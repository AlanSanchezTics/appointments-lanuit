import { describe, expect, it } from "vitest";

import {
  parseBlockableSlotsParams,
  parseCreateBlockedSlotsPayload,
} from "@/lib/admin/blocked-spaces/validation";

describe("admin blocked spaces validation", () => {
  it("parses month and optional date for blockable slots", () => {
    expect(
      parseBlockableSlotsParams({
        month: "2026-03",
        date: "2026-03-18",
      }),
    ).toEqual({
      month: "2026-03",
      date: "2026-03-18",
    });

    expect(
      parseBlockableSlotsParams({
        month: "2026-03",
      }),
    ).toEqual({
      month: "2026-03",
      date: null,
    });
  });

  it("rejects dates outside month", () => {
    expect(() =>
      parseBlockableSlotsParams({
        month: "2026-03",
        date: "2026-04-01",
      }),
    ).toThrow("DATE_OUTSIDE_MONTH");
  });

  it("parses blocked slots payload and de-duplicates validation", () => {
    expect(
      parseCreateBlockedSlotsPayload({
        month: "2026-03",
        date: "2026-03-20",
        slots: ["09:00", "13:00"],
        reason: "DESCANSO",
      }),
    ).toEqual({
      month: "2026-03",
      date: "2026-03-20",
      slots: ["09:00", "13:00"],
      reason: "DESCANSO",
    });

    expect(() =>
      parseCreateBlockedSlotsPayload({
        month: "2026-03",
        date: "2026-03-20",
        slots: ["09:00", "09:00"],
        reason: "DESCANSO",
      }),
    ).toThrow("DUPLICATE_SLOTS");
  });
});
