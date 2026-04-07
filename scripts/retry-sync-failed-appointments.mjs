import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";

const REQUIRED_TIMEZONE = "America/Mexico_City";
const GOOGLE_EVENT_DURATION_HOURS = 3;

function getArg(name, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));

  if (!arg) {
    return fallback;
  }

  return arg.slice(name.length + 3);
}

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throw new Error("INVALID_BOOLEAN_FLAG");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildDateTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

function getCalendarDateTimeRange(input) {
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

function resolveCalendarConfig() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) {
    throw new Error("CALENDAR_NOT_CONFIGURED");
  }

  return {
    clientEmail,
    privateKey,
    calendarId,
  };
}

function createCalendarClient() {
  const config = resolveCalendarConfig();
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

async function createCalendarEvent(calendarClient, input) {
  const range = getCalendarDateTimeRange(input);
  const response = await calendarClient.calendar.events.insert({
    calendarId: calendarClient.calendarId,
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
    throw new Error("CALENDAR_EVENT_ID_MISSING");
  }

  return response.data.id;
}

async function acquireNamedLock(client, lockName) {
  const rows = await client.$queryRaw`
    SELECT GET_LOCK(${lockName}, 0) AS acquired
  `;
  const acquired = rows[0]?.acquired;
  return acquired === 1 || acquired === 1n;
}

async function releaseNamedLock(client, lockName) {
  await client.$queryRaw`
    SELECT RELEASE_LOCK(${lockName})
  `;
}

function toDateKey(value) {
  return value.toISOString().slice(0, 10);
}

function toTimeKey(value) {
  return value.toISOString().slice(11, 16);
}

async function main() {
  const batchSize = Number(getArg("batch", "200"));
  const dryRun = parseBoolean(getArg("dry-run", undefined), false);

  if (!Number.isFinite(batchSize) || batchSize < 1) {
    throw new Error("INVALID_BATCH_SIZE");
  }

  const prisma = new PrismaClient();
  const calendarClient = createCalendarClient();
  const summary = {
    scanned: 0,
    recovered: 0,
    skippedByConcurrentChange: 0,
    calendarFailures: 0,
    lockSkipped: 0,
    dryRun,
    batchSize,
  };
  let lastSeenId = 0;

  try {
    while (true) {
      const rows = await prisma.appointment.findMany({
        where: {
          status: "SYNC_FAILED",
          id: {
            gt: lastSeenId,
          },
        },
        orderBy: {
          id: "asc",
        },
        take: batchSize,
        select: {
          id: true,
          date: true,
          timeSlot: true,
          googleEventId: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      });

      if (rows.length === 0) {
        break;
      }

      lastSeenId = rows[rows.length - 1].id;

      for (const row of rows) {
        summary.scanned += 1;
        const lockName = `sync-retry:appointment:${row.id}`;
        const lockAcquired = await acquireNamedLock(prisma, lockName);

        if (!lockAcquired) {
          summary.lockSkipped += 1;
          continue;
        }

        try {
          if (dryRun) {
            continue;
          }

          let nextGoogleEventId = row.googleEventId;

          if (!nextGoogleEventId) {
            nextGoogleEventId = await createCalendarEvent(calendarClient, {
              name: row.client.name,
              date: toDateKey(row.date),
              timeSlot: toTimeKey(row.timeSlot),
            });
          }

          const updated = await prisma.appointment.updateMany({
            where: {
              id: row.id,
              status: "SYNC_FAILED",
            },
            data: {
              status: "CONFIRMED",
              googleEventId: nextGoogleEventId,
            },
          });

          if (updated.count === 0) {
            summary.skippedByConcurrentChange += 1;
            continue;
          }

          summary.recovered += 1;
        } catch {
          summary.calendarFailures += 1;
        } finally {
          await releaseNamedLock(prisma, lockName);
        }
      }

      if (rows.length < batchSize) {
        break;
      }
    }

    console.log(
      JSON.stringify(
        {
          ...summary,
          executedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
