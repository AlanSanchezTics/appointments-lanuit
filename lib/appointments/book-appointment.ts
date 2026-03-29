import { Prisma } from "@prisma/client";
import { getBookableMonthConfig } from "@/lib/active-months/service";
import { getAvailableStartSlots } from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import {
  acquireBookingLocks,
  cleanupExpiredReservationLocks,
  deleteReservationLockByToken,
  findReservationLockByTokenForUpdate,
  lockConflictingAppointments,
  releaseBookingLocks,
} from "@/lib/db/appointments";
import { prisma } from "@/lib/db/prisma";
import { isFutureDateTime } from "@/lib/datetime/mexico-city";
import {
  bookingSchema,
  confirmBookingWithLockSchema,
  validateBookingRules,
} from "@/lib/validation/appointment";
import { getWhatsappPhone } from "@/lib/whatsapp/message";

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return {
    monthStart,
    monthEndExclusive,
  };
}

async function hasActiveFutureAppointmentInMonth(
  tx: Prisma.TransactionClient,
  input: { phone: string; month: string },
  now: Date,
) {
  const { monthStart, monthEndExclusive } = getMonthRange(input.month);
  const appointments = await tx.appointment.findMany({
    where: {
      client: {
        phone: input.phone,
      },
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    select: {
      date: true,
      timeSlot: true,
    },
  });

  return appointments.some((appointment) =>
    isFutureDateTime(
      appointment.date.toISOString().slice(0, 10),
      appointment.timeSlot.toISOString().slice(11, 16),
      now,
    ));
}

async function resolveClientInTransaction(
  tx: Prisma.TransactionClient,
  input: { phone: string; name?: string | undefined },
) {
  const normalizedName = input.name?.trim();

  if (normalizedName) {
    const client = await tx.client.upsert({
      where: {
        phone: input.phone,
      },
      create: {
        phone: input.phone,
        name: normalizedName,
      },
      update: {},
    });

    if (client.name !== normalizedName) {
      throw new Error("CLIENT_NAME_MISMATCH");
    }

    return client;
  }

  const client = await tx.client.findUnique({
    where: {
      phone: input.phone,
    },
  });

  if (!client) {
    throw new Error("NAME_REQUIRED_FOR_NEW_CLIENT");
  }

  return client;
}

async function createAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: { phone: string; date: string; timeSlot: string; name?: string },
  baseSlots: readonly string[],
  now: Date,
) {
  await lockConflictingAppointments(tx, input.date, input.phone);

  const hasFutureInTargetMonth = await hasActiveFutureAppointmentInMonth(
    tx,
    {
      phone: input.phone,
      month: input.date.slice(0, 7),
    },
    now,
  );

  if (hasFutureInTargetMonth) {
    throw new Error("PHONE_ALREADY_BOOKED");
  }

  const occupied = await tx.appointment.findMany({
    where: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
    },
    select: {
      timeSlot: true,
    },
  });

  const occupiedSlots = occupied.map((item) => item.timeSlot.toISOString().slice(11, 16));
  const availableSlots = getAvailableStartSlots(baseSlots, occupiedSlots);

  if (!availableSlots.includes(input.timeSlot)) {
    throw new Error("SLOT_NOT_AVAILABLE");
  }

  const client = await resolveClientInTransaction(tx, {
    phone: input.phone,
    name: input.name,
  });

  return tx.appointment.create({
    data: {
      clientId: client.id,
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: timeSlotToDate(input.timeSlot),
      status: "CONFIRMED",
    },
    include: {
      client: {
        select: {
          name: true,
        },
      },
    },
  });
}

async function finalizeAppointment(input: { appointmentId: number; date: string; name: string; timeSlot: string }) {
  const syncResult = await syncAppointmentToCalendar(input);

  return {
    appointmentId: input.appointmentId,
    status: syncResult.status,
    syncReason: "reason" in syncResult ? syncResult.reason : undefined,
    whatsappPhone: getWhatsappPhone(),
    whatsappData: {
      name: input.name,
      date: input.date,
      timeSlot: input.timeSlot,
    },
  };
}

export async function bookAppointment(rawInput: unknown, now = new Date()) {
  const input = validateBookingRules(bookingSchema.parse(rawInput), now);
  const monthConfig = await getBookableMonthConfig(input.date.slice(0, 7), now);
  const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);

  const appointment = await prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, input.date, input.phone);

    try {
      return createAppointmentInTransaction(tx, input, baseSlots, now);
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return finalizeAppointment({
    appointmentId: appointment.id,
    date: input.date,
    name: appointment.client.name,
    timeSlot: input.timeSlot,
  });
}

export async function confirmAppointmentWithLock(rawInput: unknown, now = new Date()) {
  const payload =
    typeof rawInput === "object" && rawInput !== null && "lockToken" in rawInput
      ? (rawInput as { lockToken?: unknown })
      : { lockToken: undefined };

  const lockToken = typeof payload.lockToken === "string" ? payload.lockToken.trim() : "";

  if (!lockToken) {
    throw new Error("LOCK_TOKEN_REQUIRED");
  }

  const input = validateBookingRules(confirmBookingWithLockSchema.parse(rawInput), now);
  const monthConfig = await getBookableMonthConfig(input.date.slice(0, 7), now);
  const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);

  const appointment = await prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, input.date, input.phone);

    try {
      await cleanupExpiredReservationLocks(tx, now);

      const lock = await findReservationLockByTokenForUpdate(tx, lockToken);

      if (!lock) {
        throw new Error("LOCK_EXPIRED_OR_INVALID");
      }

      if (lock.expiresAt <= now.toISOString()) {
        throw new Error("LOCK_EXPIRED_OR_INVALID");
      }

      if (lock.date !== input.date || lock.timeSlot !== input.timeSlot || lock.phone !== input.phone) {
        throw new Error("LOCK_EXPIRED_OR_INVALID");
      }

      const created = await createAppointmentInTransaction(tx, input, baseSlots, now);
      await deleteReservationLockByToken(tx, lockToken);

      return created;
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return finalizeAppointment({
    appointmentId: appointment.id,
    date: input.date,
    name: appointment.client.name,
    timeSlot: input.timeSlot,
  });
}
