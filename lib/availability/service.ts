import { getBookableMonthConfig } from "@/lib/active-months/service";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { listMonthAppointments, listMonthActiveReservationLocks } from "@/lib/db/appointments";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";
import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import { resolveMonthDays } from "@/lib/availability/resolver";
import type { DayOccupancy } from "@/lib/availability/types";

export type DayAvailability = {
  date: string;
  slots: string[];
};

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return { monthStart, monthEnd };
}

function groupTimesByDate(rows: ReadonlyArray<{ date: string; timeSlot: string }>) {
  const byDate = new Map<string, string[]>();

  for (const row of rows) {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row.timeSlot]);
  }

  return byDate;
}

export async function getMonthAvailability(month: string, now = new Date()) {
  // Gate de mes activo y no pasado (MONTH_NOT_ALLOWED). Las reglas se leen sin bloqueo: esta lectura es pública.
  await getBookableMonthConfig(month, now);

  const config = await findMonthAvailability(month);

  if (!config) {
    throw new Error("MONTH_NOT_ALLOWED");
  }

  const { monthStart, monthEnd } = getMonthBounds(month);
  const [bookedAppointments, lockedSlots, blockedSlots] = await Promise.all([
    listMonthAppointments(monthStart, monthEnd),
    listMonthActiveReservationLocks(monthStart, monthEnd, now),
    listMonthBlockedSlots(monthStart, monthEnd),
  ]);

  const occupiedByDate = groupTimesByDate(bookedAppointments);
  const lockedByDate = groupTimesByDate(lockedSlots);
  const blockedByDate = groupTimesByDate(blockedSlots);
  const occupancyByDate: Record<string, DayOccupancy> = {};

  // A-05: los locks activos cuentan como ocupados en el flujo público.
  for (const date of new Set([...occupiedByDate.keys(), ...lockedByDate.keys(), ...blockedByDate.keys()])) {
    const { hasFullDayBlock, blockedSlots: manualBlocks } = splitBlockedTimeSlots(
      blockedByDate.get(date) ?? [],
    );

    occupancyByDate[date] = {
      occupiedTimes: [...(occupiedByDate.get(date) ?? []), ...(lockedByDate.get(date) ?? [])],
      blockedTimes: Array.from(manualBlocks),
      fullDayBlocked: hasFullDayBlock,
    };
  }

  const currentDate = getCurrentDateKey(now);

  return resolveMonthDays(config, { now, occupancyByDate })
    .filter((day) => day.date >= currentDate)
    .map(({ date, slots }) => ({ date, slots }))
    .filter((day) => day.slots.length > 0);
}
