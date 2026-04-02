"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { fetchAdminClientsCatalog } from "@/lib/admin/clients/api-client";
import type {
  AdminClientCatalogSort,
  AdminClientCatalogStatus,
  AdminClientsCatalogResponse,
} from "@/lib/admin/clients/types";

type UseClientsCatalogInput = {
  initialData: AdminClientsCatalogResponse;
};

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

export function useClientsCatalog({ initialData }: UseClientsCatalogInput) {
  const router = useRouter();
  const pathname = usePathname();
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const [data, setData] = useState<AdminClientsCatalogResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const filters = data.filters;

  const updateSearchParams = useCallback((nextFilters: {
    query: string;
    status: AdminClientCatalogStatus;
    sort: AdminClientCatalogSort;
    page: number;
    pageSize: number;
  }) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (nextFilters.query.trim().length > 0) {
      params.set("query", nextFilters.query.trim());
    } else {
      params.delete("query");
    }

    params.set("status", nextFilters.status);
    params.set("sort", nextFilters.sort);
    params.set("page", String(nextFilters.page));
    params.set("pageSize", String(nextFilters.pageSize));

    const nextQuery = params.toString();
    const nextUrl = nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname;

    window.history.replaceState(window.history.state, "", nextUrl);
  }, [pathname]);

  const loadCatalog = useCallback(async (nextFilters: {
    query: string;
    status: AdminClientCatalogStatus;
    sort: AdminClientCatalogSort;
    page: number;
    pageSize: number;
  }) => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorCode(null);

    try {
      const response = await fetchAdminClientsCatalog({
        ...nextFilters,
        signal: controller.signal,
      });

      if (requestId === requestIdRef.current) {
        setData((previous) => ({
          ...response,
          // Keep analytics stable while interacting with filters.
          metrics: previous.metrics,
        }));
      }
    } catch (error) {
      if (error instanceof Error && error.message === "AbortError") {
        return;
      }

      if (requestId === requestIdRef.current) {
        setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const applyQuery = useCallback((query: string) => {
    const nextFilters = {
      ...filters,
      query,
      page: 1,
    };

    updateSearchParams(nextFilters);
    void loadCatalog(nextFilters);
  }, [filters, loadCatalog, updateSearchParams]);

  const updateStatus = useCallback((status: AdminClientCatalogStatus) => {
    const nextFilters = {
      ...filters,
      status,
      page: 1,
    };

    updateSearchParams(nextFilters);
    void loadCatalog(nextFilters);
  }, [filters, loadCatalog, updateSearchParams]);

  const updateSort = useCallback((sort: AdminClientCatalogSort) => {
    const nextFilters = {
      ...filters,
      sort,
      page: 1,
    };

    updateSearchParams(nextFilters);
    void loadCatalog(nextFilters);
  }, [filters, loadCatalog, updateSearchParams]);

  const goToPage = useCallback((page: number) => {
    const nextFilters = {
      ...filters,
      page,
    };

    updateSearchParams(nextFilters);
    void loadCatalog(nextFilters);
  }, [filters, loadCatalog, updateSearchParams]);

  const retry = useCallback(() => {
    void loadCatalog(filters);
  }, [filters, loadCatalog]);

  const refresh = useCallback(async () => {
    await loadCatalog(filters);
  }, [filters, loadCatalog]);

  const goToClient = useCallback((clientId: number) => {
    router.push(`/admin/clients/${clientId}`);
  }, [router]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    data,
    filters,
    isLoading,
    errorCode,
    applyQuery,
    updateStatus,
    updateSort,
    goToPage,
    retry,
    refresh,
    goToClient,
    hasRows: useMemo(() => data.clients.length > 0, [data.clients.length]),
  };
}
