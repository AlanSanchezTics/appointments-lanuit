import { z } from "zod";

import { parseAdminMonthKey } from "@/lib/admin/months/validation";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(date: string) {
  if (!DATE_KEY_PATTERN.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function parseAdminDayAgendaParams(input: { month: string; date: string }) {
  const month = parseAdminMonthKey(input.month);

  if (!isValidDateKey(input.date)) {
    throw new Error("DATE_INVALID_FORMAT");
  }

  if (!input.date.startsWith(`${month}-`)) {
    throw new Error("DATE_OUTSIDE_MONTH");
  }

  return {
    month,
    date: input.date,
  };
}

const RESCHEDULE_SCHEMA = z.object({
  month: z.string(),
  date: z.string(),
  timeSlot: z.enum(BASE_TIME_SLOTS),
});

export function parseAdminReschedulePayload(payload: unknown) {
  const parsed = RESCHEDULE_SCHEMA.parse(payload);
  const params = parseAdminDayAgendaParams({
    month: parsed.month,
    date: parsed.date,
  });

  return {
    ...params,
    timeSlot: parsed.timeSlot,
  };
}

const CANCEL_SCHEMA = z.object({
  month: z.string(),
});

export function parseAdminCancelPayload(payload: unknown) {
  const parsed = CANCEL_SCHEMA.parse(payload);

  return {
    month: parseAdminMonthKey(parsed.month),
  };
}

export function parseAppointmentIdParam(rawValue: string) {
  if (!/^\d+$/.test(rawValue)) {
    throw new Error("APPOINTMENT_ID_INVALID");
  }

  const appointmentId = Number(rawValue);

  if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
    throw new Error("APPOINTMENT_ID_INVALID");
  }

  return appointmentId;
}
