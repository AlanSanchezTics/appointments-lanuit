import type { AppointmentStatus } from "@prisma/client";

export const SLOT_BLOCKING_APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SYNC_FAILED",
] satisfies AppointmentStatus[];
