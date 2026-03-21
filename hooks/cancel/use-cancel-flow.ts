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
  const [appointment, setAppointment] = useState<CancelableAppointment | null>(
    null,
  );
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
        setAppointment(result);
        setStep("review");
      } catch (error) {
        setLookupErrorCode(
          error instanceof Error ? error.message : "UNKNOWN_ERROR",
        );
      }
    });
  }

  function handleCancel() {
    if (!appointment) {
      return;
    }

    startCancelTransition(async () => {
      setCancelErrorCode(null);

      try {
        await submitCancellation({
          phone: appointment.phone,
          appointmentId: appointment.appointmentId,
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
    setAppointment(null);
    setLookupErrorCode(null);
    setCancelErrorCode(null);
    setPhone("");
  }

  return {
    step,
    phone,
    appointment,
    lookupErrorCode,
    cancelErrorCode,
    isSearching,
    isCancelling,
    setPhone,
    handleLookup,
    handleCancel,
    handleReset,
  };
}

