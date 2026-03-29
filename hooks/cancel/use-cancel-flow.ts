"use client";

import { useState, useTransition } from "react";

import { lookupCancelableAppointment, submitCancellation } from "@/lib/cancel/api-client";
import type {
  CancelableAppointment,
  CancellationStep,
} from "@/lib/cancel/types";

export function useCancelFlow() {
  const [step, setStep] = useState<CancellationStep>("lookup");
  const [phone, setPhone] = useState("");
  const [appointments, setAppointments] = useState<CancelableAppointment[]>([]);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<number[]>([]);
  const [lookupErrorCode, setLookupErrorCode] = useState<string | null>(null);
  const [cancelErrorCode, setCancelErrorCode] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();

  function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupErrorCode(null);
    setCancelErrorCode(null);

    const normalizedPhone = phone.replace(/\D/g, "");

    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      setLookupErrorCode("PHONE_INVALID");
      return;
    }

    startSearchTransition(async () => {
      try {
        const result = await lookupCancelableAppointment(normalizedPhone);
        setAppointments(result.appointments);
        setSelectedAppointmentIds([]);
        setStep("review");
      } catch (error) {
        setLookupErrorCode(
          error instanceof Error ? error.message : "UNKNOWN_ERROR",
        );
      }
    });
  }

  function handleCancel() {
    if (selectedAppointmentIds.length === 0) {
      setCancelErrorCode("CANCEL_SELECTION_REQUIRED");
      return;
    }

    startCancelTransition(async () => {
      setCancelErrorCode(null);

      try {
        await submitCancellation({
          phone: phone.replace(/\D/g, ""),
          appointmentIds: selectedAppointmentIds,
        });
        setStep("success");
      } catch (error) {
        setCancelErrorCode(
          error instanceof Error ? error.message : "UNKNOWN_ERROR",
        );
      }
    });
  }

  function handleReset() {
    setStep("lookup");
    setAppointments([]);
    setSelectedAppointmentIds([]);
    setLookupErrorCode(null);
    setCancelErrorCode(null);
    setPhone("");
  }

  function toggleAppointmentSelection(appointmentId: number) {
    setCancelErrorCode(null);
    setSelectedAppointmentIds((current) =>
      current.includes(appointmentId)
        ? current.filter((id) => id !== appointmentId)
        : [...current, appointmentId],
    );
  }

  return {
    step,
    phone,
    appointments,
    selectedAppointmentIds,
    lookupErrorCode,
    cancelErrorCode,
    isSearching,
    isCancelling,
    setPhone,
    handleLookup,
    handleCancel,
    handleReset,
    toggleAppointmentSelection,
  };
}
