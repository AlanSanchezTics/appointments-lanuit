import {
  MONTH_SLOT_MODE_VALUES,
  type MonthSlotMode,
} from "@/lib/availability/month-slot-mode";

export const MONTHS_CATALOG_STATUS_VALUES = ["ALL", "ACTIVE", "INACTIVE"] as const;

export type MonthsCatalogStatus = (typeof MONTHS_CATALOG_STATUS_VALUES)[number];
export { MONTH_SLOT_MODE_VALUES };
export type { MonthSlotMode };

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

export type MonthDetailDayTone = "available" | "low" | "full" | "weekend";

export type MonthDetailCalendarDay = {
  date: string;
  day: number;
  isWeekend: boolean;
  availableSpaces: number;
  appointmentsCount?: number;
  tone: MonthDetailDayTone;
};

export type MonthDetailMetrics = {
  confirmedAppointments: number;
  cancelledAppointments: number;
  availableSpaces: number;
  blockedSpaces: number;
  occupiedSpaces: number;
};

export type MonthDetailResponse = {
  month: string;
  monthStatus: "ACTIVE" | "INACTIVE";
  slotMode: MonthSlotMode;
  currentMonth: string;
  currentDate: string;
  isPastMonth: boolean;
  projectedSaturationPercent: number;
  metrics: MonthDetailMetrics;
  calendarDays: MonthDetailCalendarDay[];
};

export type UpdateAdminMonthSlotModePayload = {
  slotMode: MonthSlotMode;
};

export type UpdateAdminMonthSlotModeResponse = {
  month: string;
  slotMode: MonthSlotMode;
};
