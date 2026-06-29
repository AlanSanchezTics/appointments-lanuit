import { Prisma } from "@prisma/client";
import type { AppointmentStatus } from "@prisma/client";

import { getBookableMonthConfig } from "@/lib/active-months/service";
import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import {
  createAppointmentLogEvent,
  createAppointmentLogEvents,
} from "@/lib/admin/appointment-logs/service";
import { updateCalendarEvent, createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar/google";
import { SLOT_BLOCKING_APPOINTMENT_STATUSES } from "@/lib/constants/appointment-statuses";
import {
  getCurrentDateKey,
  isFutureDateTime,
  isWeekdayInMexicoCity,
} from "@/lib/datetime/mexico-city";
import { prisma } from "@/lib/db/prisma";
import { listBlockedSlotsByDateForUpdate } from "@/lib/db/blocked-slots";
import { getAvailableStartSlotsWithManualBlocks } from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import {
  canCancelPublicAppointment,
  canModifyPublicAppointment,
  getHoursUntilAppointment,
  getPublicAppointmentBlockedReason,
  isPublicAppointmentFuture,
} from "@/lib/my-appointments/rules";
import type {
  MyAppointmentLookupItem,
  MyAppointmentsCancelResult,
  MyAppointmentsLookupResult,
  MyAppointmentsRescheduleResult,
} from "@/lib/my-appointments/types";
import {
  myAppointmentsCancelSchema,
  myAppointmentsLookupSchema,
  myAppointmentsRescheduleSchema,
} from "@/lib/validation/my-appointments";

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

function toPublicLookupStatus(status: AppointmentStatus): MyAppointmentLookupItem["status"] {
  if (status === "PENDING" || status === "CONFIRMED" || status === "SYNC_FAILED") {
    return status;
  }

  throw new Error("INVALID_APPOINTMENT_STATUS");
}

async function listFutureAppointmentsByPhone(phone: string, now = new Date()) {
  const currentDate = getCurrentDateKey(now);
  const records = await prisma.appointment.findMany({
    where: {
      client: {
        phone,
      },
      status: {
        in: ["PENDING", "CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${currentDate}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: {
      client: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
  });

  return records
    .map((record) => ({
      appointmentId: record.id,
      name: record.client.name,
      phone: record.client.phone,
      date: dateToDateKey(record.date),
      timeSlot: timeToTimeSlotKey(record.timeSlot),
      status: toPublicLookupStatus(record.status),
    }))
    .filter((appointment) => isPublicAppointmentFuture(appointment, now));
}

async function findPublicAppointmentsByIdsForUpdate(
  tx: Prisma.TransactionClient,
  input: { phone: string; appointmentIds: number[] },
  now = new Date(),
) {
  if (input.appointmentIds.length === 0) {
    return [];
  }

  const ids = Prisma.join(input.appointmentIds);
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      client_id: number;
      name: string;
      phone: string;
      date: Date;
      time_slot: Date;
      status: "PENDING" | "CONFIRMED" | "SYNC_FAILED";
      google_event_id: string | null;
    }>
  >`
    SELECT a.id, a.client_id, c.name, c.phone, a.date, a.time_slot, a.status, a.google_event_id
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE a.id IN (${ids})
      AND c.phone = ${input.phone}
      AND a.status IN ('PENDING', 'CONFIRMED', 'SYNC_FAILED')
      AND a.date >= ${getCurrentDateKey(now)}
    ORDER BY a.date ASC, a.time_slot ASC
    FOR UPDATE
  `;

  return records.map((record) => ({
    id: record.id,
    clientId: record.client_id,
    name: record.name,
    phone: record.phone,
    date: dateToDateKey(record.date),
    timeSlot: timeToTimeSlotKey(record.time_slot),
    status: record.status,
    googleEventId: record.google_event_id,
  }));
}

async function findAppointmentForRescheduleForUpdate(
  tx: Prisma.TransactionClient,
  input: { appointmentId: number; phone: string },
) {
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      client_id: number;
      name: string;
      phone: string;
      date: Date;
      time_slot: Date;
      status: "PENDING" | "CONFIRMED" | "SYNC_FAILED";
      google_event_id: string | null;
    }>
  >`
    SELECT a.id, a.client_id, c.name, c.phone, a.date, a.time_slot, a.status, a.google_event_id
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE a.id = ${input.appointmentId}
      AND c.phone = ${input.phone}
      AND a.status IN ('PENDING', 'CONFIRMED', 'SYNC_FAILED')
    LIMIT 1
    FOR UPDATE
  `;

  const record = records[0];

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    clientId: record.client_id,
    name: record.name,
    phone: record.phone,
    date: dateToDateKey(record.date),
    timeSlot: timeToTimeSlotKey(record.time_slot),
    status: record.status,
    googleEventId: record.google_event_id,
  };
}

export async function findMyAppointments(
  rawInput: unknown,
  now = new Date(),
): Promise<MyAppointmentsLookupResult> {
  const input = myAppointmentsLookupSchema.parse(rawInput);
  const appointments = await listFutureAppointmentsByPhone(input.phone, now);

  if (appointments.length === 0) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  return {
    appointments: appointments.map((appointment) => {
      const canCancel = canCancelPublicAppointment(appointment, now);
      const canModify = canModifyPublicAppointment(appointment, now);
      const blockedReason = getPublicAppointmentBlockedReason({
        canCancel,
        canModify,
      });

      return {
        ...appointment,
        canCancel,
        canModify,
        isBlocked: !(canCancel || canModify),
        ...(blockedReason ? { blockedReason } : {}),
      };
    }),
  };
}

export async function cancelMyAppointments(
  rawInput: unknown,
  now = new Date(),
): Promise<MyAppointmentsCancelResult> {
  const input = myAppointmentsCancelSchema.parse(rawInput);
  const selectedIds = Array.from(new Set(input.appointmentIds));

  const appointments = await prisma.$transaction(async (tx) => {
    const lockedAppointments = await findPublicAppointmentsByIdsForUpdate(
      tx,
      {
        phone: input.phone,
        appointmentIds: selectedIds,
      },
      now,
    );

    if (lockedAppointments.length !== selectedIds.length) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    if (
      lockedAppointments.some(
        (appointment) =>
          !canCancelPublicAppointment(
            {
              ...appointment,
              status: appointment.status,
            },
            now,
          ),
      )
    ) {
      throw new Error("APPOINTMENT_IS_COMING_SOON");
    }

    await tx.appointment.updateMany({
      where: {
        id: {
          in: lockedAppointments.map((appointment) => appointment.id),
        },
      },
      data: {
        status: "CANCELLED",
      },
    });

    await createAppointmentLogEvents(
      tx,
      lockedAppointments.map((appointment) => ({
        appointmentId: appointment.id,
        actionType: "CANCELLED",
        actor: {
          type: "CLIENT" as const,
        },
        clientId: appointment.clientId,
        payload: {
          appointment: {
            date: appointment.date,
            timeSlot: appointment.timeSlot,
          },
        },
      })),
    );

    return lockedAppointments;
  });

  const cancelledAppointments: MyAppointmentsCancelResult["cancelledAppointments"] = [];

  for (const appointment of appointments) {
    if (!appointment.googleEventId) {
      cancelledAppointments.push({
        appointmentId: appointment.id,
        status: "CANCELLED",
      });
      continue;
    }

    try {
      await deleteCalendarEvent(appointment.googleEventId);

      await prisma.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          googleEventId: null,
        },
      });

      cancelledAppointments.push({
        appointmentId: appointment.id,
        status: "CANCELLED",
      });
    } catch {
      cancelledAppointments.push({
        appointmentId: appointment.id,
        status: "CANCELLED",
        syncReason: "CALENDAR_DELETE_FAILED",
      });
    }
  }

  return {
    cancelledAppointments,
  };
}

async function validateRescheduleDestination(
  input: {
    month: string;
    date: string;
    timeSlot: string;
    appointmentId: number;
  },
  tx: Prisma.TransactionClient,
  now = new Date(),
) {
  try {
    if (input.date.slice(0, 7) !== input.month) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    if (!isFutureDateTime(input.date, input.timeSlot, now)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    if (!isWeekdayInMexicoCity(input.date)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    const monthConfig = await getBookableMonthConfig(input.month);
    const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);
    const [occupiedAppointments, blockedSlots] = await Promise.all([
      tx.appointment.findMany({
        where: {
          date: new Date(`${input.date}T00:00:00.000Z`),
          status: {
            in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
          },
          id: {
            not: input.appointmentId,
          },
        },
        select: {
          timeSlot: true,
        },
      }),
      listBlockedSlotsByDateForUpdate(tx, input.date),
    ]);

    const occupiedSlots = occupiedAppointments.map((record) =>
      record.timeSlot.toISOString().slice(11, 16),
    );
    const blockedTimeSlots = blockedSlots.map((slot) => slot.timeSlot);
    const { hasFullDayBlock, blockedSlots: blockedSlotsSet } =
      splitBlockedTimeSlots(blockedTimeSlots);

    if (hasFullDayBlock) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    const availableSlots = getAvailableStartSlotsWithManualBlocks(
      baseSlots,
      occupiedSlots,
      Array.from(blockedSlotsSet),
      monthConfig.slotMode,
    );

    if (!availableSlots.some((slot) => slot === input.timeSlot)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_NOT_AVAILABLE") {
      throw error;
    }

    throw new Error("SLOT_NOT_AVAILABLE");
  }
}

export async function rescheduleMyAppointment(
  rawInput: unknown,
  now = new Date(),
): Promise<MyAppointmentsRescheduleResult> {
  const input = myAppointmentsRescheduleSchema.parse(rawInput);

  const source = await prisma.$transaction(async (tx) => {
    const current = await findAppointmentForRescheduleForUpdate(tx, {
      appointmentId: input.appointmentId,
      phone: input.phone,
    });

    if (!current) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    if (!isPublicAppointmentFuture(current, now)) {
      throw new Error("APPOINTMENT_NOT_MODIFIABLE");
    }

    if (getHoursUntilAppointment(current, now) < 3) {
      throw new Error("APPOINTMENT_NOT_MODIFIABLE");
    }

    await validateRescheduleDestination(
      {
        month: input.month,
        date: input.date,
        timeSlot: input.timeSlot,
        appointmentId: current.id,
      },
      tx,
      now,
    );

    await tx.appointment.update({
      where: {
        id: current.id,
      },
      data: {
        date: new Date(`${input.date}T00:00:00.000Z`),
        timeSlot: timeSlotToDate(input.timeSlot),
        googleEventId: current.status === "PENDING" ? null : current.googleEventId,
      },
    });

    await createAppointmentLogEvent(tx, {
      appointmentId: current.id,
      actionType: "MODIFIED",
      actor: {
        type: "CLIENT",
      },
      clientId: current.clientId,
      payload: {
        appointment: {
          date: input.date,
          timeSlot: input.timeSlot,
        },
        previous: {
          date: current.date,
          timeSlot: current.timeSlot,
        },
        next: {
          date: input.date,
          timeSlot: input.timeSlot,
        },
      },
    });

    return current;
  });

  if (source.status === "PENDING") {
    return {
      appointmentId: source.id,
      status: "PENDING",
      googleEventId: null,
    };
  }

  if (source.googleEventId) {
    try {
      await updateCalendarEvent({
        eventId: source.googleEventId,
        name: source.name,
        date: input.date,
        timeSlot: input.timeSlot,
      });

      await prisma.appointment.update({
        where: {
          id: source.id,
        },
        data: {
          status: "CONFIRMED",
          googleEventId: source.googleEventId,
        },
      });

      return {
        appointmentId: source.id,
        status: "CONFIRMED",
        googleEventId: source.googleEventId,
      };
    } catch {
      await prisma.appointment.update({
        where: {
          id: source.id,
        },
        data: {
          status: "SYNC_FAILED",
        },
      });

      return {
        appointmentId: source.id,
        status: "SYNC_FAILED",
        syncReason: "CALENDAR_SYNC_FAILED",
        googleEventId: source.googleEventId,
      };
    }
  }

  try {
    const googleEventId = await createCalendarEvent({
      name: source.name,
      date: input.date,
      timeSlot: input.timeSlot,
    });

    await prisma.appointment.update({
      where: {
        id: source.id,
      },
      data: {
        status: "CONFIRMED",
        googleEventId,
      },
    });

    return {
      appointmentId: source.id,
      status: "CONFIRMED",
      googleEventId,
    };
  } catch {
    await prisma.appointment.update({
      where: {
        id: source.id,
      },
      data: {
        status: "SYNC_FAILED",
      },
    });

    return {
      appointmentId: source.id,
      status: "SYNC_FAILED",
      syncReason: "CALENDAR_SYNC_FAILED",
      googleEventId: null,
    };
  }
}
