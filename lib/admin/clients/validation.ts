import { z } from "zod";

import type { SearchAdminClientsInput } from "@/lib/admin/clients/types";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

const SEARCH_CLIENTS_QUERY_SCHEMA = z.object({
  query: z
    .string()
    .trim()
    .min(MIN_QUERY_LENGTH, "CLIENT_SEARCH_QUERY_TOO_SHORT")
    .max(100, "CLIENT_SEARCH_QUERY_TOO_LONG"),
  limit: z
    .number()
    .int("CLIENT_SEARCH_LIMIT_INVALID")
    .min(1, "CLIENT_SEARCH_LIMIT_INVALID")
    .max(MAX_LIMIT, "CLIENT_SEARCH_LIMIT_INVALID")
    .optional(),
});

function parseLimit(rawValue: string | null) {
  if (rawValue == null || rawValue.trim() === "") {
    return DEFAULT_LIMIT;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error("CLIENT_SEARCH_LIMIT_INVALID");
  }

  return Number(rawValue);
}

export function parseSearchAdminClientsQuery(
  searchParams: URLSearchParams,
): SearchAdminClientsInput {
  const parsed = SEARCH_CLIENTS_QUERY_SCHEMA.parse({
    query: searchParams.get("query") ?? "",
    limit: parseLimit(searchParams.get("limit")),
  });

  return {
    query: parsed.query,
    limit: parsed.limit ?? DEFAULT_LIMIT,
  };
}
