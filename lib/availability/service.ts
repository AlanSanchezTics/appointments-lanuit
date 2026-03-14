import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { getCurrentDateKey, getCurrentTimeKey, isCurrentMonth } from "@/lib/datetime/mexico-city";
import { listMonthActiveReservationLocks, listMonthAppointments } from "@/lib/db/appointments";
import { getAvailableStartSlots, isWeekdayBookingDate } from "@/lib/availability/rules";

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
  if (!isCurrentMonth(month, now)) {
    throw new Error("MONTH_NOT_ALLOWED");
  }

  const { monthStart, monthEnd } = getMonthBounds(month);
  const bookedAppointments = await listMonthAppointments(monthStart, monthEnd);
  const lockedSlots = await listMonthActiveReservationLocks(monthStart, monthEnd, now);
  const appointmentsByDate = new Map<string, string[]>();
  const lockedSlotsByDate = new Map<string, string[]>();
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

  return getMonthDays(month)
    .filter((date) => date >= currentDate)
    .filter((date) => isWeekdayBookingDate(date))
    .map((date) => {
      const occupiedSlots = appointmentsByDate.get(date) ?? [];
      const activeLockSlots = lockedSlotsByDate.get(date) ?? [];
      const slots = getAvailableStartSlots(BASE_TIME_SLOTS, occupiedSlots)
        .filter((slot) => !activeLockSlots.includes(slot))
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
