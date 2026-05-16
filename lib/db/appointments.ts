import type { AppointmentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { SLOT_BLOCKING_APPOINTMENT_STATUSES } from "@/lib/constants/appointment-statuses";
import { prisma } from "@/lib/db/prisma";

export type PersistedAppointment = {
  id: number;
  name: string;
  alias: string | null;
  phone: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  googleEventId: string | null;
  clientId: number;
};

export type PersistedReservationLock = {
  id: number;
  date: string;
  timeSlot: string;
  phone: string;
  lockToken: string;
  expiresAt: string;
};

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

function mapAppointment(row: {
  id: number;
  date: Date;
  timeSlot: Date;
  status: AppointmentStatus;
  googleEventId: string | null;
  clientId: number;
  client: {
    name: string;
    alias: string | null;
    phone: string;
  };
}) {
  return {
    id: row.id,
    name: row.client.name,
    alias: row.client.alias,
    phone: row.client.phone,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    status: row.status,
    googleEventId: row.googleEventId,
    clientId: row.clientId,
  } satisfies PersistedAppointment;
}

function mapReservationLock(row: {
  id: number;
  date: Date;
  timeSlot: Date;
  phone: string;
  lockToken: string;
  expiresAt: Date;
}) {
  return {
    id: row.id,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    phone: row.phone,
    lockToken: row.lockToken,
    expiresAt: row.expiresAt.toISOString(),
  } satisfies PersistedReservationLock;
}

export async function hasActiveFutureAppointment(phone: string, dateFloor: string) {
  const record = await prisma.appointment.findFirst({
    where: {
      client: {
        phone,
      },
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
      client: {
        phone,
      },
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gt: new Date(`${dateFloor}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: {
      client: {
        select: {
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
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
      client: {
        phone,
      },
      status: "CONFIRMED",
      date: {
        gt: new Date(`${dateFloor}T00:00:00.000Z`),
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: {
      client: {
        select: {
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
  });

  return record ? mapAppointment(record) : null;
}

export async function listCancelableFutureAppointmentsByPhoneInMonth(
  phone: string,
  dateFloor: string,
  monthStart: string,
  monthEndExclusive: string,
) {
  const records = await prisma.appointment.findMany({
    where: {
      client: {
        phone,
      },
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gt: new Date(`${dateFloor}T00:00:00.000Z`),
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: {
      client: {
        select: {
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
  });

  return records.map(mapAppointment);
}

export async function findActiveAppointmentByPhoneForUpdate(
  tx: Prisma.TransactionClient,
  phone: string,
  dateFloor: string,
) {
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      client_id: number;
      name: string;
      alias: string | null;
      phone: string;
      date: Date;
      time_slot: Date;
      status: AppointmentStatus;
      google_event_id: string | null;
    }>
  >`
    SELECT a.id, a.client_id, c.name, c.alias, c.phone, a.date, a.time_slot, a.status, a.google_event_id
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE c.phone = ${phone}
      AND a.status IN ('CONFIRMED', 'SYNC_FAILED')
      AND a.date > ${dateFloor}
    ORDER BY a.date ASC, a.time_slot ASC
    LIMIT 1
    FOR UPDATE
  `;

  const record = records[0];

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    alias: record.alias,
    phone: record.phone,
    date: dateToDateKey(record.date),
    timeSlot: timeToTimeSlotKey(record.time_slot),
    status: record.status,
    googleEventId: record.google_event_id,
    clientId: record.client_id,
  } satisfies PersistedAppointment;
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
      client_id: number;
      name: string;
      alias: string | null;
      phone: string;
      date: Date;
      time_slot: Date;
      status: AppointmentStatus;
      google_event_id: string | null;
    }>
  >`
    SELECT a.id, a.client_id, c.name, c.alias, c.phone, a.date, a.time_slot, a.status, a.google_event_id
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE a.id = ${appointmentId}
      AND c.phone = ${phone}
      AND a.status = 'CONFIRMED'
      AND a.date > ${dateFloor}
      AND a.date >= ${monthStart}
      AND a.date < ${monthEndExclusive}
    LIMIT 1
    FOR UPDATE
  `;

  const record = records[0];

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    alias: record.alias,
    phone: record.phone,
    date: dateToDateKey(record.date),
    timeSlot: timeToTimeSlotKey(record.time_slot),
    status: record.status,
    googleEventId: record.google_event_id,
    clientId: record.client_id,
  } satisfies PersistedAppointment;
}

export async function findCancelableFutureAppointmentsByIdsForUpdate(
  tx: Prisma.TransactionClient,
  appointmentIds: number[],
  phone: string,
  dateFloor: string,
  monthStart: string,
  monthEndExclusive: string,
) {
  if (appointmentIds.length === 0) {
    return [];
  }

  const ids = Prisma.join(appointmentIds);
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      client_id: number;
      name: string;
      alias: string | null;
      phone: string;
      date: Date;
      time_slot: Date;
      status: AppointmentStatus;
      google_event_id: string | null;
    }>
  >`
    SELECT a.id, a.client_id, c.name, c.alias, c.phone, a.date, a.time_slot, a.status, a.google_event_id
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE a.id IN (${ids})
      AND c.phone = ${phone}
      AND a.status IN ('CONFIRMED', 'SYNC_FAILED')
      AND a.date > ${dateFloor}
      AND a.date >= ${monthStart}
      AND a.date < ${monthEndExclusive}
    ORDER BY a.date ASC, a.time_slot ASC
    FOR UPDATE
  `;

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    alias: record.alias,
    phone: record.phone,
    date: dateToDateKey(record.date),
    timeSlot: timeToTimeSlotKey(record.time_slot),
    status: record.status,
    googleEventId: record.google_event_id,
    clientId: record.client_id,
  })) satisfies PersistedAppointment[];
}

export async function listMonthAppointments(monthStart: string, monthEndExclusive: string) {
  const records = await prisma.appointment.findMany({
    where: {
      status: {
        in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: {
      client: {
        select: {
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
  });

  return records.map(mapAppointment);
}

export async function listMonthActiveReservationLocks(monthStart: string, monthEndExclusive: string, now = new Date()) {
  const records = await prisma.reservationLock.findMany({
    where: {
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
      expiresAt: {
        gt: now,
      },
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return records.map(mapReservationLock);
}

export async function listActiveReservationLocksForDate(
  tx: Prisma.TransactionClient,
  date: string,
  now = new Date(),
) {
  const records = await tx.reservationLock.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
      expiresAt: {
        gt: now,
      },
    },
    orderBy: [{ timeSlot: "asc" }, { createdAt: "asc" }],
  });

  return records.map(mapReservationLock);
}

export async function lockConflictingAppointments(tx: Prisma.TransactionClient, date: string, phone: string) {
  const slotBlockingStatuses = Prisma.join(
    SLOT_BLOCKING_APPOINTMENT_STATUSES.map((status) => Prisma.sql`${status}`),
  );

  await tx.$queryRaw`
    SELECT a.id
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE (a.date = ${date} OR c.phone = ${phone})
      AND a.status IN (${slotBlockingStatuses})
    FOR UPDATE
  `;
}

export async function cleanupExpiredReservationLocks(tx: Prisma.TransactionClient, now = new Date()) {
  await tx.reservationLock.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });
}

export async function deleteActiveReservationLocksByPhone(
  tx: Prisma.TransactionClient,
  phone: string,
  now = new Date(),
) {
  await tx.reservationLock.deleteMany({
    where: {
      phone,
      expiresAt: {
        gt: now,
      },
    },
  });
}

export async function createReservationLock(
  tx: Prisma.TransactionClient,
  input: { date: string; timeSlot: string; phone: string; lockToken: string; expiresAt: Date },
) {
  const row = await tx.reservationLock.create({
    data: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: timeSlotToDate(input.timeSlot),
      phone: input.phone,
      lockToken: input.lockToken,
      expiresAt: input.expiresAt,
    },
  });

  return mapReservationLock(row);
}

export async function findActiveReservationLockForSlotForUpdate(
  tx: Prisma.TransactionClient,
  input: { date: string; timeSlot: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      date: Date;
      time_slot: Date;
      phone: string;
      lock_token: string;
      expires_at: Date;
    }>
  >`
    SELECT id, date, time_slot, phone, lock_token, expires_at
    FROM reservation_locks
    WHERE date = ${input.date}
      AND time_slot = ${input.timeSlot}
      AND expires_at > ${now}
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE
  `;

  const row = records[0];

  if (!row) {
    return null;
  }

  return mapReservationLock({
    id: row.id,
    date: row.date,
    timeSlot: row.time_slot,
    phone: row.phone,
    lockToken: row.lock_token,
    expiresAt: row.expires_at,
  });
}

export async function findReservationLockByTokenForUpdate(
  tx: Prisma.TransactionClient,
  lockToken: string,
) {
  const records = await tx.$queryRaw<
    Array<{
      id: number;
      date: Date;
      time_slot: Date;
      phone: string;
      lock_token: string;
      expires_at: Date;
    }>
  >`
    SELECT id, date, time_slot, phone, lock_token, expires_at
    FROM reservation_locks
    WHERE lock_token = ${lockToken}
    LIMIT 1
    FOR UPDATE
  `;

  const row = records[0];

  if (!row) {
    return null;
  }

  return mapReservationLock({
    id: row.id,
    date: row.date,
    timeSlot: row.time_slot,
    phone: row.phone,
    lockToken: row.lock_token,
    expiresAt: row.expires_at,
  });
}

export async function deleteReservationLockByToken(tx: Prisma.TransactionClient, lockToken: string) {
  await tx.reservationLock.deleteMany({
    where: {
      lockToken,
    },
  });
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
