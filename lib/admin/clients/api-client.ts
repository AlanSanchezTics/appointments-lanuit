"use client";

import type { SearchAdminClientsResponse } from "@/lib/admin/clients/types";

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
