"use client";

import type {
  CreateAdminMonthsPayload,
  CreateAdminMonthsResponse,
  MonthDetailResponse,
  MonthsCatalogResponse,
  MonthsCatalogStatus,
  UpdateAdminMonthSlotModeResponse,
  MonthSlotMode,
} from "@/lib/admin/months/types";

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

export async function updateAdminMonthSlotMode(
  month: string,
  slotMode: MonthSlotMode,
): Promise<UpdateAdminMonthSlotModeResponse> {
  const response = await fetch(`/api/admin/months/${month}/slot-mode`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slotMode,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(payload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<UpdateAdminMonthSlotModeResponse>;
}
