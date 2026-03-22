export const MONTHS_CATALOG_STATUS_VALUES = ["ALL", "ACTIVE", "INACTIVE"] as const;

export type MonthsCatalogStatus = (typeof MONTHS_CATALOG_STATUS_VALUES)[number];

export type MonthsCatalogMetrics = {
  activeMonths: number;
  inactiveMonths: number;
  futureMonths: number;
  pastMonths: number;
  pastAppointments: number;
  futureAppointments: number;
};

export type AdminMonthListItem = {
  month: string;
  status: "ACTIVE" | "INACTIVE";
};

export type MonthsCatalogResponse = {
  filters: {
    year: number;
    status: MonthsCatalogStatus;
    availableYears: number[];
  };
  metrics: MonthsCatalogMetrics;
  months: AdminMonthListItem[];
  total: number;
  currentMonth: string;
  currentDate: string;
};

export type CreateAdminMonthsPayload = {
  year: number;
  months: string[];
};

export type CreateAdminMonthsResponse = {
  createdMonths: string[];
  skippedMonths: string[];
  totalCreated: number;
  totalSkipped: number;
};
