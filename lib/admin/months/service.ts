import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import { type MonthSlotMode } from "@/lib/availability/month-slot-mode";
import {
  createInactiveMonths,
  countActiveMonthsByYear,
  countFutureAppointmentsByYear,
  countFutureMonthsByYear,
  countInactiveMonthsByYear,
  countPastAppointmentsByYear,
  countPastMonthsByYear,
  listExistingMonths,
  findRegisteredMonth,
  listMonthsByYear,
  updateRegisteredMonthStatus,
  updateRegisteredMonthSlotMode,
} from "@/lib/db/admin-months";

import type {
  CreateAdminMonthsPayload,
  CreateAdminMonthsResponse,
  ActiveMonthStatus,
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

export async function updateAdminMonthSlotMode(
  month: string,
  slotMode: MonthSlotMode,
  now = new Date(),
) {
  const registration = await findRegisteredMonth(month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const currentMonth = getCurrentMonthKey(now);

  if (month < currentMonth) {
    throw new Error("MONTH_IN_PAST");
  }

  if (registration.slotMode === slotMode) {
    return {
      month: registration.month,
      slotMode: registration.slotMode,
    };
  }

  return updateRegisteredMonthSlotMode(month, slotMode);
}

export async function updateAdminMonthStatus(
  month: string,
  status: ActiveMonthStatus,
  now = new Date(),
) {
  const registration = await findRegisteredMonth(month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const currentMonth = getCurrentMonthKey(now);

  if (month < currentMonth) {
    throw new Error("MONTH_IN_PAST");
  }

  if (registration.status === status) {
    return {
      month: registration.month,
      status: registration.status,
    };
  }

  return updateRegisteredMonthStatus(month, status);
}
