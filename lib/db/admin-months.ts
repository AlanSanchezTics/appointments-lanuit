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

export type PersistedMonthAppointment = {
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
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

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
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

export async function listExistingMonths(months: string[]) {
  if (months.length === 0) {
    return [];
  }

  const rows = await prisma.activeMonth.findMany({
    where: {
      month: {
        in: months,
      },
    },
    select: {
      month: true,
    },
  });

  return rows.map((row) => row.month).sort();
}

export async function createInactiveMonths(months: string[]) {
  if (months.length === 0) {
    return;
  }

  await prisma.activeMonth.createMany({
    data: months.map((month) => ({
      month,
      status: "INACTIVE",
    })),
    skipDuplicates: true,
  });
}

export async function findRegisteredMonth(month: string) {
  return prisma.activeMonth.findUnique({
    where: {
      month,
    },
    select: {
      month: true,
      status: true,
    },
  });
}

export async function listAppointmentsByMonth(monthStart: string, monthEndExclusive: string) {
  const rows = await prisma.appointment.findMany({
    where: {
      status: {
        in: ["CONFIRMED", "CANCELLED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    select: {
      date: true,
      timeSlot: true,
      status: true,
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return rows.map((row) => ({
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    status: row.status,
  })) satisfies PersistedMonthAppointment[];
}
