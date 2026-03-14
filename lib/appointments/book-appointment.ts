import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { Prisma } from "@prisma/client";
import { getAvailableStartSlots } from "@/lib/availability/rules";
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
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { bookingSchema, validateBookingRules } from "@/lib/validation/appointment";
import { buildWhatsappUrl } from "@/lib/whatsapp/message";

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

async function createAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: { name: string; phone: string; date: string; timeSlot: string },
  currentDate: string,
) {
  await lockConflictingAppointments(tx, input.date, input.phone);

  const activeAppointment = await tx.appointment.findFirst({
    where: {
      phone: input.phone,
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gt: new Date(`${currentDate}T00:00:00.000Z`),
      },
    },
    select: {
      id: true,
    },
  });

  if (activeAppointment) {
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
  const availableSlots = getAvailableStartSlots(BASE_TIME_SLOTS, occupiedSlots);

  if (!availableSlots.includes(input.timeSlot)) {
    throw new Error("SLOT_NOT_AVAILABLE");
  }

  return tx.appointment.create({
    data: {
      name: input.name,
      phone: input.phone,
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: timeSlotToDate(input.timeSlot),
      status: "CONFIRMED",
    },
  });
}

async function finalizeAppointment(input: { appointmentId: number; date: string; name: string; timeSlot: string }) {
  const syncResult = await syncAppointmentToCalendar(input);

  return {
    appointmentId: input.appointmentId,
    status: syncResult.status,
    syncReason: "reason" in syncResult ? syncResult.reason : undefined,
    whatsappUrl: buildWhatsappUrl({
      name: input.name,
      date: input.date,
      timeSlot: input.timeSlot,
    }),
  };
}

export async function bookAppointment(rawInput: unknown, now = new Date()) {
  const input = validateBookingRules(bookingSchema.parse(rawInput), now);
  const currentDate = getCurrentDateKey(now);

  const appointment = await prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, input.date, input.phone);

    try {
      return createAppointmentInTransaction(tx, input, currentDate);
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return finalizeAppointment({
    appointmentId: appointment.id,
    date: input.date,
    name: input.name,
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

  const input = validateBookingRules(bookingSchema.parse(rawInput), now);
  const currentDate = getCurrentDateKey(now);

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

      const created = await createAppointmentInTransaction(tx, input, currentDate);
      await deleteReservationLockByToken(tx, lockToken);

      return created;
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return finalizeAppointment({
    appointmentId: appointment.id,
    date: input.date,
    name: input.name,
    timeSlot: input.timeSlot,
  });
}
