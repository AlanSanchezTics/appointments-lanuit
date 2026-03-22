import { describe, expect, it } from "vitest";

import {
  parseAdminCancelPayload,
  parseAdminDayAgendaParams,
  parseAdminReschedulePayload,
  parseAppointmentIdParam,
} from "@/lib/admin/appointments/validation";

describe("admin appointments validation", () => {
  it("parses valid day agenda params", () => {
    expect(
      parseAdminDayAgendaParams({
        month: "2026-03",
        date: "2026-03-13",
      }),
    ).toEqual({
      month: "2026-03",
      date: "2026-03-13",
    });
  });

  it("rejects date outside selected month", () => {
    expect(() =>
      parseAdminDayAgendaParams({
        month: "2026-03",
        date: "2026-04-01",
      }),
    ).toThrow("DATE_OUTSIDE_MONTH");
  });

  it("parses reschedule payload", () => {
    expect(
      parseAdminReschedulePayload({
        month: "2026-03",
        date: "2026-03-14",
        timeSlot: "14:00",
      }),
    ).toEqual({
      month: "2026-03",
      date: "2026-03-14",
      timeSlot: "14:00",
    });
  });

  it("parses cancel payload", () => {
    expect(
      parseAdminCancelPayload({
        month: "2026-03",
      }),
    ).toEqual({
      month: "2026-03",
    });
  });

  it("parses valid appointment id param", () => {
    expect(parseAppointmentIdParam("42")).toBe(42);
  });

  it("rejects invalid appointment id param", () => {
    expect(() => parseAppointmentIdParam("abc")).toThrow("APPOINTMENT_ID_INVALID");
  });
});
