import type { BlockedSlotReason, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PersistedBlockedSlot = {
  id: number;
  date: string;
  timeSlot: string;
  reason: BlockedSlotReason;
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
  createdByAdminId: number | null;
}) {
  return {
    id: row.id,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    reason: row.reason,
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

export async function createBlockedSlots(
  tx: Prisma.TransactionClient,
  input: {
    date: string;
    slots: string[];
    reason: BlockedSlotReason;
    createdByAdminId: number | null;
  },
) {
  await tx.blockedSlot.createMany({
    data: input.slots.map((timeSlot) => ({
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: timeSlotToDate(timeSlot),
      reason: input.reason,
      createdByAdminId: input.createdByAdminId,
    })),
  });
}
