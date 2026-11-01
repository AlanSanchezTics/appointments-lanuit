import { describe, expect, it } from "vitest";

import { normalizeErrorCode } from "@/lib/api/error-response";
import {
  bookingSchema,
  confirmBookingWithLockSchema,
  isBookingMonthAllowed,
  lockReservationSchema,
  validateBookingRules,
} from "@/lib/validation/appointment";

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

  it("no longer rejects weekend days (FR-017: el resolvedor decide si hay horarios)", () => {
    expect(
      validateBookingRules(
        { date: "2026-03-07", timeSlot: "10:00" },
        new Date("2026-03-03T12:00:00.000Z"),
      ),
    ).toEqual({ date: "2026-03-07", timeSlot: "10:00" });
  });

  it("accepts any valid HH:mm time (FR-006), not only the base grid", () => {
    expect(
      bookingSchema.parse({
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "07:30",
      }).timeSlot,
    ).toBe("07:30");
  });

  it("rejects a time that is not HH:mm", () => {
    for (const timeSlot of ["7:30", "24:00", "12:60", "1230", "12:00:00"]) {
      expect(() =>
        bookingSchema.parse({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot,
        }),
      ).toThrow();
    }
  });

  it("rejects impossible calendar dates in every booking schema (B2)", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-04-31"]) {
      const input = { name: "Ana Lopez", phone: "5512345678", date, timeSlot: "10:00" };

      for (const parse of [
        () => bookingSchema.parse(input),
        () => lockReservationSchema.parse(input),
        () => confirmBookingWithLockSchema.parse(input),
      ]) {
        let code = "NO_ERROR";
        try {
          parse();
        } catch (error) {
          code = normalizeErrorCode(error);
        }
        expect(code, date).toBe("VALIDATION_ERROR");
      }
    }
  });

  it("accepts real calendar dates, including leap days (B2)", () => {
    for (const date of ["2028-02-29", "2026-03-31", "2026-04-30"]) {
      expect(
        bookingSchema.parse({ name: "Ana Lopez", phone: "5512345678", date, timeSlot: "10:00" }).date,
      ).toBe(date);
    }
  });
});
