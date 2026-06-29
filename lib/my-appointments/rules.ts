import type { AppointmentStatus } from "@prisma/client";

import { isFutureDateTime } from "@/lib/datetime/mexico-city";

const CANCEL_WINDOW_HOURS = 24;
const MODIFY_WINDOW_HOURS = 3;
const MS_PER_HOUR = 1000 * 60 * 60;

export type MyAppointmentsLookupAppointment = {
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
};

export function getHoursUntilAppointment(
  appointment: { date: string; timeSlot: string },
  now: Date,
) {
  const appointmentDateTime = new Date(
    `${appointment.date}T${appointment.timeSlot}:00.000Z`,
  );
  return (appointmentDateTime.getTime() - now.getTime()) / MS_PER_HOUR;
}

export function isPublicAppointmentFuture(
  appointment: { date: string; timeSlot: string },
  now: Date,
) {
  return isFutureDateTime(appointment.date, appointment.timeSlot, now);
}

export function canCancelPublicAppointment(
  appointment: MyAppointmentsLookupAppointment,
  now: Date,
) {
  return (
    (appointment.status === "CONFIRMED" || appointment.status === "SYNC_FAILED")
    && getHoursUntilAppointment(appointment, now) >= CANCEL_WINDOW_HOURS
  );
}

export function canModifyPublicAppointment(
  appointment: MyAppointmentsLookupAppointment,
  now: Date,
) {
  return (
    (appointment.status === "PENDING"
      || appointment.status === "CONFIRMED"
      || appointment.status === "SYNC_FAILED")
    && getHoursUntilAppointment(appointment, now) >= MODIFY_WINDOW_HOURS
  );
}

export function getPublicAppointmentBlockedReason(input: {
  canCancel: boolean;
  canModify: boolean;
}) {
  if (input.canCancel || input.canModify) {
    return undefined;
  }

  return "PUBLIC_ACTIONS_UNAVAILABLE" as const;
}
