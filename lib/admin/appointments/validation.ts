import { z } from "zod";

import { parseAdminMonthKey } from "@/lib/admin/months/validation";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import type { AdminCreateAppointmentPayload } from "@/lib/admin/appointments/types";
import { normalizeClientAlias } from "@/lib/shared/client-name";

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

const CREATE_APPOINTMENT_SCHEMA = z
  .object({
    month: z.string(),
    date: z.string(),
    timeSlot: z.enum(BASE_TIME_SLOTS),
    clientId: z
      .number()
      .int("CLIENT_ID_INVALID")
      .positive("CLIENT_ID_INVALID")
      .optional(),
    client: z
      .object({
        name: z.string(),
        alias: z
          .string()
          .max(100, "CLIENT_ALIAS_TOO_LONG")
          .optional(),
        phone: z.string(),
        clientNumber: z
          .number()
          .int("CLIENT_NUMBER_INVALID")
          .positive("CLIENT_NUMBER_INVALID")
          .optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    const hasClientId = typeof value.clientId === "number";
    const hasClientObject = Boolean(value.client);

    if (hasClientId === hasClientObject) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLIENT_SELECTION_INVALID",
      });
    }
  });

export function parseAdminCreateAppointmentPayload(payload: unknown): AdminCreateAppointmentPayload {
  const parsed = CREATE_APPOINTMENT_SCHEMA.parse(payload);
  const params = parseAdminDayAgendaParams({
    month: parsed.month,
    date: parsed.date,
  });

  if (typeof parsed.clientId === "number") {
    return {
      ...params,
      timeSlot: parsed.timeSlot,
      clientId: parsed.clientId,
    };
  }

  if (!parsed.client) {
    throw new Error("CLIENT_SELECTION_INVALID");
  }

  return {
    ...params,
    timeSlot: parsed.timeSlot,
    client: {
      name: parsed.client.name,
      alias: normalizeClientAlias(parsed.client.alias) ?? undefined,
      phone: parsed.client.phone,
      clientNumber: parsed.client.clientNumber,
    },
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
