import type { DayAvailability } from "@/lib/availability/service";

export type BookingStep = "schedule" | "identity" | "confirm" | "success";

export type StepTransitionDirection = "forward" | "backward";

export type ClientState = "unknown" | "existing" | "new" | "reschedule";

export type RescheduleOption = {
  appointmentId: number;
  date: string;
  timeSlot: string;
};

export type BookingDraft = {
  date: string | null;
  timeSlot: string | null;
  name: string;
  phone: string;
};

export type BookingSuccess = {
  appointmentId: number;
  status: "CONFIRMED" | "SYNC_FAILED" | "PENDING";
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
  kind?: "schedule" | "identity";
};

export type ClientCheckLockResult = SlotLock & {
  clientExists: boolean;
  clientName?: string;
  futureAppointmentsInMonth?: RescheduleOption[];
  canBookAsNewAppointment?: boolean;
  whatsappPhone?: string;
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
