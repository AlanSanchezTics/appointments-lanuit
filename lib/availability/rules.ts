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

function canCoexistWithManualBlockedSlotRule(
  candidateSlot: string,
  blockedSlot: string,
  blockedSlots: readonly string[],
) {
  if (candidateSlot === blockedSlot) {
    return false;
  }

  const candidatePair = pairBySlot.get(candidateSlot);
  const blockedPair = pairBySlot.get(blockedSlot);

  if (!candidatePair || !blockedPair) {
    return true;
  }

  if (candidatePair.pairIndex === blockedPair.pairIndex) {
    return true;
  }

  const blockedFirstSlot = DIRECTIONAL_SLOT_PAIRS[blockedPair.pairIndex][0];
  const blockedSecondSlot = DIRECTIONAL_SLOT_PAIRS[blockedPair.pairIndex][1];
  const hasFirstBlocked = blockedSlots.includes(blockedFirstSlot);
  const hasSecondBlocked = blockedSlots.includes(blockedSecondSlot);

  if (hasFirstBlocked && hasSecondBlocked) {
    return true;
  }

  if (blockedPair.position === "first" && hasFirstBlocked) {
    if (candidatePair.position === "first" && candidatePair.pairIndex > blockedPair.pairIndex) {
      return false;
    }
  }

  if (blockedPair.position === "second" && hasSecondBlocked) {
    if (candidatePair.position === "second" && candidatePair.pairIndex < blockedPair.pairIndex) {
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

export function getAvailableStartSlotsWithManualBlocks(
  baseSlots: readonly string[],
  directionalOccupiedSlots: string[],
  manualBlockedSlots: string[],
) {
  if (directionalOccupiedSlots.length >= MAX_APPOINTMENTS_PER_DAY) {
    return [];
  }

  return baseSlots.filter((candidateSlot) => {
    if (manualBlockedSlots.includes(candidateSlot)) {
      return false;
    }

    const validDirectional = directionalOccupiedSlots.every((occupiedSlot) =>
      canCoexistByDirectionalRule(candidateSlot, occupiedSlot),
    );

    if (!validDirectional) {
      return false;
    }

    return manualBlockedSlots.every((blockedSlot) =>
      canCoexistWithManualBlockedSlotRule(candidateSlot, blockedSlot, manualBlockedSlots),
    );
  });
}
