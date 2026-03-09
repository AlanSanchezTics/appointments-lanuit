import { APPOINTMENT_GAP_HOURS } from "@/lib/constants/slots";
import { parseTimeSlot } from "@/lib/datetime/mexico-city";

export function isWeekdayBookingDate(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function hasMinimumGap(candidateSlot: string, existingSlots: string[]) {
  const candidateTime = parseTimeSlot(candidateSlot);
  const candidateMinutes = candidateTime.hour * 60 + candidateTime.minute;

  return existingSlots.every((slot) => {
    const existingTime = parseTimeSlot(slot);
    const existingMinutes = existingTime.hour * 60 + existingTime.minute;
    return Math.abs(candidateMinutes - existingMinutes) >= APPOINTMENT_GAP_HOURS * 60;
  });
}

export function getAvailableStartSlots(baseSlots: readonly string[], occupiedSlots: string[]) {
  return baseSlots.filter((slot) => !occupiedSlots.includes(slot) && hasMinimumGap(slot, occupiedSlots));
}
