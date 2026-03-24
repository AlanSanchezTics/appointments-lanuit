import { describe, expect, it } from "vitest";

import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";

describe("month slot mode", () => {
  it("returns full base slots in BLOCK_MODE", () => {
    expect(resolveBaseSlotsByMonthMode("BLOCK_MODE")).toEqual([
      "09:00",
      "10:00",
      "13:00",
      "14:00",
      "17:00",
      "18:00",
    ]);
  });

  it("returns second-only base slots in SECOND_ONLY_MODE", () => {
    expect(resolveBaseSlotsByMonthMode("SECOND_ONLY_MODE")).toEqual([
      "10:00",
      "14:00",
      "18:00",
    ]);
  });

  it("falls back to BLOCK_MODE when mode is missing", () => {
    expect(resolveBaseSlotsByMonthMode()).toEqual([
      "09:00",
      "10:00",
      "13:00",
      "14:00",
      "17:00",
      "18:00",
    ]);
  });
});

