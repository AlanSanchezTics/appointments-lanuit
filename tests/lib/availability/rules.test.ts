import { describe, expect, it } from "vitest";

import {
  getAvailableStartSlots,
  getAvailableStartSlotsWithManualBlocks,
} from "@/lib/availability/rules";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

describe("availability rules", () => {
  it("returns all base slots when there are no occupied slots", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, []);

    expect(available).toEqual(["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"]);
  });

  it("keeps only 09:00 and 13:00 when 17:00 is occupied", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["17:00"]);

    expect(available).toEqual(["09:00", "13:00"]);
    expect(available).not.toContain("10:00");
    expect(available).not.toContain("14:00");
    expect(available).not.toContain("17:00");
    expect(available).not.toContain("18:00");
  });

  it("keeps only 14:00 and 18:00 when 10:00 is occupied", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["10:00"]);

    expect(available).toEqual(["14:00", "18:00"]);
    expect(available).not.toContain("09:00");
    expect(available).not.toContain("10:00");
    expect(available).not.toContain("13:00");
    expect(available).not.toContain("17:00");
  });

  it("composes directional restrictions from multiple occupied slots", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["10:00", "14:00"]);

    expect(available).toEqual(["18:00"]);
  });

  it("returns no slots when there are already 3 active appointments in the day", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["09:00", "14:00", "18:00"]);

    expect(available).toEqual([]);
  });

  it("applies manual block directional rule for single blocked first slot", () => {
    const available = getAvailableStartSlotsWithManualBlocks(
      BASE_TIME_SLOTS,
      [],
      ["09:00"],
    );

    expect(available).toEqual(["10:00", "14:00", "18:00"]);
  });

  it("does not propagate directional restriction when a full pair is manually blocked", () => {
    const available = getAvailableStartSlotsWithManualBlocks(
      BASE_TIME_SLOTS,
      [],
      ["09:00", "10:00"],
    );

    expect(available).toEqual(["13:00", "14:00", "17:00", "18:00"]);
  });

  it("returns no slots when full day is manually blocked", () => {
    const available = getAvailableStartSlotsWithManualBlocks(
      BASE_TIME_SLOTS,
      [],
      [...BASE_TIME_SLOTS],
    );

    expect(available).toEqual([]);
  });
});
