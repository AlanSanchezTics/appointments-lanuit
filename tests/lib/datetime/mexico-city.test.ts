import { describe, expect, it } from "vitest";

import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";

describe("mexico city datetime", () => {
  it("formats current month and date keys", () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    expect(getCurrentMonthKey(now)).toBe("2026-03");
    expect(getCurrentDateKey(now)).toBe("2026-03-03");
  });
});
