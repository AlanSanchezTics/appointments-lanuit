import type { AppointmentStatus } from "@prisma/client";

import { MAX_APPOINTMENTS_PER_DAY } from "@/lib/constants/slots";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { prisma } from "@/lib/db/prisma";

import type { WeeklyOccupancySummary } from "./types";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["CONFIRMED", "SYNC_FAILED"];
const WEEK_CAPACITY = MAX_APPOINTMENTS_PER_DAY * 5;

function parseDateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getCurrentWeekMondayKey(currentDate: string) {
  const current = parseDateKeyToUtcDate(currentDate);
  const dayOfWeek = current.getUTCDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday = addUtcDays(current, -mondayOffset);

  return toDateKey(monday);
}

function percent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

async function groupActiveAppointmentsByDate(startDateKey: string, endDateExclusiveKey: string) {
  const rows = await prisma.appointment.groupBy({
    by: ["date"],
    where: {
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
      date: {
        gte: parseDateKeyToUtcDate(startDateKey),
        lt: parseDateKeyToUtcDate(endDateExclusiveKey),
      },
    },
    _count: {
      _all: true,
    },
  });

  return new Map(rows.map((row) => [toDateKey(row.date), row._count._all]));
}

function getBusinessWeekDays(mondayKey: string) {
  const monday = parseDateKeyToUtcDate(mondayKey);
  return Array.from({ length: 5 }, (_, index) => toDateKey(addUtcDays(monday, index)));
}

export async function getAdminDashboardWeeklyOccupancy(
  now = new Date(),
): Promise<WeeklyOccupancySummary> {
  const currentDateKey = getCurrentDateKey(now);
  const currentMondayKey = getCurrentWeekMondayKey(currentDateKey);
  const previousMondayKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(currentMondayKey), -7));
  const nextMondayKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(currentMondayKey), 7));
  const currentWeekDays = getBusinessWeekDays(currentMondayKey);
  const previousWeekDays = getBusinessWeekDays(previousMondayKey);

  const [currentWeekCounts, previousWeekCounts] = await Promise.all([
    groupActiveAppointmentsByDate(currentMondayKey, nextMondayKey),
    groupActiveAppointmentsByDate(previousMondayKey, currentMondayKey),
  ]);

  const days = currentWeekDays.map((date) => {
    const occupiedSlots = currentWeekCounts.get(date) ?? 0;
    return {
      date,
      occupiedSlots,
      capacity: MAX_APPOINTMENTS_PER_DAY,
      occupancyPercent: percent(occupiedSlots, MAX_APPOINTMENTS_PER_DAY),
    };
  });

  const currentWeekOccupiedTotal = days.reduce((sum, day) => sum + day.occupiedSlots, 0);
  const previousWeekOccupiedTotal = previousWeekDays.reduce(
    (sum, date) => sum + (previousWeekCounts.get(date) ?? 0),
    0,
  );
  const currentWeekOccupancyPercent = percent(currentWeekOccupiedTotal, WEEK_CAPACITY);
  const previousWeekOccupancyPercent = percent(previousWeekOccupiedTotal, WEEK_CAPACITY);

  return {
    days,
    currentWeekOccupancyPercent,
    previousWeekOccupancyPercent,
    deltaPercentPoints: currentWeekOccupancyPercent - previousWeekOccupancyPercent,
  };
}
