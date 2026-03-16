import { PrismaClient } from "@prisma/client";

function getCurrentMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));

  return next.toISOString().slice(0, 7);
}

function getWindowMonths(currentMonth: string, size: number) {
  const months: string[] = [];
  let cursor = currentMonth;

  for (let index = 0; index < size; index += 1) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }

  return months;
}

async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    const windowSizeRaw = Number(process.env.ACTIVE_MONTH_WINDOW_SIZE ?? "2");
    const windowSize = Number.isInteger(windowSizeRaw) && windowSizeRaw > 0 ? windowSizeRaw : 2;
    const currentMonth = getCurrentMonthKey();
    const windowMonths = getWindowMonths(currentMonth, windowSize);

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
    });
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
