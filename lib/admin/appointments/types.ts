import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import type { BlockReason } from "@/lib/admin/blocked-spaces/types";

export type AdminDayAgendaItem = {
  appointmentId: number;
  date: string;
  timeSlot: string;
  name: string;
  phone: string;
  status: "CONFIRMED" | "SYNC_FAILED";
};

export type AdminPendingAppointmentItem = {
  appointmentId: number;
  clientNumber: number;
  date: string;
  timeSlot: string;
  name: string;
  phone: string;
};

export type AdminDayAgendaResponse = {
  month: string;
  date: string;
  total: number;
  appointments: AdminDayAgendaItem[];
  blockedSlots: Array<{
    blockedSlotId: number;
    date: string;
    timeSlot: string;
    reason: BlockReason;
  }>;
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

export type AdminAppointmentTransitionResponse = {
  appointmentId: number;
  status: "CONFIRMED" | "REJECTED" | "SYNC_FAILED";
  syncReason?: "CALENDAR_NOT_CONFIGURED" | "CALENDAR_SYNC_FAILED";
};

export type AdminCreateAppointmentClientInput = {
  name: string;
  phone: string;
  clientNumber?: number;
};

export type AdminCreateAppointmentPayload =
  | {
      month: string;
      date: string;
      timeSlot: (typeof BASE_TIME_SLOTS)[number];
      clientId: number;
      client?: never;
    }
  | {
      month: string;
      date: string;
      timeSlot: (typeof BASE_TIME_SLOTS)[number];
      client: AdminCreateAppointmentClientInput;
      clientId?: never;
    };

export type AdminCreateAppointmentResponse = {
  appointmentId: number;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "SYNC_FAILED";
  client: {
    clientId: number;
    clientNumber: number;
    name: string;
    phone: string;
  };
  syncReason?: "CALENDAR_NOT_CONFIGURED" | "CALENDAR_SYNC_FAILED";
};
