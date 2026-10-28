import type { DayAvailability } from "@/lib/availability/service";

export type SlotOption = {
  slot: string;
  daysCount: number;
};

export function getSlotOptions(days: DayAvailability[]): SlotOption[] {
  const counts = new Map<string, number>();

  for (const day of days) {
    for (const slot of day.slots) {
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([slot, daysCount]) => ({ slot, daysCount })).sort(
    (a, b) => a.slot.localeCompare(b.slot),
  );
}

export function getDatesForSlot(days: DayAvailability[], slot: string) {
  return days.filter((day) => day.slots.includes(slot)).map((day) => day.date);
}

/**
 * Returns the draft fields needed so `slot` is paired with a date that has it,
 * or null when the current draft already satisfies that.
 */
export function alignDraftToSlot(
  days: DayAvailability[],
  slot: string,
  current: { date: string | null; timeSlot: string | null },
) {
  const dates = getDatesForSlot(days, slot);

  if (
    current.timeSlot === slot
    && current.date !== null
    && dates.includes(current.date)
  ) {
    return null;
  }

  const date = current.date !== null && dates.includes(current.date)
    ? current.date
    : (dates[0] ?? null);

  return { date, timeSlot: slot };
}
