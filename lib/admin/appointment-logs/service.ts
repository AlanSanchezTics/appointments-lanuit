import type { Prisma } from "@prisma/client";

import { REQUIRED_TIMEZONE } from "@/lib/constants/slots";
import { prisma } from "@/lib/db/prisma";
import type {
  AdminAppointmentLogsFilters,
  AdminAppointmentLogsItem,
  AdminAppointmentLogsResponse,
  AppointmentLogActorType,
  CreateAppointmentLogInput,
} from "@/lib/admin/appointment-logs/types";

const PDF_EXPORT_LIMIT = 1000;

function getMexicoCityOffsetString() {
  return "-06:00";
}

function toMexicoCityDayStart(date: string) {
  return new Date(`${date}T00:00:00.000${getMexicoCityOffsetString()}`);
}

function toMexicoCityDayEndExclusive(date: string) {
  const start = toMexicoCityDayStart(date);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function toMexicoCityMonthStart(month: string) {
  return new Date(`${month}-01T00:00:00.000${getMexicoCityOffsetString()}`);
}

function toMexicoCityMonthEndExclusive(month: string) {
  const start = toMexicoCityMonthStart(month);
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function formatDateTimeInMexicoCity(value: Date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: REQUIRED_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${getMexicoCityOffsetString()}`;
}

function combineDateAndTime(date: Date, timeSlot: Date) {
  return `${date.toISOString().slice(0, 10)}T${timeSlot.toISOString().slice(11, 16)}:00${getMexicoCityOffsetString()}`;
}

function mapActionLabel(actionType: string) {
  if (actionType === "PENDING") {
    return "Cita solicitada";
  }

  if (actionType === "CONFIRMED") {
    return "Cita confirmada";
  }

  if (actionType === "CANCELLED") {
    return "Cita cancelada";
  }

  return "Cita rechazada";
}

function mapActorLabel(actorType: AppointmentLogActorType) {
  if (actorType === "SYSTEM") {
    return "Sistema";
  }

  if (actorType === "ADMIN") {
    return "Admin";
  }

  return "Cliente";
}

function buildWhere(filters: AdminAppointmentLogsFilters): Prisma.AppointmentLogWhereInput {
  const clauses: Prisma.AppointmentLogWhereInput[] = [];
  const client = filters.client.trim();

  if (client.length > 0) {
    const normalizedPhone = client.replace(/\D/g, "");
    const clientClauses: Prisma.ClientWhereInput[] = [
      {
        name: {
          contains: client,
        },
      },
    ];

    if (normalizedPhone.length > 0) {
      clientClauses.push({
        phone: {
          contains: normalizedPhone,
        },
      });
    }

    clientClauses.push({
      alias: {
        contains: client,
      },
    });

    clauses.push({
      client: {
        is: {
          OR: clientClauses,
        },
      },
    });
  }

  if (filters.actionType) {
    clauses.push({
      actionType: filters.actionType,
    });
  }

  if (filters.month) {
    clauses.push({
      appointment: {
        is: {
          date: {
            gte: toMexicoCityMonthStart(filters.month),
            lt: toMexicoCityMonthEndExclusive(filters.month),
          },
        },
      },
    });
  }

  if (filters.actionDateFrom || filters.actionDateTo) {
    clauses.push({
      createdAt: {
        ...(filters.actionDateFrom
          ? {
              gte: toMexicoCityDayStart(filters.actionDateFrom),
            }
          : {}),
        ...(filters.actionDateTo
          ? {
              lt: toMexicoCityDayEndExclusive(filters.actionDateTo),
            }
          : {}),
      },
    });
  }

  if (clauses.length === 0) {
    return {};
  }

  return {
    AND: clauses,
  };
}

function mapAppointmentLogItem(row: {
  id: number;
  appointmentId: number;
  actionType: string;
  actorType: AppointmentLogActorType;
  createdAt: Date;
  appointment: {
    date: Date;
    timeSlot: Date;
  };
  client: {
    name: string;
    alias: string | null;
    phone: string;
    clientNumber: number | null;
  };
}): AdminAppointmentLogsItem {
  return {
    id: row.id,
    appointmentNumber: row.appointmentId,
    client: {
      name: row.client.name,
      alias: row.client.alias,
      phone: row.client.phone,
      clientNumber: row.client.clientNumber,
    },
    actionType: row.actionType as AdminAppointmentLogsItem["actionType"],
    actionLabel: mapActionLabel(row.actionType),
    appointmentDateTime: combineDateAndTime(row.appointment.date, row.appointment.timeSlot),
    actor: {
      type: row.actorType,
      label: mapActorLabel(row.actorType),
    },
    actionDateTime: formatDateTimeInMexicoCity(row.createdAt),
  };
}

export async function createAppointmentLogEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  input: CreateAppointmentLogInput,
) {
  return tx.appointmentLog.create({
    data: {
      appointmentId: input.appointmentId,
      actionType: input.actionType,
      actorType: input.actor.type,
      clientId: input.clientId,
    },
  });
}

export async function createAppointmentLogEvents(
  tx: Prisma.TransactionClient | typeof prisma,
  inputs: CreateAppointmentLogInput[],
) {
  if (inputs.length === 0) {
    return { count: 0 };
  }

  await tx.appointmentLog.createMany({
    data: inputs.map((input) => ({
      appointmentId: input.appointmentId,
      actionType: input.actionType,
      actorType: input.actor.type,
      clientId: input.clientId,
    })),
  });

  return { count: inputs.length };
}

export async function getAdminAppointmentLogs(
  filters: AdminAppointmentLogsFilters & { page: number; pageSize: number },
): Promise<AdminAppointmentLogsResponse> {
  const where = buildWhere(filters);
  const { page, pageSize, ...responseFilters } = filters;

  const [totalItems, rows] = await Promise.all([
    prisma.appointmentLog.count({
      where,
    }),
    prisma.appointmentLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      include: {
        appointment: {
          select: {
            date: true,
            timeSlot: true,
          },
        },
        client: {
          select: {
            name: true,
            alias: true,
            phone: true,
            clientNumber: true,
          },
        },
      },
    }),
  ]);

  const items = rows.map(mapAppointmentLogItem);

  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
    filters: responseFilters,
  };
}

export async function getAdminAppointmentLogsForExport(filters: AdminAppointmentLogsFilters) {
  const where = buildWhere(filters);

  const totalItems = await prisma.appointmentLog.count({
    where,
  });

  if (totalItems > PDF_EXPORT_LIMIT) {
    throw new Error("EXPORT_LIMIT_EXCEEDED");
  }

  const rows = await prisma.appointmentLog.findMany({
    where,
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    include: {
      appointment: {
        select: {
          date: true,
          timeSlot: true,
        },
      },
      client: {
        select: {
          name: true,
          alias: true,
          phone: true,
          clientNumber: true,
        },
      },
    },
  });

  return {
    totalItems,
    items: rows.map(mapAppointmentLogItem),
  };
}

export function mapAppointmentLogLabel(actionType: AdminAppointmentLogsItem["actionType"]) {
  return mapActionLabel(actionType);
}

export function formatAppointmentLogDateTime(value: Date) {
  return formatDateTimeInMexicoCity(value);
}
