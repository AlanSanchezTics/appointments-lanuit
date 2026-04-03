import type { AppointmentStatus } from "@prisma/client";

import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";
import { MAX_APPOINTMENTS_PER_DAY } from "@/lib/constants/slots";
import { getCurrentDateKey, getCurrentTimeKey } from "@/lib/datetime/mexico-city";
import { listActiveAppointmentsByDate } from "@/lib/db/admin-appointments";
import { prisma } from "@/lib/db/prisma";
import type { AppLanguage } from "@/lib/i18n/config";

import { getDailyTipSelection } from "./daily-tip";
import type {
  DashboardReminderItem,
  DashboardReminderType,
  WeeklyOccupancySummary,
} from "./types";

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

function getAgendaTargetDateKey(currentDateKey: string) {
  const currentDate = parseDateKeyToUtcDate(currentDateKey);
  const dayOfWeek = currentDate.getUTCDay();

  if (dayOfWeek === 6) {
    return toDateKey(addUtcDays(currentDate, 2));
  }

  if (dayOfWeek === 0) {
    return toDateKey(addUtcDays(currentDate, 1));
  }

  return currentDateKey;
}

function percent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function toMinutes(timeSlot: string) {
  const [hour, minute] = timeSlot.split(":").map(Number);
  return (hour * 60) + minute;
}

function resolveAgendaStatus(
  appointmentDateKey: string,
  timeSlot: string,
  currentDateKey: string,
  currentTimeSlot: string,
) {
  if (appointmentDateKey > currentDateKey) {
    return "PENDING" as const;
  }

  if (appointmentDateKey < currentDateKey) {
    return "READY" as const;
  }

  const startMinutes = toMinutes(timeSlot);
  const endMinutes = startMinutes + 180;
  const currentMinutes = toMinutes(currentTimeSlot);

  if (currentMinutes >= endMinutes) {
    return "READY" as const;
  }

  if (currentMinutes >= startMinutes) {
    return "IN_PROGRESS" as const;
  }

  return "PENDING" as const;
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

async function listPendingAppointments(): Promise<AdminPendingAppointmentItem[]> {
  const rows = await prisma.appointment.findMany({
    where: {
      status: "PENDING",
    },
    select: {
      id: true,
      date: true,
      timeSlot: true,
      client: {
        select: {
          clientNumber: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: [
      { date: "asc" },
      { timeSlot: "asc" },
      { createdAt: "asc" },
    ],
  });

  return rows.map((row) => ({
    appointmentId: row.id,
    clientNumber: row.client.clientNumber,
    date: toDateKey(row.date),
    timeSlot: row.timeSlot.toISOString().slice(11, 16),
    name: row.client.name,
    phone: row.client.phone,
  }));
}

async function listReminderAppointmentsByDate(
  dateKey: string,
  reminderType: DashboardReminderType,
): Promise<DashboardReminderItem[]> {
  const nextDateKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(dateKey), 1));
  const rows = await prisma.appointment.findMany({
    where: {
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
      date: {
        gte: parseDateKeyToUtcDate(dateKey),
        lt: parseDateKeyToUtcDate(nextDateKey),
      },
    },
    select: {
      id: true,
      date: true,
      timeSlot: true,
      appointmentReminders: {
        where: {
          reminderType,
        },
        select: {
          id: true,
        },
        take: 1,
      },
      client: {
        select: {
          clientNumber: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: [
      { timeSlot: "asc" },
      { createdAt: "asc" },
    ],
  });

  return rows.map((row) => ({
    appointmentId: row.id,
    clientNumber: row.client.clientNumber,
    date: toDateKey(row.date),
    timeSlot: row.timeSlot.toISOString().slice(11, 16),
    name: row.client.name,
    phone: row.client.phone,
    reminderType,
    reminderSent: row.appointmentReminders.length > 0,
  }));
}

function getBusinessWeekDays(mondayKey: string) {
  const monday = parseDateKeyToUtcDate(mondayKey);
  return Array.from({ length: 5 }, (_, index) => toDateKey(addUtcDays(monday, index)));
}

export async function getAdminDashboardWeeklyOccupancy(
  language: AppLanguage,
  now = new Date(),
): Promise<WeeklyOccupancySummary> {
  const currentDateKey = getCurrentDateKey(now);
  const agendaTargetDateKey = getAgendaTargetDateKey(currentDateKey);
  const currentTimeKey = getCurrentTimeKey(now);
  const currentMondayKey = getCurrentWeekMondayKey(currentDateKey);
  const previousMondayKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(currentMondayKey), -7));
  const nextMondayKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(currentMondayKey), 7));
  const nextDayKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(currentDateKey), 1));
  const nextWeekKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(currentDateKey), 7));
  const currentWeekDays = getBusinessWeekDays(currentMondayKey);
  const previousWeekDays = getBusinessWeekDays(previousMondayKey);

  const [
    currentWeekCounts,
    previousWeekCounts,
    todayAppointments,
    pendingAppointments,
    nextDayReminders,
    nextWeekReminders,
    dailyTip,
  ] = await Promise.all([
    groupActiveAppointmentsByDate(currentMondayKey, nextMondayKey),
    groupActiveAppointmentsByDate(previousMondayKey, currentMondayKey),
    listActiveAppointmentsByDate(agendaTargetDateKey),
    listPendingAppointments(),
    listReminderAppointmentsByDate(nextDayKey, "NEXT_DAY"),
    listReminderAppointmentsByDate(nextWeekKey, "NEXT_WEEK"),
    getDailyTipSelection(language, now),
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
  const busiestDay = days.reduce((currentMax, day) =>
    day.occupiedSlots > currentMax.occupiedSlots ? day : currentMax);
  const todayAgenda = todayAppointments.map((appointment) => ({
    appointmentId: appointment.id,
    timeSlot: appointment.timeSlot,
    name: appointment.name,
    phone: appointment.phone,
    status: resolveAgendaStatus(
      appointment.date,
      appointment.timeSlot,
      currentDateKey,
      currentTimeKey,
    ),
  }));
  const todayOccupiedAppointments = todayAgenda.length;

  return {
    days,
    busiestDay,
    dailyOccupancy: {
      date: currentDateKey,
      occupiedAppointments: todayOccupiedAppointments,
      capacity: MAX_APPOINTMENTS_PER_DAY,
      occupancyPercent: Math.min(
        100,
        percent(todayOccupiedAppointments, MAX_APPOINTMENTS_PER_DAY),
      ),
    },
    todayAgendaTargetDate: agendaTargetDateKey,
    todayAgenda,
    pendingAppointments,
    reminders: {
      nextDay: nextDayReminders,
      nextWeek: nextWeekReminders,
    },
    dailyTip,
    currentWeekOccupancyPercent,
    previousWeekOccupancyPercent,
    deltaPercentPoints: currentWeekOccupancyPercent - previousWeekOccupancyPercent,
  };
}
