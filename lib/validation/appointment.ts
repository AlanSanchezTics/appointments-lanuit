import { z } from "zod";

import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { isCurrentMonth, isFutureDateTime, isWeekdayInMexicoCity } from "@/lib/datetime/mexico-city";

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[0-9]{10}$/.test(value), "El telefono debe tener 10 digitos");

const requiredNameSchema = z
  .string()
  .trim()
  .min(3, "El nombre debe tener al menos 3 caracteres")
  .max(100, "El nombre no puede exceder 100 caracteres");

const optionalNameSchema = z
  .string()
  .trim()
  .min(3, "El nombre debe tener al menos 3 caracteres")
  .max(100, "El nombre no puede exceder 100 caracteres")
  .optional();

const bookingCoreSchema = z.object({
  phone: phoneSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD"),
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
});

export function isBookingMonthAllowed(month: string, now = new Date()) {
  return isCurrentMonth(month, now);
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
