import { z } from "zod";

import type {
  AdminClientsCatalogQuery,
  SearchAdminClientsInput,
  UpdateAdminClientPayload,
} from "@/lib/admin/clients/types";
import {
  ADMIN_CLIENT_CATALOG_SORT_VALUES,
  ADMIN_CLIENT_CATALOG_STATUS_VALUES,
} from "@/lib/admin/clients/types";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const DEFAULT_CATALOG_PAGE = 1;
const DEFAULT_CATALOG_PAGE_SIZE = 20;
const MAX_CATALOG_PAGE_SIZE = 100;

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

const CATALOG_QUERY_SCHEMA = z.object({
  query: z.string().trim().max(100, "CLIENT_CATALOG_QUERY_TOO_LONG"),
  status: z.enum(ADMIN_CLIENT_CATALOG_STATUS_VALUES),
  sort: z.enum(ADMIN_CLIENT_CATALOG_SORT_VALUES),
  page: z
    .number()
    .int("CLIENT_CATALOG_PAGE_INVALID")
    .min(1, "CLIENT_CATALOG_PAGE_INVALID"),
  pageSize: z
    .number()
    .int("CLIENT_CATALOG_PAGE_SIZE_INVALID")
    .min(1, "CLIENT_CATALOG_PAGE_SIZE_INVALID")
    .max(MAX_CATALOG_PAGE_SIZE, "CLIENT_CATALOG_PAGE_SIZE_INVALID"),
});

const UPDATE_CLIENT_SCHEMA = z.object({
  name: z
    .string()
    .trim()
    .min(3, "CLIENT_NAME_TOO_SHORT")
    .max(100, "CLIENT_NAME_TOO_LONG")
    .optional(),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => /^[0-9]{10}$/.test(value), "VALIDATION_PHONE_INVALID")
    .optional(),
  isLoyal: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "VALIDATION_ERROR",
});

function parseNumber(rawValue: string | null, options: {
  defaultValue: number;
  errorCode: string;
}) {
  if (rawValue == null || rawValue.trim() === "") {
    return options.defaultValue;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(options.errorCode);
  }

  return Number(rawValue);
}

function parseLimit(rawValue: string | null) {
  return parseNumber(rawValue, {
    defaultValue: DEFAULT_LIMIT,
    errorCode: "CLIENT_SEARCH_LIMIT_INVALID",
  });
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

export function parseAdminClientsCatalogQuery(
  searchParams: URLSearchParams,
): AdminClientsCatalogQuery {
  const rawStatus = (searchParams.get("status") ?? "ALL").toUpperCase();
  const rawSort = (searchParams.get("sort") ?? "RECENT").toUpperCase();

  const parsed = CATALOG_QUERY_SCHEMA.parse({
    query: searchParams.get("query") ?? "",
    status: rawStatus,
    sort: rawSort,
    page: parseNumber(searchParams.get("page"), {
      defaultValue: DEFAULT_CATALOG_PAGE,
      errorCode: "CLIENT_CATALOG_PAGE_INVALID",
    }),
    pageSize: parseNumber(searchParams.get("pageSize"), {
      defaultValue: DEFAULT_CATALOG_PAGE_SIZE,
      errorCode: "CLIENT_CATALOG_PAGE_SIZE_INVALID",
    }),
  });

  return {
    query: parsed.query,
    status: parsed.status,
    sort: parsed.sort,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

export function parseAdminClientsCatalogQueryFromObject(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const normalizedEntries = Object.entries(searchParams).flatMap(
    ([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((chunk) => [key, chunk] as [string, string]);
      }

      if (typeof value === "string") {
        return [[key, value] as [string, string]];
      }

      return [];
    },
  );

  return parseAdminClientsCatalogQuery(new URLSearchParams(normalizedEntries));
}

export function parseAdminClientsCatalogQueryOrDefault(
  searchParams: Record<string, string | string[] | undefined>,
) {
  try {
    return parseAdminClientsCatalogQueryFromObject(searchParams);
  } catch {
    return parseAdminClientsCatalogQuery(new URLSearchParams());
  }
}

export function parseAdminClientIdParam(rawClientId: string) {
  if (!/^\d+$/.test(rawClientId)) {
    throw new Error("CLIENT_ID_INVALID");
  }

  const parsedClientId = Number(rawClientId);

  if (!Number.isSafeInteger(parsedClientId) || parsedClientId <= 0) {
    throw new Error("CLIENT_ID_INVALID");
  }

  return parsedClientId;
}

export function parseUpdateAdminClientPayload(
  payload: unknown,
): UpdateAdminClientPayload {
  const parsed = UPDATE_CLIENT_SCHEMA.parse(payload);
  return parsed;
}
