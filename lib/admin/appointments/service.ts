import { getAvailableStartSlotsWithManualBlocks } from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import { createCalendarEvent, deleteCalendarEvent, GoogleCalendarConfigError } from "@/lib/calendar/google";
import type {
  AdminCancelAppointmentPayload,
  AdminCancelAppointmentResponse,
  AdminDayAgendaResponse,
  AdminRescheduleAppointmentPayload,
  AdminRescheduleAppointmentResponse,
} from "@/lib/admin/appointments/types";
import { findRegisteredMonth } from "@/lib/db/admin-months";
import {
  cancelAppointmentById,
  findActiveAppointmentByIdInMonthForUpdate,
  listActiveAppointmentsByDate,
  listActiveAppointmentsByDateExcludingForUpdate,
  updateAppointmentScheduleById,
} from "@/lib/db/admin-appointments";
import {
  cleanupExpiredReservationLocks,
  findActiveReservationLockForSlotForUpdate,
  lockConflictingAppointments,
} from "@/lib/db/appointments";
import {
  listBlockedSlotsByDate,
  listBlockedSlotsByDateForUpdate,
} from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import { validateBookingRules } from "@/lib/validation/appointment";
import { isFutureDateTime } from "@/lib/datetime/mexico-city";

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
      name: appointment.name,
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

    const availableSlots = getAvailableStartSlotsWithManualBlocks(
      baseSlots,
      occupiedSlots,
      blockedSlots.map((blockedSlot) => blockedSlot.timeSlot),
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
  now = new Date(),
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

    if (!isFutureDateTime(current.date, current.timeSlot, now)) {
      throw new Error("APPOINTMENT_NOT_CANCELABLE");
    }

    await cancelAppointmentById(tx, current.id);

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
