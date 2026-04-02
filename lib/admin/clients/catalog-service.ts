import { prisma } from "@/lib/db/prisma";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import {
  buildClientSearchWhere,
  dateToDateKey,
  getFutureActiveAppointmentsWhere,
  timeToTimeSlotKey,
} from "@/lib/admin/clients/helpers";
import type {
  AdminClientsCatalogQuery,
  AdminClientsCatalogResponse,
} from "@/lib/admin/clients/types";

function resolveCatalogOrderBy(sort: AdminClientsCatalogQuery["sort"]) {
  if (sort === "APPOINTMENTS_DESC") {
    return [
      { appointments: { _count: "desc" as const } },
      { updatedAt: "desc" as const },
    ];
  }

  if (sort === "NAME_ASC") {
    return [{ name: "asc" as const }, { updatedAt: "desc" as const }];
  }

  if (sort === "NAME_DESC") {
    return [{ name: "desc" as const }, { updatedAt: "desc" as const }];
  }

  return [{ updatedAt: "desc" as const }];
}

export async function getAdminClientsCatalog(
  filters: AdminClientsCatalogQuery,
  now = new Date(),
): Promise<AdminClientsCatalogResponse> {
  const currentDate = getCurrentDateKey(now);
  const queryWhere = buildClientSearchWhere(filters.query);
  const futureActiveAppointmentsWhere = getFutureActiveAppointmentsWhere(currentDate);

  const listWhere = {
    ...queryWhere,
    ...(filters.status === "WITH_FUTURE_APPOINTMENTS"
      ? {
          appointments: {
            some: futureActiveAppointmentsWhere,
          },
        }
      : {}),
    ...(filters.status === "WITHOUT_FUTURE_APPOINTMENTS"
      ? {
          appointments: {
            none: futureActiveAppointmentsWhere,
          },
        }
      : {}),
    ...(filters.status === "LOYAL"
      ? {
          isLoyal: true,
        }
      : {}),
  };

  const [totalClients, withFutureAppointments, loyalClients, totalFiltered, rows] =
    await Promise.all([
      prisma.client.count({
        where: queryWhere,
      }),
      prisma.client.count({
        where: {
          ...queryWhere,
          appointments: {
            some: futureActiveAppointmentsWhere,
          },
        },
      }),
      prisma.client.count({
        where: {
          ...queryWhere,
          isLoyal: true,
        },
      }),
      prisma.client.count({
        where: listWhere,
      }),
      prisma.client.findMany({
        where: listWhere,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: resolveCatalogOrderBy(filters.sort),
        select: {
          id: true,
          name: true,
          phone: true,
          isLoyal: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              appointments: true,
            },
          },
          appointments: {
            select: {
              date: true,
            },
            orderBy: {
              date: "desc",
            },
            take: 1,
          },
        },
      }),
    ]);

  const clientIds = rows.map((row) => row.id);
  const futureAppointmentsByClient = new Map<number, { date: Date; timeSlot: Date }>();

  if (clientIds.length > 0) {
    const futureAppointmentRows = await prisma.appointment.findMany({
      where: {
        clientId: {
          in: clientIds,
        },
        ...futureActiveAppointmentsWhere,
      },
      select: {
        clientId: true,
        date: true,
        timeSlot: true,
      },
      orderBy: [
        {
          clientId: "asc",
        },
        {
          date: "asc",
        },
        {
          timeSlot: "asc",
        },
      ],
    });

    for (const appointment of futureAppointmentRows) {
      if (!futureAppointmentsByClient.has(appointment.clientId)) {
        futureAppointmentsByClient.set(appointment.clientId, {
          date: appointment.date,
          timeSlot: appointment.timeSlot,
        });
      }
    }
  }

  return {
    filters,
    metrics: {
      totalClients,
      withFutureAppointments,
      withoutFutureAppointments: Math.max(0, totalClients - withFutureAppointments),
      loyalClients,
      loyalClientsPercentage:
        totalClients === 0 ? 0 : Math.round((loyalClients / totalClients) * 100),
    },
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: totalFiltered,
      totalPages: Math.max(1, Math.ceil(totalFiltered / filters.pageSize)),
    },
    clients: rows.map((row) => ({
      clientId: row.id,
      name: row.name,
      phone: row.phone,
      isLoyal: row.isLoyal,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      totalAppointments: row._count.appointments,
      hasFutureActiveAppointments: futureAppointmentsByClient.has(row.id),
      lastAppointmentDate: row.appointments[0]
        ? dateToDateKey(row.appointments[0].date)
        : null,
      nextAppointmentDate: futureAppointmentsByClient.get(row.id)
        ? dateToDateKey(futureAppointmentsByClient.get(row.id)!.date)
        : null,
      nextAppointmentTimeSlot: futureAppointmentsByClient.get(row.id)
        ? timeToTimeSlotKey(futureAppointmentsByClient.get(row.id)!.timeSlot)
        : null,
    })),
    currentDate,
  };
}
