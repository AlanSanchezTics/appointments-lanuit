import { PrismaClient } from "@prisma/client";

function getArg(name, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));

  if (!arg) {
    return fallback;
  }

  return arg.slice(name.length + 3);
}

const olderThanHours = Number(
  getArg("older-than-hours", process.env.PENDING_APPOINTMENT_REJECTION_HOURS ?? "36"),
);
const batchSize = Number(getArg("batch", "5000"));

if (!Number.isFinite(olderThanHours) || olderThanHours < 1) {
  throw new Error("INVALID_OLDER_THAN_HOURS");
}

if (!Number.isFinite(batchSize) || batchSize < 1) {
  throw new Error("INVALID_BATCH_SIZE");
}

const prisma = new PrismaClient();

function getPendingAppointmentRejectionCutoff(now, olderThanHours) {
  return new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
}

async function rejectPendingAppointmentsInBatches(client, input) {
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

async function main() {
  const result = await rejectPendingAppointmentsInBatches(prisma, {
    olderThanHours,
    batchSize,
  });

  console.log(
    JSON.stringify(
      {
        ...result,
        executedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
