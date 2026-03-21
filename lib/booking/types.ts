import type { DayAvailability } from "@/lib/availability/service";

export type BookingStep = "details" | "confirm" | "success";

export type StepTransitionDirection = "forward" | "backward";

export type ClientState = "unknown" | "existing" | "new";

export type BookingDraft = {
  date: string | null;
  timeSlot: string | null;
  name: string;
  phone: string;
};

export type BookingSuccess = {
  appointmentId: number;
  status: "CONFIRMED" | "SYNC_FAILED";
  syncReason?: string;
  whatsappPhone: string;
  whatsappData: {
    name: string;
    date: string;
    timeSlot: string;
  };
};

export type SlotLock = {
  lockToken: string;
  expiresAt: string;
};

export type ClientCheckLockResult = SlotLock & {
  clientExists: boolean;
  clientName?: string;
};

export type BookingValidationErrors = {
  date?: string;
  timeSlot?: string;
  name?: string;
  phone?: string;
  form?: string;
};

export type BookingWizardInput = {
  month: string;
  days: DayAvailability[];
  initialDraft?: Partial<BookingDraft>;
};
