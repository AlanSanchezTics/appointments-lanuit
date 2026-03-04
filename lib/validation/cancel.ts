import { z } from "zod";

export const cancelSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, "El telefono debe tener 10 digitos"),
});

export type CancelInput = z.infer<typeof cancelSchema>;
