import type { AppointmentStatus } from "@prisma/client";

export type AdminClientSearchItem = {
  clientId: number;
  clientNumber: number;
  name: string;
  alias?: string | null;
  phone: string;
  isLoyal: boolean;
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
  "LOYAL",
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
  clientNumber: number;
  name: string;
  alias?: string | null;
  phone: string;
  isLoyal: boolean;
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
    loyalClients: number;
    loyalClientsPercentage: number;
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
  status: AppointmentStatus;
};

export type AdminClientDetailResponse = {
  client: {
    clientId: number;
    clientNumber: number;
    name: string;
    alias?: string | null;
    phone: string;
    isLoyal: boolean;
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
  name?: string;
  alias?: string | null;
  phone?: string;
  clientNumber?: number;
  isLoyal?: boolean;
};

export type UpdateAdminClientResponse = {
  clientId: number;
  clientNumber: number;
  name: string;
  alias?: string | null;
  phone: string;
  isLoyal: boolean;
  updatedAt: string;
};
