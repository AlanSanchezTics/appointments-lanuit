"use client";

import { useCallback, useRef, useState } from "react";

import { fetchAdminDayAgenda } from "@/lib/admin/appointments/api-client";
import type { AdminDayAgendaResponse } from "@/lib/admin/appointments/types";

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

export function useDayAgendaModal(month: string) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AdminDayAgendaResponse | null>(null);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [agendaErrorCode, setAgendaErrorCode] = useState<string | null>(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isOpen = selectedDate !== null;

  const loadAgenda = useCallback(
    async (date: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoadingAgenda(true);
      setAgendaErrorCode(null);

      try {
        const response = await fetchAdminDayAgenda(month, date, controller.signal);
        setAgenda(response);
      } catch (error) {
        if (error instanceof Error && error.message === "AbortError") {
          return;
        }

        setAgendaErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
      } finally {
        setIsLoadingAgenda(false);
      }
    },
    [month],
  );

  const open = useCallback(
    async (date: string) => {
      setSelectedDate(date);
      setEditingAppointmentId(null);
      await loadAgenda(date);
    },
    [loadAgenda],
  );

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSelectedDate(null);
    setAgenda(null);
    setAgendaErrorCode(null);
    setEditingAppointmentId(null);
    setIsLoadingAgenda(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!selectedDate) {
      return;
    }

    await loadAgenda(selectedDate);
  }, [loadAgenda, selectedDate]);

  return {
    isOpen,
    selectedDate,
    agenda,
    isLoadingAgenda,
    agendaErrorCode,
    editingAppointmentId,
    setEditingAppointmentId,
    open,
    close,
    refresh,
  };
}
