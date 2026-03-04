import { google } from "googleapis";

const REQUIRED_TIMEZONE = "America/Mexico_City";
const GOOGLE_EVENT_DURATION_HOURS = 3;

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildDateTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

function getRange(date, timeSlot) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = timeSlot.split(":").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const endDate = new Date(startDate);

  endDate.setUTCHours(endDate.getUTCHours() + GOOGLE_EVENT_DURATION_HOURS);

  return {
    start: buildDateTime(startDate),
    end: buildDateTime(endDate),
  };
}

async function main() {
  const clientEmail = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const calendarId = requireEnv("GOOGLE_CALENDAR_ID");
  const smokeDate = requireEnv("GOOGLE_CALENDAR_SMOKE_DATE");
  const smokeTime = requireEnv("GOOGLE_CALENDAR_SMOKE_TIME");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({
    version: "v3",
    auth,
  });
  const range = getRange(smokeDate, smokeTime);
  let calendarInfo;

  try {
    calendarInfo = await calendar.calendars.get({
      calendarId,
    });
  } catch (error) {
    const status = error?.response?.status ?? error?.status ?? error?.code;
    const reason = error?.response?.data?.error?.errors?.[0]?.reason;

    if (status === 404 && reason === "notFound") {
      const listBefore = await calendar.calendarList.list();
      console.log(`Calendar not found via calendars.get. Visible calendars before insert: ${(listBefore.data.items ?? []).length}`);

      try {
        await calendar.calendarList.insert({
          requestBody: {
            id: calendarId,
          },
        });
        console.log(`Calendar inserted into calendarList: ${calendarId}`);
      } catch (insertError) {
        console.error("calendarList.insert failed");
        console.error(
          JSON.stringify(
            {
              message: insertError?.message,
              status: insertError?.response?.status ?? insertError?.status ?? insertError?.code,
              responseData: insertError?.response?.data,
            },
            null,
            2,
          ),
        );
      }

      const listAfter = await calendar.calendarList.list();
      console.log(
        JSON.stringify(
          {
            visibleCalendars: (listAfter.data.items ?? []).map((item) => ({
              id: item.id,
              summary: item.summary,
              accessRole: item.accessRole,
              primary: item.primary ?? false,
            })),
          },
          null,
          2,
        ),
      );

      calendarInfo = await calendar.calendars.get({
        calendarId,
      });
    } else {
      throw error;
    }
  }

  console.log(`Calendar OK: ${calendarInfo.data.summary ?? calendarId}`);

  const created = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: "Smoke Test La Nuit",
      description: "Temporary verification event created by local smoke test.",
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

  const eventId = created.data.id;

  if (!eventId) {
    throw new Error("Smoke test event was created without an id");
  }

  console.log(`Event created: ${eventId}`);

  await calendar.events.delete({
    calendarId,
    eventId,
  });

  console.log("Event deleted. Google Calendar sync is operational.");
}

main().catch((error) => {
  if (error?.response?.data) {
    console.error(
      JSON.stringify(
        {
          message: error.message,
          status: error.response.status,
          responseData: error.response.data,
        },
        null,
        2,
      ),
    );
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
