import { isWeekdayBookingDate } from "@/lib/availability/rules";
import { MAX_APPOINTMENTS_PER_DAY } from "@/lib/constants/slots";
import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import { findRegisteredMonth, listAppointmentsByMonth } from "@/lib/db/admin-months";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";

import type { MonthDetailCalendarDay, MonthDetailResponse } from "@/lib/admin/months/types";

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);

  return { monthStart, monthEndExclusive };
}

function getMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

function resolveTone(isWeekend: boolean, availableSpaces: number): MonthDetailCalendarDay["tone"] {
  if (isWeekend) {
    return "weekend";
  }

  if (availableSpaces === 0) {
    return "full";
  }

  if (availableSpaces === 1) {
    return "low";
  }

  return "available";
}

export async function getAdminMonthDetail(
  month: string,
  now = new Date(),
): Promise<MonthDetailResponse> {
  const registration = await findRegisteredMonth(month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const { monthStart, monthEndExclusive } = getMonthBounds(month);
  const [appointments, blockedSlots] = await Promise.all([
    listAppointmentsByMonth(monthStart, monthEndExclusive),
    listMonthBlockedSlots(monthStart, monthEndExclusive),
  ]);
  const activeSlotsByDate = new Map<string, string[]>();
  const blockedSlotsByDate = new Map<string, string[]>();

  let confirmedAppointments = 0;
  let cancelledAppointments = 0;

  for (const appointment of appointments) {
    if (appointment.status === "CANCELLED") {
      cancelledAppointments += 1;
      continue;
    }

    confirmedAppointments += 1;
    const occupied = activeSlotsByDate.get(appointment.date) ?? [];
    occupied.push(appointment.timeSlot);
    activeSlotsByDate.set(appointment.date, occupied);
  }

  for (const blockedSlot of blockedSlots) {
    const dayBlockedSlots = blockedSlotsByDate.get(blockedSlot.date) ?? [];
    dayBlockedSlots.push(blockedSlot.timeSlot);
    blockedSlotsByDate.set(blockedSlot.date, dayBlockedSlots);
  }

  const calendarDays = getMonthDays(month).map((date) => {
    const isWeekend = !isWeekdayBookingDate(date);
    const occupiedSlots = activeSlotsByDate.get(date) ?? [];
    const dayBlockedSlots = blockedSlotsByDate.get(date) ?? [];
    const availableSpaces = isWeekend
      ? 0
      : Math.max(0, MAX_APPOINTMENTS_PER_DAY - (occupiedSlots.length + dayBlockedSlots.length));

    return {
      date,
      day: Number(date.slice(8, 10)),
      isWeekend,
      availableSpaces,
      tone: resolveTone(isWeekend, availableSpaces),
    } satisfies MonthDetailCalendarDay;
  });

  const operationalDays = calendarDays.filter((day) => !day.isWeekend).length;
  const occupiedSpaces = confirmedAppointments;
  const blockedSpaces = blockedSlots.length;
  const totalCapacity = operationalDays * MAX_APPOINTMENTS_PER_DAY;
  const availableSpaces = Math.max(0, totalCapacity - (occupiedSpaces + blockedSpaces));
  const currentMonth = getCurrentMonthKey(now);
  const currentDate = getCurrentDateKey(now);
  const totalModeledSpaces = occupiedSpaces + availableSpaces;
  const projectedSaturationPercent = totalModeledSpaces
    ? Math.round((occupiedSpaces / totalModeledSpaces) * 100)
    : 0;

  return {
    month,
    monthStatus: registration.status,
    currentMonth,
    currentDate,
    isPastMonth: month < currentMonth,
    projectedSaturationPercent,
    metrics: {
      confirmedAppointments,
      cancelledAppointments,
      availableSpaces,
      blockedSpaces,
      occupiedSpaces,
    },
    calendarDays,
  };
}
