import { z } from "zod";

export const cancelLookupSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, "El telefono debe tener 10 digitos"),
});

export const cancelSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, "El telefono debe tener 10 digitos"),
  appointmentId: z.number().int().positive(),
});

export type CancelLookupInput = z.infer<typeof cancelLookupSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
