import { describe, expect, it } from "vitest";

import { SLOT_MODE_PRESETS } from "@/lib/availability/defaults";
import { buildSlotModePresetRules, deriveSlotMode } from "@/lib/availability/slot-mode-derivation";

// Verificación mínima de T011. T018 completa la cobertura de la derivación.
const FULL_DECEMBER_BLOCK = buildSlotModePresetRules("2026-12", "BLOCK_MODE");

describe("slot mode derivation (mínimo T011)", () => {
  it("returns BLOCK_MODE for a month without rules, even if it was SECOND_ONLY (D31)", () => {
    expect(deriveSlotMode([], "SECOND_ONLY_MODE")).toBe("BLOCK_MODE");
  });

  it("returns the preset when one full-month rule matches it exactly", () => {
    expect(deriveSlotMode(FULL_DECEMBER_BLOCK, "SECOND_ONLY_MODE")).toBe("BLOCK_MODE");
    expect(deriveSlotMode(buildSlotModePresetRules("2026-12", "SECOND_ONLY_MODE"), "BLOCK_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("keeps the current value for a partial rule with preset values (D19, A-09)", () => {
    const partial = [{ ...FULL_DECEMBER_BLOCK[0], endDate: "2026-12-30" }];

    expect(deriveSlotMode(partial, "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("keeps the current value when maxPerDay differs from the preset", () => {
    const changed = [{ ...FULL_DECEMBER_BLOCK[0], maxPerDay: 4 }];

    expect(deriveSlotMode(changed, "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("builds a single full-month rule with the preset values (D16)", () => {
    expect(buildSlotModePresetRules("2026-02", "BLOCK_MODE")).toEqual([
      {
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        weekdays: [1, 2, 3, 4, 5],
        times: SLOT_MODE_PRESETS.BLOCK_MODE.times,
        minGapMinutes: 240,
        preserveCapacity: true,
        maxPerDay: 3,
      },
    ]);
  });

  // T018 (D19, D31, D33, FR-033).
  it("compares rule values without depending on their order", () => {
    const reversed = [{ ...FULL_DECEMBER_BLOCK[0], weekdays: [5, 4, 3, 2, 1], times: [...SLOT_MODE_PRESETS.BLOCK_MODE.times].reverse() }];

    expect(deriveSlotMode(reversed, "SECOND_ONLY_MODE")).toBe("BLOCK_MODE");
  });

  it("keeps the current value when minGapMinutes or preserveCapacity differ from the preset", () => {
    expect(deriveSlotMode([{ ...FULL_DECEMBER_BLOCK[0], minGapMinutes: 180 }], "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
    expect(deriveSlotMode([{ ...FULL_DECEMBER_BLOCK[0], preserveCapacity: false }], "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("keeps the current value when the weekdays differ from the preset", () => {
    expect(deriveSlotMode([{ ...FULL_DECEMBER_BLOCK[0], weekdays: [1, 2, 3, 4, 5, 6] }], "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("keeps the current value with two rules even when one of them matches the preset", () => {
    const split = [
      { ...FULL_DECEMBER_BLOCK[0], endDate: "2026-12-15" },
      { ...FULL_DECEMBER_BLOCK[0], startDate: "2026-12-16" },
    ];

    expect(deriveSlotMode(split, "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("keeps the current value for a full-month rule that starts after the first day", () => {
    const shifted = [{ ...FULL_DECEMBER_BLOCK[0], startDate: "2026-12-02" }];

    expect(deriveSlotMode(shifted, "SECOND_ONLY_MODE")).toBe("SECOND_ONLY_MODE");
  });

  it("builds a full-month rule with the last day of months of 31 and 29 days", () => {
    expect(buildSlotModePresetRules("2026-12", "BLOCK_MODE")[0]).toMatchObject({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
    expect(buildSlotModePresetRules("2028-02", "SECOND_ONLY_MODE")[0]).toMatchObject({
      startDate: "2028-02-01",
      endDate: "2028-02-29",
    });
  });

  // D33: las excepciones no entran en la derivación; el PATCH reemplaza solo reglas (quien llama conserva excepciones).
  it("derives from rules only, so exceptions cannot change the mode (D33)", () => {
    const preset = buildSlotModePresetRules("2026-12", "SECOND_ONLY_MODE");

    expect(preset).toHaveLength(1);
    expect(deriveSlotMode(preset, "BLOCK_MODE")).toBe("SECOND_ONLY_MODE");
  });
});
