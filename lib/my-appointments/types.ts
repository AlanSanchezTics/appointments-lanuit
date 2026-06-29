export type MyAppointmentsActionabilityReason =
  | "PUBLIC_ACTIONS_UNAVAILABLE"
  | "CANCELLATION_WINDOW_EXPIRED"
  | "RESCHEDULE_WINDOW_EXPIRED";

export type MyAppointmentLookupItem = {
  appointmentId: number;
  name: string;
  phone: string;
  date: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "SYNC_FAILED";
  canCancel: boolean;
  canModify: boolean;
  isBlocked: boolean;
  blockedReason?: MyAppointmentsActionabilityReason;
};

export type MyAppointmentsLookupResult = {
  appointments: MyAppointmentLookupItem[];
};

export type MyAppointmentsCancelResult = {
  cancelledAppointments: Array<{
    appointmentId: number;
    status: "CANCELLED";
    syncReason?: "CALENDAR_DELETE_FAILED";
  }>;
};

export type MyAppointmentsRescheduleResult = {
  appointmentId: number;
  status: "PENDING" | "CONFIRMED" | "SYNC_FAILED";
  syncReason?: "CALENDAR_NOT_CONFIGURED" | "CALENDAR_SYNC_FAILED";
  googleEventId?: string | null;
};
