// Tipos de dominio del motor de disponibilidad (contracts/availability-engine.md).
// Sin dependencias de Prisma, Next.js ni React.

export type AvailabilityWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AvailabilityRule = {
  id: number;
  startDate: string;
  endDate: string;
  weekdays: number[];
  times: string[];
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
};

export type AvailabilityException = {
  id: number;
  date: string;
  times: string[];
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
};

export type MonthAvailabilityConfig = {
  month: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  availabilityVersion: number;
};

export type DayRuleSource = "EXCEPTION" | "RULE" | "DEFAULT";

export type DayRule = {
  source: DayRuleSource;
  times: string[];
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
};

// Ocupación y bloqueos de un día. Las citas activas y los locks llegan ya calculados por el llamador.
export type DayOccupancy = {
  occupiedTimes: string[];
  blockedTimes: string[];
  fullDayBlocked: boolean;
};

export type DayContext = DayOccupancy & {
  date: string;
  currentTime: string | null;
};

export type DayAvailability = {
  slots: string[];
  availableSpaces: number;
};
