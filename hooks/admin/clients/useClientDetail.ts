"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminClientDetail,
  updateAdminClient,
} from "@/lib/admin/clients/api-client";
import type {
  AdminClientDetailResponse,
  UpdateAdminClientPayload,
} from "@/lib/admin/clients/types";

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

type UseClientDetailInput = {
  clientId: number;
  initialData: AdminClientDetailResponse;
};

export function useClientDetail({ clientId, initialData }: UseClientDetailInput) {
  const [data, setData] = useState<AdminClientDetailResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorCode(null);

    try {
      const response = await fetchAdminClientDetail(clientId);
      setData(response);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  const updateClient = useCallback(async (payload: UpdateAdminClientPayload) => {
    setIsUpdating(true);

    try {
      await updateAdminClient(clientId, payload);
      await refresh();
    } finally {
      setIsUpdating(false);
    }
  }, [clientId, refresh]);

  const updateClientIdentity = useCallback(
    async (payload: { name: string; phone: string }) => {
      await updateClient(payload);
    },
    [updateClient],
  );

  const updateLoyalty = useCallback(
    async (isLoyal: boolean) => {
      await updateClient({ isLoyal });
    },
    [updateClient],
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  return {
    data,
    isLoading,
    isUpdating,
    errorCode,
    refresh,
    retry: refresh,
    updateClientIdentity,
    updateLoyalty,
  };
}
