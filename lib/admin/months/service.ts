import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import {
  createInactiveMonths,
  countActiveMonthsByYear,
  countFutureAppointmentsByYear,
  countFutureMonthsByYear,
  countInactiveMonthsByYear,
  countPastAppointmentsByYear,
  countPastMonthsByYear,
  listExistingMonths,
  listMonthsByYear,
} from "@/lib/db/admin-months";

import type {
  CreateAdminMonthsPayload,
  CreateAdminMonthsResponse,
  MonthsCatalogResponse,
  MonthsCatalogStatus,
} from "@/lib/admin/months/types";

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

export async function createAdminMonths(
  input: CreateAdminMonthsPayload,
): Promise<CreateAdminMonthsResponse> {
  const existingMonths = await listExistingMonths(input.months);
  const existingSet = new Set(existingMonths);
  const monthsToCreate = input.months.filter((month) => !existingSet.has(month));

  await createInactiveMonths(monthsToCreate);

  return {
    createdMonths: monthsToCreate,
    skippedMonths: existingMonths,
    totalCreated: monthsToCreate.length,
    totalSkipped: existingMonths.length,
  };
}
