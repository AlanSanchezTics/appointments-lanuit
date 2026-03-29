export type CancellationStep = "lookup" | "review" | "success";

export type CancelableAppointment = {
  appointmentId: number;
  name: string;
  phone: string;
  date: string;
  timeSlot: string;
  status: "CONFIRMED";
};

export type CancellationResult = {
  cancelledAppointments: Array<{
    appointmentId: number;
    status: "CANCELLED";
    syncReason?: "CALENDAR_DELETE_FAILED";
  }>;
};

export type CancelableAppointmentLookupResult = {
  appointments: CancelableAppointment[];
};
