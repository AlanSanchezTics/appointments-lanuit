import { APPOINTMENT_GAP_HOURS } from "@/lib/constants/slots";
import { parseTimeSlot } from "@/lib/datetime/mexico-city";

export function isWeekdayBookingDate(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function hasMinimumGap(candidateSlot: string, existingSlots: string[]) {
  const candidateHour = parseTimeSlot(candidateSlot).hour;

  return existingSlots.every((slot) => {
    const existingHour = parseTimeSlot(slot).hour;
    return Math.abs(candidateHour - existingHour) >= APPOINTMENT_GAP_HOURS;
  });
}
