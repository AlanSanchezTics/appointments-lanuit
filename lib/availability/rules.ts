import { DIRECTIONAL_SLOT_PAIRS, MAX_APPOINTMENTS_PER_DAY } from "@/lib/constants/slots";

type PairSlotPosition = "first" | "second";

const pairBySlot = new Map<string, { pairIndex: number; position: PairSlotPosition }>();

for (const [pairIndex, [firstSlot, secondSlot]] of DIRECTIONAL_SLOT_PAIRS.entries()) {
  pairBySlot.set(firstSlot, { pairIndex, position: "first" });
  pairBySlot.set(secondSlot, { pairIndex, position: "second" });
}

function canCoexistByDirectionalRule(candidateSlot: string, occupiedSlot: string) {
  const candidatePair = pairBySlot.get(candidateSlot);
  const occupiedPair = pairBySlot.get(occupiedSlot);

  if (!candidatePair || !occupiedPair) {
    return candidateSlot !== occupiedSlot;
  }

  if (candidatePair.pairIndex === occupiedPair.pairIndex) {
    return false;
  }

  if (occupiedPair.position === "first") {
    if (candidatePair.position === "second" && candidatePair.pairIndex < occupiedPair.pairIndex) {
      return false;
    }
  }

  if (occupiedPair.position === "second") {
    if (candidatePair.position === "first" && candidatePair.pairIndex > occupiedPair.pairIndex) {
      return false;
    }
  }

  return true;
}

export function isWeekdayBookingDate(date: string) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function getAvailableStartSlots(baseSlots: readonly string[], occupiedSlots: string[]) {
  if (occupiedSlots.length >= MAX_APPOINTMENTS_PER_DAY) {
    return [];
  }

  return baseSlots.filter((candidateSlot) => {
    if (occupiedSlots.includes(candidateSlot)) {
      return false;
    }

    return occupiedSlots.every((occupiedSlot) => canCoexistByDirectionalRule(candidateSlot, occupiedSlot));
  });
}
