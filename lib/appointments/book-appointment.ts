import type { AppointmentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { getBookableMonthConfig } from "@/lib/active-months/service";
import { resolveDay } from "@/lib/availability/resolver";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";
import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
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
import { findMonthAvailabilityForShare } from "@/lib/db/availability-rules";
import { listBlockedSlotsByDateForUpdate } from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import { isFutureDateTime } from "@/lib/datetime/mexico-city";
import { createClientWithUniqueClientNumber } from "@/lib/clients/client-number-service";
import {
  areEquivalentClientNames,
  normalizeClientName,
} from "@/lib/shared/client-name";
import { createAppointmentLogEvent } from "@/lib/admin/appointment-logs/service";
import {
  bookingSchema,
  confirmBookingWithLockSchema,
  validateBookingRules,
} from "@/lib/validation/appointment";
import { getWhatsappPhone } from "@/lib/whatsapp/message";

type AppointmentCreationStatus = "CONFIRMED" | "PENDING";

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

// PD-08 / R-06: se llama dentro de la transacción, después de acquireBookingLocks (FOR SHARE).
async function readMonthRulesInTransaction(tx: Prisma.TransactionClient, month: string) {
  const config = await findMonthAvailabilityForShare(tx, month);

  if (!config) {
    throw new Error("MONTH_NOT_ALLOWED");
  }

  return config;
}

// D46: un día sin horarios ofrecibles deja slots vacíos, así que el horario pedido responde SLOT_NOT_AVAILABLE.
function resolveOfferedSlots(
  config: MonthAvailabilityConfig,
  input: {
    date: string;
    now: Date;
    occupiedSlots: string[];
    blockedTimeSlots: string[];
  },
) {
  // D54/D55: "00:00" en bloqueos es el centinela de día completo, no una hora.
  const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(input.blockedTimeSlots);

  return resolveDay(config, input.date, {
    now: input.now,
    occupancy: {
      occupiedTimes: input.occupiedSlots,
      blockedTimes: Array.from(blockedSlots),
      fullDayBlocked: hasFullDayBlock,
    },
  }).slots;
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
  config: MonthAvailabilityConfig,
  now: Date,
) {
  await lockConflictingAppointments(tx, input.date, input.phone);

  const [occupied, blockedSlots] = await Promise.all([
    tx.appointment.findMany({
      where: {
        date: new Date(`${input.date}T00:00:00.000Z`),
        status: {
          in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
        },
      },
      select: {
        timeSlot: true,
      },
    }),
    listBlockedSlotsByDateForUpdate(tx, input.date),
  ]);

  const occupiedSlots = occupied.map((item) =>
    item.timeSlot.toISOString().slice(11, 16),
  );
  const offeredSlots = resolveOfferedSlots(config, {
    date: input.date,
    now,
    occupiedSlots,
    blockedTimeSlots: blockedSlots.map((slot) => slot.timeSlot),
  });

  if (!offeredSlots.includes(input.timeSlot)) {
    throw new Error("SLOT_NOT_AVAILABLE");
  }

  const client = await resolveClientInTransaction(tx, {
    phone: input.phone,
    name: input.name,
  });
  const status: AppointmentCreationStatus =
    input.status ?? (client.isLoyal ? "CONFIRMED" : "PENDING");

  const appointment = await tx.appointment.create({
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

  await createAppointmentLogEvent(tx, {
    appointmentId: appointment.id,
    actionType: status,
    actor: {
      type: "CLIENT",
    },
    clientId: client.id,
    payload: {
      appointment: {
        date: input.date,
        timeSlot: input.timeSlot,
      },
    },
  });

  return appointment;
}

async function rescheduleAppointmentInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    appointmentIdToReschedule: number;
    phone: string;
    date: string;
    timeSlot: string;
  },
  config: MonthAvailabilityConfig,
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
      // D95: PENDING también puede reprogramarse desde la sugerencia del umbral.
      status: {
        in: ["PENDING", "CONFIRMED", "SYNC_FAILED"],
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

  const [occupied, blockedSlots] = await Promise.all([
    tx.appointment.findMany({
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
    }),
    listBlockedSlotsByDateForUpdate(tx, input.date),
  ]);

  const occupiedSlots = occupied.map((item) =>
    item.timeSlot.toISOString().slice(11, 16),
  );
  const offeredSlots = resolveOfferedSlots(config, {
    date: input.date,
    now,
    occupiedSlots,
    blockedTimeSlots: blockedSlots.map((slot) => slot.timeSlot),
  });

  if (!offeredSlots.includes(input.timeSlot)) {
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

  // D95: una cita PENDING reprogramada sigue PENDING, sin evento de calendario y con bitácora MODIFIED (como Mi cita).
  if (appointmentToReschedule.status === "PENDING") {
    await createAppointmentLogEvent(tx, {
      appointmentId: appointmentToReschedule.id,
      actionType: "MODIFIED",
      actor: {
        type: "CLIENT",
      },
      clientId: appointmentToReschedule.clientId,
      payload: {
        appointment: {
          date: input.date,
          timeSlot: input.timeSlot,
        },
        previous: {
          date: currentDate,
          timeSlot: currentTimeSlot,
        },
        next: {
          date: input.date,
          timeSlot: input.timeSlot,
        },
      },
    });
  }

  await deleteReservationLockByToken(tx, lockToken);

  return {
    appointmentId: appointmentToReschedule.id,
    name: appointmentToReschedule.client.name,
    status: appointmentToReschedule.status,
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
  status: AppointmentStatus;
  previousGoogleEventId: string | null;
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
  await getBookableMonthConfig(input.date.slice(0, 7), now);

  const appointment = await prisma.$transaction(async (tx) => {
    try {
      // NB-3 (D65): los locks dentro del try para que el finally los libere si fallan a mitad.
      await acquireBookingLocks(tx, input.date, input.phone);
      const config = await readMonthRulesInTransaction(tx, input.date.slice(0, 7));

      // NB-2 (D65): sin await, el finally liberaba los locks antes de que terminara la inserción.
      return await createAppointmentInTransaction(
        tx,
        {
          ...input,
          status: "CONFIRMED",
        },
        config,
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
  await getBookableMonthConfig(input.date.slice(0, 7), now);

  const result = await prisma.$transaction(async (tx) => {
    try {
      // NB-3 (D65): locks dentro del try.
      await acquireBookingLocks(tx, input.date, input.phone);
      const config = await readMonthRulesInTransaction(tx, input.date.slice(0, 7));
      // D89: conflictos de citas antes de tocar RL (la limpieza y la lectura por token van después).
      await lockConflictingAppointments(tx, input.date, input.phone);
      await cleanupExpiredReservationLocks(tx, input.date, now);

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
          config,
          now,
          lockToken,
        );

        return {
          type: "rescheduled" as const,
          appointmentId: rescheduled.appointmentId,
          name: rescheduled.name,
          status: rescheduled.status,
          previousGoogleEventId: rescheduled.previousGoogleEventId,
        };
      }

      const created = await createAppointmentInTransaction(tx, input, config, now);
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
      status: result.status,
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
