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
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    status: row.status,
    googleEventId: row.googleEventId,
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
  await tx.$queryRaw`
    SELECT id
    FROM appointments
    WHERE (date = ${date} OR phone = ${phone})
      AND status IN ('CONFIRMED', 'SYNC_FAILED')
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
