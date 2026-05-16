"use client";

import type {
  AdminCancelAppointmentResponse,
  AdminCreateAppointmentClientInput,
  AdminCreateAppointmentPayload,
  AdminCreateAppointmentResponse,
  AdminDayAgendaResponse,
  AdminRescheduleAppointmentPayload,
  AdminRescheduleAppointmentResponse,
} from "@/lib/admin/appointments/types";
import { normalizeClientAlias, normalizeClientName } from "@/lib/shared/client-name";

type AdminCreateAppointmentInlinePayload = {
  month: string;
  date: string;
  timeSlot: AdminCreateAppointmentPayload["timeSlot"];
  client: AdminCreateAppointmentClientInput;
  clientId?: never;
};

function hasInlineClientPayload(
  payload: AdminCreateAppointmentPayload,
): payload is AdminCreateAppointmentInlinePayload {
  return "client" in payload && payload.client !== undefined;
}

function normalizeCreateAppointmentPayload(
  payload: AdminCreateAppointmentPayload,
): AdminCreateAppointmentPayload {
  if (!hasInlineClientPayload(payload)) {
    return payload;
  }

  return {
    ...payload,
    client: {
      ...payload.client,
      name: normalizeClientName(payload.client.name),
      alias: normalizeClientAlias(payload.client.alias) ?? undefined,
    },
  };
}

export async function fetchAdminDayAgenda(
  month: string,
  date: string,
  signal?: AbortSignal,
): Promise<AdminDayAgendaResponse> {
  const response = await fetch(`/api/admin/months/${month}/days/${date}/agenda`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(payload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<AdminDayAgendaResponse>;
}

export async function rescheduleAdminAppointmentById(
  appointmentId: number,
  payload: AdminRescheduleAppointmentPayload,
): Promise<AdminRescheduleAppointmentResponse> {
  const response = await fetch(`/api/admin/appointments/${appointmentId}/reschedule`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(errorPayload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<AdminRescheduleAppointmentResponse>;
}

export async function cancelAdminAppointmentById(
  appointmentId: number,
  payload: { month: string },
): Promise<AdminCancelAppointmentResponse> {
  const response = await fetch(`/api/admin/appointments/${appointmentId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(errorPayload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<AdminCancelAppointmentResponse>;
}

export async function createAdminAppointmentByMonth(
  payload: AdminCreateAppointmentPayload,
): Promise<AdminCreateAppointmentResponse> {
  const normalizedPayload = normalizeCreateAppointmentPayload(payload);
  const response = await fetch(`/api/admin/months/${payload.month}/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizedPayload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(errorPayload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<AdminCreateAppointmentResponse>;
}
