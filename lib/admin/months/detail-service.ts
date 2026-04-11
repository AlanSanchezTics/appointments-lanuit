import { getAvailableStartSlotsWithManualBlocks, isWeekdayBookingDate } from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import { countBlockedSpacesByMode, splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import { DIRECTIONAL_SLOT_PAIRS, MAX_APPOINTMENTS_PER_DAY } from "@/lib/constants/slots";
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

function getPreviousMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonthDate = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousYear = previousMonthDate.getUTCFullYear();
  const previousMonth = String(previousMonthDate.getUTCMonth() + 1).padStart(2, "0");

  return `${previousYear}-${previousMonth}`;
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

function countAvailableSpacesFromSlots(availableSlots: readonly string[]) {
  const pairsWithAvailability = new Set<number>();

  for (const slot of availableSlots) {
    const pairIndex = DIRECTIONAL_SLOT_PAIRS.findIndex(
      ([firstSlot, secondSlot]) => firstSlot === slot || secondSlot === slot,
    );

    if (pairIndex >= 0) {
      pairsWithAvailability.add(pairIndex);
    }
  }

  return pairsWithAvailability.size;
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
  const previousMonth = getPreviousMonthKey(month);
  const { monthStart: previousMonthStart, monthEndExclusive: previousMonthEndExclusive } =
    getMonthBounds(previousMonth);
  const [
    appointments,
    blockedSlots,
    previousMonthAppointments,
    previousMonthBlockedSlots,
    previousMonthRegistration,
  ] =
    await Promise.all([
      listAppointmentsByMonth(monthStart, monthEndExclusive),
      listMonthBlockedSlots(monthStart, monthEndExclusive),
      listAppointmentsByMonth(previousMonthStart, previousMonthEndExclusive),
      listMonthBlockedSlots(previousMonthStart, previousMonthEndExclusive),
      findRegisteredMonth(previousMonth),
    ]);
  const previousMonthSlotMode = previousMonthRegistration?.slotMode ?? registration.slotMode;
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
    const dayBlockedTimeSlots = blockedSlotsByDate.get(date) ?? [];
    const { hasFullDayBlock } = splitBlockedTimeSlots(dayBlockedTimeSlots);
    const { blockedSlots } = splitBlockedTimeSlots(dayBlockedTimeSlots);
    const baseSlots = resolveBaseSlotsByMonthMode(registration.slotMode);
    const dayAvailableSlots = isWeekend || hasFullDayBlock
      ? []
      : getAvailableStartSlotsWithManualBlocks(
        baseSlots,
        occupiedSlots,
        Array.from(blockedSlots),
        registration.slotMode,
      );
    const availableSpaces = countAvailableSpacesFromSlots(dayAvailableSlots);

    return {
      date,
      day: Number(date.slice(8, 10)),
      isWeekend,
      availableSpaces,
      appointmentsCount: occupiedSlots.length,
      tone: resolveTone(isWeekend, availableSpaces),
    } satisfies MonthDetailCalendarDay;
  });

  const operationalDays = calendarDays.filter((day) => !day.isWeekend).length;
  const occupiedSpaces = confirmedAppointments;
  const blockedSpaces = calendarDays
    .filter((day) => !day.isWeekend)
    .reduce(
      (total, day) =>
        total
        + countBlockedSpacesByMode({
          slotMode: registration.slotMode,
          blockedTimeSlots: blockedSlotsByDate.get(day.date) ?? [],
        }),
      0,
    );
  const totalCapacity = operationalDays * MAX_APPOINTMENTS_PER_DAY;
  const availableSpaces = Math.max(0, totalCapacity - (occupiedSpaces + blockedSpaces));
  const currentMonth = getCurrentMonthKey(now);
  const currentDate = getCurrentDateKey(now);
  const totalModeledSpaces = occupiedSpaces + availableSpaces;
  const projectedSaturationPercent = totalModeledSpaces
    ? Math.round((occupiedSpaces / totalModeledSpaces) * 100)
    : 0;
  const previousMonthOperationalDays = getMonthDays(previousMonth).filter((date) =>
    isWeekdayBookingDate(date),
  ).length;
  const previousMonthOccupiedSpaces = previousMonthAppointments.filter(
    (appointment) => appointment.status !== "CANCELLED",
  ).length;
  const previousMonthBlockedByDate = new Map<string, string[]>();

  for (const blockedSlot of previousMonthBlockedSlots) {
    const dayBlockedSlots = previousMonthBlockedByDate.get(blockedSlot.date) ?? [];
    dayBlockedSlots.push(blockedSlot.timeSlot);
    previousMonthBlockedByDate.set(blockedSlot.date, dayBlockedSlots);
  }

  const previousMonthBlockedSpaces = getMonthDays(previousMonth)
    .filter((date) => isWeekdayBookingDate(date))
    .reduce(
      (total, date) =>
        total
        + countBlockedSpacesByMode({
          slotMode: previousMonthSlotMode,
          blockedTimeSlots: previousMonthBlockedByDate.get(date) ?? [],
        }),
      0,
    );
  const previousMonthTotalCapacity = previousMonthOperationalDays * MAX_APPOINTMENTS_PER_DAY;
  const previousMonthAvailableSpaces = Math.max(
    0,
    previousMonthTotalCapacity - (previousMonthOccupiedSpaces + previousMonthBlockedSpaces),
  );
  const previousMonthModeledSpaces =
    previousMonthOccupiedSpaces + previousMonthAvailableSpaces;
  const previousProjectedSaturationPercent = previousMonthModeledSpaces
    ? Math.round((previousMonthOccupiedSpaces / previousMonthModeledSpaces) * 100)
    : 0;
  const deltaPercentPoints =
    projectedSaturationPercent - previousProjectedSaturationPercent;

  return {
    month,
    monthStatus: registration.status,
    slotMode: registration.slotMode,
    currentMonth,
    currentDate,
    isPastMonth: month < currentMonth,
    projectedSaturationPercent,
    saturationComparison: {
      previousMonth,
      previousProjectedSaturationPercent,
      deltaPercentPoints,
    },
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
