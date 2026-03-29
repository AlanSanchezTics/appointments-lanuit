import { z } from "zod";

import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { getCurrentMonthKey, isFutureDateTime, isWeekdayInMexicoCity } from "@/lib/datetime/mexico-city";

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

const bookingCoreSchema = z.object({
  phone: phoneSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "VALIDATION_DATE_FORMAT"),
  timeSlot: z.enum(BASE_TIME_SLOTS),
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

  if (!isWeekdayInMexicoCity(input.date)) {
    throw new Error("WEEKDAY_ONLY");
  }

  return input;
}

export type BookingInput = z.infer<typeof bookingSchema>;
export type LockReservationInput = z.infer<typeof lockReservationSchema>;
export type ConfirmBookingWithLockInput = z.infer<typeof confirmBookingWithLockSchema>;
