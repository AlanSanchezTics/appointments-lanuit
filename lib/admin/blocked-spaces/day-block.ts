import { DIRECTIONAL_SLOT_PAIRS, MAX_APPOINTMENTS_PER_DAY } from "@/lib/constants/slots";
import { resolveBaseSlotsByMonthMode, type MonthSlotMode } from "@/lib/availability/month-slot-mode";

export const FULL_DAY_BLOCK_TIME_SLOT = "00:00";

export function isFullDayBlockTimeSlot(timeSlot: string) {
  return timeSlot === FULL_DAY_BLOCK_TIME_SLOT;
}

export function splitBlockedTimeSlots(timeSlots: readonly string[]) {
  const blockedSlots = new Set<string>();
  let hasFullDayBlock = false;

  for (const timeSlot of timeSlots) {
    if (isFullDayBlockTimeSlot(timeSlot)) {
      hasFullDayBlock = true;
      continue;
    }

    blockedSlots.add(timeSlot);
  }

  return {
    hasFullDayBlock,
    blockedSlots,
  };
}

export function countBlockedSpacesByMode(input: {
  slotMode: MonthSlotMode;
  blockedTimeSlots: readonly string[];
}) {
  const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(input.blockedTimeSlots);

  if (hasFullDayBlock) {
    return MAX_APPOINTMENTS_PER_DAY;
  }

  if (input.slotMode === "SECOND_ONLY_MODE") {
    const secondOnlySlots = resolveBaseSlotsByMonthMode("SECOND_ONLY_MODE");
    return secondOnlySlots.filter((slot) => blockedSlots.has(slot)).length;
  }

  return DIRECTIONAL_SLOT_PAIRS.reduce((total, [firstSlot, secondSlot]) => {
    if (blockedSlots.has(firstSlot) && blockedSlots.has(secondSlot)) {
      return total + 1;
    }

    return total;
  }, 0);
}
