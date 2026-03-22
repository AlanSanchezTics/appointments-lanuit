import { getCurrentMonthKey } from "@/lib/datetime/mexico-city";

import {
  MONTHS_CATALOG_STATUS_VALUES,
  type MonthsCatalogStatus,
} from "@/lib/admin/months/types";

type ParsedMonthsCatalogQuery = {
  year: number;
  status: MonthsCatalogStatus;
  availableYears: number[];
};

const MIN_YEAR_DIGITS = 4;
const AVAILABLE_YEARS_AHEAD = 5;

function getCurrentYear(now: Date) {
  return Number(getCurrentMonthKey(now).slice(0, MIN_YEAR_DIGITS));
}

function getAvailableYears(now: Date) {
  const currentYear = getCurrentYear(now);
  return Array.from(
    { length: AVAILABLE_YEARS_AHEAD + 1 },
    (_, index) => currentYear + index,
  );
}

function parseStatus(rawValue: string | null): MonthsCatalogStatus {
  const normalized = (rawValue ?? "ALL").toUpperCase();

  if (
    MONTHS_CATALOG_STATUS_VALUES.some((value) => value === normalized)
  ) {
    return normalized as MonthsCatalogStatus;
  }

  throw new Error("MONTHS_STATUS_INVALID");
}

function parseYear(rawValue: string | null, availableYears: number[]) {
  if (!rawValue) {
    return availableYears[0];
  }

  if (!/^\d{4}$/.test(rawValue)) {
    throw new Error("MONTHS_YEAR_INVALID");
  }

  const parsed = Number(rawValue);

  if (!availableYears.includes(parsed)) {
    throw new Error("MONTHS_YEAR_OUT_OF_RANGE");
  }

  return parsed;
}

export function parseMonthsCatalogQuery(
  searchParams: URLSearchParams,
  now = new Date(),
): ParsedMonthsCatalogQuery {
  const availableYears = getAvailableYears(now);
  const status = parseStatus(searchParams.get("status"));
  const year = parseYear(searchParams.get("year"), availableYears);

  return {
    year,
    status,
    availableYears,
  };
}

export function parseMonthsCatalogQueryFromObject(
  searchParams: Record<string, string | string[] | undefined>,
  now = new Date(),
): ParsedMonthsCatalogQuery {
  const normalizedEntries = Object.entries(searchParams).flatMap(
    ([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((chunk) => [key, chunk] as [string, string]);
      }

      if (typeof value === "string") {
        return [[key, value] as [string, string]];
      }

      return [];
    },
  );

  return parseMonthsCatalogQuery(new URLSearchParams(normalizedEntries), now);
}

export function parseMonthsCatalogQueryOrDefault(
  searchParams: Record<string, string | string[] | undefined>,
  now = new Date(),
) {
  try {
    return parseMonthsCatalogQueryFromObject(searchParams, now);
  } catch {
    return parseMonthsCatalogQuery(new URLSearchParams(), now);
  }
}
