import { PrismaClient } from "@prisma/client";

const DEFAULT_WINDOW_SIZE = 2;

function getArg(name, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));

  if (!arg) {
    return fallback;
  }

  return arg.slice(name.length + 3);
}

function getCurrentMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

function getWindowMonths(currentMonth, windowSize) {
  const months = [];
  let cursor = currentMonth;

  for (let index = 0; index < windowSize; index += 1) {
    months.push(cursor);

    const [year, monthNumber] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1));
    cursor = next.toISOString().slice(0, 7);
  }

  return months;
}

const windowSize = Number(getArg("window", process.env.ACTIVE_MONTH_WINDOW_SIZE ?? String(DEFAULT_WINDOW_SIZE)));

if (!Number.isInteger(windowSize) || windowSize < 1) {
  throw new Error("INVALID_WINDOW_SIZE");
}

const currentMonth = getCurrentMonthKey();
const windowMonths = getWindowMonths(currentMonth, windowSize);
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const month of windowMonths) {
      await tx.activeMonth.upsert({
        where: { month },
        create: { month, status: "ACTIVE" },
        update: { status: "ACTIVE" },
      });
    }

    await tx.activeMonth.updateMany({
      where: {
        month: {
          lt: currentMonth,
        },
      },
      data: {
        status: "INACTIVE",
      },
    });

    const maxWindowMonth = windowMonths[windowMonths.length - 1];

    await tx.activeMonth.updateMany({
      where: {
        month: {
          gt: maxWindowMonth,
        },
      },
      data: {
        status: "INACTIVE",
      },
    });
  });

  console.log(
    JSON.stringify(
      {
        currentMonth,
        windowSize,
        activeMonths: windowMonths,
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
