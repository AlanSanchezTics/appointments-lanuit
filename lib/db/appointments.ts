import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PersistedAppointment = {
  id: number;
  name: string;
  phone: string;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "CANCELLED" | "SYNC_FAILED";
  googleEventId: string | null;
};

function mapAppointment(row: {
  id: number;
  name: string;
  phone: string;
  date: Date;
  timeSlot: Date;
  status: "CONFIRMED" | "CANCELLED" | "SYNC_FAILED";
  googleEventId: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    date: row.date.toISOString().slice(0, 10),
    timeSlot: row.timeSlot.toISOString().slice(11, 16),
    status: row.status,
    googleEventId: row.googleEventId,
  } satisfies PersistedAppointment;
}

export async function hasActiveFutureAppointment(phone: string, dateFloor: string) {
  const record = await prisma.appointment.findFirst({
    where: {
      phone,
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gt: new Date(`${dateFloor}T00:00:00.000Z`),
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(record);
}

export async function findActiveAppointmentByPhone(phone: string, dateFloor: string) {
  const record = await prisma.appointment.findFirst({
    where: {
      phone,
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gt: new Date(`${dateFloor}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return record ? mapAppointment(record) : null;
}

export async function findConfirmedFutureAppointmentByPhoneInMonth(
  phone: string,
  dateFloor: string,
  monthStart: string,
  monthEndExclusive: string,
) {
  const record = await prisma.appointment.findFirst({
    where: {
      phone,
      status: "CONFIRMED",
      date: {
        gt: new Date(`${dateFloor}T00:00:00.000Z`),
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return record ? mapAppointment(record) : null;
}

export async function findActiveAppointmentByPhoneForUpdate(
  tx: Prisma.TransactionClient,
  phone: string,
  dateFloor: string,
) {
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      name: string;
      phone: string;
      date: Date;
      time_slot: Date;
      status: "CONFIRMED" | "CANCELLED" | "SYNC_FAILED";
      google_event_id: string | null;
    }>
  >`
    SELECT id, name, phone, date, time_slot, status, google_event_id
    FROM appointments
    WHERE phone = ${phone}
      AND status IN ('CONFIRMED', 'SYNC_FAILED')
      AND date > ${dateFloor}
    ORDER BY date ASC, time_slot ASC
    LIMIT 1
    FOR UPDATE
  `;

  const record = records[0];

  if (!record) {
    return null;
  }

  return mapAppointment({
    id: record.id,
    name: record.name,
    phone: record.phone,
    date: record.date,
    timeSlot: record.time_slot,
    status: record.status,
    googleEventId: record.google_event_id,
  });
}

export async function findConfirmedFutureAppointmentByIdForUpdate(
  tx: Prisma.TransactionClient,
  appointmentId: number,
  phone: string,
  dateFloor: string,
  monthStart: string,
  monthEndExclusive: string,
) {
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      name: string;
      phone: string;
      date: Date;
      time_slot: Date;
      status: "CONFIRMED" | "CANCELLED" | "SYNC_FAILED";
      google_event_id: string | null;
    }>
  >`
    SELECT id, name, phone, date, time_slot, status, google_event_id
    FROM appointments
    WHERE id = ${appointmentId}
      AND phone = ${phone}
      AND status = 'CONFIRMED'
      AND date > ${dateFloor}
      AND date >= ${monthStart}
      AND date < ${monthEndExclusive}
    LIMIT 1
    FOR UPDATE
  `;

  const record = records[0];

  if (!record) {
    return null;
  }

  return mapAppointment({
    id: record.id,
    name: record.name,
    phone: record.phone,
    date: record.date,
    timeSlot: record.time_slot,
    status: record.status,
    googleEventId: record.google_event_id,
  });
}

export async function listMonthAppointments(monthStart: string, monthEndExclusive: string) {
  const records = await prisma.appointment.findMany({
    where: {
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return records.map(mapAppointment);
}

export async function lockConflictingAppointments(tx: Prisma.TransactionClient, date: string, phone: string) {
  await tx.$queryRaw`
    SELECT id
    FROM appointments
    WHERE (date = ${date} OR phone = ${phone})
      AND status IN ('CONFIRMED', 'SYNC_FAILED')
    FOR UPDATE
  `;
}

async function acquireNamedLock(tx: Prisma.TransactionClient, lockName: string) {
  const rows = await tx.$queryRaw<Array<{ acquired: number | bigint | null }>>`
    SELECT GET_LOCK(${lockName}, 5) AS acquired
  `;

  const acquired = rows[0]?.acquired;

  if (acquired !== 1 && acquired !== 1n) {
    throw new Error("LOCK_TIMEOUT");
  }
}

export async function acquireBookingLocks(tx: Prisma.TransactionClient, date: string, phone: string) {
  const orderedLocks = [`booking:date:${date}`, `booking:phone:${phone}`].sort();

  for (const lockName of orderedLocks) {
    await acquireNamedLock(tx, lockName);
  }
}

async function releaseNamedLock(tx: Prisma.TransactionClient, lockName: string) {
  await tx.$queryRaw`
    SELECT RELEASE_LOCK(${lockName})
  `;
}

export async function releaseBookingLocks(tx: Prisma.TransactionClient, date: string, phone: string) {
  const orderedLocks = [`booking:date:${date}`, `booking:phone:${phone}`].sort().reverse();

  for (const lockName of orderedLocks) {
    await releaseNamedLock(tx, lockName);
  }
}
