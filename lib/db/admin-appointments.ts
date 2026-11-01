import type { AppointmentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { SLOT_BLOCKING_APPOINTMENT_STATUSES } from "@/lib/constants/appointment-statuses";
import { prisma } from "@/lib/db/prisma";

export type PersistedAdminAgendaAppointment = {
  id: number;
  clientId: number;
  clientNumber: number;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "SYNC_FAILED";
  name: string;
  alias: string | null;
  phone: string;
  googleEventId: string | null;
};

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

function toActiveAppointmentStatus(
  status: AppointmentStatus,
): PersistedAdminAgendaAppointment["status"] {
  if (status === "CONFIRMED" || status === "SYNC_FAILED") {
    return status;
  }

  throw new Error("APPOINTMENT_NOT_ACTIVE");
}

function mapAgendaAppointment(row: {
  id: number;
  clientId: number;
  date: Date;
  timeSlot: Date;
  status: AppointmentStatus;
  googleEventId: string | null;
  client: {
    id: number;
    clientNumber: number;
    name: string;
    alias: string | null;
    phone: string;
  };
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientNumber: row.client.clientNumber,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    status: toActiveAppointmentStatus(row.status),
    name: row.client.name,
    alias: row.client.alias,
    phone: row.client.phone,
    googleEventId: row.googleEventId,
  } satisfies PersistedAdminAgendaAppointment;
}

export async function listActiveAppointmentsByDate(date: string) {
  const rows = await prisma.appointment.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
    },
    include: {
      client: {
        select: {
          id: true,
          clientNumber: true,
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
    orderBy: [{ timeSlot: "asc" }],
  });

  return rows.map(mapAgendaAppointment);
}

export async function findActiveAppointmentByIdInMonthForUpdate(
  tx: Prisma.TransactionClient,
  input: { appointmentId: number; monthStart: string; monthEndExclusive: string },
) {
  const row = await tx.appointment.findFirst({
    where: {
      id: input.appointmentId,
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${input.monthStart}T00:00:00.000Z`),
        lt: new Date(`${input.monthEndExclusive}T00:00:00.000Z`),
      },
    },
    include: {
      client: {
        select: {
          id: true,
          clientNumber: true,
          name: true,
          alias: true,
          phone: true,
        },
      },
    },
  });

  return row ? mapAgendaAppointment(row) : null;
}

// Misma razón que listActiveAppointmentSlotsByDateForUpdate (D77): lectura bloqueante, no snapshot.
export async function listActiveAppointmentsByDateExcludingForUpdate(
  tx: Prisma.TransactionClient,
  input: { date: string; excludeAppointmentId: number },
) {
  const rows = await tx.$queryRaw<Array<{ t: string }>>`
    SELECT TIME_FORMAT(time_slot, '%H:%i') AS t
    FROM appointments
    WHERE date = ${input.date}
      AND status IN (${Prisma.join(SLOT_BLOCKING_APPOINTMENT_STATUSES.map((status) => Prisma.sql`${status}`))})
      AND id <> ${input.excludeAppointmentId}
    ORDER BY time_slot ASC
    FOR UPDATE
  `;

  return rows.map((row) => row.t);
}

// D68: ocupación para horarios de la agenda admin (estados que bloquean en el flujo público). La lista visible no cambia.
export async function listBlockingAppointmentsByDate(date: string) {
  return prisma.appointment.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
      status: {
        in: SLOT_BLOCKING_APPOINTMENT_STATUSES,
      },
    },
    select: {
      id: true,
      timeSlot: true,
    },
  }).then((rows) => rows.map((row) => ({ id: row.id, timeSlot: timeToTimeSlotKey(row.timeSlot) })));
}

// D77: lectura con FOR UPDATE de verdad. Un findMany plano usa el snapshot de REPEATABLE READ, que puede ser
// anterior al COMMIT de una reserva pública; la lectura bloqueante siempre ve la última versión confirmada.
export async function listActiveAppointmentSlotsByDateForUpdate(
  tx: Prisma.TransactionClient,
  date: string,
) {
  const rows = await tx.$queryRaw<Array<{ t: string }>>`
    SELECT TIME_FORMAT(time_slot, '%H:%i') AS t
    FROM appointments
    WHERE date = ${date}
      AND status IN (${Prisma.join(SLOT_BLOCKING_APPOINTMENT_STATUSES.map((status) => Prisma.sql`${status}`))})
    ORDER BY time_slot ASC
    FOR UPDATE
  `;

  return rows.map((row) => row.t);
}

export async function updateAppointmentScheduleById(
  tx: Prisma.TransactionClient,
  input: { appointmentId: number; date: string; timeSlot: string },
) {
  return tx.appointment.update({
    where: {
      id: input.appointmentId,
    },
    data: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${input.timeSlot}:00.000Z`),
    },
  });
}

export async function cancelAppointmentById(tx: Prisma.TransactionClient, appointmentId: number) {
  return tx.appointment.update({
    where: {
      id: appointmentId,
    },
    data: {
      status: "CANCELLED",
    },
  });
}
