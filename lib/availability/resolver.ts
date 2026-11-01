import { computeDayAvailability } from "@/lib/availability/capacity-engine";
import { daysInMonth, resolveDayRule } from "@/lib/availability/day-rule";
import type {
  DayAvailability,
  DayOccupancy,
  DayRule,
  MonthAvailabilityConfig,
} from "@/lib/availability/types";
import { getCurrentDateKey, getCurrentTimeKey } from "@/lib/datetime/mexico-city";

// Punto único de cálculo de disponibilidad por día y por mes (FR-016). Todos los consumidores llaman aquí.

export type ResolvedDay = DayAvailability & {
  date: string;
  dayRule: DayRule | null;
};

export type ResolveDayOptions = {
  now: Date;
  occupancy?: Partial<DayOccupancy>;
};

export type ResolveMonthOptions = {
  now: Date;
  occupancyByDate?: Readonly<Record<string, Partial<DayOccupancy>>>;
};

export function resolveDay(
  config: MonthAvailabilityConfig,
  date: string,
  { now, occupancy = {} }: ResolveDayOptions,
): ResolvedDay {
  const dayRule = resolveDayRule(config, date);
  // Hora actual solo si la fecha es hoy en America/Mexico_City (FR-014).
  const currentTime = getCurrentDateKey(now) === date ? getCurrentTimeKey(now) : null;

  return {
    date,
    dayRule,
    ...computeDayAvailability(dayRule, {
      date,
      occupiedTimes: occupancy.occupiedTimes ?? [],
      blockedTimes: occupancy.blockedTimes ?? [],
      fullDayBlocked: occupancy.fullDayBlocked ?? false,
      currentTime,
    }),
  };
}

export function resolveMonthDays(
  config: MonthAvailabilityConfig,
  { now, occupancyByDate = {} }: ResolveMonthOptions,
): ResolvedDay[] {
  return Array.from({ length: daysInMonth(config.month) }, (_, index) => {
    const date = `${config.month}-${String(index + 1).padStart(2, "0")}`;

    return resolveDay(config, date, { now, occupancy: occupancyByDate[date] });
  });
}
