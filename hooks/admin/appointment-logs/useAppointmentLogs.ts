"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAdminAppointmentLogs } from "@/lib/admin/appointment-logs/api-client";
import type {
  AdminAppointmentLogsQuery,
  AdminAppointmentLogsResponse,
  AppointmentLogActionType,
} from "@/lib/admin/appointment-logs/types";

type UseAppointmentLogsInput = {
  initialData: AdminAppointmentLogsResponse;
};

function buildFiltersFromData(data: AdminAppointmentLogsResponse): AdminAppointmentLogsQuery {
  return {
    ...data.filters,
    page: data.pagination.page,
    pageSize: data.pagination.pageSize,
    format: "json",
  };
}

export function useAppointmentLogs({ initialData }: UseAppointmentLogsInput) {
  const pathname = usePathname();
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const [data, setData] = useState<AdminAppointmentLogsResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const filters = useMemo(() => buildFiltersFromData(data), [data]);

  const updateSearchParams = useCallback((nextFilters: AdminAppointmentLogsQuery) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (nextFilters.client.trim()) {
      params.set("client", nextFilters.client.trim());
    } else {
      params.delete("client");
    }

    if (nextFilters.actionType) {
      params.set("actionType", nextFilters.actionType);
    } else {
      params.delete("actionType");
    }

    if (nextFilters.month) {
      params.set("month", nextFilters.month);
    } else {
      params.delete("month");
    }

    if (nextFilters.actionDateFrom) {
      params.set("actionDateFrom", nextFilters.actionDateFrom);
    } else {
      params.delete("actionDateFrom");
    }

    if (nextFilters.actionDateTo) {
      params.set("actionDateTo", nextFilters.actionDateTo);
    } else {
      params.delete("actionDateTo");
    }

    params.set("page", String(nextFilters.page));
    params.set("pageSize", String(nextFilters.pageSize));

    const nextQuery = params.toString();
    const nextUrl = nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname;

    window.history.replaceState(window.history.state, "", nextUrl);
  }, [pathname]);

  const loadLogs = useCallback(async (nextFilters: AdminAppointmentLogsQuery) => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorCode(null);

    try {
      const response = await fetchAdminAppointmentLogs(
        {
          ...nextFilters,
          format: "json",
        },
        controller.signal,
      );

      if (requestId === requestIdRef.current) {
        setData(response);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "AbortError") {
        return;
      }

      if (requestId === requestIdRef.current) {
        setErrorCode(error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const applyFilters = useCallback((nextFilters: {
    client: string;
    actionType: AppointmentLogActionType | null;
    month: string;
    actionDateFrom: string;
    actionDateTo: string;
  }) => {
    const normalized = {
      ...filters,
      ...nextFilters,
      page: 1,
    };

    updateSearchParams(normalized);
    void loadLogs(normalized);
  }, [filters, loadLogs, updateSearchParams]);

  const goToPage = useCallback((page: number) => {
    const normalized = {
      ...filters,
      page,
    };

    updateSearchParams(normalized);
    void loadLogs(normalized);
  }, [filters, loadLogs, updateSearchParams]);

  const clearFilters = useCallback(() => {
    const normalized = {
      client: "",
      actionType: null,
      month: "",
      actionDateFrom: "",
      actionDateTo: "",
      page: 1,
      pageSize: filters.pageSize,
      format: "json" as const,
    };

    updateSearchParams(normalized);
    void loadLogs(normalized);
  }, [filters.pageSize, loadLogs, updateSearchParams]);

  const exportPdf = useCallback(async () => {
    setIsExporting(true);
    setErrorCode(null);

    try {
      const response = await fetch(`/api/admin/appointment-logs?${new URLSearchParams({
        client: filters.client,
        ...(filters.actionType ? { actionType: filters.actionType } : {}),
        ...(filters.month ? { month: filters.month } : {}),
        ...(filters.actionDateFrom ? { actionDateFrom: filters.actionDateFrom } : {}),
        ...(filters.actionDateTo ? { actionDateTo: filters.actionDateTo } : {}),
        page: String(filters.page),
        pageSize: String(filters.pageSize),
        format: "pdf",
      }).toString()}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { errorCode?: string; error?: string }
          | null;

        throw new Error(payload?.errorCode ?? payload?.error ?? "UNKNOWN_ERROR");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "appointment-logs.pdf";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "UNKNOWN_ERROR");
    } finally {
      setIsExporting(false);
    }
  }, [filters.actionDateFrom, filters.actionDateTo, filters.actionType, filters.client, filters.month, filters.page, filters.pageSize]);

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
    isExporting,
    errorCode,
    applyFilters,
    clearFilters,
    goToPage,
    exportPdf,
    hasRows: useMemo(() => data.items.length > 0, [data.items.length]),
  };
}
