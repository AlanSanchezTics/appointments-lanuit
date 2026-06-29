"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { fetchMonthAvailability } from "@/lib/booking/api-client";
import {
  cancelMyAppointments,
  lookupMyAppointments,
  rescheduleMyAppointment,
} from "@/lib/my-appointments/api-client";
import type { MyAppointmentLookupItem } from "@/lib/my-appointments/types";

type FlowStep = "lookup" | "results" | "reschedule" | "success";
type SuccessAction = "cancel" | "reschedule" | null;

export function useMyAppointmentsFlow(availableMonths: string[]) {
  const [step, setStep] = useState<FlowStep>("lookup");
  const [phone, setPhone] = useState("");
  const [appointments, setAppointments] = useState<MyAppointmentLookupItem[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [lookupErrorCode, setLookupErrorCode] = useState<string | null>(null);
  const [actionErrorCode, setActionErrorCode] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<SuccessAction>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rescheduleMonth, setRescheduleMonth] = useState<string>(availableMonths[0] ?? "");
  const [rescheduleDays, setRescheduleDays] = useState<Array<{ date: string; slots: string[] }>>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isCanceling, startCancelTransition] = useTransition();
  const [isRescheduling, startRescheduleTransition] = useTransition();
  const [isLoadingAvailability, startAvailabilityTransition] = useTransition();

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.appointmentId === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId],
  );

  useEffect(() => {
    if (step !== "reschedule" || !rescheduleMonth) {
      return;
    }

    startAvailabilityTransition(async () => {
      try {
        const days = await fetchMonthAvailability(rescheduleMonth);
        setRescheduleDays(days);
        setSelectedDate((currentSelectedDate) => {
          const nextSelectedDate =
            currentSelectedDate && days.some((day) => day.date === currentSelectedDate)
              ? currentSelectedDate
              : (days[0]?.date ?? null);
          const nextDay = days.find((day) => day.date === nextSelectedDate) ?? null;

          setSelectedTimeSlot((currentTimeSlot) => {
            if (nextDay?.slots.includes(currentTimeSlot ?? "")) {
              return currentTimeSlot;
            }

            return nextDay?.slots[0] ?? null;
          });

          return nextSelectedDate;
        });
      } catch {
        setRescheduleDays([]);
        setSelectedDate(null);
        setSelectedTimeSlot(null);
      }
    });
  }, [rescheduleMonth, step]);

  useEffect(() => {
    if (availableMonths.length === 0) {
      setRescheduleMonth("");
      return;
    }

    if (!availableMonths.includes(rescheduleMonth)) {
      setRescheduleMonth(availableMonths[0]);
    }
  }, [availableMonths, rescheduleMonth]);

  function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupErrorCode(null);
    setActionErrorCode(null);
    setSuccessAction(null);
    setSuccessMessage(null);

    const normalizedPhone = phone.replace(/\D/g, "");

    if (!/^[0-9]{10}$/.test(normalizedPhone)) {
      setLookupErrorCode("PHONE_INVALID");
      return;
    }

    startSearchTransition(async () => {
      try {
        const result = await lookupMyAppointments(normalizedPhone);
        setAppointments(result.appointments);
        setSelectedAppointmentId(result.appointments[0]?.appointmentId ?? null);
        setStep("results");
      } catch (error) {
        setLookupErrorCode(error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    });
  }

  function handleSelectAppointment(appointmentId: number) {
    setSelectedAppointmentId(appointmentId);
    setActionErrorCode(null);
  }

  function handleCancelSelected() {
    if (!selectedAppointment) {
      setActionErrorCode("APPOINTMENT_NOT_FOUND");
      return;
    }

    if (!selectedAppointment.canCancel) {
      setActionErrorCode("APPOINTMENT_IS_COMING_SOON");
      return;
    }

    startCancelTransition(async () => {
      setActionErrorCode(null);

      try {
        await cancelMyAppointments({
          phone: phone.replace(/\D/g, ""),
          appointmentIds: [selectedAppointment.appointmentId],
        });
        setSuccessAction("cancel");
        setSuccessMessage("La cita fue cancelada.");
        setStep("success");
      } catch (error) {
        setActionErrorCode(error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    });
  }

  function handleStartModify() {
    if (!selectedAppointment) {
      setActionErrorCode("APPOINTMENT_NOT_FOUND");
      return;
    }

    if (!selectedAppointment.canModify) {
      setActionErrorCode("APPOINTMENT_NOT_MODIFIABLE");
      return;
    }

    if (availableMonths.length === 0) {
      setActionErrorCode("SLOT_NOT_AVAILABLE");
      return;
    }

    const appointmentMonth = selectedAppointment.date.slice(0, 7);
    const initialMonth = availableMonths.includes(appointmentMonth)
      ? appointmentMonth
      : (availableMonths[0] ?? appointmentMonth);

    setRescheduleMonth(initialMonth);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setStep("reschedule");
  }

  function handleRescheduleConfirm() {
    if (!selectedAppointment || !selectedDate || !selectedTimeSlot || !rescheduleMonth) {
      setActionErrorCode("VALIDATION_ERROR");
      return;
    }

    startRescheduleTransition(async () => {
      setActionErrorCode(null);

      try {
        await rescheduleMyAppointment({
          phone: phone.replace(/\D/g, ""),
          appointmentId: selectedAppointment.appointmentId,
          month: rescheduleMonth,
          date: selectedDate,
          timeSlot: selectedTimeSlot,
        });

        setSuccessAction("reschedule");
        setSuccessMessage("La cita fue modificada.");
        setStep("success");
      } catch (error) {
        setActionErrorCode(error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    });
  }

  function handleReset() {
    setStep("lookup");
    setPhone("");
    setAppointments([]);
    setSelectedAppointmentId(null);
    setLookupErrorCode(null);
    setActionErrorCode(null);
    setSuccessAction(null);
    setSuccessMessage(null);
    setRescheduleDays([]);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
  }

  function handleBackToResults() {
    setStep("results");
    setActionErrorCode(null);
  }

  return {
    step,
    phone,
    appointments,
    selectedAppointment,
    lookupErrorCode,
    actionErrorCode,
    successAction,
    successMessage,
    isSearching,
    isCanceling,
    isRescheduling,
    isLoadingAvailability,
    rescheduleMonth,
    rescheduleDays,
    selectedDate,
    selectedTimeSlot,
    availableMonths,
    setPhone,
    setRescheduleMonth,
    setSelectedDate,
    setSelectedTimeSlot,
    handleLookup,
    handleSelectAppointment,
    handleCancelSelected,
    handleStartModify,
    handleRescheduleConfirm,
    handleReset,
    handleBackToResults,
  };
}
