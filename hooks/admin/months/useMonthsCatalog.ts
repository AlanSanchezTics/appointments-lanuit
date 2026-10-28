"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { fetchMonthsCatalog } from "@/lib/admin/months/api-client";
import type { AdminMonthListItem, MonthsCatalogResponse, MonthsCatalogStatus } from "@/lib/admin/months/types";

type UseMonthsCatalogInput = {
  initialData: MonthsCatalogResponse;
  initialShowPast?: boolean;
};

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

// Meses como "YYYY-MM": la comparación de strings es cronológica.
function filterVisibleMonths(
  months: AdminMonthListItem[],
  currentMonth: string,
  showPast: boolean,
) {
  if (showPast) {
    return months;
  }

  return months.filter((item) => item.month >= currentMonth);
}

export function useMonthsCatalog({ initialData, initialShowPast = false }: UseMonthsCatalogInput) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<MonthsCatalogResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(initialShowPast);
  // Mientras la navegación no se confirma, la vista deshabilita los controles (isBusy),
  // así que cada escritura parte de la URL confirmada.
  const [isPending, startTransition] = useTransition();

  const year = data.filters.year;
  const status = data.filters.status;

  // Escribe la URL actual con un cambio; conserva el resto de params.
  const replaceSearchParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [pathname, router, searchParams]);

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
    replaceSearchParams((params) => params.set("year", String(nextYear)));
    void loadCatalog(nextYear, status);
  }, [loadCatalog, replaceSearchParams, status]);

  const updateStatus = useCallback((nextStatus: MonthsCatalogStatus) => {
    replaceSearchParams((params) => params.set("status", nextStatus));
    void loadCatalog(year, nextStatus);
  }, [loadCatalog, replaceSearchParams, year]);

  const retry = useCallback(() => {
    void loadCatalog(year, status);
  }, [loadCatalog, status, year]);

  const refreshCatalog = useCallback(async () => {
    await loadCatalog(year, status);
  }, [loadCatalog, status, year]);

  // Solo filtra la lista en cliente (sin fetch); `past` se conserva al cambiar year/status.
  const updateShowPast = useCallback((nextShowPast: boolean) => {
    replaceSearchParams((params) => {
      if (nextShowPast) {
        params.set("past", "1");
      } else {
        params.delete("past");
      }
    });
    setShowPast(nextShowPast);
  }, [replaceSearchParams]);

  const goToMonth = useCallback((month: string) => {
    router.push(`/admin/months/${month}`);
  }, [router]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    setShowPast(initialShowPast);
  }, [initialShowPast]);

  const availableYears = useMemo(() => data.filters.availableYears, [data.filters.availableYears]);

  const currentMonth = data.currentMonth;
  const visibleMonths = useMemo(
    () => filterVisibleMonths(data.months, currentMonth, showPast),
    [currentMonth, data.months, showPast],
  );
  const hasHiddenPastMonths = !showPast && data.months.some((item) => item.month < currentMonth);

  return {
    data,
    year,
    status,
    availableYears,
    isLoading,
    isPending,
    isBusy: isLoading || isPending,
    errorCode,
    showPast,
    visibleMonths,
    hasHiddenPastMonths,
    updateYear,
    updateStatus,
    updateShowPast,
    retry,
    refreshCatalog,
    goToMonth,
  };
}
