import { getBookableMonthConfig } from "@/lib/active-months/service";
import { getCurrentDateKey, getCurrentTimeKey } from "@/lib/datetime/mexico-city";
import { listMonthActiveReservationLocks, listMonthAppointments } from "@/lib/db/appointments";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";
import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import {
  getAvailableStartSlotsWithManualBlocks,
  isWeekdayBookingDate,
} from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";

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

function getMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

export async function getMonthAvailability(month: string, now = new Date()) {
  const monthConfig = await getBookableMonthConfig(month, now);
  const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);

  const { monthStart, monthEnd } = getMonthBounds(month);
  const bookedAppointments = await listMonthAppointments(monthStart, monthEnd);
  const lockedSlots = await listMonthActiveReservationLocks(monthStart, monthEnd, now);
  const blockedSlots = await listMonthBlockedSlots(monthStart, monthEnd);
  const appointmentsByDate = new Map<string, string[]>();
  const lockedSlotsByDate = new Map<string, string[]>();
  const blockedSlotsByDate = new Map<string, string[]>();
  const currentDate = getCurrentDateKey(now);
  const currentTime = getCurrentTimeKey(now);

  for (const appointment of bookedAppointments) {
    const dayAppointments = appointmentsByDate.get(appointment.date) ?? [];
    dayAppointments.push(appointment.timeSlot);
    appointmentsByDate.set(appointment.date, dayAppointments);
  }

  for (const lock of lockedSlots) {
    const dayLocks = lockedSlotsByDate.get(lock.date) ?? [];
    dayLocks.push(lock.timeSlot);
    lockedSlotsByDate.set(lock.date, dayLocks);
  }

  for (const blockedSlot of blockedSlots) {
    const dayBlockedSlots = blockedSlotsByDate.get(blockedSlot.date) ?? [];
    dayBlockedSlots.push(blockedSlot.timeSlot);
    blockedSlotsByDate.set(blockedSlot.date, dayBlockedSlots);
  }

  return getMonthDays(month)
    .filter((date) => date >= currentDate)
    .filter((date) => isWeekdayBookingDate(date))
    .map((date) => {
      const occupiedSlots = appointmentsByDate.get(date) ?? [];
      const activeLockSlots = lockedSlotsByDate.get(date) ?? [];
      const dayBlockedTimeSlots = blockedSlotsByDate.get(date) ?? [];
      const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(dayBlockedTimeSlots);

      if (hasFullDayBlock) {
        return {
          date,
          slots: [],
        };
      }

      const slots = getAvailableStartSlotsWithManualBlocks(
        baseSlots,
        [...occupiedSlots, ...activeLockSlots],
        Array.from(blockedSlots),
      )
        .filter((slot) => {
        if (date !== currentDate) {
          return true;
        }

        return slot >= currentTime;
      });

      return { date, slots };
    })
    .filter((day) => day.slots.length > 0);
}
