"use client";

import type {
  AffectedAppointmentItem,
  CreateAdminMonthsPayload,
  CreateAdminMonthsResponse,
  MonthAvailabilityResponse,
  MonthDetailResponse,
  MonthsCatalogResponse,
  MonthsCatalogStatus,
  ActiveMonthStatus,
  PreviewAvailabilityPayload,
  PreviewAvailabilityResponse,
  SaveAvailabilityPayload,
  UpdateAdminMonthStatusResponse,
  UpdateAdminMonthSlotModeResponse,
} from "@/lib/admin/months/types";
import type { AvailabilityPresetMode } from "@/lib/availability/defaults";

// message = código de error de la API. affectedAppointments llega en el 409 de confirmación (D18).
export class AdminMonthApiError extends Error {
  readonly affectedAppointments: AffectedAppointmentItem[];

  constructor(code: string, affectedAppointments: AffectedAppointmentItem[] = []) {
    super(code);
    this.name = "AdminMonthApiError";
    this.affectedAppointments = affectedAppointments;
  }
}

async function readAdminMonthApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { errorCode?: string; affectedAppointments?: AffectedAppointmentItem[] }
    | null;

  return new AdminMonthApiError(payload?.errorCode ?? "UNKNOWN_ERROR", payload?.affectedAppointments ?? []);
}

type FetchMonthsCatalogInput = {
  year: number;
  status: MonthsCatalogStatus;
  signal?: AbortSignal;
};

export async function fetchMonthsCatalog(
  input: FetchMonthsCatalogInput,
): Promise<MonthsCatalogResponse> {
  const searchParams = new URLSearchParams({
    year: String(input.year),
    status: input.status,
  });
  const response = await fetch(`/api/admin/months/catalog?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: input.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(payload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<MonthsCatalogResponse>;
}

export async function createMonths(
  payload: CreateAdminMonthsPayload,
): Promise<CreateAdminMonthsResponse> {
  const response = await fetch("/api/admin/months", {
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

  return response.json() as Promise<CreateAdminMonthsResponse>;
}

export async function fetchAdminMonthDetail(
  month: string,
  signal?: AbortSignal,
): Promise<MonthDetailResponse> {
  const response = await fetch(`/api/admin/months/${month}`, {
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

  return response.json() as Promise<MonthDetailResponse>;
}

type UpdateAdminMonthSlotModeOptions = {
  // Opcionales: sin expectedVersion el servidor no compara versión (D51).
  expectedVersion?: number;
  confirmAffectedAppointments?: boolean;
};

export async function updateAdminMonthSlotMode(
  month: string,
  slotMode: AvailabilityPresetMode,
  options: UpdateAdminMonthSlotModeOptions = {},
): Promise<UpdateAdminMonthSlotModeResponse> {
  const response = await fetch(`/api/admin/months/${month}/slot-mode`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slotMode,
      expectedVersion: options.expectedVersion,
      confirmAffectedAppointments: options.confirmAffectedAppointments ?? false,
    }),
  });

  if (!response.ok) {
    throw await readAdminMonthApiError(response);
  }

  return response.json() as Promise<UpdateAdminMonthSlotModeResponse>;
}

export async function fetchAdminMonthAvailability(
  month: string,
  signal?: AbortSignal,
): Promise<MonthAvailabilityResponse> {
  const response = await fetch(`/api/admin/months/${month}/availability`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await readAdminMonthApiError(response);
  }

  return response.json() as Promise<MonthAvailabilityResponse>;
}

// Sin escritura (FR-023): citas que quedarían fuera del horario propuesto.
export async function previewAdminMonthAvailability(
  month: string,
  payload: PreviewAvailabilityPayload,
): Promise<PreviewAvailabilityResponse> {
  const response = await fetch(`/api/admin/months/${month}/availability/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readAdminMonthApiError(response);
  }

  return response.json() as Promise<PreviewAvailabilityResponse>;
}

export async function saveAdminMonthAvailability(
  month: string,
  payload: SaveAvailabilityPayload,
): Promise<MonthAvailabilityResponse> {
  const response = await fetch(`/api/admin/months/${month}/availability`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readAdminMonthApiError(response);
  }

  return response.json() as Promise<MonthAvailabilityResponse>;
}

export async function updateAdminMonthStatus(
  month: string,
  status: ActiveMonthStatus,
): Promise<UpdateAdminMonthStatusResponse> {
  const response = await fetch(`/api/admin/months/${month}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(payload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<UpdateAdminMonthStatusResponse>;
}
