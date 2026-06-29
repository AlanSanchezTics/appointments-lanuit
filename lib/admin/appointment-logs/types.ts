export type AppointmentLogActionType =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "REJECTED"
  | "MODIFIED";

export type AppointmentLogActorType =
  | "SYSTEM"
  | "ADMIN"
  | "CLIENT";

export type AdminAppointmentLogsFormat = "json" | "pdf";

export type AdminAppointmentLogsQuery = {
  page: number;
  pageSize: number;
  client: string;
  actionType: AppointmentLogActionType | null;
  month: string;
  actionDateFrom: string | null;
  actionDateTo: string | null;
  format: AdminAppointmentLogsFormat;
};

export type AdminAppointmentLogsFilters = Omit<
  AdminAppointmentLogsQuery,
  "page" | "pageSize" | "format"
>;

export type AdminAppointmentLogsItem = {
  id: number;
  appointmentNumber: number;
  client: {
    name: string;
    alias: string | null;
    phone: string;
    clientNumber: number | null;
  };
  actionType: AppointmentLogActionType;
  actionLabel: string;
  appointmentDateTime: string;
  previousAppointmentDateTime?: string | null;
  actor: {
    type: AppointmentLogActorType;
    label: string;
  };
  actionDateTime: string;
};

export type AdminAppointmentLogsPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminAppointmentLogsResponse = {
  items: AdminAppointmentLogsItem[];
  pagination: AdminAppointmentLogsPagination;
  filters: AdminAppointmentLogsFilters;
};

export type AppointmentLogActorInput =
  | {
      type: "SYSTEM";
    }
  | {
      type: "ADMIN";
    }
  | {
      type: "CLIENT";
    };

export type AppointmentLogScheduleSnapshot = {
  date: string;
  timeSlot: string;
};

export type AppointmentLogPayload = {
  appointment: AppointmentLogScheduleSnapshot;
  previous?: AppointmentLogScheduleSnapshot;
  next?: AppointmentLogScheduleSnapshot;
};

export type CreateAppointmentLogInput = {
  appointmentId: number;
  actionType: AppointmentLogActionType;
  actor: AppointmentLogActorInput;
  clientId: number;
  payload: AppointmentLogPayload;
};
