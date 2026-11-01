import { describe, expect, it } from "vitest";

import { SLOT_MODE_PRESETS } from "@/lib/availability/defaults";
import { buildSlotModePresetRules } from "@/lib/availability/slot-mode-derivation";

describe("slot mode preset rules (D16)", () => {
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
});
