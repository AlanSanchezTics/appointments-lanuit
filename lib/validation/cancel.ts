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
  appointmentId: z.number().int().positive(),
});

export type CancelLookupInput = z.infer<typeof cancelLookupSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
