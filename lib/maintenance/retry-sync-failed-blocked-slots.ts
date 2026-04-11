export type RetrySyncFailedBlockedSlotsClient = {
  blockedSlot: {
    findMany: (input: {
      where: {
        calendarSyncStatus: "SYNC_FAILED";
        id: {
          gt: number;
        };
      };
      orderBy: {
        id: "asc";
      };
      take: number;
      select: {
        id: true;
        date: true;
        timeSlot: true;
        reason: true;
        googleEventId: true;
      };
    }) => Promise<Array<{
      id: number;
      date: Date;
      timeSlot: Date;
      reason: string;
      googleEventId: string | null;
    }>>;
    updateMany: (input: {
      where: {
        id: number;
        calendarSyncStatus: "SYNC_FAILED";
      };
      data: {
        calendarSyncStatus: "CONFIRMED";
        calendarSyncReason: null;
        googleEventId: string;
      };
    }) => Promise<{ count: number }>;
  };
};

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toTimeKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

export async function retrySyncFailedBlockedSlotsInBatches(
  client: RetrySyncFailedBlockedSlotsClient,
  input: {
    batchSize: number;
    dryRun?: boolean;
    createCalendarEvent: (payload: {
      date: string;
      timeSlot: string;
      reason: string;
    }) => Promise<string>;
  },
) {
  if (!Number.isFinite(input.batchSize) || input.batchSize < 1) {
    throw new Error("INVALID_BATCH_SIZE");
  }

  const dryRun = input.dryRun ?? false;
  const summary = {
    scanned: 0,
    recovered: 0,
    skippedByConcurrentChange: 0,
    calendarFailures: 0,
    dryRun,
    batchSize: input.batchSize,
  };

  let lastSeenId = 0;

  while (true) {
    const rows = await client.blockedSlot.findMany({
      where: {
        calendarSyncStatus: "SYNC_FAILED",
        id: {
          gt: lastSeenId,
        },
      },
      orderBy: {
        id: "asc",
      },
      take: input.batchSize,
      select: {
        id: true,
        date: true,
        timeSlot: true,
        reason: true,
        googleEventId: true,
      },
    });

    if (rows.length === 0) {
      break;
    }

    lastSeenId = rows[rows.length - 1].id;

    for (const row of rows) {
      summary.scanned += 1;

      if (dryRun) {
        continue;
      }

      try {
        const googleEventId = row.googleEventId
          ?? await input.createCalendarEvent({
            date: toDateKey(row.date),
            timeSlot: toTimeKey(row.timeSlot),
            reason: row.reason,
          });

        const result = await client.blockedSlot.updateMany({
          where: {
            id: row.id,
            calendarSyncStatus: "SYNC_FAILED",
          },
          data: {
            calendarSyncStatus: "CONFIRMED",
            calendarSyncReason: null,
            googleEventId,
          },
        });

        if (result.count === 0) {
          summary.skippedByConcurrentChange += 1;
          continue;
        }

        summary.recovered += 1;
      } catch {
        summary.calendarFailures += 1;
      }
    }

    if (rows.length < input.batchSize) {
      break;
    }
  }

  return summary;
}
