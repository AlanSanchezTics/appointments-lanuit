import { describe, expect, it } from "vitest";

import {
  formatLongDate,
  getCurrentDateKey,
  getCurrentMonthKey,
  getCurrentTimeKey,
  isFutureDateTime,
} from "@/lib/datetime/mexico-city";

describe("mexico city datetime", () => {
  it("formats current month and date keys", () => {
    const now = new Date("2026-03-03T12:00:00.000Z");

    expect(getCurrentMonthKey(now)).toBe("2026-03");
    expect(getCurrentDateKey(now)).toBe("2026-03-03");
  });

  it("formats current time key in Mexico City timezone", () => {
    expect(getCurrentTimeKey(new Date("2026-03-03T18:35:00.000Z"))).toBe("12:35");
  });

  it("validates future datetime with same-day slot checks", () => {
    const now = new Date("2026-03-03T18:35:00.000Z");

    expect(isFutureDateTime("2026-03-04", "09:00", now)).toBe(true);
    expect(isFutureDateTime("2026-03-03", "13:00", now)).toBe(true);
    expect(isFutureDateTime("2026-03-03", "10:00", now)).toBe(false);
  });

  it("capitalizes month in long date format for spanish", () => {
    expect(formatLongDate("2026-03-18", "es")).toContain("Marzo");
    expect(formatLongDate("2026-03-18", "es")).not.toContain("marzo");
  });
});
