import type { DayRule } from "@/lib/availability/types";

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

// D14/D41/FR-029: cada hora de la rejilla vigente bloqueada cuenta 1 espacio; un bloqueo de día completo
// cuenta 1 por cada hora de la rejilla. Sin regla vigente el día cuenta 0. Acepta el centinela "00:00" tal cual llega.
export function countBlockedSpaces(dayRule: DayRule | null, blockedTimes: readonly string[]) {
  if (!dayRule) {
    return 0;
  }

  const grid = new Set(dayRule.times);
  const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(blockedTimes);

  if (hasFullDayBlock) {
    return grid.size;
  }

  return [...grid].filter((time) => blockedSlots.has(time)).length;
}
