"use client";

import { useState, useTransition } from "react";

import { BookingConfirmStep } from "@/components/booking/booking-confirm-step";
import { BookingSuccessStep } from "@/components/booking/booking-success-step";
import { BookingWizardStep1 } from "@/components/booking/booking-wizard-step1";
import { CalendarModal } from "@/components/booking/calendar-modal";
import type { DayAvailability } from "@/lib/availability/service";

export type BookingStep = "details" | "confirm" | "success";

export type BookingDraft = {
  date: string | null;
  timeSlot: string | null;
  name: string;
  phone: string;
};

export type BookingSuccess = {
  appointmentId: number;
  status: "CONFIRMED" | "SYNC_FAILED";
  syncReason?: string;
  whatsappUrl: string;
};

export type BookingValidationErrors = {
  date?: string;
  timeSlot?: string;
  name?: string;
  phone?: string;
  form?: string;
};

type BookingWizardProps = {
  month: string;
  days: DayAvailability[];
  initialDraft?: Partial<BookingDraft>;
  submitBooking?: (draft: BookingDraft) => Promise<BookingSuccess>;
  onWhatsAppRedirect?: (url: string) => void;
};

export function BookingWizard({
  month,
  days,
  initialDraft,
  submitBooking = submitBookingDraft,
  onWhatsAppRedirect = (url) => window.location.assign(url),
}: BookingWizardProps) {
  const [step, setStep] = useState<BookingStep>("details");
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<BookingValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BookingDraft>(() => ({
    date: getInitialField(initialDraft, "date", days[0]?.date ?? null),
    timeSlot: getInitialField(
      initialDraft,
      "timeSlot",
      days[0]?.slots[0] ?? null,
    ),
    name: getInitialField(initialDraft, "name", ""),
    phone: getInitialField(initialDraft, "phone", ""),
  }));

  function updateDraft(nextDraft: Partial<BookingDraft>) {
    setDraft((current) => ({
      ...current,
      ...nextDraft,
    }));
    setErrors((current) => ({
      ...current,
      ...(nextDraft.date ? { date: undefined } : {}),
      ...(nextDraft.timeSlot ? { timeSlot: undefined } : {}),
      ...(typeof nextDraft.name === "string" ? { name: undefined } : {}),
      ...(typeof nextDraft.phone === "string" ? { phone: undefined } : {}),
      form: undefined,
    }));
    setSubmitError(null);
  }

  function handleContinue() {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setStep("confirm");
  }

  function handleConfirm() {
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStep("details");
      return;
    }

    startTransition(async () => {
      setSubmitError(null);

      try {
        const result = await submitBooking(draft);
        setSuccess(result);
        setStep("success");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "UNKNOWN_ERROR";
        setSubmitError(getApiErrorMessage(message));
      }
    });
  }

  return (
    <>
      <section className="mx-auto w-full max-w-[24rem] rounded-[2.5rem] border border-white/70 bg-[var(--surface)] p-0 shadow-[0_34px_90px_rgba(52,37,31,0.16)] backdrop-blur md:max-w-[26rem] md:p-7">
        <div className="rounded-[2.15rem] border border-[rgba(255,255,255,0.72)] bg-white px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:px-6 md:py-7">
          <div>
            {step === "details" ? (
              <BookingWizardStep1
                days={days}
                draft={draft}
                errors={errors}
                month={month}
                onContinue={handleContinue}
                onDraftChange={updateDraft}
                onOpenCalendar={() => setCalendarOpen(true)}
              />
            ) : null}

            {step === "confirm" ? (
              <BookingConfirmStep
                draft={draft}
                errorMessage={submitError}
                isPending={isPending}
                onBack={() => {
                  setSubmitError(null);
                  setStep("details");
                }}
                onConfirm={handleConfirm}
              />
            ) : null}

            {step === "success" && success ? (
              <BookingSuccessStep
                draft={draft}
                onWhatsAppRedirect={onWhatsAppRedirect}
                success={success}
              />
            ) : null}
          </div>
        </div>
      </section>

      <CalendarModal
        days={days}
        isOpen={isCalendarOpen}
        month={month}
        onClose={() => setCalendarOpen(false)}
        onSelect={(date) => {
          const nextDay = days.find((day) => day.date === date) ?? null;
          updateDraft({
            date,
            timeSlot: nextDay?.slots.includes(draft.timeSlot ?? "")
              ? draft.timeSlot
              : (nextDay?.slots[0] ?? null),
          });
        }}
        selectedDate={draft.date}
      />
    </>
  );
}

async function submitBookingDraft(draft: BookingDraft) {
  const response = await fetch("/api/reservar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: draft.name,
      phone: draft.phone,
      date: draft.date,
      timeSlot: draft.timeSlot,
    }),
  });

  const payload = (await response.json()) as BookingSuccess & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "UNKNOWN_ERROR");
  }

  return payload;
}

function validateDraft(draft: BookingDraft): BookingValidationErrors {
  const nextErrors: BookingValidationErrors = {};

  if (!draft.date) {
    nextErrors.date = "Selecciona un dia disponible.";
  }

  if (!draft.timeSlot) {
    nextErrors.timeSlot = "Selecciona un horario antes de continuar.";
  }

  if (draft.name.trim().length < 3) {
    nextErrors.name = "Ingresa tu nombre completo.";
  }

  if (!/^[0-9]{10}$/.test(draft.phone.trim())) {
    nextErrors.phone = "Ingresa un telefono de 10 digitos.";
  }

  if (nextErrors.date || nextErrors.timeSlot) {
    nextErrors.form = "Completa la fecha y el horario antes de continuar.";
  }

  return nextErrors;
}

function getApiErrorMessage(code: string) {
  if (code === "SLOT_NOT_AVAILABLE") {
    return "Ese horario ya no esta disponible. Elige otro.";
  }

  if (code === "PHONE_ALREADY_BOOKED") {
    return "Ya tienes una cita futura activa con este telefono.";
  }

  if (code === "MONTH_NOT_ALLOWED") {
    return "Solo se puede agendar en el mes actual.";
  }

  if (code === "LOCK_TIMEOUT") {
    return "Hubo un conflicto temporal al reservar. Intenta de nuevo.";
  }

  return "No se pudo reservar la cita. Intenta de nuevo.";
}

function getInitialField<K extends keyof BookingDraft>(
  initialDraft: Partial<BookingDraft> | undefined,
  key: K,
  fallback: BookingDraft[K],
) {
  if (initialDraft && key in initialDraft) {
    return initialDraft[key] as BookingDraft[K];
  }

  return fallback;
}
