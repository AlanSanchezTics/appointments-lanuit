export type ReservationLockCleanupClient = {
  reservationLock: {
    findMany: (input: {
      where: { expiresAt: { lt: Date } };
      orderBy: { id: "asc" };
      take: number;
      select: { id: true };
    }) => Promise<Array<{ id: number }>>;
    deleteMany: (input: { where: { id: { in: number[] } } }) => Promise<{ count: number }>;
  };
};

export function getReservationLockCleanupCutoff(now: Date, olderThanDays: number) {
  return new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
}

export async function cleanupExpiredReservationLocksInBatches(
  client: ReservationLockCleanupClient,
  input: { olderThanDays: number; batchSize: number; now?: Date },
) {
  if (!Number.isFinite(input.olderThanDays) || input.olderThanDays < 1) {
    throw new Error("INVALID_OLDER_THAN_DAYS");
  }

  if (!Number.isFinite(input.batchSize) || input.batchSize < 1) {
    throw new Error("INVALID_BATCH_SIZE");
  }

  const now = input.now ?? new Date();
  const cutoff = getReservationLockCleanupCutoff(now, input.olderThanDays);
  let deleted = 0;

  while (true) {
    const rows = await client.reservationLock.findMany({
      where: {
        expiresAt: {
          lt: cutoff,
        },
      },
      orderBy: {
        id: "asc",
      },
      take: input.batchSize,
      select: {
        id: true,
      },
    });

    if (rows.length === 0) {
      break;
    }

    const ids = rows.map((row) => row.id);
    const result = await client.reservationLock.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    deleted += result.count;

    if (rows.length < input.batchSize) {
      break;
    }
  }

  return {
    deleted,
    olderThanDays: input.olderThanDays,
    batchSize: input.batchSize,
  };
}
