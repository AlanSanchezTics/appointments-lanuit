import { beforeEach, describe, expect, it, vi } from "vitest";

const calendarsGetMock = vi.fn();
const calendarListInsertMock = vi.fn();
const calendarListListMock = vi.fn();
const insertMock = vi.fn();
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
