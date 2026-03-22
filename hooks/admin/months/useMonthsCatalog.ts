"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { fetchMonthsCatalog } from "@/lib/admin/months/api-client";
import type { MonthsCatalogResponse, MonthsCatalogStatus } from "@/lib/admin/months/types";

type UseMonthsCatalogInput = {
  initialData: MonthsCatalogResponse;
};

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

export function useMonthsCatalog({ initialData }: UseMonthsCatalogInput) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<MonthsCatalogResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const year = data.filters.year;
  const status = data.filters.status;

  const updateSearchParams = useCallback(
    (nextYear: number, nextStatus: MonthsCatalogStatus) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(nextYear));
      params.set("status", nextStatus);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadCatalog = useCallback(async (nextYear: number, nextStatus: MonthsCatalogStatus) => {
    setIsLoading(true);
    setErrorCode(null);

    try {
      const response = await fetchMonthsCatalog({
        year: nextYear,
        status: nextStatus,
      });
      setData(response);
    } catch (error) {
      if (error instanceof Error && error.message === "AbortError") {
        return;
      }

      setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateYear = useCallback((nextYear: number) => {
    updateSearchParams(nextYear, status);
    void loadCatalog(nextYear, status);
  }, [loadCatalog, status, updateSearchParams]);

  const updateStatus = useCallback((nextStatus: MonthsCatalogStatus) => {
    updateSearchParams(year, nextStatus);
    void loadCatalog(year, nextStatus);
  }, [loadCatalog, updateSearchParams, year]);

  const retry = useCallback(() => {
    void loadCatalog(year, status);
  }, [loadCatalog, status, year]);

  const goToMonth = useCallback((month: string) => {
    router.push(`/admin/months/${month}`);
  }, [router]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const availableYears = useMemo(() => data.filters.availableYears, [data.filters.availableYears]);

  return {
    data,
    year,
    status,
    availableYears,
    isLoading,
    errorCode,
    updateYear,
    updateStatus,
    retry,
    goToMonth,
  };
}
