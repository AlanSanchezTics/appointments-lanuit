"use client";

import type {
  CreateAdminMonthsPayload,
  CreateAdminMonthsResponse,
  MonthsCatalogResponse,
  MonthsCatalogStatus,
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
