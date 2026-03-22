import type { ActiveMonthStatus, AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "CONFIRMED",
  "SYNC_FAILED",
];

type MonthRange = {
  monthStart: string;
  monthEndExclusive: string;
};

type YearDateRange = {
  yearStart: Date;
  yearEndExclusive: Date;
};

function getMonthRange(year: number): MonthRange {
  const monthStart = `${year}-01`;
  const monthEndExclusive = `${year + 1}-01`;

  return {
    monthStart,
    monthEndExclusive,
  };
}

function getYearDateRange(year: number): YearDateRange {
  return {
    yearStart: new Date(`${year}-01-01T00:00:00.000Z`),
    yearEndExclusive: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
}

export async function countActiveMonthsByYear(year: number) {
  const range = getMonthRange(year);

  return prisma.activeMonth.count({
    where: {
      status: "ACTIVE",
      month: {
        gte: range.monthStart,
        lt: range.monthEndExclusive,
      },
    },
  });
}

export async function countInactiveMonthsByYear(year: number) {
  const range = getMonthRange(year);

  return prisma.activeMonth.count({
    where: {
      status: "INACTIVE",
      month: {
        gte: range.monthStart,
        lt: range.monthEndExclusive,
      },
    },
  });
}

export async function countFutureMonthsByYear(
  year: number,
  currentMonth: string,
) {
  const range = getMonthRange(year);

  return prisma.activeMonth.count({
    where: {
      month: {
        gte: range.monthStart,
        lt: range.monthEndExclusive,
        gt: currentMonth,
      },
    },
  });
}

export async function countPastMonthsByYear(year: number, currentMonth: string) {
  const range = getMonthRange(year);

  return prisma.activeMonth.count({
    where: {
      AND: [
        {
          month: {
            gte: range.monthStart,
            lt: range.monthEndExclusive,
          },
        },
        {
          month: {
            lt: currentMonth,
          },
        },
      ],
    },
  });
}

export async function countPastAppointmentsByYear(
  year: number,
  currentDate: string,
) {
  const range = getYearDateRange(year);

  return prisma.appointment.count({
    where: {
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
      AND: [
        {
          date: {
            gte: range.yearStart,
            lt: range.yearEndExclusive,
          },
        },
        {
          date: {
            lt: new Date(`${currentDate}T00:00:00.000Z`),
          },
        },
      ],
    },
  });
}

export async function countFutureAppointmentsByYear(
  year: number,
  currentDate: string,
) {
  const range = getYearDateRange(year);

  return prisma.appointment.count({
    where: {
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
      AND: [
        {
          date: {
            gte: range.yearStart,
            lt: range.yearEndExclusive,
          },
        },
        {
          date: {
            gt: new Date(`${currentDate}T00:00:00.000Z`),
          },
        },
      ],
    },
  });
}

export async function listMonthsByYear(
  year: number,
  status: "ALL" | ActiveMonthStatus,
) {
  const range = getMonthRange(year);

  const rows = await prisma.activeMonth.findMany({
    where: {
      month: {
        gte: range.monthStart,
        lt: range.monthEndExclusive,
      },
      ...(status === "ALL"
        ? {}
        : {
            status,
          }),
    },
    orderBy: {
      month: "asc",
    },
    select: {
      month: true,
      status: true,
    },
  });

  return rows;
}
