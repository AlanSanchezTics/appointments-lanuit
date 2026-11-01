// Oráculo congelado: copia de la lógica legada de lib/availability/rules.ts, borrado en la Ronda 4A (T064).
// (getAvailableStartSlotsWithManualBlocks, ramas BLOCK_MODE y SECOND_ONLY_MODE).
// No importa código de la aplicación: las constantes del legado van incrustadas.
// Fixture de prueba permanente. No editar salvo que se regenere la fuente histórica.

type LegacySlotMode = "BLOCK_MODE" | "SECOND_ONLY_MODE";

const LEGACY_DIRECTIONAL_SLOT_PAIRS = [
  ["09:00", "10:00"],
  ["13:00", "14:00"],
  ["17:00", "18:00"],
] as const;

const LEGACY_MAX_APPOINTMENTS_PER_DAY = 3;

type PairSlotPosition = "first" | "second";

const legacyPairBySlot = new Map<string, { pairIndex: number; position: PairSlotPosition }>();

for (const [pairIndex, [firstSlot, secondSlot]] of LEGACY_DIRECTIONAL_SLOT_PAIRS.entries()) {
  legacyPairBySlot.set(firstSlot, { pairIndex, position: "first" });
  legacyPairBySlot.set(secondSlot, { pairIndex, position: "second" });
}

function canCoexistByDirectionalRule(candidateSlot: string, occupiedSlot: string) {
  const candidatePair = legacyPairBySlot.get(candidateSlot);
  const occupiedPair = legacyPairBySlot.get(occupiedSlot);

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

function canCoexistByModeRule(candidateSlot: string, occupiedSlot: string, slotMode: LegacySlotMode) {
  if (slotMode === "SECOND_ONLY_MODE") {
    return candidateSlot !== occupiedSlot;
  }

  return canCoexistByDirectionalRule(candidateSlot, occupiedSlot);
}

function canCoexistWithManualBlockedSlotRule(
  candidateSlot: string,
  blockedSlot: string,
  blockedSlots: readonly string[],
) {
  if (candidateSlot === blockedSlot) {
    return false;
  }

  const candidatePair = legacyPairBySlot.get(candidateSlot);
  const blockedPair = legacyPairBySlot.get(blockedSlot);

  if (!candidatePair || !blockedPair) {
    return true;
  }

  if (candidatePair.pairIndex === blockedPair.pairIndex) {
    return true;
  }

  const blockedFirstSlot = LEGACY_DIRECTIONAL_SLOT_PAIRS[blockedPair.pairIndex][0];
  const blockedSecondSlot = LEGACY_DIRECTIONAL_SLOT_PAIRS[blockedPair.pairIndex][1];
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

export function legacyGetAvailableStartSlotsWithManualBlocks<T extends string>(
  baseSlots: readonly T[],
  directionalOccupiedSlots: string[],
  manualBlockedSlots: string[],
  slotMode: LegacySlotMode = "BLOCK_MODE",
): T[] {
  if (directionalOccupiedSlots.length >= LEGACY_MAX_APPOINTMENTS_PER_DAY) {
    return [];
  }

  if (slotMode === "SECOND_ONLY_MODE") {
    return baseSlots.filter((candidateSlot) => {
      if (manualBlockedSlots.includes(candidateSlot)) {
        return false;
      }

      return directionalOccupiedSlots.every((occupiedSlot) =>
        canCoexistByModeRule(candidateSlot, occupiedSlot, slotMode),
      );
    });
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
