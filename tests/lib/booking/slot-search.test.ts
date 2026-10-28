import { describe, expect, it } from "vitest";

import {
  alignDraftToSlot,
  getDatesForSlot,
  getSlotOptions,
} from "@/lib/booking/slot-search";

const days = [
  { date: "2026-11-02", slots: ["10:00", "18:00"] },
  { date: "2026-11-03", slots: ["09:00"] },
  { date: "2026-11-04", slots: ["18:00", "10:00"] },
];

describe("slot-search", () => {
  it("lists slots with day counts sorted by time", () => {
    expect(getSlotOptions(days)).toEqual([
      { slot: "09:00", daysCount: 1 },
      { slot: "10:00", daysCount: 2 },
      { slot: "18:00", daysCount: 2 },
    ]);
    expect(getSlotOptions([])).toEqual([]);
  });

  it("returns the dates that have a slot", () => {
    expect(getDatesForSlot(days, "18:00")).toEqual(["2026-11-02", "2026-11-04"]);
    expect(getDatesForSlot(days, "13:00")).toEqual([]);
  });

  it("keeps the draft when it already matches the slot", () => {
    expect(
      alignDraftToSlot(days, "18:00", { date: "2026-11-04", timeSlot: "18:00" }),
    ).toBeNull();
  });

  it("keeps the current date when it has the slot", () => {
    expect(
      alignDraftToSlot(days, "10:00", { date: "2026-11-04", timeSlot: "18:00" }),
    ).toEqual({ date: "2026-11-04", timeSlot: "10:00" });
  });

  it("falls back to the first date with the slot", () => {
    expect(
      alignDraftToSlot(days, "18:00", { date: "2026-11-03", timeSlot: "09:00" }),
    ).toEqual({ date: "2026-11-02", timeSlot: "18:00" });
  });

  it("returns a null date when no day has the slot", () => {
    expect(
      alignDraftToSlot(days, "13:00", { date: "2026-11-02", timeSlot: "10:00" }),
    ).toEqual({ date: null, timeSlot: "13:00" });
  });
});
