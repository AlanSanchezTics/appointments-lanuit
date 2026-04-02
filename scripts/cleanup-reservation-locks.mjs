import { PrismaClient } from "@prisma/client";

function getArg(name, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));

  if (!arg) {
    return fallback;
  }

  return arg.slice(name.length + 3);
}

const batchSize = Number(getArg("batch", "5000"));

if (!Number.isFinite(batchSize) || batchSize < 1) {
  throw new Error("INVALID_BATCH_SIZE");
}

const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date();
  let deleted = 0;

  while (true) {
    const rows = await prisma.reservationLock.findMany({
      where: {
        expiresAt: {
          lte: cutoff,
        },
      },
      orderBy: {
        id: "asc",
      },
      take: batchSize,
      select: {
        id: true,
      },
    });

    if (rows.length === 0) {
      break;
    }

    const ids = rows.map((row) => row.id);
    const result = await prisma.reservationLock.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    deleted += result.count;

    if (rows.length < batchSize) {
      break;
    }
  }

  console.log(
    JSON.stringify(
      {
        deleted,
        batchSize,
        cutoff: cutoff.toISOString(),
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
