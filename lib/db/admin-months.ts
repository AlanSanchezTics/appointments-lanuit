import type { AppointmentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { resolveClientDisplayName } from "@/lib/shared/client-name";
import type { ActiveMonthStatus } from "@/lib/admin/months/types";
import {
  DEFAULT_MONTH_SLOT_MODE,
  type MonthSlotMode,
} from "@/lib/availability/month-slot-mode";

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
      slotMode: DEFAULT_MONTH_SLOT_MODE,
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
      slotMode: true,
    },
  });
}

export async function updateRegisteredMonthSlotMode(month: string, slotMode: MonthSlotMode) {
  return prisma.activeMonth.update({
    where: {
      month,
    },
    data: {
      slotMode,
    },
    select: {
      month: true,
      slotMode: true,
    },
  });
}

export async function updateRegisteredMonthStatus(
  month: string,
  status: ActiveMonthStatus,
) {
  return prisma.activeMonth.update({
    where: {
      month,
    },
    data: {
      status,
    },
    select: {
      month: true,
      status: true,
    },
  });
}

// D66: los contadores y la ocupación del admin no cuentan PENDING (el flujo público sí lo bloquea, sin cambio).
// CANCELLED se pide solo para la métrica de canceladas.
const COUNTED_APPOINTMENT_STATUSES: AppointmentStatus[] = ["CONFIRMED", "SYNC_FAILED", "CANCELLED"];

export async function listAppointmentsByMonth(monthStart: string, monthEndExclusive: string) {
  const rows = await prisma.appointment.findMany({
    where: {
      status: {
        in: COUNTED_APPOINTMENT_STATUSES,
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

export type AppointmentReader = Pick<Prisma.TransactionClient, "appointment">;

// Citas activas del mes para el chequeo de citas afectadas (FR-023, D35). Incluye PENDING, a diferencia de los contadores (D66).
export async function listMonthActiveAppointmentsForAvailability(
  db: AppointmentReader,
  monthStart: string,
  monthEndExclusive: string,
) {
  const rows = await db.appointment.findMany({
    where: {
      status: {
        in: ["PENDING", "CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    select: {
      id: true,
      date: true,
      timeSlot: true,
      status: true,
      client: {
        select: {
          name: true,
          alias: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    status: row.status,
    clientName: resolveClientDisplayName({ name: row.client.name, alias: row.client.alias }),
  }));
}
