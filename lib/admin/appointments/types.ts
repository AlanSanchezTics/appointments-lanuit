import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

export type AdminDayAgendaItem = {
  appointmentId: number;
  date: string;
  timeSlot: string;
  name: string;
  phone: string;
  status: "CONFIRMED" | "SYNC_FAILED";
};

export type AdminDayAgendaResponse = {
  month: string;
  date: string;
  total: number;
  appointments: AdminDayAgendaItem[];
};

export type AdminRescheduleAppointmentPayload = {
  month: string;
  date: string;
  timeSlot: (typeof BASE_TIME_SLOTS)[number];
};

export type AdminRescheduleAppointmentResponse = {
  appointmentId: number;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "SYNC_FAILED";
  syncReason?: "CALENDAR_NOT_CONFIGURED" | "CALENDAR_SYNC_FAILED";
};

export type AdminCancelAppointmentPayload = {
  month: string;
};

export type AdminCancelAppointmentResponse = {
  appointmentId: number;
  status: "CANCELLED";
  syncReason?: "CALENDAR_DELETE_FAILED";
};
