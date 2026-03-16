"use client";

import { useEffect, useState, useTransition } from "react";

import { BookingConfirmStep } from "@/components/booking/booking-confirm-step";
import { BookingSuccessStep } from "@/components/booking/booking-success-step";
import { BookingWizardStep1 } from "@/components/booking/booking-wizard-step1";
import { CalendarModal } from "@/components/booking/calendar-modal";
import type { DayAvailability } from "@/lib/availability/service";

export type BookingStep = "details" | "confirm" | "success";

type ClientState = "unknown" | "existing" | "new";

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

export type SlotLock = {
  lockToken: string;
  expiresAt: string;
};

type ClientCheckLockResult = SlotLock & {
  clientExists: boolean;
  clientName?: string;
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
  refreshDays?: (month: string) => Promise<DayAvailability[]>;
  checkClientAndAcquireLock?: (draft: BookingDraft) => Promise<ClientCheckLockResult>;
  releaseLock?: (lockToken: string) => Promise<void>;
  submitBooking?: (draft: BookingDraft, lockToken: string) => Promise<BookingSuccess>;
  onWhatsAppRedirect?: (url: string) => void;
};

export function BookingWizard({
  month,
  days,
  initialDraft,
  refreshDays = fetchMonthAvailability,
  checkClientAndAcquireLock = checkClientAndAcquireReservationLock,
  releaseLock = releaseReservationLock,
  submitBooking = submitBookingDraft,
  onWhatsAppRedirect = (url) => window.location.assign(url),
}: BookingWizardProps) {
  const [step, setStep] = useState<BookingStep>("details");
  const [clientState, setClientState] = useState<ClientState>("unknown");
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<BookingValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [activeLock, setActiveLock] = useState<SlotLock | null>(null);
  const [currentDays, setCurrentDays] = useState<DayAvailability[]>(days);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BookingDraft>(() => ({
    date: getInitialField(initialDraft, "date", days[0]?.date ?? null),
    timeSlot: getInitialField(initialDraft, "timeSlot", days[0]?.slots[0] ?? null),
    name: getInitialField(initialDraft, "name", ""),
    phone: getInitialField(initialDraft, "phone", ""),
  }));

  useEffect(() => {
    setCurrentDays(days);
    setDraft((current) => normalizeDraftByAvailability(current, days));
  }, [days]);

  useEffect(() => {
    return () => {
      if (activeLock?.lockToken) {
        void releaseLock(activeLock.lockToken).catch(() => undefined);
      }
    };
  }, [activeLock?.lockToken, releaseLock]);

  useEffect(() => {
    if (!activeLock || (step !== "confirm" && clientState !== "new")) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const nextSeconds = Math.floor((new Date(activeLock.expiresAt).getTime() - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, nextSeconds));
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeLock, clientState, step]);

  useEffect(() => {
    if (!activeLock || remainingSeconds > 0) {
      return;
    }

    startTransition(async () => {
      await releaseLock(activeLock.lockToken).catch(() => undefined);
      setActiveLock(null);
      setClientState("unknown");
      setSubmitError(getApiErrorMessage("LOCK_EXPIRED_OR_INVALID"));
      setStep("details");
    });
  }, [activeLock, remainingSeconds, releaseLock, startTransition]);

  useEffect(() => {
    if (!submitError) {
      return;
    }

    let isCancelled = false;

    void refreshDays(month)
      .then((nextDays) => {
        if (isCancelled) {
          return;
        }

        setCurrentDays(nextDays);
        setDraft((current) => normalizeDraftByAvailability(current, nextDays));
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [month, refreshDays, submitError]);

  function updateDraft(nextDraft: Partial<BookingDraft>) {
    const shouldInvalidateActiveLock =
      activeLock &&
      step === "details" &&
      ((typeof nextDraft.date === "string" && nextDraft.date !== draft.date) ||
        (typeof nextDraft.timeSlot === "string" && nextDraft.timeSlot !== draft.timeSlot) ||
        (typeof nextDraft.phone === "string" && normalizePhone(nextDraft.phone) !== normalizePhone(draft.phone)));

    if (shouldInvalidateActiveLock && activeLock) {
      void releaseLock(activeLock.lockToken).catch(() => undefined);
      setActiveLock(null);
      setRemainingSeconds(0);
      setClientState("unknown");
      setDraft((current) => ({
        ...current,
        ...nextDraft,
        ...(typeof nextDraft.phone === "string" ? { name: "" } : {}),
      }));
    } else {
      setDraft((current) => ({
        ...current,
        ...nextDraft,
      }));
    }

    if (typeof nextDraft.phone === "string" && clientState !== "unknown") {
      setClientState("unknown");
      setDraft((current) => ({
        ...current,
        ...nextDraft,
        name: "",
      }));
    }

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
    const nextErrors = validateDraft(draft, clientState === "new");
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (clientState === "new") {
      if (!activeLock?.lockToken) {
        setSubmitError(getApiErrorMessage("LOCK_EXPIRED_OR_INVALID"));
        return;
      }

      setStep("confirm");
      return;
    }

    startTransition(async () => {
      try {
        const response = await checkClientAndAcquireLock(draft);
        const lock = {
          lockToken: response.lockToken,
          expiresAt: response.expiresAt,
        };

        setActiveLock(lock);
        setRemainingSeconds(Math.max(0, Math.floor((new Date(lock.expiresAt).getTime() - Date.now()) / 1000)));
        setSubmitError(null);

        if (response.clientExists) {
          setClientState("existing");
          setDraft((current) => ({
            ...current,
            name: response.clientName ?? current.name,
          }));
          setStep("confirm");
          return;
        }

        setClientState("new");
      } catch (error) {
        const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        setSubmitError(getApiErrorMessage(message));
      }
    });
  }

  function handleBack() {
    startTransition(async () => {
      if (activeLock?.lockToken) {
        await releaseLock(activeLock.lockToken).catch(() => undefined);
      }

      setActiveLock(null);
      setRemainingSeconds(0);
      setSubmitError(null);
      setClientState("unknown");
      setStep("details");
    });
  }

  function handleConfirm() {
    const nextErrors = validateDraft(draft, clientState === "new");
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStep("details");
      return;
    }

    if (!activeLock?.lockToken) {
      setSubmitError(getApiErrorMessage("LOCK_EXPIRED_OR_INVALID"));
      setStep("details");
      return;
    }

    startTransition(async () => {
      setSubmitError(null);

      try {
        const result = await submitBooking(draft, activeLock.lockToken);
        setActiveLock(null);
        setRemainingSeconds(0);
        setClientState("unknown");
        setSuccess(result);
        setStep("success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
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
                days={currentDays}
                errorMessage={submitError}
                draft={draft}
                errors={errors}
                month={month}
                onContinue={handleContinue}
                onDraftChange={updateDraft}
                onOpenCalendar={() => setCalendarOpen(true)}
                isPending={isPending}
                showNameField={clientState === "new"}
                hasActiveLock={clientState === "new" && Boolean(activeLock)}
                remainingSeconds={remainingSeconds}
              />
            ) : null}

            {step === "confirm" ? (
              <BookingConfirmStep
                draft={draft}
                errorMessage={submitError}
                isPending={isPending}
                remainingSeconds={remainingSeconds}
                onBack={handleBack}
                onConfirm={handleConfirm}
              />
            ) : null}

            {step === "success" && success ? (
              <BookingSuccessStep draft={draft} onWhatsAppRedirect={onWhatsAppRedirect} success={success} />
            ) : null}
          </div>
        </div>
      </section>

      <CalendarModal
        days={currentDays}
        isOpen={isCalendarOpen}
        month={month}
        onClose={() => setCalendarOpen(false)}
        onSelect={(date) => {
          const nextDay = currentDays.find((day) => day.date === date) ?? null;
          updateDraft({
            date,
            timeSlot: nextDay?.slots.includes(draft.timeSlot ?? "") ? draft.timeSlot : (nextDay?.slots[0] ?? null),
          });
        }}
        selectedDate={draft.date}
      />
    </>
  );
}

async function checkClientAndAcquireReservationLock(draft: BookingDraft) {
  const response = await fetch("/api/reservar/client-check-lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: draft.phone,
      date: draft.date,
      timeSlot: draft.timeSlot,
    }),
  });

  const payload = (await response.json()) as ClientCheckLockResult & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "UNKNOWN_ERROR");
  }

  return payload;
}

async function releaseReservationLock(lockToken: string) {
  await fetch("/api/reservar/lock", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lockToken }),
  });
}

async function submitBookingDraft(draft: BookingDraft, lockToken: string) {
  const response = await fetch("/api/reservar/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: draft.name,
      phone: draft.phone,
      date: draft.date,
      timeSlot: draft.timeSlot,
      lockToken,
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

async function fetchMonthAvailability(month: string) {
  const response = await fetch(`/api/availability/${month}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("AVAILABILITY_REFRESH_FAILED");
  }

  const payload = (await response.json()) as {
    days?: DayAvailability[];
  };

  return payload.days ?? [];
}

function normalizeDraftByAvailability(draft: BookingDraft, days: DayAvailability[]) {
  if (draft.date === null && draft.timeSlot === null) {
    return draft;
  }

  if (days.length === 0) {
    return {
      ...draft,
      date: null,
      timeSlot: null,
    };
  }

  const selectedDay = days.find((day) => day.date === draft.date) ?? days[0] ?? null;

  if (!selectedDay) {
    return {
      ...draft,
      date: null,
      timeSlot: null,
    };
  }

  const nextTimeSlot = selectedDay.slots.includes(draft.timeSlot ?? "") ? draft.timeSlot : (selectedDay.slots[0] ?? null);

  return {
    ...draft,
    date: selectedDay.date,
    timeSlot: nextTimeSlot,
  };
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function validateDraft(draft: BookingDraft, requiresName: boolean): BookingValidationErrors {
  const nextErrors: BookingValidationErrors = {};

  if (!draft.date) {
    nextErrors.date = "Selecciona un dia disponible.";
  }

  if (!draft.timeSlot) {
    nextErrors.timeSlot = "Selecciona un horario antes de continuar.";
  }

  if (!/^[0-9]{10}$/.test(normalizePhone(draft.phone))) {
    nextErrors.phone = "Ingresa un telefono de 10 digitos.";
  }

  if (requiresName && draft.name.trim().length < 3) {
    nextErrors.name = "Ingresa tu nombre completo.";
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

  if (code === "SLOT_LOCKED") {
    return "Ese horario acaba de ser bloqueado por otra persona. Elige otro.";
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

  if (code === "LOCK_EXPIRED_OR_INVALID") {
    return "El bloqueo temporal expiro. Selecciona de nuevo tu horario.";
  }

  if (code === "PAST_TIME_SLOT") {
    return "Ese horario ya paso. Elige uno disponible.";
  }

  if (code === "NAME_REQUIRED_FOR_NEW_CLIENT") {
    return "Ingresa tu nombre para completar la reserva.";
  }

  if (code === "CLIENT_NAME_MISMATCH") {
    return "Este telefono ya esta registrado con otro nombre.";
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
