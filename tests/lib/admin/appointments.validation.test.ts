import { describe, expect, it } from "vitest";

import {
  parseAdminCancelPayload,
  parseAdminCreateAppointmentPayload,
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

  it("parses create payload for existing client", () => {
    expect(
      parseAdminCreateAppointmentPayload({
        month: "2026-03",
        date: "2026-03-20",
        timeSlot: "10:00",
        clientId: 10,
      }),
    ).toEqual({
      month: "2026-03",
      date: "2026-03-20",
      timeSlot: "10:00",
      clientId: 10,
    });
  });

  it("parses create payload for new client", () => {
    expect(
      parseAdminCreateAppointmentPayload({
        month: "2026-03",
        date: "2026-03-20",
        timeSlot: "10:00",
        client: {
          name: "Ana Garcia",
          phone: "5512345678",
        },
      }),
    ).toEqual({
      month: "2026-03",
      date: "2026-03-20",
      timeSlot: "10:00",
      client: {
        name: "Ana Garcia",
        phone: "5512345678",
      },
    });
  });

  it("rejects create payload when client selector is invalid", () => {
    expect(() =>
      parseAdminCreateAppointmentPayload({
        month: "2026-03",
        date: "2026-03-20",
        timeSlot: "10:00",
        clientId: 10,
        client: {
          name: "Ana Garcia",
          phone: "5512345678",
        },
      }),
    ).toThrow("CLIENT_SELECTION_INVALID");
  });

  it("parses valid appointment id param", () => {
    expect(parseAppointmentIdParam("42")).toBe(42);
  });

  it("rejects invalid appointment id param", () => {
    expect(() => parseAppointmentIdParam("abc")).toThrow("APPOINTMENT_ID_INVALID");
  });
});
