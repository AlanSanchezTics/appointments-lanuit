"use client";

import type {
  AdminClientDetailResponse,
  AdminClientsCatalogQuery,
  AdminClientsCatalogResponse,
  SearchAdminClientsResponse,
  UpdateAdminClientPayload,
  UpdateAdminClientResponse,
} from "@/lib/admin/clients/types";

export async function searchAdminClientsByQuery(
  query: string,
  input?: {
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<SearchAdminClientsResponse> {
  const searchParams = new URLSearchParams({
    query,
  });

  if (typeof input?.limit === "number") {
    searchParams.set("limit", String(input.limit));
  }

  const response = await fetch(`/api/admin/clients/search?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: input?.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(payload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<SearchAdminClientsResponse>;
}

export async function fetchAdminClientsCatalog(
  input: AdminClientsCatalogQuery & { signal?: AbortSignal },
): Promise<AdminClientsCatalogResponse> {
  const searchParams = new URLSearchParams();

  if (input.query.trim().length > 0) {
    searchParams.set("query", input.query.trim());
  }
  searchParams.set("status", input.status);
  searchParams.set("sort", input.sort);
  searchParams.set("page", String(input.page));
  searchParams.set("pageSize", String(input.pageSize));

  const response = await fetch(`/api/admin/clients/catalog?${searchParams.toString()}`, {
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

  return response.json() as Promise<AdminClientsCatalogResponse>;
}

export async function fetchAdminClientDetail(
  clientId: number,
  signal?: AbortSignal,
): Promise<AdminClientDetailResponse> {
  const response = await fetch(`/api/admin/clients/${clientId}`, {
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

  return response.json() as Promise<AdminClientDetailResponse>;
}

export async function updateAdminClient(
  clientId: number,
  payload: UpdateAdminClientPayload,
): Promise<UpdateAdminClientResponse> {
  const response = await fetch(`/api/admin/clients/${clientId}`, {
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

  return response.json() as Promise<UpdateAdminClientResponse>;
}
