import { z } from "zod";

import { isValidIsoDate } from "@/lib/availability/day-rule";
import { getCurrentMonthKey, isFutureDateTime } from "@/lib/datetime/mexico-city";

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[0-9]{10}$/.test(value), "VALIDATION_PHONE_INVALID");

const requiredNameSchema = z
  .string()
  .trim()
  .min(3, "VALIDATION_NAME_TOO_SHORT")
  .max(100, "VALIDATION_NAME_TOO_LONG");

const optionalNameSchema = z
  .string()
  .trim()
  .min(3, "VALIDATION_NAME_TOO_SHORT")
  .max(100, "VALIDATION_NAME_TOO_LONG")
  .optional();

// FR-006: cualquier HH:mm válido; que la hora se ofrezca lo decide el resolvedor (SLOT_NOT_AVAILABLE).
export const timeSlotSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "VALIDATION_TIME_SLOT_FORMAT");

const bookingCoreSchema = z.object({
  phone: phoneSchema,
  // Calendario real (2026-02-30 y 2026-13-01 se rechazan); el formato lo valida isValidIsoDate.
  date: z.string().refine(isValidIsoDate, "VALIDATION_DATE_FORMAT"),
  timeSlot: timeSlotSchema,
});

export const bookingSchema = bookingCoreSchema.extend({
  name: requiredNameSchema,
});

export const lockReservationSchema = bookingCoreSchema;

export const confirmBookingWithLockSchema = bookingCoreSchema.extend({
  name: z
    .union([optionalNameSchema, z.literal("")])
    .transform((value) => (typeof value === "string" ? value.trim() : value)),
  appointmentIdToReschedule: z.number().int().positive().optional(),
});

export function isBookingMonthAllowed(month: string, now = new Date()) {
  const currentMonth = getCurrentMonthKey(now);
  return month >= currentMonth;
}

export function validateBookingRules<
  TInput extends {
    date: string;
    timeSlot: string;
  },
>(input: TInput, now = new Date()) {
  const month = input.date.slice(0, 7);

  if (!isBookingMonthAllowed(month, now)) {
    throw new Error("MONTH_NOT_ALLOWED");
  }

  if (!isFutureDateTime(input.date, input.timeSlot, now)) {
    throw new Error("PAST_TIME_SLOT");
  }

  return input;
}

export type BookingInput = z.infer<typeof bookingSchema>;
export type LockReservationInput = z.infer<typeof lockReservationSchema>;
export type ConfirmBookingWithLockInput = z.infer<typeof confirmBookingWithLockSchema>;
