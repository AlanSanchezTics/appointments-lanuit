import { ActiveMonthStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { type MonthSlotMode } from "@/lib/availability/month-slot-mode";

export type PersistedActiveMonth = {
  id: number;
  month: string;
  status: ActiveMonthStatus;
  slotMode: MonthSlotMode;
};

function mapActiveMonth(row: {
  id: number;
  month: string;
  status: ActiveMonthStatus;
  slotMode: MonthSlotMode;
}) {
  return {
    id: row.id,
    month: row.month,
    status: row.status,
    slotMode: row.slotMode,
  } satisfies PersistedActiveMonth;
}

export async function findActiveMonth(month: string) {
  const row = await prisma.activeMonth.findUnique({
    where: {
      month,
    },
    select: {
      id: true,
      month: true,
      status: true,
      slotMode: true,
    },
  });

  return row ? mapActiveMonth(row) : null;
}

export async function listActiveMonths() {
  const rows = await prisma.activeMonth.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: {
      month: "asc",
    },
    select: {
      id: true,
      month: true,
      status: true,
      slotMode: true,
    },
  });

  return rows.map(mapActiveMonth);
}

export async function reconcileActiveMonthsInDatabase(input: {
  currentMonth: string;
  windowMonths: string[];
}) {
  await prisma.$transaction(async (tx) => {
    for (const month of input.windowMonths) {
      await tx.activeMonth.upsert({
        where: {
          month,
        },
        create: {
          month,
          status: "ACTIVE",
        },
        update: {
          status: "ACTIVE",
        },
      });
    }

    await tx.activeMonth.updateMany({
      where: {
        month: {
          lt: input.currentMonth,
        },
      },
      data: {
        status: "INACTIVE",
      },
    });

    const maxWindowMonth = input.windowMonths[input.windowMonths.length - 1];

    if (maxWindowMonth) {
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
    }
  });
}
