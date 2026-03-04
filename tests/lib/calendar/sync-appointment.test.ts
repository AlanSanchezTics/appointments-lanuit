import { beforeEach, describe, expect, it, vi } from "vitest";

const createCalendarEventMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: createCalendarEventMock,
  GoogleCalendarConfigError: class GoogleCalendarConfigError extends Error {},
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      update: updateMock,
    },
  },
}));

describe("syncAppointmentToCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the google event id on successful sync", async () => {
    createCalendarEventMock.mockResolvedValueOnce("google-event-1");

    const { syncAppointmentToCalendar } = await import("@/lib/calendar/sync-appointment");
    const result = await syncAppointmentToCalendar({
      appointmentId: 7,
      name: "Ana",
      date: "2026-03-04",
      timeSlot: "09:00",
    });

    expect(result).toEqual({ status: "CONFIRMED" });
    expect(updateMock).toHaveBeenCalledWith({
      where: {
        id: 7,
      },
      data: {
        googleEventId: "google-event-1",
      },
    });
  });

  it("marks the appointment as sync failed when google errors", async () => {
    createCalendarEventMock.mockRejectedValueOnce(new Error("boom"));

    const { syncAppointmentToCalendar } = await import("@/lib/calendar/sync-appointment");
    const result = await syncAppointmentToCalendar({
      appointmentId: 9,
      name: "Ana",
      date: "2026-03-04",
      timeSlot: "09:00",
    });

    expect(result).toEqual({ status: "SYNC_FAILED", reason: "CALENDAR_SYNC_FAILED" });
    expect(updateMock).toHaveBeenCalledWith({
      where: {
        id: 9,
      },
      data: {
        status: "SYNC_FAILED",
      },
    });
  });
});
