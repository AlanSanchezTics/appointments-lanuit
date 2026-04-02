"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createAdminAppointmentByMonth } from "@/lib/admin/appointments/api-client";
import type {
  AdminCreateAppointmentResponse,
  AdminCreateAppointmentPayload,
} from "@/lib/admin/appointments/types";
import { fetchAdminBlockableSlots } from "@/lib/admin/blocked-spaces/api-client";
import type { AdminBlockableDay } from "@/lib/admin/blocked-spaces/types";
import {
  fetchNextAdminClientNumber,
  searchAdminClientsByQuery,
} from "@/lib/admin/clients/api-client";
import type { AdminClientSearchItem } from "@/lib/admin/clients/types";
import type { BaseTimeSlot } from "@/lib/constants/slots";

const DEFAULT_ERROR_CODE = "UNKNOWN_ERROR";
const MIN_CLIENT_QUERY_LENGTH = 2;

type FieldErrors = {
  date?: string;
  timeSlot?: string;
  client?: string;
  name?: string;
  phone?: string;
};

type ClientMode = "existing" | "new";

export function useBookAppointmentModal(month: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingDays, setIsLoadingDays] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [days, setDays] = useState<AdminBlockableDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<BaseTimeSlot | null>(null);
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminClientSearchItem[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<AdminClientSearchItem | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientNumber, setNewClientNumber] = useState("");
  const [hasInitializedClientNumberSuggestion, setHasInitializedClientNumberSuggestion] = useState(false);
  const [successResult, setSuccessResult] = useState<AdminCreateAppointmentResponse | null>(null);
  const abortDaysRef = useRef<AbortController | null>(null);
  const abortClientSearchRef = useRef<AbortController | null>(null);
  const abortClientNumberRef = useRef<AbortController | null>(null);

  const selectedDaySlots = useMemo(() => {
    if (!selectedDate) {
      return [] as BaseTimeSlot[];
    }

    return days.find((day) => day.date === selectedDate)?.slots ?? [];
  }, [days, selectedDate]);

  const isReadyToSubmit = useMemo(() => {
    if (!selectedDate || !selectedTimeSlot || isSubmitting || isLoadingDays || Boolean(successResult)) {
      return false;
    }

    if (clientMode === "existing") {
      return Boolean(selectedClient);
    }

    return newClientName.trim().length >= 3 && newClientPhone.trim().length > 0;
  }, [
    clientMode,
    isLoadingDays,
    isSubmitting,
    newClientName,
    newClientPhone,
    selectedClient,
    selectedDate,
    selectedTimeSlot,
    successResult,
  ]);

  const resetClientState = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedClient(null);
    setNewClientName("");
    setNewClientPhone("");
    setNewClientNumber("");
    setHasInitializedClientNumberSuggestion(false);
    setFieldErrors((current) => ({
      ...current,
      client: undefined,
      name: undefined,
      phone: undefined,
    }));
  }, []);

  const refreshAvailability = useCallback(async () => {
    abortDaysRef.current?.abort();
    const controller = new AbortController();
    abortDaysRef.current = controller;

    setIsLoadingDays(true);
    setErrorCode(null);

    try {
      const response = await fetchAdminBlockableSlots(month, null, controller.signal);
      const mappedDays = response.days.map((day) => ({
        date: day.date,
        slots: [...day.slots],
      }));

      setDays(mappedDays);
      setSelectedDate((currentDate) => {
        const firstDate = mappedDays[0]?.date ?? null;
        const hasCurrent = currentDate
          ? mappedDays.some((day) => day.date === currentDate)
          : false;
        const resolvedDate = hasCurrent ? currentDate : firstDate;
        const resolvedDay = mappedDays.find((day) => day.date === resolvedDate);

        setSelectedTimeSlot((currentSlot) => {
          if (!resolvedDay || resolvedDay.slots.length === 0) {
            return null;
          }

          if (currentSlot && resolvedDay.slots.includes(currentSlot)) {
            return currentSlot;
          }

          return resolvedDay.slots[0] ?? null;
        });

        return resolvedDate;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "AbortError") {
        return;
      }

      setDays([]);
      setSelectedDate(null);
      setSelectedTimeSlot(null);
      const normalizedError =
        error instanceof Error ? error : new Error(DEFAULT_ERROR_CODE);
      setErrorCode(normalizedError.message);
      throw normalizedError;
    } finally {
      setIsLoadingDays(false);
    }
  }, [month]);

  const open = useCallback(async () => {
    setIsOpen(true);
    setIsLoadingDays(true);
    setIsSubmitting(false);
    setErrorCode(null);
    setFieldErrors({});
    setClientMode("existing");
    resetClientState();
    setSuccessResult(null);
    await refreshAvailability();
  }, [refreshAvailability, resetClientState]);

  const close = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    abortDaysRef.current?.abort();
    abortDaysRef.current = null;
    abortClientSearchRef.current?.abort();
    abortClientSearchRef.current = null;
    abortClientNumberRef.current?.abort();
    abortClientNumberRef.current = null;
    setIsOpen(false);
    setIsLoadingDays(false);
    setIsSubmitting(false);
    setErrorCode(null);
    setFieldErrors({});
    setDays([]);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setClientMode("existing");
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchingClients(false);
    setSelectedClient(null);
    setNewClientName("");
    setNewClientPhone("");
    setNewClientNumber("");
    setHasInitializedClientNumberSuggestion(false);
    setSuccessResult(null);
  }, [isSubmitting]);

  const selectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      const day = days.find((item) => item.date === date);
      setSelectedTimeSlot(day?.slots[0] ?? null);
      setFieldErrors((current) => ({
        ...current,
        date: undefined,
        timeSlot: undefined,
      }));
    },
    [days],
  );

  const selectTimeSlot = useCallback((timeSlot: BaseTimeSlot) => {
    setSelectedTimeSlot(timeSlot);
    setFieldErrors((current) => ({
      ...current,
      timeSlot: undefined,
    }));
  }, []);

  const changeClientMode = useCallback(
    (mode: ClientMode) => {
      setClientMode(mode);
      resetClientState();
      setFieldErrors((current) => ({
        ...current,
        client: undefined,
        name: undefined,
        phone: undefined,
      }));
    },
    [resetClientState],
  );

  useEffect(() => {
    if (!isOpen || clientMode !== "existing") {
      return;
    }

    if (searchQuery.trim().length < MIN_CLIENT_QUERY_LENGTH) {
      abortClientSearchRef.current?.abort();
      setSearchResults([]);
      setIsSearchingClients(false);
      return;
    }

    const controller = new AbortController();
    abortClientSearchRef.current?.abort();
    abortClientSearchRef.current = controller;
    setIsSearchingClients(true);
    setErrorCode(null);

    const timeout = window.setTimeout(() => {
      void searchAdminClientsByQuery(searchQuery.trim(), {
        limit: 8,
        signal: controller.signal,
      })
        .then((response) => {
          setSearchResults(response.clients);
        })
        .catch((error) => {
          if (error instanceof Error && error.message === "AbortError") {
            return;
          }

          setSearchResults([]);
          setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
        })
        .finally(() => {
          setIsSearchingClients(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [clientMode, isOpen, searchQuery]);

  useEffect(() => {
    if (!isOpen || clientMode !== "new") {
      abortClientNumberRef.current?.abort();
      return;
    }

    if (newClientNumber.trim().length > 0 || hasInitializedClientNumberSuggestion) {
      return;
    }

    const controller = new AbortController();
    abortClientNumberRef.current?.abort();
    abortClientNumberRef.current = controller;

    void fetchNextAdminClientNumber(controller.signal)
      .then((nextClientNumber) => {
        setNewClientNumber(String(nextClientNumber));
        setHasInitializedClientNumberSuggestion(true);
      })
      .catch((error) => {
        if (error instanceof Error && error.message === "AbortError") {
          return;
        }

        setErrorCode(error instanceof Error ? error.message : DEFAULT_ERROR_CODE);
      });

    return () => {
      controller.abort();
    };
  }, [
    clientMode,
    hasInitializedClientNumberSuggestion,
    isOpen,
    newClientNumber,
  ]);

  const validate = useCallback((): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!selectedDate) {
      nextErrors.date = "DATE_REQUIRED";
    }

    if (!selectedTimeSlot) {
      nextErrors.timeSlot = "TIME_SLOT_REQUIRED";
    }

    if (clientMode === "existing") {
      if (!selectedClient) {
        nextErrors.client = "CLIENT_REQUIRED";
      }
    } else {
      if (newClientName.trim().length < 3) {
        nextErrors.name = "VALIDATION_NAME_TOO_SHORT";
      }

      if (newClientPhone.trim().length === 0) {
        nextErrors.phone = "VALIDATION_PHONE_INVALID";
      }

      if (
        newClientNumber.trim().length > 0
        && !/^[1-9]\d*$/.test(newClientNumber.trim())
      ) {
        nextErrors.client = "CLIENT_NUMBER_INVALID";
      }
    }

    return nextErrors;
  }, [
    clientMode,
    newClientName,
    newClientNumber,
    newClientPhone,
    selectedClient,
    selectedDate,
    selectedTimeSlot,
  ]);

  const submit = useCallback(async () => {
    if (isSubmitting || successResult) {
      return null;
    }

    const nextErrors = validate();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    if (!selectedDate || !selectedTimeSlot) {
      return null;
    }

    const payload: AdminCreateAppointmentPayload =
      clientMode === "existing" && selectedClient
        ? {
            month,
            date: selectedDate,
            timeSlot: selectedTimeSlot,
            clientId: selectedClient.clientId,
          }
        : {
            month,
            date: selectedDate,
            timeSlot: selectedTimeSlot,
            client: {
              name: newClientName.trim(),
              phone: newClientPhone.trim(),
              ...(newClientNumber.trim().length > 0
                ? { clientNumber: Number(newClientNumber.trim()) }
                : {}),
            },
          };

    setIsSubmitting(true);
    setErrorCode(null);

    try {
      const response = await createAdminAppointmentByMonth(payload);
      setSuccessResult(response);
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clientMode,
    isSubmitting,
    month,
    newClientName,
    newClientNumber,
    newClientPhone,
    selectedClient,
    selectedDate,
    selectedTimeSlot,
    successResult,
    validate,
  ]);

  return {
    isOpen,
    isLoadingDays,
    isSubmitting,
    isReadyToSubmit,
    errorCode,
    fieldErrors,
    days,
    selectedDate,
    selectedDaySlots,
    selectedTimeSlot,
    clientMode,
    searchQuery,
    searchResults,
    isSearchingClients,
    selectedClient,
    newClientName,
    newClientPhone,
    newClientNumber,
    successResult,
    open,
    close,
    selectDate,
    selectTimeSlot,
    changeClientMode,
    setSearchQuery,
    selectClient: (client: AdminClientSearchItem) => {
      setSelectedClient(client);
      setFieldErrors((current) => ({
        ...current,
        client: undefined,
      }));
    },
    setNewClientName: (value: string) => {
      setNewClientName(value);
      setFieldErrors((current) => ({
        ...current,
        name: undefined,
      }));
    },
    setNewClientPhone: (value: string) => {
      setNewClientPhone(value);
      setFieldErrors((current) => ({
        ...current,
        phone: undefined,
      }));
    },
    setNewClientNumber: (value: string) => {
      setNewClientNumber(value);
      setFieldErrors((current) => ({
        ...current,
        client: undefined,
      }));
    },
    refreshAvailability,
    submit,
  };
}
