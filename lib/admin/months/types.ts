import type { AvailabilityException, AvailabilityRule } from "@/lib/availability/types";
import type { AvailabilityPresetMode } from "@/lib/availability/defaults";

export const MONTHS_CATALOG_STATUS_VALUES = ["ALL", "ACTIVE", "INACTIVE"] as const;
export const ACTIVE_MONTH_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

export type MonthsCatalogStatus = (typeof MONTHS_CATALOG_STATUS_VALUES)[number];
export type ActiveMonthStatus = (typeof ACTIVE_MONTH_STATUS_VALUES)[number];

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
  status: ActiveMonthStatus;
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

// D13/D34/FR-028: "closed" = día sin horarios resueltos (gris); sustituye al antiguo "weekend".
export type MonthDetailDayTone = "available" | "low" | "full" | "closed";

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

export type MonthSaturationComparison = {
  previousMonth: string;
  previousProjectedSaturationPercent: number;
  deltaPercentPoints: number;
};

export type MonthDetailResponse = {
  month: string;
  monthStatus: ActiveMonthStatus;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  availabilityVersion: number;
  // Informativo: true cuando el mes no tiene reglas y el resolvedor aplica D6 (D28).
  usesDefaultRule: boolean;
  currentMonth: string;
  currentDate: string;
  isPastMonth: boolean;
  projectedSaturationPercent: number;
  saturationComparison?: MonthSaturationComparison;
  metrics: MonthDetailMetrics;
  calendarDays: MonthDetailCalendarDay[];
};

// D16/D33/D45: expectedVersion y confirmAffectedAppointments son opcionales en PATCH slot-mode (A-01, D51).
export type UpdateAdminMonthSlotModePayload = {
  slotMode: AvailabilityPresetMode;
  expectedVersion?: number;
  confirmAffectedAppointments: boolean;
};

export type UpdateAdminMonthSlotModeResponse = {
  month: string;
  availabilityVersion: number;
};

export type AvailabilityRuleBody = {
  startDate: string;
  endDate: string;
  weekdays: number[];
  times: string[];
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
};

export type AvailabilityExceptionBody = {
  date: string;
  times: string[];
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
};

export type PreviewAvailabilityPayload = {
  rules: AvailabilityRuleBody[];
  exceptions: AvailabilityExceptionBody[];
};

export type SaveAvailabilityPayload = PreviewAvailabilityPayload & {
  expectedVersion: number;
  confirmAffectedAppointments: boolean;
};

export type AffectedAppointmentItem = {
  appointmentId: number;
  date: string;
  timeSlot: string;
  status: string;
  clientName: string;
};

export type PreviewAvailabilityResponse = {
  affectedCount: number;
  affectedAppointments: AffectedAppointmentItem[];
};

export type MonthAvailabilityResponse = {
  month: string;
  availabilityVersion: number;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  usesDefaultRule: boolean;
};

export type UpdateAdminMonthStatusPayload = {
  status: ActiveMonthStatus;
};

export type UpdateAdminMonthStatusResponse = {
  month: string;
  status: ActiveMonthStatus;
};
