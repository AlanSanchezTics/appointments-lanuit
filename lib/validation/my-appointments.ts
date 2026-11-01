import { z } from "zod";

import { isValidIsoDate } from "@/lib/availability/day-rule";
import { timeSlotSchema } from "@/lib/validation/appointment";

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[0-9]{10}$/.test(value), "PHONE_INVALID");

// Calendario real: 2026-02-30 es VALIDATION_ERROR (antes respondía SLOT_NOT_AVAILABLE 409 en reprogramación).
const dateSchema = z.string().refine(isValidIsoDate, "VALIDATION_ERROR");
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "VALIDATION_ERROR");

export const myAppointmentsLookupSchema = z.object({
  phone: phoneSchema,
});

export const myAppointmentsCancelSchema = z.object({
  phone: phoneSchema,
  appointmentIds: z
    .array(z.number().int().positive())
    .min(1, "VALIDATION_APPOINTMENT_IDS_REQUIRED")
    .refine(
      (values) => new Set(values).size === values.length,
      "VALIDATION_APPOINTMENT_IDS_DUPLICATED",
    ),
});

export const myAppointmentsRescheduleSchema = z.object({
  phone: phoneSchema,
  appointmentId: z.number().int().positive(),
  month: monthSchema,
  date: dateSchema,
  timeSlot: timeSlotSchema,
});

export type MyAppointmentsLookupInput = z.infer<typeof myAppointmentsLookupSchema>;
export type MyAppointmentsCancelInput = z.infer<typeof myAppointmentsCancelSchema>;
export type MyAppointmentsRescheduleInput = z.infer<typeof myAppointmentsRescheduleSchema>;
