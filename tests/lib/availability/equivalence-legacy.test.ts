import { describe, expect, it } from "vitest";

import { SLOT_MODE_PRESETS, type AvailabilityPresetMode } from "@/lib/availability/defaults";
import { resolveDay } from "@/lib/availability/resolver";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";

import { legacyGetAvailableStartSlotsWithManualBlocks } from "./fixtures/legacy-block-oracle";

// Equivalencia motor frente al oráculo congelado (SC-002, D43, R-05).
// Lunes 2026-12-07; "now" en 2020 para que la fecha no sea hoy y no se filtre por hora actual.
const MONTH = "2026-12";
const DATE = "2026-12-07";
const NOW = new Date("2020-01-01T12:00:00.000Z");

const BLOCK_BASE = [...SLOT_MODE_PRESETS.BLOCK_MODE.times];
const SECOND_BASE = [...SLOT_MODE_PRESETS.SECOND_ONLY_MODE.times];

function engineSlots(mode: AvailabilityPresetMode, occupied: string[], blocked: string[]) {
  const config: MonthAvailabilityConfig = {
    month: MONTH,
    availabilityVersion: 1,
    exceptions: [],
    rules: [
      {
        id: 1,
        startDate: `${MONTH}-01`,
        endDate: `${MONTH}-31`,
        ...SLOT_MODE_PRESETS[mode],
      },
    ],
  };

  return resolveDay(config, DATE, {
    now: NOW,
    occupancy: { occupiedTimes: occupied, blockedTimes: blocked },
  }).slots;
}

function legacySlots(mode: AvailabilityPresetMode, occupied: string[], blocked: string[]) {
  const base = mode === "BLOCK_MODE" ? BLOCK_BASE : SECOND_BASE;

  return [...legacyGetAvailableStartSlotsWithManualBlocks(base, occupied, blocked, mode)];
}

function subsets(items: readonly string[]) {
  return Array.from({ length: 1 << items.length }, (_, mask) => items.filter((_, index) => (mask >> index) & 1));
}

// Ocupaciones alcanzables con el legado sin bloqueos (como el experimento: tope 3, cada cita admitida por las demás).
function reachableOccupiedSets(mode: AvailabilityPresetMode) {
  const base = mode === "BLOCK_MODE" ? BLOCK_BASE : SECOND_BASE;

  return subsets(base).filter(
    (occupied) =>
      occupied.length <= 3 &&
      occupied.every((slot, index) =>
        legacySlots(mode, occupied.filter((_, other) => other !== index), []).includes(slot),
      ),
  );
}

function disjointBlockCombinations(mode: AvailabilityPresetMode) {
  const base = mode === "BLOCK_MODE" ? BLOCK_BASE : SECOND_BASE;
  const pairs: { occupied: string[]; blocked: string[] }[] = [];

  for (const occupied of reachableOccupiedSets(mode)) {
    for (const blocked of subsets(base)) {
      if (blocked.every((slot) => !occupied.includes(slot))) {
        pairs.push({ occupied, blocked });
      }
    }
  }

  return pairs;
}

describe("equivalencia con el legado (oráculo congelado)", () => {
  it("reaches the 20 BLOCK occupancy states and the 8 SECOND_ONLY states of the experiment", () => {
    expect(reachableOccupiedSets("BLOCK_MODE")).toHaveLength(20);
    expect(reachableOccupiedSets("SECOND_ONLY_MODE")).toHaveLength(8);
  });

  it("matches the legacy BLOCK_MODE result for every reachable occupancy without blocks (0 differences, SC-002)", () => {
    const differences = reachableOccupiedSets("BLOCK_MODE").filter(
      (occupied) => JSON.stringify(engineSlots("BLOCK_MODE", occupied, [])) !== JSON.stringify(legacySlots("BLOCK_MODE", occupied, [])),
    );

    expect(differences).toEqual([]);
  });

  it("matches the legacy SECOND_ONLY_MODE result for every reachable occupancy without blocks (0 differences, SC-002)", () => {
    const differences = reachableOccupiedSets("SECOND_ONLY_MODE").filter(
      (occupied) =>
        JSON.stringify(engineSlots("SECOND_ONLY_MODE", occupied, [])) !==
        JSON.stringify(legacySlots("SECOND_ONLY_MODE", occupied, [])),
    );

    expect(differences).toEqual([]);
  });

  it("covers 432 BLOCK combinations of reachable occupancy and disjoint manual blocks", () => {
    expect(disjointBlockCombinations("BLOCK_MODE")).toHaveLength(432);
  });

  // Gate con bloqueos manuales (D43, SC-003): 48 de 432 combinaciones difieren del legado. Se acepta 48;
  // el 27 de D2 salió de una variante con pares y es solo nota histórica. Si cambia, el cambio debe ser decisión de producto.
  it("gate con bloqueos manuales: 48 de 432 combinaciones difieren del legado (D43, SC-003)", () => {
    const blockDifferences = disjointBlockCombinations("BLOCK_MODE").filter(
      ({ occupied, blocked }) =>
        blocked.length > 0 &&
        JSON.stringify(engineSlots("BLOCK_MODE", occupied, blocked)) !==
          JSON.stringify(legacySlots("BLOCK_MODE", occupied, blocked)),
    );

    // Identidad fija de las 48 combinaciones (clave = JSON de { occupied, blocked }, orden por defecto de sort).
    expect(blockDifferences.map(({ occupied, blocked }) => JSON.stringify({ occupied, blocked })).sort()).toEqual([
      `{"occupied":["09:00"],"blocked":["10:00","13:00","18:00"]}`,
      `{"occupied":["09:00"],"blocked":["13:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["09:00","13:00","14:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["09:00","13:00","14:00"]}`,
      `{"occupied":["10:00"],"blocked":["09:00","13:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["09:00","14:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["09:00","14:00"]}`,
      `{"occupied":["10:00"],"blocked":["09:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["13:00","14:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["13:00","14:00"]}`,
      `{"occupied":["10:00"],"blocked":["13:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["14:00","18:00"]}`,
      `{"occupied":["10:00"],"blocked":["14:00"]}`,
      `{"occupied":["10:00"],"blocked":["18:00"]}`,
      `{"occupied":["13:00"],"blocked":["09:00","14:00","18:00"]}`,
      `{"occupied":["13:00"],"blocked":["09:00","14:00"]}`,
      `{"occupied":["13:00"],"blocked":["09:00","18:00"]}`,
      `{"occupied":["13:00"],"blocked":["09:00"]}`,
      `{"occupied":["14:00"],"blocked":["09:00","13:00","18:00"]}`,
      `{"occupied":["14:00"],"blocked":["09:00","18:00"]}`,
      `{"occupied":["14:00"],"blocked":["13:00","18:00"]}`,
      `{"occupied":["14:00"],"blocked":["18:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","13:00","14:00","18:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","13:00","14:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","13:00","18:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","13:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","14:00","18:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","14:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00","18:00"]}`,
      `{"occupied":["17:00"],"blocked":["09:00"]}`,
      `{"occupied":["17:00"],"blocked":["13:00","14:00","18:00"]}`,
      `{"occupied":["17:00"],"blocked":["13:00","14:00"]}`,
      `{"occupied":["17:00"],"blocked":["13:00","18:00"]}`,
      `{"occupied":["17:00"],"blocked":["13:00"]}`,
      `{"occupied":["18:00"],"blocked":["09:00","14:00","17:00"]}`,
      `{"occupied":["18:00"],"blocked":["09:00","14:00"]}`,
      `{"occupied":[],"blocked":["09:00","10:00","13:00","18:00"]}`,
      `{"occupied":[],"blocked":["09:00","13:00","14:00","18:00"]}`,
      `{"occupied":[],"blocked":["09:00","13:00","14:00"]}`,
      `{"occupied":[],"blocked":["09:00","13:00","18:00"]}`,
      `{"occupied":[],"blocked":["09:00","14:00","17:00","18:00"]}`,
      `{"occupied":[],"blocked":["09:00","14:00","17:00"]}`,
      `{"occupied":[],"blocked":["09:00","14:00","18:00"]}`,
      `{"occupied":[],"blocked":["09:00","14:00"]}`,
      `{"occupied":[],"blocked":["09:00","18:00"]}`,
      `{"occupied":[],"blocked":["10:00","13:00","18:00"]}`,
      `{"occupied":[],"blocked":["13:00","14:00","18:00"]}`,
      `{"occupied":[],"blocked":["13:00","18:00"]}`,
    ]);

    // Superconjunto: en cada diferencia el motor ofrece todos los slots del legado (solo añade).
    const missingFromEngine = blockDifferences
      .filter(({ occupied, blocked }) => {
        const engine = engineSlots("BLOCK_MODE", occupied, blocked);

        return legacySlots("BLOCK_MODE", occupied, blocked).some((slot) => !engine.includes(slot));
      })
      .map(({ occupied, blocked }) => JSON.stringify({ occupied, blocked }));

    expect(missingFromEngine).toEqual([]);
  });
});
