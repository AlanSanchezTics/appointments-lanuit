import { Prisma } from "@prisma/client";

import { getBookableMonthConfig } from "@/lib/active-months/service";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import { getAvailableStartSlots } from "@/lib/availability/rules";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar/google";
import { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import { SLOT_BLOCKING_APPOINTMENT_STATUSES } from "@/lib/constants/appointment-statuses";
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
import { createClientWithUniqueClientNumber } from "@/lib/clients/client-number-service";
import {
  areEquivalentClientNames,
  normalizeClientName,
} from "@/lib/shared/client-name";
import {
  bookingSchema,
  confirmBookingWithLockSchema,
  validateBookingRules,
} from "@/lib/validation/appointment";
import { getWhatsappPhone } from "@/lib/whatsapp/message";

const MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS = 15;
type AppointmentCreationStatus = "CONFIRMED" | "PENDING";

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);

  return {
    monthStart,
    monthEndExclusive,
  };
}

function getNaturalDayDifference(dateA: string, dateB: string) {
  const [yearA, monthA, dayA] = dateA.split("-").map(Number);
  const [yearB, monthB, dayB] = dateB.split("-").map(Number);
  const utcA = Date.UTC(yearA, monthA - 1, dayA);
  const utcB = Date.UTC(yearB, monthB - 1, dayB);
  return Math.abs(Math.floor((utcB - utcA) / (24 * 60 * 60 * 1000)));
}

type FutureAppointmentInMonth = {
  appointmentId: number;
  date: string;
  timeSlot: string;
};

function hasInsufficientDayGap(
  candidateDate: string,
  futureAppointmentsInMonth: FutureAppointmentInMonth[],
) {
  return futureAppointmentsInMonth.some(
    (appointment) =>
      getNaturalDayDifference(candidateDate, appointment.date)
      < MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS,
  );
}

async function listActiveFutureAppointmentsInMonth(
  tx: Prisma.TransactionClient,
  input: { phone: string; month: string; excludeAppointmentId?: number },
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
      ...(typeof input.excludeAppointmentId === "number"
        ? { id: { not: input.excludeAppointmentId } }
        : {}),
    },
    select: {
      id: true,
      date: true,
      timeSlot: true,
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return appointments
    .map((appointment) => ({
      appointmentId: appointment.id,
      date: appointment.date.toISOString().slice(0, 10),
      timeSlot: appointment.timeSlot.toISOString().slice(11, 16),
    }))
    .filter((appointment) =>
      isFutureDateTime(appointment.date, appointment.timeSlot, now),
    ) satisfies FutureAppointmentInMonth[];
}

async function resolveClientInTransaction(
  tx: Prisma.TransactionClient,
  input: { phone: string; name?: string | undefined },
) {
  const normalizedName =
    typeof input.name === "string" ? normalizeClientName(input.name) : undefined;

  if (normalizedName) {
    const existingClient = await tx.client.findUnique({
      where: {
        phone: input.phone,
      },
    });

    if (existingClient) {
      if (!areEquivalentClientNames(existingClient.name, normalizedName)) {
        throw new Error("CLIENT_NAME_MISMATCH");
      }

      return existingClient;
    }

    const client = await createClientWithUniqueClientNumber(tx, {
      phone: input.phone,
      name: normalizedName,
    });

    if (!areEquivalentClientNames(client.name, normalizedName)) {
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
  input: {
    phone: string;
    date: string;
    timeSlot: string;
    name?: string;
    status?: AppointmentCreationStatus;
  },
  baseSlots: readonly string[],
  now: Date,
) {
  await lockConflictingAppointments(tx, input.date, input.phone);

  const futureAppointmentsInTargetMonth = await listActiveFutureAppointmentsInMonth(
    tx,
    {
      phone: input.phone,
      month: input.date.slice(0, 7),
    },
    now,
  );

  if (hasInsufficientDayGap(input.date, futureAppointmentsInTargetMonth)) {
    throw new Error("PHONE_ALREADY_BOOKED");
  }

  const occupied = await tx.appointment.findMany({
    where: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      status: {
        in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
      },
    },
    select: {
      timeSlot: true,
    },
  });

  const occupiedSlots = occupied.map((item) =>
    item.timeSlot.toISOString().slice(11, 16),
  );
  const availableSlots = getAvailableStartSlots(baseSlots, occupiedSlots);

  if (!availableSlots.includes(input.timeSlot)) {
    throw new Error("SLOT_NOT_AVAILABLE");
  }

  const client = await resolveClientInTransaction(tx, {
    phone: input.phone,
    name: input.name,
  });
  const status: AppointmentCreationStatus =
    input.status ?? (client.isLoyal ? "CONFIRMED" : "PENDING");

  return tx.appointment.create({
    data: {
      clientId: client.id,
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: timeSlotToDate(input.timeSlot),
      status,
    },
    include: {
      client: {
        select: {
          name: true,
          isLoyal: true,
        },
      },
    },
  });
}

async function rescheduleAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    appointmentIdToReschedule: number;
    phone: string;
    date: string;
    timeSlot: string;
  },
  baseSlots: readonly string[],
  now: Date,
  lockToken: string,
) {
  await lockConflictingAppointments(tx, input.date, input.phone);

  const { monthStart, monthEndExclusive } = getMonthRange(input.date.slice(0, 7));

  const appointmentToReschedule = await tx.appointment.findFirst({
    where: {
      id: input.appointmentIdToReschedule,
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
    include: {
      client: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!appointmentToReschedule) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const currentDate = appointmentToReschedule.date.toISOString().slice(0, 10);
  const currentTimeSlot = appointmentToReschedule.timeSlot
    .toISOString()
    .slice(11, 16);

  if (!isFutureDateTime(currentDate, currentTimeSlot, now)) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const futureAppointmentsInTargetMonth = await listActiveFutureAppointmentsInMonth(
    tx,
    {
      phone: input.phone,
      month: input.date.slice(0, 7),
      excludeAppointmentId: appointmentToReschedule.id,
    },
    now,
  );

  if (hasInsufficientDayGap(input.date, futureAppointmentsInTargetMonth)) {
    throw new Error("PHONE_ALREADY_BOOKED");
  }

  const occupied = await tx.appointment.findMany({
    where: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      status: {
        in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
      },
      id: {
        not: appointmentToReschedule.id,
      },
    },
    select: {
      timeSlot: true,
    },
  });

  const occupiedSlots = occupied.map((item) =>
    item.timeSlot.toISOString().slice(11, 16),
  );
  const availableSlots = getAvailableStartSlots(baseSlots, occupiedSlots);

  if (!availableSlots.includes(input.timeSlot)) {
    throw new Error("SLOT_NOT_AVAILABLE");
  }

  await tx.appointment.update({
    where: {
      id: appointmentToReschedule.id,
    },
    data: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: timeSlotToDate(input.timeSlot),
    },
  });

  await deleteReservationLockByToken(tx, lockToken);

  return {
    appointmentId: appointmentToReschedule.id,
    name: appointmentToReschedule.client.name,
    previousGoogleEventId: appointmentToReschedule.googleEventId,
  };
}

async function finalizeCreatedAppointment(input: {
  appointmentId: number;
  date: string;
  name: string;
  timeSlot: string;
  status: AppointmentCreationStatus;
}) {
  if (input.status === "PENDING") {
    return {
      appointmentId: input.appointmentId,
      status: "PENDING" as const,
      whatsappPhone: getWhatsappPhone(),
      whatsappData: {
        name: input.name,
        date: input.date,
        timeSlot: input.timeSlot,
      },
    };
  }

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

async function finalizeRescheduledAppointment(input: {
  appointmentId: number;
  date: string;
  name: string;
  timeSlot: string;
  previousGoogleEventId: string | null;
}) {
  if (input.previousGoogleEventId) {
    try {
      await deleteCalendarEvent(input.previousGoogleEventId);
    } catch {
      // non-blocking
    }
  }

  try {
    const googleEventId = await createCalendarEvent({
      name: input.name,
      date: input.date,
      timeSlot: input.timeSlot,
    });

    await prisma.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        googleEventId,
        status: "CONFIRMED",
      },
    });

    return {
      appointmentId: input.appointmentId,
      status: "CONFIRMED" as const,
      whatsappPhone: getWhatsappPhone(),
      whatsappData: {
        name: input.name,
        date: input.date,
        timeSlot: input.timeSlot,
      },
    };
  } catch {
    await prisma.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        googleEventId: null,
        status: "SYNC_FAILED",
      },
    });

    return {
      appointmentId: input.appointmentId,
      status: "SYNC_FAILED" as const,
      syncReason: "CALENDAR_SYNC_FAILED",
      whatsappPhone: getWhatsappPhone(),
      whatsappData: {
        name: input.name,
        date: input.date,
        timeSlot: input.timeSlot,
      },
    };
  }
}

export async function bookAppointment(rawInput: unknown, now = new Date()) {
  const input = validateBookingRules(bookingSchema.parse(rawInput), now);
  const monthConfig = await getBookableMonthConfig(input.date.slice(0, 7), now);
  const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);

  const appointment = await prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, input.date, input.phone);

    try {
      return createAppointmentInTransaction(
        tx,
        {
          ...input,
          status: "CONFIRMED",
        },
        baseSlots,
        now,
      );
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return finalizeCreatedAppointment({
    appointmentId: appointment.id,
    date: input.date,
    name: appointment.client.name,
    timeSlot: input.timeSlot,
    status: "CONFIRMED",
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

  const input = validateBookingRules(
    confirmBookingWithLockSchema.parse(rawInput),
    now,
  );
  const monthConfig = await getBookableMonthConfig(input.date.slice(0, 7), now);
  const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);

  const result = await prisma.$transaction(async (tx) => {
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

      if (
        lock.date !== input.date
        || lock.timeSlot !== input.timeSlot
        || lock.phone !== input.phone
      ) {
        throw new Error("LOCK_EXPIRED_OR_INVALID");
      }

      if (typeof input.appointmentIdToReschedule === "number") {
        const rescheduled = await rescheduleAppointmentInTransaction(
          tx,
          {
            appointmentIdToReschedule: input.appointmentIdToReschedule,
            phone: input.phone,
            date: input.date,
            timeSlot: input.timeSlot,
          },
          baseSlots,
          now,
          lockToken,
        );

        return {
          type: "rescheduled" as const,
          appointmentId: rescheduled.appointmentId,
          name: rescheduled.name,
          previousGoogleEventId: rescheduled.previousGoogleEventId,
        };
      }

      const created = await createAppointmentInTransaction(tx, input, baseSlots, now);
      await deleteReservationLockByToken(tx, lockToken);

      return {
        type: "created" as const,
        appointmentId: created.id,
        name: created.client.name,
        status: created.status as AppointmentCreationStatus,
      };
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  if (result.type === "rescheduled") {
    return finalizeRescheduledAppointment({
      appointmentId: result.appointmentId,
      date: input.date,
      name: result.name,
      timeSlot: input.timeSlot,
      previousGoogleEventId: result.previousGoogleEventId,
    });
  }

  return finalizeCreatedAppointment({
    appointmentId: result.appointmentId,
    date: input.date,
    name: result.name,
    timeSlot: input.timeSlot,
    status: result.status,
  });
}
