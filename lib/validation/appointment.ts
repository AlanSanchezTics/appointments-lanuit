import { z } from "zod";

import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { isCurrentMonth, isFutureDateTime, isWeekdayInMexicoCity } from "@/lib/datetime/mexico-city";

export const bookingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  phone: z.string().regex(/^[0-9]{10}$/, "El telefono debe tener 10 digitos"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD"),
  timeSlot: z.enum(BASE_TIME_SLOTS),
});

export function isBookingMonthAllowed(month: string, now = new Date()) {
  return isCurrentMonth(month, now);
}

export function validateBookingRules(input: z.infer<typeof bookingSchema>, now = new Date()) {
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
