import { describe, expect, it } from "vitest";

import { isBookingMonthAllowed, validateBookingRules } from "@/lib/validation/appointment";

describe("appointment validation", () => {
  it("accepts current and future months, rejects past months", () => {
    expect(isBookingMonthAllowed("2026-03", new Date("2026-03-03T12:00:00.000Z"))).toBe(true);
    expect(isBookingMonthAllowed("2026-04", new Date("2026-03-03T12:00:00.000Z"))).toBe(true);
    expect(isBookingMonthAllowed("2026-02", new Date("2026-03-03T12:00:00.000Z"))).toBe(false);
  });

  it("allows same-day bookings when slot has not passed", () => {
    expect(
      validateBookingRules(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-03",
          timeSlot: "13:00",
        },
        new Date("2026-03-03T18:00:00.000Z"),
      ),
    ).toMatchObject({
      date: "2026-03-03",
      timeSlot: "13:00",
    });
  });

  it("rejects same-day bookings when slot already passed", () => {
    expect(() =>
      validateBookingRules(
        {
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-03",
          timeSlot: "09:00",
        },
        new Date("2026-03-03T21:00:00.000Z"),
      ),
    ).toThrow("PAST_TIME_SLOT");
  });
});
