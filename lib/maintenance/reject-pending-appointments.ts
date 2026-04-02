export type PendingAppointmentRejectionClient = {
  appointment: {
    findMany: (input: {
      where: {
        status: "PENDING";
        createdAt: {
          lt: Date;
        };
      };
      orderBy: {
        id: "asc";
      };
      take: number;
      select: {
        id: true;
      };
    }) => Promise<Array<{ id: number }>>;
    updateMany: (input: {
      where: {
        id: {
          in: number[];
        };
        status: "PENDING";
      };
      data: {
        status: "REJECTED";
      };
    }) => Promise<{ count: number }>;
  };
};

export function getPendingAppointmentRejectionCutoff(
  now: Date,
  olderThanHours: number,
) {
  return new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
}

export async function rejectPendingAppointmentsInBatches(
  client: PendingAppointmentRejectionClient,
  input: { olderThanHours: number; batchSize: number; now?: Date },
) {
  if (!Number.isFinite(input.olderThanHours) || input.olderThanHours < 1) {
    throw new Error("INVALID_OLDER_THAN_HOURS");
  }

  if (!Number.isFinite(input.batchSize) || input.batchSize < 1) {
    throw new Error("INVALID_BATCH_SIZE");
  }

  const now = input.now ?? new Date();
  const cutoff = getPendingAppointmentRejectionCutoff(now, input.olderThanHours);
  let rejected = 0;

  while (true) {
    const rows = await client.appointment.findMany({
      where: {
        status: "PENDING",
        createdAt: {
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
    const result = await client.appointment.updateMany({
      where: {
        id: {
          in: ids,
        },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });

    rejected += result.count;

    if (rows.length < input.batchSize) {
      break;
    }
  }

  return {
    rejected,
    olderThanHours: input.olderThanHours,
    batchSize: input.batchSize,
  };
}
