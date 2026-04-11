import { google } from "googleapis";

import { GOOGLE_EVENT_DURATION_HOURS, REQUIRED_TIMEZONE } from "@/lib/constants/slots";

type CalendarConfig = {
  calendarId: string;
  clientEmail: string;
  privateKey: string;
};

export class GoogleCalendarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarConfigError";
  }
}

export class GoogleCalendarSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarSyncError";
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function buildDateTime(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

export function getCalendarDateTimeRange(input: { date: string; timeSlot: string }) {
  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.timeSlot.split(":").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const endDate = new Date(startDate);

  endDate.setUTCHours(endDate.getUTCHours() + GOOGLE_EVENT_DURATION_HOURS);

  return {
    start: buildDateTime(startDate),
    end: buildDateTime(endDate),
  };
}

export function getCalendarConfig(): CalendarConfig {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) {
    throw new GoogleCalendarConfigError("CALENDAR_NOT_CONFIGURED");
  }

  return {
    calendarId,
    clientEmail,
    privateKey,
  };
}

export function getBlockedCalendarConfig(): CalendarConfig {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const calendarId = process.env.BLOCKED_GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) {
    throw new GoogleCalendarConfigError("CALENDAR_NOT_CONFIGURED");
  }

  return {
    calendarId,
    clientEmail,
    privateKey,
  };
}

function getCalendarClient() {
  const config = getCalendarConfig();

  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return {
    calendar: google.calendar({
      version: "v3",
      auth,
    }),
    calendarId: config.calendarId,
  };
}

function getBlockedCalendarClient() {
  const config = getBlockedCalendarConfig();

  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return {
    calendar: google.calendar({
      version: "v3",
      auth,
    }),
    calendarId: config.calendarId,
  };
}

function normalizeGoogleCalendarError(error: unknown) {
  if (error instanceof GoogleCalendarConfigError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new GoogleCalendarSyncError(error.message);
  }

  throw new GoogleCalendarSyncError("GOOGLE_CALENDAR_UNKNOWN_ERROR");
}

export async function verifyCalendarAccess() {
  try {
    const { calendar, calendarId } = getCalendarClient();

    const response = await calendar.calendars.get({
      calendarId,
    });

    return {
      id: response.data.id ?? calendarId,
      summary: response.data.summary ?? "",
      timeZone: response.data.timeZone ?? REQUIRED_TIMEZONE,
    };
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function listAccessibleCalendars() {
  try {
    const { calendar } = getCalendarClient();
    const response = await calendar.calendarList.list();

    return (response.data.items ?? []).map((item) => ({
      id: item.id ?? "",
      summary: item.summary ?? "",
      accessRole: item.accessRole ?? "",
      primary: Boolean(item.primary),
    }));
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function insertCalendarIntoCalendarList() {
  try {
    const { calendar, calendarId } = getCalendarClient();

    await calendar.calendarList.insert({
      requestBody: {
        id: calendarId,
      },
    });

    return calendarId;
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function createCalendarEvent(input: { name: string; date: string; timeSlot: string }) {
  try {
    const { calendar, calendarId } = getCalendarClient();
    const range = getCalendarDateTimeRange(input);

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `${input.name}`,
        start: {
          dateTime: range.start,
          timeZone: REQUIRED_TIMEZONE,
        },
        end: {
          dateTime: range.end,
          timeZone: REQUIRED_TIMEZONE,
        },
      },
    });

    if (!response.data.id) {
      throw new GoogleCalendarSyncError("CALENDAR_EVENT_ID_MISSING");
    }

    return response.data.id;
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function createBlockedSlotCalendarEvent(input: {
  date: string;
  timeSlot: string;
  reason: string;
  durationHours?: number;
}) {
  try {
    const { calendar, calendarId } = getBlockedCalendarClient();
    const isFullDayBlock = input.timeSlot === "00:00";
    const summary = isFullDayBlock
      ? `Día libre - ${input.reason}`
      : `No disponible - ${input.reason}`;

    if (isFullDayBlock) {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          start: {
            dateTime: `${input.date}T06:00:00`,
            timeZone: REQUIRED_TIMEZONE,
          },
          end: {
            dateTime: `${input.date}T23:00:00`,
            timeZone: REQUIRED_TIMEZONE,
          },
        },
      });

      if (!response.data.id) {
        throw new GoogleCalendarSyncError("CALENDAR_EVENT_ID_MISSING");
      }

      return response.data.id;
    }

    const [startHour, startMinute] = input.timeSlot.split(":").map(Number);
    const startDate = new Date(Date.UTC(
      Number(input.date.slice(0, 4)),
      Number(input.date.slice(5, 7)) - 1,
      Number(input.date.slice(8, 10)),
      startHour,
      startMinute,
      0,
    ));
    const endDate = new Date(startDate);
    endDate.setUTCHours(endDate.getUTCHours() + (input.durationHours ?? GOOGLE_EVENT_DURATION_HOURS));

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        start: {
          dateTime: buildDateTime(startDate),
          timeZone: REQUIRED_TIMEZONE,
        },
        end: {
          dateTime: buildDateTime(endDate),
          timeZone: REQUIRED_TIMEZONE,
        },
      },
    });

    if (!response.data.id) {
      throw new GoogleCalendarSyncError("CALENDAR_EVENT_ID_MISSING");
    }

    return response.data.id;
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function updateCalendarEventSummary(input: { eventId: string; summary: string }) {
  try {
    const { calendar, calendarId } = getCalendarClient();

    await calendar.events.patch({
      calendarId,
      eventId: input.eventId,
      requestBody: {
        summary: input.summary,
      },
    });
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function updateBlockedSlotCalendarEventSummary(input: { eventId: string; summary: string }) {
  try {
    const { calendar, calendarId } = getBlockedCalendarClient();

    await calendar.events.patch({
      calendarId,
      eventId: input.eventId,
      requestBody: {
        summary: input.summary,
      },
    });
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function createSmokeTestCalendarEvent(input: { date: string; timeSlot: string }) {
  return createCalendarEvent({
    name: "Smoke Test La Nuit",
    date: input.date,
    timeSlot: input.timeSlot,
  });
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    const { calendar, calendarId } = getCalendarClient();

    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}

export async function deleteBlockedSlotCalendarEvent(eventId: string) {
  try {
    const { calendar, calendarId } = getBlockedCalendarClient();

    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error) {
    normalizeGoogleCalendarError(error);
  }
}
