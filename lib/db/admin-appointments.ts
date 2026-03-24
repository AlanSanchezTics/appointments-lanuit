import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PersistedAdminAgendaAppointment = {
  id: number;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "SYNC_FAILED";
  name: string;
  phone: string;
  googleEventId: string | null;
};

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

function mapAgendaAppointment(row: {
  id: number;
  date: Date;
  timeSlot: Date;
  status: "CONFIRMED" | "SYNC_FAILED";
  googleEventId: string | null;
  client: {
    name: string;
    phone: string;
  };
}) {
  return {
    id: row.id,
    date: dateToDateKey(row.date),
    timeSlot: timeToTimeSlotKey(row.timeSlot),
    status: row.status,
    name: row.client.name,
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
          name: true,
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
          name: true,
          phone: true,
        },
      },
    },
  });

  return row ? mapAgendaAppointment(row) : null;
}

export async function listActiveAppointmentsByDateExcludingForUpdate(
  tx: Prisma.TransactionClient,
  input: { date: string; excludeAppointmentId: number },
) {
  const rows = await tx.appointment.findMany({
    where: {
      date: new Date(`${input.date}T00:00:00.000Z`),
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      id: {
        not: input.excludeAppointmentId,
      },
    },
    select: {
      timeSlot: true,
    },
    orderBy: [{ timeSlot: "asc" }],
  });

  return rows.map((row) => timeToTimeSlotKey(row.timeSlot));
}

export async function listActiveAppointmentSlotsByDateForUpdate(
  tx: Prisma.TransactionClient,
  date: string,
) {
  const rows = await tx.appointment.findMany({
    where: {
      date: new Date(`${date}T00:00:00.000Z`),
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
    },
    select: {
      timeSlot: true,
    },
    orderBy: [{ timeSlot: "asc" }],
  });

  return rows.map((row) => timeToTimeSlotKey(row.timeSlot));
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
