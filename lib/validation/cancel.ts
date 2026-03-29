import { z } from "zod";

const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[0-9]{10}$/.test(value), "VALIDATION_PHONE_INVALID");

export const cancelLookupSchema = z.object({
  phone: phoneSchema,
});

export const cancelSchema = z.object({
  phone: phoneSchema,
  appointmentIds: z
    .array(z.number().int().positive())
    .min(1, "VALIDATION_APPOINTMENT_IDS_REQUIRED")
    .refine(
      (values) => new Set(values).size === values.length,
      "VALIDATION_APPOINTMENT_IDS_DUPLICATED",
    ),
});

export type CancelLookupInput = z.infer<typeof cancelLookupSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
