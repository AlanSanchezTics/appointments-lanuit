import { z } from "zod";

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(8).max(128),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export function parseAdminLoginPayload(payload: unknown) {
  return adminLoginSchema.parse(payload);
}
