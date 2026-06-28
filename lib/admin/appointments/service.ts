import { Prisma } from "@prisma/client";
import { createCalendarEvent, deleteCalendarEvent, GoogleCalendarConfigError } from "@/lib/calendar/google";
import type {
  AdminAppointmentTransitionResponse,
  AdminCancelAppointmentPayload,
  AdminCancelAppointmentResponse,
  AdminCreateAppointmentPayload,
  AdminCreateAppointmentResponse,
  AdminDayAgendaResponse,
  AdminRescheduleAppointmentPayload,
  AdminRescheduleAppointmentResponse,
} from "@/lib/admin/appointments/types";
import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import { getAvailableStartSlotsWithManualBlocks } from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import { findRegisteredMonth } from "@/lib/db/admin-months";
import {
  listActiveAppointmentSlotsByDateForUpdate,
  cancelAppointmentById,
  findActiveAppointmentByIdInMonthForUpdate,
  listActiveAppointmentsByDate,
  listActiveAppointmentsByDateExcludingForUpdate,
  updateAppointmentScheduleById,
} from "@/lib/db/admin-appointments";
import {
  acquireBookingLocks,
  cleanupExpiredReservationLocks,
  findActiveReservationLockForSlotForUpdate,
  lockConflictingAppointments,
  releaseBookingLocks,
} from "@/lib/db/appointments";
import {
  listBlockedSlotsByDate,
  listBlockedSlotsByDateForUpdate,
} from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import { validateBookingRules, bookingSchema } from "@/lib/validation/appointment";
import { isFutureDateTime } from "@/lib/datetime/mexico-city";
import { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import { createClientWithUniqueClientNumber } from "@/lib/clients/client-number-service";
import {
  createAppointmentLogEvent,
} from "@/lib/admin/appointment-logs/service";
import type { AppointmentLogActorInput } from "@/lib/admin/appointment-logs/types";
import {
  areEquivalentClientNames,
  normalizeClientAlias,
  resolveClientDisplayName,
} from "@/lib/shared/client-name";

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return {
    monthStart,
    monthEndExclusive,
  };
}

function mapCalendarErrorReason(error: unknown) {
  return error instanceof GoogleCalendarConfigError
    ? "CALENDAR_NOT_CONFIGURED"
    : "CALENDAR_SYNC_FAILED";
}

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

async function resolveClientForCreate(
  tx: Prisma.TransactionClient,
  input: AdminCreateAppointmentPayload,
) {
  if ("clientId" in input) {
    const client = await tx.client.findUnique({
      where: {
        id: input.clientId,
      },
      select: {
        id: true,
        clientNumber: true,
        name: true,
        alias: true,
        phone: true,
      },
    });

    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    return client;
  }

  const parsed = bookingSchema.parse({
    name: input.client.name,
    phone: input.client.phone,
    date: input.date,
    timeSlot: input.timeSlot,
  });

  const existingClient = await tx.client.findUnique({
    where: {
      phone: parsed.phone,
    },
    select: {
      id: true,
      clientNumber: true,
      name: true,
      alias: true,
      phone: true,
    },
  });

  const client = existingClient
    ?? await createClientWithUniqueClientNumber(tx, {
      phone: parsed.phone,
      name: parsed.name,
      preferredClientNumber: input.client.clientNumber,
      alias: normalizeClientAlias(input.client.alias),
    });

  if (!areEquivalentClientNames(client.name, parsed.name)) {
    throw new Error("CLIENT_NAME_MISMATCH");
  }

  return client;
}

export async function getAdminDayAgenda(input: {
  month: string;
  date: string;
}): Promise<AdminDayAgendaResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const [appointments, blockedSlots] = await Promise.all([
    listActiveAppointmentsByDate(input.date),
    listBlockedSlotsByDate(input.date),
  ]);

  return {
    month: input.month,
    date: input.date,
    total: appointments.length,
    appointments: appointments.map((appointment) => ({
      appointmentId: appointment.id,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: appointment.status,
      name: resolveClientDisplayName(appointment),
      alias: appointment.alias,
      phone: appointment.phone,
    })),
    blockedSlots: blockedSlots.map((blockedSlot) => ({
      blockedSlotId: blockedSlot.id,
      date: blockedSlot.date,
      timeSlot: blockedSlot.timeSlot,
      reason: blockedSlot.reason,
    })),
  };
}

export async function createAdminAppointment(
  input: AdminCreateAppointmentPayload,
  now = new Date(),
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminCreateAppointmentResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  if (registration.status !== "ACTIVE") {
    throw new Error("MONTH_NOT_ACTIVE");
  }

  validateBookingRules(
    {
      date: input.date,
      timeSlot: input.timeSlot,
    },
    now,
  );

  const baseSlots = resolveBaseSlotsByMonthMode(registration.slotMode);

  const created = await prisma.$transaction(async (tx) => {
    const resolvedClient = await resolveClientForCreate(tx, input);
    const lockPhone = resolvedClient.phone;

    await acquireBookingLocks(tx, input.date, lockPhone);

    try {
      await cleanupExpiredReservationLocks(tx, now);
      await lockConflictingAppointments(tx, input.date, lockPhone);

      const activeLock = await findActiveReservationLockForSlotForUpdate(tx, {
        date: input.date,
        timeSlot: input.timeSlot,
        now,
      });

      if (activeLock && activeLock.phone !== resolvedClient.phone) {
        throw new Error("SLOT_LOCKED");
      }

      const [occupiedSlots, blockedSlots] = await Promise.all([
        listActiveAppointmentSlotsByDateForUpdate(tx, input.date),
        listBlockedSlotsByDateForUpdate(tx, input.date),
      ]);
      const blockedTimeSlots = blockedSlots.map((slot) => slot.timeSlot);
      const { hasFullDayBlock, blockedSlots: blockedSlotsSet } = splitBlockedTimeSlots(blockedTimeSlots);

      if (hasFullDayBlock) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      const availableSlots = getAvailableStartSlotsWithManualBlocks(
        baseSlots,
        occupiedSlots,
        Array.from(blockedSlotsSet),
        registration.slotMode,
      );

      if (!availableSlots.includes(input.timeSlot)) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      const appointment = await tx.appointment.create({
        data: {
          clientId: resolvedClient.id,
          date: new Date(`${input.date}T00:00:00.000Z`),
          timeSlot: new Date(`1970-01-01T${input.timeSlot}:00.000Z`),
          status: "CONFIRMED",
        },
        select: {
          id: true,
        },
      });

      await createAppointmentLogEvent(tx, {
        appointmentId: appointment.id,
        actionType: "CONFIRMED",
        actor,
        clientId: resolvedClient.id,
      });

      return {
        appointmentId: appointment.id,
        client: resolvedClient,
      };
    } finally {
      await releaseBookingLocks(tx, input.date, lockPhone);
    }
  });

  const syncResult = await syncAppointmentToCalendar({
    appointmentId: created.appointmentId,
    name: resolveClientDisplayName(created.client),
    date: input.date,
    timeSlot: input.timeSlot,
  });
  const syncReason =
    syncResult.status === "SYNC_FAILED"
      ? syncResult.reason
      : undefined;

  return {
    appointmentId: created.appointmentId,
    date: input.date,
    timeSlot: input.timeSlot,
    status: syncResult.status,
    syncReason,
    client: {
      clientId: created.client.id,
      clientNumber: created.client.clientNumber,
      name: created.client.name,
      alias: created.client.alias,
      phone: created.client.phone,
    },
  };
}

async function syncRescheduledAppointment(input: {
  appointmentId: number;
  name: string;
  date: string;
  timeSlot: string;
  previousGoogleEventId: string | null;
}): Promise<AdminRescheduleAppointmentResponse> {
  if (input.previousGoogleEventId) {
    try {
      await deleteCalendarEvent(input.previousGoogleEventId);
    } catch {
      // non-blocking: we still try to recreate the event for the new slot
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
      date: input.date,
      timeSlot: input.timeSlot,
      status: "CONFIRMED",
    };
  } catch (error) {
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
      date: input.date,
      timeSlot: input.timeSlot,
      status: "SYNC_FAILED",
      syncReason: mapCalendarErrorReason(error),
    };
  }
}

export async function rescheduleAdminAppointment(
  appointmentId: number,
  input: AdminRescheduleAppointmentPayload,
  now = new Date(),
): Promise<AdminRescheduleAppointmentResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const baseSlots = resolveBaseSlotsByMonthMode(registration.slotMode);

  validateBookingRules(
    {
      date: input.date,
      timeSlot: input.timeSlot,
    },
    now,
  );

  const { monthStart, monthEndExclusive } = getMonthRange(input.month);

  const updated = await prisma.$transaction(async (tx) => {
    const current = await findActiveAppointmentByIdInMonthForUpdate(tx, {
      appointmentId,
      monthStart,
      monthEndExclusive,
    });

    if (!current) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    if (!isFutureDateTime(current.date, current.timeSlot, now)) {
      throw new Error("APPOINTMENT_NOT_EDITABLE");
    }

    await cleanupExpiredReservationLocks(tx, now);
    await lockConflictingAppointments(tx, input.date, current.phone);

    const activeLock = await findActiveReservationLockForSlotForUpdate(tx, {
      date: input.date,
      timeSlot: input.timeSlot,
      now,
    });

    if (activeLock && activeLock.phone !== current.phone) {
      throw new Error("SLOT_LOCKED");
    }

    const [occupiedSlots, blockedSlots] = await Promise.all([
      listActiveAppointmentsByDateExcludingForUpdate(tx, {
        date: input.date,
        excludeAppointmentId: current.id,
      }),
      listBlockedSlotsByDateForUpdate(tx, input.date),
    ]);
    const blockedTimeSlots = blockedSlots.map((blockedSlot) => blockedSlot.timeSlot);
    const { hasFullDayBlock, blockedSlots: blockedSlotsSet } = splitBlockedTimeSlots(blockedTimeSlots);

    if (hasFullDayBlock) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    const availableSlots = getAvailableStartSlotsWithManualBlocks(
      baseSlots,
      occupiedSlots,
      Array.from(blockedSlotsSet),
      registration.slotMode,
    );

    if (!availableSlots.includes(input.timeSlot)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    await updateAppointmentScheduleById(tx, {
      appointmentId,
      date: input.date,
      timeSlot: input.timeSlot,
    });

    return {
      appointmentId: current.id,
      name: current.name,
      date: input.date,
      timeSlot: input.timeSlot,
      previousGoogleEventId: current.googleEventId,
    };
  });

  return syncRescheduledAppointment(updated);
}

export async function cancelAdminAppointment(
  appointmentId: number,
  input: AdminCancelAppointmentPayload,
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminCancelAppointmentResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const { monthStart, monthEndExclusive } = getMonthRange(input.month);

  const appointment = await prisma.$transaction(async (tx) => {
    const current = await findActiveAppointmentByIdInMonthForUpdate(tx, {
      appointmentId,
      monthStart,
      monthEndExclusive,
    });

    if (!current) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    await cancelAppointmentById(tx, current.id);

    await createAppointmentLogEvent(tx, {
      appointmentId: current.id,
      actionType: "CANCELLED",
      actor,
      clientId: current.clientId,
    });

    return current;
  });

  if (appointment.googleEventId) {
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
    } catch {
      return {
        appointmentId: appointment.id,
        status: "CANCELLED",
        syncReason: "CALENDAR_DELETE_FAILED",
      };
    }
  }

  return {
    appointmentId: appointment.id,
    status: "CANCELLED",
  };
}

async function transitionPendingAppointment(
  tx: Prisma.TransactionClient,
  input: {
    appointmentId: number;
    nextStatus: "CONFIRMED" | "REJECTED";
    actor: AppointmentLogActorInput;
  },
): Promise<
  AdminAppointmentTransitionResponse & {
    syncInput?: {
      name: string;
      date: string;
      timeSlot: string;
    };
  }
> {
  const current = await tx.appointment.findUnique({
    where: {
      id: input.appointmentId,
    },
    select: {
      id: true,
      status: true,
      date: true,
      timeSlot: true,
      client: {
        select: {
          id: true,
          clientNumber: true,
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
  });

  if (!current) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  if (current.status !== "PENDING") {
    throw new Error("APPOINTMENT_STATUS_INVALID_TRANSITION");
  }

  const updated = await tx.appointment.updateMany({
    where: {
      id: input.appointmentId,
      status: "PENDING",
    },
    data: {
      status: input.nextStatus,
    },
  });

  if (updated.count === 0) {
    throw new Error("APPOINTMENT_STATUS_INVALID_TRANSITION");
  }

  const response: AdminAppointmentTransitionResponse & {
    syncInput?: {
      name: string;
      date: string;
      timeSlot: string;
    };
  } = {
    appointmentId: input.appointmentId,
    status: input.nextStatus,
  };

  if (input.nextStatus === "CONFIRMED") {
    response.syncInput = {
      name: current.client.name,
      date: dateToDateKey(current.date),
      timeSlot: timeToTimeSlotKey(current.timeSlot),
    };
  }

  await createAppointmentLogEvent(tx, {
    appointmentId: current.id,
    actionType: input.nextStatus,
    actor: input.actor,
    clientId: current.client.id,
  });

  return response;
}

export async function confirmPendingAppointment(
  appointmentId: number,
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminAppointmentTransitionResponse> {
  const transitioned = await prisma.$transaction(async (tx) =>
    transitionPendingAppointment(tx, {
      appointmentId,
      nextStatus: "CONFIRMED",
      actor,
    }),
  );

  if (!transitioned.syncInput) {
    return transitioned;
  }

  const syncResult = await syncAppointmentToCalendar({
    appointmentId: transitioned.appointmentId,
    name: transitioned.syncInput.name,
    date: transitioned.syncInput.date,
    timeSlot: transitioned.syncInput.timeSlot,
  });

  if (syncResult.status === "SYNC_FAILED") {
    return {
      appointmentId: transitioned.appointmentId,
      status: "SYNC_FAILED",
      syncReason: syncResult.reason,
    };
  }

  return {
    appointmentId: transitioned.appointmentId,
    status: "CONFIRMED",
  };
}

export async function rejectPendingAppointment(
  appointmentId: number,
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminAppointmentTransitionResponse> {
  return prisma.$transaction(async (tx) =>
    transitionPendingAppointment(tx, {
      appointmentId,
      nextStatus: "REJECTED",
      actor,
    }),
  );
}
