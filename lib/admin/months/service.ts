import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import {
  countActiveMonthsByYear,
  countFutureAppointmentsByYear,
  countFutureMonthsByYear,
  countInactiveMonthsByYear,
  countPastAppointmentsByYear,
  countPastMonthsByYear,
  listMonthsByYear,
} from "@/lib/db/admin-months";

import type { MonthsCatalogResponse, MonthsCatalogStatus } from "@/lib/admin/months/types";

type GetMonthsCatalogInput = {
  year: number;
  status: MonthsCatalogStatus;
  availableYears: number[];
};

function mapStatusFilter(status: MonthsCatalogStatus) {
  if (status === "ALL") {
    return "ALL" as const;
  }

  return status;
}

export async function getMonthsCatalog(
  input: GetMonthsCatalogInput,
  now = new Date(),
): Promise<MonthsCatalogResponse> {
  const currentMonth = getCurrentMonthKey(now);
  const currentDate = getCurrentDateKey(now);
  const persistenceStatus = mapStatusFilter(input.status);

  const [
    activeMonths,
    inactiveMonths,
    futureMonths,
    pastMonths,
    pastAppointments,
    futureAppointments,
    months,
  ] = await Promise.all([
    countActiveMonthsByYear(input.year),
    countInactiveMonthsByYear(input.year),
    countFutureMonthsByYear(input.year, currentMonth),
    countPastMonthsByYear(input.year, currentMonth),
    countPastAppointmentsByYear(input.year, currentDate),
    countFutureAppointmentsByYear(input.year, currentDate),
    listMonthsByYear(input.year, persistenceStatus),
  ]);

  return {
    filters: {
      year: input.year,
      status: input.status,
      availableYears: input.availableYears,
    },
    metrics: {
      activeMonths,
      inactiveMonths,
      futureMonths,
      pastMonths,
      pastAppointments,
      futureAppointments,
    },
    months,
    total: months.length,
    currentMonth,
    currentDate,
  };
}
