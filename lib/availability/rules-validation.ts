import { isDateInMonth } from "@/lib/availability/day-rule";
import {
  FULL_DAY_BLOCK_SENTINEL_TIME,
  MAX_PER_DAY_MAX,
  MAX_PER_DAY_MIN,
  MAX_TIMES_PER_DAY,
  MIN_GAP_MINUTES_MAX,
  MIN_GAP_MINUTES_MIN,
} from "@/lib/availability/defaults";
import type { AvailabilityException, AvailabilityRule } from "@/lib/availability/types";

// Validación y normalización de reglas y excepciones antes de guardar (FR-003, FR-025, D20, D21, D37, D38).
// Lanza Error con código AVAILABILITY_* (R-11), no zod.

export type AvailabilityRuleDraft = Omit<AvailabilityRule, "id"> & { id?: number };
export type AvailabilityExceptionDraft = Omit<AvailabilityException, "id"> & { id?: number };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// D37: sin duplicados y ordenadas. El límite D21 se cuenta después de normalizar. F4/D55: 00:00 es centinela, no hora.
export function normalizeTimes(times: readonly string[]): string[] {
  if (times.some((time) => !TIME_PATTERN.test(time) || time === FULL_DAY_BLOCK_SENTINEL_TIME)) {
    throw new Error("AVAILABILITY_TIME_INVALID");
  }

  const normalized = [...new Set(times)].sort();

  if (normalized.length > MAX_TIMES_PER_DAY) {
    throw new Error("AVAILABILITY_TIMES_LIMIT_EXCEEDED");
  }

  return normalized;
}

function assertDateInMonth(date: string, month: string, code: string) {
  if (!isDateInMonth(date, month)) {
    throw new Error(code);
  }
}

function assertParameters(item: { minGapMinutes: number; maxPerDay: number }) {
  if (
    !Number.isInteger(item.minGapMinutes) ||
    item.minGapMinutes < MIN_GAP_MINUTES_MIN ||
    item.minGapMinutes > MIN_GAP_MINUTES_MAX
  ) {
    throw new Error("AVAILABILITY_MIN_GAP_OUT_OF_RANGE");
  }

  if (
    !Number.isInteger(item.maxPerDay) ||
    item.maxPerDay < MAX_PER_DAY_MIN ||
    item.maxPerDay > MAX_PER_DAY_MAX
  ) {
    throw new Error("AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE");
  }
}

function normalizeRule(rule: AvailabilityRuleDraft, month: string): AvailabilityRuleDraft {
  assertDateInMonth(rule.startDate, month, "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
  assertDateInMonth(rule.endDate, month, "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");

  if (rule.startDate > rule.endDate) {
    throw new Error("AVAILABILITY_RULE_RANGE_INVALID");
  }

  if (
    rule.weekdays.length === 0 ||
    rule.weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7)
  ) {
    throw new Error("AVAILABILITY_RULE_WEEKDAYS_REQUIRED");
  }

  const times = normalizeTimes(rule.times);

  if (times.length === 0) {
    throw new Error("AVAILABILITY_RULE_TIMES_REQUIRED");
  }

  assertParameters(rule);

  return {
    ...rule,
    weekdays: [...new Set(rule.weekdays)].sort((first, second) => first - second),
    times,
  };
}

// A2: una excepción con lista vacía es válida y cierra el día.
function normalizeException(
  exception: AvailabilityExceptionDraft,
  month: string,
): AvailabilityExceptionDraft {
  assertDateInMonth(exception.date, month, "AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH");
  assertParameters(exception);

  return { ...exception, times: normalizeTimes(exception.times) };
}

export function normalizeAvailabilityConfig(input: {
  month: string;
  rules: AvailabilityRuleDraft[];
  exceptions: AvailabilityExceptionDraft[];
}): { rules: AvailabilityRuleDraft[]; exceptions: AvailabilityExceptionDraft[] } {
  const rules = input.rules.map((rule) => normalizeRule(rule, input.month));
  const exceptions = input.exceptions.map((exception) => normalizeException(exception, input.month));

  // FR-003: traslape por fechas, sin mirar días de la semana (A1).
  for (let index = 0; index < rules.length; index += 1) {
    for (let other = index + 1; other < rules.length; other += 1) {
      if (rules[index].startDate <= rules[other].endDate && rules[other].startDate <= rules[index].endDate) {
        throw new Error("AVAILABILITY_RULE_OVERLAP");
      }
    }
  }

  // N3: fecha única por mes; se rechaza aquí, antes de llegar a la restricción de la BD.
  if (new Set(exceptions.map((exception) => exception.date)).size !== exceptions.length) {
    throw new Error("AVAILABILITY_EXCEPTION_DATE_DUPLICATE");
  }

  return { rules, exceptions };
}
