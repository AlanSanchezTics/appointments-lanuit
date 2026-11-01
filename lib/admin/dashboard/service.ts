import type { AppointmentStatus } from "@prisma/client";

import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";
import { resolveDay } from "@/lib/availability/resolver";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";
import { getCurrentDateKey, getCurrentTimeKey } from "@/lib/datetime/mexico-city";
import { listActiveAppointmentsByDate } from "@/lib/db/admin-appointments";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import type { AppLanguage } from "@/lib/i18n/config";

import { getDailyTipSelection } from "./daily-tip";
import type {
  DashboardReminderItem,
  DashboardReminderType,
  RetouchReminderItem,
  WeeklyOccupancySummary,
} from "./types";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["CONFIRMED", "SYNC_FAILED"];

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

// D66 (reemplaza D61 en lo relativo a PENDING): la ocupación del admin no cuenta PENDING; el público sí lo bloquea.
// Solo la usan las métricas de ocupación; recordatorios y resumen de retoque conservan ACTIVE_APPOINTMENT_STATUSES.
async function groupActiveAppointmentsByDate(startDateKey: string, endDateExclusiveKey: string) {
  const rows = await prisma.appointment.groupBy({
    by: ["date"],
    where: {
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
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
          alias: true,
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
    alias: row.client.alias,
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
      client: {
        select: {
          clientNumber: true,
          name: true,
          alias: true,
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
    alias: row.client.alias,
    phone: row.client.phone,
    reminderType,
  }));
}

async function listRetouchReminderCandidates(
  currentDateKey: string,
): Promise<RetouchReminderItem[]> {
  const currentDate = parseDateKeyToUtcDate(currentDateKey);
  const date21DaysAgo = addUtcDays(currentDate, -21);
  const date31DaysAhead = addUtcDays(currentDate, 31);
  const date21DaysAgoKey = toDateKey(date21DaysAgo);
  const date31DaysAheadKey = toDateKey(date31DaysAhead);

  const baseAppointments = await prisma.appointment.findMany({
    where: {
      status: {
        in: ACTIVE_APPOINTMENT_STATUSES,
      },
      date: {
        gte: date21DaysAgo,
        lt: addUtcDays(date21DaysAgo, 1),
      },
    },
    select: {
      clientId: true,
      client: {
        select: {
          clientNumber: true,
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
    orderBy: [
      { client: { clientNumber: "asc" } },
      { id: "asc" },
    ],
  });

  const uniqueClients = new Map<
    number,
    {
      clientNumber: number;
      name: string;
      alias: string | null;
      phone: string;
    }
  >();
  for (const appointment of baseAppointments) {
    if (!uniqueClients.has(appointment.clientId)) {
      uniqueClients.set(appointment.clientId, {
        clientNumber: appointment.client.clientNumber,
        name: appointment.client.name,
        alias: appointment.client.alias,
        phone: appointment.client.phone,
      });
    }
  }

  const clientIds = Array.from(uniqueClients.keys());
  if (clientIds.length === 0) {
    return [];
  }

  const clientAppointments = await prisma.appointment.findMany({
    where: {
      clientId: {
        in: clientIds,
      },
      date: {
        gt: date21DaysAgo,
        lte: date31DaysAhead,
      },
    },
    select: {
      clientId: true,
      date: true,
      status: true,
    },
  });

  const byClient = new Map<
    number,
    Array<{
      date: string;
      status: AppointmentStatus;
    }>
  >();
  for (const appointment of clientAppointments) {
    const key = toDateKey(appointment.date);
    const bucket = byClient.get(appointment.clientId) ?? [];
    bucket.push({
      date: key,
      status: appointment.status,
    });
    byClient.set(appointment.clientId, bucket);
  }

  const candidates: RetouchReminderItem[] = [];

  for (const clientId of clientIds) {
    const client = uniqueClients.get(clientId);
    if (!client) {
      continue;
    }

    const appointments = byClient.get(clientId) ?? [];
    const retrospective = appointments.filter(
      (item) => item.date <= currentDateKey,
    );
    const prospective = appointments.filter(
      (item) => item.date >= currentDateKey && item.date <= date31DaysAheadKey,
    );
    const hasConfirmedInRetrospective = retrospective.some(
      (item) => item.status === "CONFIRMED",
    );
    const hasConfirmedInProspective = prospective.some(
      (item) => item.status === "CONFIRMED",
    );

    if (hasConfirmedInRetrospective || hasConfirmedInProspective) {
      continue;
    }

    const hasAppointmentsInWindows = appointments.length > 0;
    candidates.push({
      clientId,
      clientNumber: client.clientNumber,
      name: client.name,
      alias: client.alias,
      phone: client.phone,
      lastAppointmentDate: date21DaysAgoKey,
      candidateReason: hasAppointmentsInWindows
        ? "ONLY_NON_CONFIRMED_APPOINTMENTS"
        : "NO_CONFIRMED_IN_31_DAYS",
    });
  }

  return candidates.sort((a, b) => a.clientNumber - b.clientNumber);
}

// D44/D53: capacidad de cada fecha = maxPerDay del día resuelto con la configuración de SU mes.
// Día cerrado (sin regla o con lista de horas vacía) = 0. Una semana puede cruzar dos meses.
// D57: un día con bloqueo de día completo aporta 0. Los bloqueos se leen en un solo rango.
async function resolveDayCapacities(dateKeys: readonly string[], now: Date) {
  const sortedDateKeys = [...dateKeys].sort();
  const firstDateKey = sortedDateKeys[0];
  const lastDateKey = sortedDateKeys[sortedDateKeys.length - 1];
  const blockedSlots = await listMonthBlockedSlots(
    firstDateKey,
    toDateKey(addUtcDays(parseDateKeyToUtcDate(lastDateKey), 1)),
  );
  const blockedTimesByDate = new Map<string, string[]>();

  for (const slot of blockedSlots) {
    blockedTimesByDate.set(slot.date, [...(blockedTimesByDate.get(slot.date) ?? []), slot.timeSlot]);
  }

  const dateKeysByMonth = new Map<string, string[]>();

  for (const dateKey of dateKeys) {
    const month = dateKey.slice(0, 7);
    dateKeysByMonth.set(month, [...(dateKeysByMonth.get(month) ?? []), dateKey]);
  }

  const capacities = new Map<string, number>();

  for (const [month, monthDateKeys] of dateKeysByMonth) {
    // Mes sin registro: sin reglas, D6 aplica (mismo criterio que detail-service).
    const config: MonthAvailabilityConfig =
      (await findMonthAvailability(month)) ?? { month, rules: [], exceptions: [], availabilityVersion: 0 };

    for (const dateKey of monthDateKeys) {
      const { dayRule } = resolveDay(config, dateKey, { now });
      const { hasFullDayBlock } = splitBlockedTimeSlots(blockedTimesByDate.get(dateKey) ?? []);
      const isOpen = !hasFullDayBlock && dayRule !== null && dayRule.times.length > 0;
      capacities.set(dateKey, isOpen ? dayRule.maxPerDay : 0);
    }
  }

  return capacities;
}

// D57: la semana es lunes a domingo; sábados y domingos cuentan si la regla los abre.
function getWeekDays(mondayKey: string) {
  const monday = parseDateKeyToUtcDate(mondayKey);
  return Array.from({ length: 7 }, (_, index) => toDateKey(addUtcDays(monday, index)));
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
  const currentWeekDays = getWeekDays(currentMondayKey);
  const previousWeekDays = getWeekDays(previousMondayKey);

  const nextAgendaDateKey = toDateKey(addUtcDays(parseDateKeyToUtcDate(agendaTargetDateKey), 1));

  const [
    currentWeekCounts,
    previousWeekCounts,
    agendaCounts,
    todayAppointments,
    pendingAppointments,
    nextDayReminders,
    nextWeekReminders,
    retouchReminders,
    dailyTip,
    capacities,
  ] = await Promise.all([
    groupActiveAppointmentsByDate(currentMondayKey, nextMondayKey),
    groupActiveAppointmentsByDate(previousMondayKey, currentMondayKey),
    groupActiveAppointmentsByDate(agendaTargetDateKey, nextAgendaDateKey),
    listActiveAppointmentsByDate(agendaTargetDateKey),
    listPendingAppointments(),
    listReminderAppointmentsByDate(nextDayKey, "NEXT_DAY"),
    listReminderAppointmentsByDate(nextWeekKey, "NEXT_WEEK"),
    listRetouchReminderCandidates(currentDateKey),
    getDailyTipSelection(language, now),
    resolveDayCapacities([...currentWeekDays, ...previousWeekDays, agendaTargetDateKey], now),
  ]);

  const days = currentWeekDays.map((date) => {
    const occupiedSlots = currentWeekCounts.get(date) ?? 0;
    const capacity = capacities.get(date) ?? 0;
    return {
      date,
      occupiedSlots,
      capacity,
      occupancyPercent: percent(occupiedSlots, capacity),
    };
  });

  const currentWeekOccupiedTotal = days.reduce((sum, day) => sum + day.occupiedSlots, 0);
  const currentWeekCapacity = days.reduce((sum, day) => sum + day.capacity, 0);
  const previousWeekOccupiedTotal = previousWeekDays.reduce(
    (sum, date) => sum + (previousWeekCounts.get(date) ?? 0),
    0,
  );
  const previousWeekCapacity = previousWeekDays.reduce(
    (sum, date) => sum + (capacities.get(date) ?? 0),
    0,
  );
  const currentWeekOccupancyPercent = percent(currentWeekOccupiedTotal, currentWeekCapacity);
  const previousWeekOccupancyPercent = percent(previousWeekOccupiedTotal, previousWeekCapacity);
  const busiestDay = days.reduce((currentMax, day) =>
    day.occupiedSlots > currentMax.occupiedSlots ? day : currentMax);
  const todayAgenda = todayAppointments.map((appointment) => ({
    appointmentId: appointment.id,
    timeSlot: appointment.timeSlot,
    name: appointment.name,
    alias: appointment.alias,
    phone: appointment.phone,
    status: resolveAgendaStatus(
      appointment.date,
      appointment.timeSlot,
      currentDateKey,
      currentTimeKey,
    ),
  }));
  // D61: cuenta las citas que bloquean horario en la fecha de agenda (incluye PENDING); la lista de agenda no cambia.
  const todayOccupiedAppointments = agendaCounts.get(agendaTargetDateKey) ?? 0;
  // D58: la capacidad usa la misma fecha que la agenda mostrada (lunes siguiente si hoy es fin de semana).
  // dailyOccupancy.date se conserva en hoy: app/admin/page.tsx compara ambas fechas para elegir el título.
  const todayCapacity = capacities.get(agendaTargetDateKey) ?? 0;

  return {
    days,
    busiestDay,
    dailyOccupancy: {
      date: currentDateKey,
      occupiedAppointments: todayOccupiedAppointments,
      capacity: todayCapacity,
      occupancyPercent: Math.min(
        100,
        percent(todayOccupiedAppointments, todayCapacity),
      ),
    },
    todayAgendaTargetDate: agendaTargetDateKey,
    todayAgenda,
    pendingAppointments,
    reminders: {
      nextDay: nextDayReminders,
      nextWeek: nextWeekReminders,
    },
    retouchReminders,
    dailyTip,
    currentWeekOccupancyPercent,
    previousWeekOccupancyPercent,
    deltaPercentPoints: currentWeekOccupancyPercent - previousWeekOccupancyPercent,
  };
}
