"use client";

import { useCallback, useState } from "react";

import { fetchAdminMonthDetail } from "@/lib/admin/months/api-client";
import type { MonthDetailResponse } from "@/lib/admin/months/types";

type UseMonthDetailInput = {
  month: string;
  initialData: MonthDetailResponse;
};

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

export function useMonthDetail({ month, initialData }: UseMonthDetailInput) {
  const [data, setData] = useState<MonthDetailResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorCode(null);

    try {
      const response = await fetchAdminMonthDetail(month);
      setData(response);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  return {
    data,
    isLoading,
    errorCode,
    refresh,
  };
}
