export type PendingAppointmentRejectionClient = {
  $transaction: <T>(
    callback: (tx: {
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
            clientId: true;
            date: true;
            timeSlot: true;
            client: {
              select: {
                clientNumber: true;
                name: true;
                alias: true;
                phone: true;
              };
            };
          };
        }) => Promise<
          Array<{
            id: number;
            clientId: number;
            date: Date;
            timeSlot: Date;
            client: {
              clientNumber: number;
              name: string;
              alias: string | null;
              phone: string;
            };
          }>
        >;
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
        appointmentLog: {
          createMany: (input: {
            data: Array<{
              appointmentId: number;
              actionType: "REJECTED";
              actorType: "SYSTEM";
              clientId: number;
            }>;
          }) => Promise<{ count: number }>;
        };
      }) => Promise<T>,
  ) => Promise<T>;
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
    const rows = await client.$transaction(async (tx) => {
      const batchRows = await tx.appointment.findMany({
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
          clientId: true,
          date: true,
          timeSlot: true,
          client: {
            select: {
              clientNumber: true,
              name: true,
              alias: true,
              phone: true,
            },
          },
        },
      });

      if (batchRows.length === 0) {
        return batchRows;
      }

      const ids = batchRows.map((row) => row.id);
      const result = await tx.appointment.updateMany({
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

      if (result.count > 0) {
        await tx.appointmentLog.createMany({
          data: batchRows.map((row) => ({
            appointmentId: row.id,
            actionType: "REJECTED" as const,
            actorType: "SYSTEM" as const,
            clientId: row.clientId,
          })),
        });
      }

      rejected += result.count;

      return batchRows;
    });

    if (rows.length === 0 || rows.length < input.batchSize) {
      break;
    }
  }

  return {
    rejected,
    olderThanHours: input.olderThanHours,
    batchSize: input.batchSize,
  };
}
