import type { AppointmentStatus, Prisma } from "@prisma/client";

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "CONFIRMED",
  "SYNC_FAILED",
];

export function normalizeClientQuery(query: string) {
  const normalizedQuery = query.trim();
  const normalizedPhoneQuery = normalizedQuery.replace(/\D/g, "");

  return {
    normalizedQuery,
    normalizedPhoneQuery,
    hasPhoneQuery: normalizedPhoneQuery.length > 0,
  };
}

export function buildClientSearchWhere(query: string): Prisma.ClientWhereInput {
  const { normalizedQuery, normalizedPhoneQuery, hasPhoneQuery } = normalizeClientQuery(query);

  if (!normalizedQuery) {
    return {};
  }

  return {
    OR: [
      {
        name: {
          contains: normalizedQuery,
        },
      },
      {
        alias: {
          contains: normalizedQuery,
        },
      },
      ...(hasPhoneQuery
        ? [
            {
              phone: {
                contains: normalizedPhoneQuery,
              },
            },
          ]
        : []),
    ],
  };
}

export function getFutureActiveAppointmentsWhere(
  currentDate: string,
): Prisma.AppointmentWhereInput {
  return {
    status: {
      in: ACTIVE_APPOINTMENT_STATUSES,
    },
    date: {
      gt: new Date(`${currentDate}T00:00:00.000Z`),
    },
  };
}

export function isFutureActiveAppointment(input: {
  status: AppointmentStatus;
  date: Date;
  currentDateValue: Date;
}) {
  return (
    ACTIVE_APPOINTMENT_STATUSES.includes(input.status)
    && input.date.getTime() > input.currentDateValue.getTime()
  );
}

export function isActiveAppointment(status: AppointmentStatus) {
  return ACTIVE_APPOINTMENT_STATUSES.includes(status);
}

export function rankClient(query: string, client: {
  name: string;
  alias: string | null;
  phone: string;
}) {
  const { normalizedQuery, normalizedPhoneQuery } = normalizeClientQuery(query);
  const lowerQuery = normalizedQuery.toLowerCase();
  const lowerName = client.name.toLowerCase();
  const lowerAlias = client.alias?.toLowerCase() ?? "";

  if (!lowerQuery && !normalizedPhoneQuery) {
    return 2;
  }

  if (
    lowerName.startsWith(lowerQuery)
    || lowerAlias.startsWith(lowerQuery)
    || client.phone.startsWith(normalizedPhoneQuery)
  ) {
    return 0;
  }

  if (
    lowerName.includes(lowerQuery)
    || lowerAlias.includes(lowerQuery)
    || client.phone.includes(normalizedPhoneQuery)
  ) {
    return 1;
  }

  return 2;
}

export function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}
