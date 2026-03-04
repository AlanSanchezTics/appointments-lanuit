import { describe, expect, it } from "vitest";

import { isBookingMonthAllowed, validateBookingRules } from "@/lib/validation/appointment";

describe("appointment validation", () => {
  it("accepts only the current month", () => {
    expect(isBookingMonthAllowed("2026-03", new Date("2026-03-03T12:00:00.000Z"))).toBe(true);
    expect(isBookingMonthAllowed("2026-04", new Date("2026-03-03T12:00:00.000Z"))).toBe(false);
  });

  it("rejects same-day bookings", () => {
    expect(() =>
      validateBookingRules(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-03",
          timeSlot: "09:00",
        },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).toThrow("SAME_DAY_NOT_ALLOWED");
  });
});
