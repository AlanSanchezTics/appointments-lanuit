import type {
  BlockedSlotCalendarSyncReason,
  BlockedSlotCalendarSyncStatus,
  BlockedSlotReason,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PersistedBlockedSlot = {
  id: number;
  date: string;
  timeSlot: string;
  reason: BlockedSlotReason;
  googleEventId: string | null;
  calendarSyncStatus: BlockedSlotCalendarSyncStatus;
  calendarSyncReason: BlockedSlotCalendarSyncReason | null;
  createdByAdminId: number | null;
};

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

function mapBlockedSlot(row: {
  id: number;
  date: Date;
  timeSlot: Date;
  reason: BlockedSlotReason;
  googleEventId: string | null;
  calendarSyncStatus: BlockedSlotCalendarSyncStatus;
  calendarSyncReason: BlockedSlotCalendarSyncReason | null;
  createdByAdminId: number | null;
}) {
  return {
    id: row.id,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    reason: row.reason,
    googleEventId: row.googleEventId,
    calendarSyncStatus: row.calendarSyncStatus,
    calendarSyncReason: row.calendarSyncReason,
    createdByAdminId: row.createdByAdminId,
  } satisfies PersistedBlockedSlot;
}

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

export async function listMonthBlockedSlots(monthStart: string, monthEndExclusive: string) {
  const rows = await prisma.blockedSlot.findMany({
    where: {
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return rows.map(mapBlockedSlot);
}

export async function listBlockedSlotsByDate(date: string) {
  const rows = await prisma.blockedSlot.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
    },
    orderBy: [{ timeSlot: "asc" }],
  });

  return rows.map(mapBlockedSlot);
}

export async function listBlockedSlotsByDateForUpdate(tx: Prisma.TransactionClient, date: string) {
  const rows = await tx.blockedSlot.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
    },
    orderBy: [{ timeSlot: "asc" }],
  });

  return rows.map(mapBlockedSlot);
}

export async function findBlockedSlotById(blockedSlotId: number) {
  const row = await prisma.blockedSlot.findUnique({
    where: {
      id: blockedSlotId,
    },
  });

  return row ? mapBlockedSlot(row) : null;
}

export async function findBlockedSlotByIdForUpdate(
  tx: Prisma.TransactionClient,
  blockedSlotId: number,
) {
  const row = await tx.blockedSlot.findUnique({
    where: {
      id: blockedSlotId,
    },
  });

  return row ? mapBlockedSlot(row) : null;
}

export async function updateBlockedSlotReasonById(
  tx: Prisma.TransactionClient,
  input: {
    blockedSlotId: number;
    reason: BlockedSlotReason;
  },
) {
  await tx.blockedSlot.update({
    where: {
      id: input.blockedSlotId,
    },
    data: {
      reason: input.reason,
    },
  });
}

export async function deleteBlockedSlotById(
  tx: Prisma.TransactionClient,
  blockedSlotId: number,
) {
  await tx.blockedSlot.delete({
    where: {
      id: blockedSlotId,
    },
  });
}

export async function deleteBlockedSlotsByDate(
  tx: Prisma.TransactionClient,
  date: string,
) {
  await tx.blockedSlot.deleteMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
    },
  });
}

export async function createBlockedSlots(
  tx: Prisma.TransactionClient,
  input: {
    date: string;
    slots: string[];
    reason: BlockedSlotReason;
    createdByAdminId: number | null;
  },
) {
  const createdRows = await Promise.all(
    input.slots.map((timeSlot) =>
      tx.blockedSlot.create({
        data: {
          date: new Date(`${input.date}T00:00:00.000Z`),
          timeSlot: timeSlotToDate(timeSlot),
          reason: input.reason,
          calendarSyncStatus: "CONFIRMED",
          calendarSyncReason: null,
          createdByAdminId: input.createdByAdminId,
        },
      }),
    ),
  );

  return createdRows
    .map(mapBlockedSlot)
    .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot));
}

export async function markBlockedSlotSynced(
  blockedSlotId: number,
  googleEventId: string,
) {
  await prisma.blockedSlot.update({
    where: {
      id: blockedSlotId,
    },
    data: {
      googleEventId,
      calendarSyncStatus: "CONFIRMED",
      calendarSyncReason: null,
    },
  });
}

export async function markBlockedSlotSyncFailed(
  blockedSlotId: number,
  reason: BlockedSlotCalendarSyncReason,
) {
  await prisma.blockedSlot.update({
    where: {
      id: blockedSlotId,
    },
    data: {
      calendarSyncStatus: "SYNC_FAILED",
      calendarSyncReason: reason,
    },
  });
}

export async function listBlockedSlotsWithSyncFailed(input: {
  take: number;
  afterId?: number;
}) {
  const rows = await prisma.blockedSlot.findMany({
    where: {
      id: {
        gt: input.afterId ?? 0,
      },
      calendarSyncStatus: "SYNC_FAILED",
    },
    orderBy: {
      id: "asc",
    },
    take: input.take,
  });

  return rows.map(mapBlockedSlot);
}

export async function updateBlockedSlotSyncFailure(
  blockedSlotId: number,
  reason: BlockedSlotCalendarSyncReason,
) {
  await prisma.blockedSlot.update({
    where: {
      id: blockedSlotId,
    },
    data: {
      calendarSyncStatus: "SYNC_FAILED",
      calendarSyncReason: reason,
    },
  });
}

export async function clearBlockedSlotGoogleEventId(blockedSlotId: number) {
  await prisma.blockedSlot.update({
    where: {
      id: blockedSlotId,
    },
    data: {
      googleEventId: null,
      calendarSyncStatus: "SYNC_FAILED",
      calendarSyncReason: "CALENDAR_DELETE_FAILED",
    },
  });
}

export async function countBlockedSlotsByGoogleEventId(googleEventId: string) {
  return prisma.blockedSlot.count({
    where: {
      googleEventId,
    },
  });
}
