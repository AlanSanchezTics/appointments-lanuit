import { beforeEach, describe, expect, it, vi } from "vitest";

const calendarsGetMock = vi.fn();
const calendarListInsertMock = vi.fn();
const calendarListListMock = vi.fn();
const insertMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();
const jwtMock = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: jwtMock,
    },
    calendar: vi.fn(() => ({
      calendars: {
        get: calendarsGetMock,
      },
      calendarList: {
        insert: calendarListInsertMock,
        list: calendarListListMock,
      },
      events: {
        insert: insertMock,
        patch: patchMock,
        delete: deleteMock,
      },
    })),
  },
}));

describe("google calendar client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "line1\\nline2";
    process.env.GOOGLE_CALENDAR_ID = "calendar-id";
    process.env.BLOCKED_GOOGLE_CALENDAR_ID = "blocked-calendar-id";
  });

  it("builds the expected date range with a fixed 3-hour duration", async () => {
    const { getCalendarDateTimeRange } = await import("@/lib/calendar/google");

    expect(
      getCalendarDateTimeRange({
        date: "2026-03-04",
        timeSlot: "09:00",
      }),
    ).toEqual({
      start: "2026-03-04T09:00:00",
      end: "2026-03-04T12:00:00",
    });
  });

  it("creates a calendar event using the required timezone", async () => {
    insertMock.mockResolvedValueOnce({
      data: {
        id: "event-123",
      },
    });

    const { createCalendarEvent } = await import("@/lib/calendar/google");
    const eventId = await createCalendarEvent({
      name: "Ana",
      date: "2026-03-04",
      timeSlot: "09:00",
    });

    expect(eventId).toBe("event-123");
    expect(jwtMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith({
      calendarId: "calendar-id",
      requestBody: {
        summary: "Ana",
        start: {
          dateTime: "2026-03-04T09:00:00",
          timeZone: "America/Mexico_City",
        },
        end: {
          dateTime: "2026-03-04T12:00:00",
          timeZone: "America/Mexico_City",
        },
      },
    });
  });

  it("creates a full-day blocked-slot event", async () => {
    insertMock.mockResolvedValueOnce({
      data: {
        id: "blocked-full-day-1",
      },
    });

    const { createBlockedSlotCalendarEvent } = await import("@/lib/calendar/google");
    const eventId = await createBlockedSlotCalendarEvent({
      date: "2026-03-04",
      timeSlot: "00:00",
      reason: "DESCANSO",
    });

    expect(eventId).toBe("blocked-full-day-1");
    expect(insertMock).toHaveBeenCalledWith({
      calendarId: "blocked-calendar-id",
      requestBody: {
        summary: "Día libre - DESCANSO",
        start: {
          dateTime: "2026-03-04T06:00:00",
          timeZone: "America/Mexico_City",
        },
        end: {
          dateTime: "2026-03-04T23:00:00",
          timeZone: "America/Mexico_City",
        },
      },
    });
  });

  it("creates a one-hour blocked-slot event when durationHours=1", async () => {
    insertMock.mockResolvedValueOnce({
      data: {
        id: "blocked-hour-1",
      },
    });

    const { createBlockedSlotCalendarEvent } = await import("@/lib/calendar/google");
    const eventId = await createBlockedSlotCalendarEvent({
      date: "2026-03-04",
      timeSlot: "13:00",
      reason: "PERSONAL",
      durationHours: 1,
    });

    expect(eventId).toBe("blocked-hour-1");
    expect(insertMock).toHaveBeenCalledWith({
      calendarId: "blocked-calendar-id",
      requestBody: {
        summary: "No disponible - PERSONAL",
        start: {
          dateTime: "2026-03-04T13:00:00",
          timeZone: "America/Mexico_City",
        },
        end: {
          dateTime: "2026-03-04T14:00:00",
          timeZone: "America/Mexico_City",
        },
      },
    });
  });

  it("updates calendar event summary", async () => {
    patchMock.mockResolvedValueOnce({});

    const { updateBlockedSlotCalendarEventSummary } = await import("@/lib/calendar/google");
    await updateBlockedSlotCalendarEventSummary({
      eventId: "event-200",
      summary: "No disponible - OTRO",
    });

    expect(patchMock).toHaveBeenCalledWith({
      calendarId: "blocked-calendar-id",
      eventId: "event-200",
      requestBody: {
        summary: "No disponible - OTRO",
      },
    });
  });

  it("verifies calendar access with the configured service account", async () => {
    calendarsGetMock.mockResolvedValueOnce({
      data: {
        id: "calendar-id",
        summary: "La Nuit",
        timeZone: "America/Mexico_City",
      },
    });

    const { verifyCalendarAccess } = await import("@/lib/calendar/google");

    await expect(verifyCalendarAccess()).resolves.toEqual({
      id: "calendar-id",
      summary: "La Nuit",
      timeZone: "America/Mexico_City",
    });
  });

  it("inserts the configured calendar into the calendar list", async () => {
    calendarListInsertMock.mockResolvedValueOnce({});

    const { insertCalendarIntoCalendarList } = await import("@/lib/calendar/google");

    await expect(insertCalendarIntoCalendarList()).resolves.toBe("calendar-id");
    expect(calendarListInsertMock).toHaveBeenCalledWith({
      requestBody: {
        id: "calendar-id",
      },
    });
  });

  it("lists calendars visible to the service account", async () => {
    calendarListListMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "calendar-id",
            summary: "La Nuit",
            accessRole: "owner",
            primary: false,
          },
        ],
      },
    });

    const { listAccessibleCalendars } = await import("@/lib/calendar/google");

    await expect(listAccessibleCalendars()).resolves.toEqual([
      {
        id: "calendar-id",
        summary: "La Nuit",
        accessRole: "owner",
        primary: false,
      },
    ]);
  });

  it("throws when the calendar credentials are missing", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    const { createCalendarEvent } = await import("@/lib/calendar/google");

    await expect(
      createCalendarEvent({
        name: "Ana",
        date: "2026-03-04",
        timeSlot: "09:00",
      }),
    ).rejects.toThrow("CALENDAR_NOT_CONFIGURED");
  });
});
