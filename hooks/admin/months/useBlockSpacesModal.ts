"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  createAdminBlockedSlots,
  fetchAdminBlockableSlots,
} from "@/lib/admin/blocked-spaces/api-client";
import { BLOCK_REASON_VALUES } from "@/lib/admin/blocked-spaces/types";

type BlockReason = (typeof BLOCK_REASON_VALUES)[number];
// Horario HH:mm que devuelve blockable-slots (D67: string libre, sin rejilla fija).
type TimeSlot = string;

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";

export function useBlockSpacesModal(month: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingDays, setIsLoadingDays] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [days, setDays] = useState<Array<{ date: string; slots: TimeSlot[] }>>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [isFullDaySelected, setIsFullDaySelected] = useState(false);
  const [reason, setReason] = useState<BlockReason>("DESCANSO");
  const abortRef = useRef<AbortController | null>(null);

  const selectedDaySlots = useMemo(() => {
    if (!selectedDate) {
      return [] as TimeSlot[];
    }

    return days.find((day) => day.date === selectedDate)?.slots ?? [];
  }, [days, selectedDate]);

  const areAllSelectedForDay = useMemo(() => {
    if (selectedDaySlots.length === 0) {
      return false;
    }

    return selectedDaySlots.every((slot) => selectedSlots.includes(slot));
  }, [selectedDaySlots, selectedSlots]);

  const isReadyToSubmit = Boolean(selectedDate) && (selectedSlots.length > 0 || isFullDaySelected) && !isSubmitting;

  const open = useCallback(async (initialDate?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsOpen(true);
    setIsLoadingDays(true);
    setErrorCode(null);
    setSelectedSlots([]);
    setIsFullDaySelected(false);
    setReason("DESCANSO");

    try {
      const response = await fetchAdminBlockableSlots(month, null, controller.signal);
      setDays(response.days);
      setSelectedDate((current) => {
        const preferredDateIfAvailable =
          initialDate && response.days.some((day) => day.date === initialDate)
            ? initialDate
            : null;

        if (preferredDateIfAvailable) {
          return preferredDateIfAvailable;
        }

        if (current && response.days.some((day) => day.date === current)) {
          return current;
        }

        return response.days[0]?.date ?? null;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "AbortError") {
        return;
      }

      setDays([]);
      setSelectedDate(null);
      setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
    } finally {
      setIsLoadingDays(false);
    }
  }, [month]);

  const close = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    abortRef.current?.abort();
    abortRef.current = null;
    setIsOpen(false);
    setIsLoadingDays(false);
    setIsSubmitting(false);
    setErrorCode(null);
    setDays([]);
    setSelectedDate(null);
    setSelectedSlots([]);
    setIsFullDaySelected(false);
    setReason("DESCANSO");
  }, [isSubmitting]);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlots([]);
    setIsFullDaySelected(false);
  }, []);

  const toggleSlot = useCallback((slot: TimeSlot) => {
    setIsFullDaySelected(false);
    setSelectedSlots((current) => {
      if (current.includes(slot)) {
        return current.filter((item) => item !== slot);
      }

      return [...current, slot].sort();
    });
  }, []);

  const selectAllSlotsForDay = useCallback(() => {
    setIsFullDaySelected(false);
    setSelectedSlots((current) => {
      const merged = new Set([...current, ...selectedDaySlots]);
      return Array.from(merged).sort();
    });
  }, [selectedDaySlots]);

  const selectFullDayForDay = useCallback(() => {
    setIsFullDaySelected(true);
    setSelectedSlots([]);
  }, []);

  const clearSelectedSlots = useCallback(() => {
    setSelectedSlots([]);
    setIsFullDaySelected(false);
  }, []);

  const submit = useCallback(
    async (onSuccess?: () => Promise<void> | void) => {
      if (
        !selectedDate
        || (!isFullDaySelected && selectedSlots.length === 0)
        || isSubmitting
      ) {
        return;
      }

      setIsSubmitting(true);
      setErrorCode(null);

      try {
        const response = isFullDaySelected
          ? await createAdminBlockedSlots({
              month,
              date: selectedDate,
              fullDay: true,
              reason,
            })
          : await createAdminBlockedSlots({
              month,
              date: selectedDate,
              slots: selectedSlots,
              reason,
            });

        if (onSuccess) {
          await onSuccess();
        }

        close();
        return response;
      } catch (error) {
        setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      close,
      isFullDaySelected,
      isSubmitting,
      month,
      reason,
      selectedDate,
      selectedSlots,
    ],
  );

  return {
    isOpen,
    isLoadingDays,
    isSubmitting,
    isReadyToSubmit,
    errorCode,
    days,
    selectedDate,
    selectedDaySlots,
    selectedSlots,
    isFullDaySelected,
    areAllSelectedForDay,
    reason,
    open,
    close,
    selectDate,
    toggleSlot,
    selectAllSlotsForDay,
    selectFullDayForDay,
    clearSelectedSlots,
    setReason,
    submit,
  };
}
