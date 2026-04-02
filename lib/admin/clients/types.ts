export type AdminClientSearchItem = {
  clientId: number;
  name: string;
  phone: string;
};

export type SearchAdminClientsInput = {
  query: string;
  limit: number;
};

export type SearchAdminClientsResponse = {
  query: string;
  total: number;
  clients: AdminClientSearchItem[];
};

export const ADMIN_CLIENT_CATALOG_STATUS_VALUES = [
  "ALL",
  "WITH_FUTURE_APPOINTMENTS",
  "WITHOUT_FUTURE_APPOINTMENTS",
] as const;

export const ADMIN_CLIENT_CATALOG_SORT_VALUES = [
  "RECENT",
  "NAME_ASC",
  "NAME_DESC",
  "APPOINTMENTS_DESC",
] as const;

export type AdminClientCatalogStatus = (typeof ADMIN_CLIENT_CATALOG_STATUS_VALUES)[number];
export type AdminClientCatalogSort = (typeof ADMIN_CLIENT_CATALOG_SORT_VALUES)[number];

export type AdminClientsCatalogQuery = {
  query: string;
  status: AdminClientCatalogStatus;
  sort: AdminClientCatalogSort;
  page: number;
  pageSize: number;
};

export type AdminClientCatalogItem = {
  clientId: number;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  totalAppointments: number;
  hasFutureActiveAppointments: boolean;
  lastAppointmentDate: string | null;
  nextAppointmentDate: string | null;
  nextAppointmentTimeSlot: string | null;
};

export type AdminClientsCatalogResponse = {
  filters: AdminClientsCatalogQuery;
  metrics: {
    totalClients: number;
    withFutureAppointments: number;
    withoutFutureAppointments: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  clients: AdminClientCatalogItem[];
  currentDate: string;
};

export type AdminClientDetailAppointmentItem = {
  appointmentId: number;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "CANCELLED" | "SYNC_FAILED";
};

export type AdminClientDetailResponse = {
  client: {
    clientId: number;
    name: string;
    phone: string;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    totalAppointments: number;
    activeAppointments: number;
    cancelledAppointments: number;
    futureActiveAppointments: number;
    lastAppointmentDate: string | null;
    nextAppointmentDate: string | null;
    nextAppointmentTimeSlot: string | null;
  };
  appointments: AdminClientDetailAppointmentItem[];
  currentDate: string;
};

export type UpdateAdminClientPayload = {
  name: string;
};

export type UpdateAdminClientResponse = {
  clientId: number;
  name: string;
  phone: string;
  updatedAt: string;
};
