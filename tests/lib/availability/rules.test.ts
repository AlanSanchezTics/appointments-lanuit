import { describe, expect, it } from "vitest";

import { getAvailableStartSlots } from "@/lib/availability/rules";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

describe("availability rules", () => {
  it("returns all base slots when there are no occupied slots", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, []);

    expect(available).toEqual(["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"]);
  });

  it("filters slots using only confirmed occupied slots", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["17:00"]);

    expect(available).toEqual(["09:00", "10:00", "13:00"]);
    expect(available).not.toContain("14:00");
    expect(available).not.toContain("18:00");
  });

  it("keeps 17:00 and 18:00 available when only 13:00 is occupied", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["13:00"]);

    expect(available).toEqual(["09:00", "17:00", "18:00"]);
    expect(available).not.toContain("10:00");
    expect(available).not.toContain("14:00");
  });

  it("allows all slots at least 4h away from 09:00", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["09:00"]);

    expect(available).toEqual(["13:00", "14:00", "17:00", "18:00"]);
    expect(available).not.toContain("10:00");
  });

  it("keeps 13:00 available when 09:00 and 17:00 are occupied", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["09:00", "17:00"]);

    expect(available).toEqual(["13:00"]);
    expect(available).not.toContain("10:00");
    expect(available).not.toContain("14:00");
    expect(available).not.toContain("18:00");
  });

  it("returns an empty array when 09:00, 14:00, and 16:00 are occupied", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["09:00", "14:00", "16:00"]);

    expect(available).toEqual([]);
  });

  it("keeps 09:00 available when 13:00 and 17:00 are occupied", () => {
    const available = getAvailableStartSlots(BASE_TIME_SLOTS, ["13:00", "17:00"]);

    expect(available).toEqual(["09:00"]);
    expect(available).not.toContain("10:00");
  });
});
