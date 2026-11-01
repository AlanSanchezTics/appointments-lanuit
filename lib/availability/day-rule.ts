import { DEFAULT_DAY_RULE } from "@/lib/availability/defaults";
import type { DayRule, MonthAvailabilityConfig } from "@/lib/availability/types";

// Fechas como calendario ("YYYY-MM-DD"): se usa UTC solo para aritmética de calendario, sin hora.
export function isValidIsoDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return false;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(`${match[1]}-${match[2]}`);
}

export function daysInMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

// Fecha válida que pertenece al mes "YYYY-MM".
export function isDateInMonth(date: string, month: string) {
  return isValidIsoDate(date) && date.startsWith(`${month}-`);
}

// ISO 1 (lunes) a 7 (domingo).
export function isoWeekdayOf(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();

  return day === 0 ? 7 : day;
}

export function resolveDayRule(config: MonthAvailabilityConfig, date: string): DayRule | null {
  // F2/F3: una fecha malformada o de otro mes no es un día cerrado ni abierto por default; se rechaza.
  if (!isDateInMonth(date, config.month)) {
    throw new Error("AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
  }

  const exception = config.exceptions.find((item) => item.date === date);

  if (exception) {
    return {
      source: "EXCEPTION",
      times: exception.times,
      minGapMinutes: exception.minGapMinutes,
      preserveCapacity: exception.preserveCapacity,
      maxPerDay: exception.maxPerDay,
    };
  }

  // FR-003: a lo sumo una regla cubre una fecha. El traslape se valida al guardar, sin mirar días de la semana.
  const covering = config.rules.filter((rule) => rule.startDate <= date && date <= rule.endDate);

  if (covering.length > 1) {
    throw new Error("AVAILABILITY_RULE_OVERLAP");
  }

  if (covering.length === 1) {
    const [rule] = covering;

    if (!rule.weekdays.includes(isoWeekdayOf(date))) {
      return null;
    }

    return {
      source: "RULE",
      times: rule.times,
      minGapMinutes: rule.minGapMinutes,
      preserveCapacity: rule.preserveCapacity,
      maxPerDay: rule.maxPerDay,
    };
  }

  // D6/D42: solo un mes sin ninguna regla usa el default de lunes a viernes.
  if (config.rules.length === 0 && isoWeekdayOf(date) <= 5) {
    return { source: "DEFAULT", ...DEFAULT_DAY_RULE, times: [...DEFAULT_DAY_RULE.times] };
  }

  return null;
}
