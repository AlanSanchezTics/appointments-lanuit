"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { BookingConfirmStep } from "@/components/booking/booking-confirm-step";
import { BookingSuccessStep } from "@/components/booking/booking-success-step";
import { BookingWizardStep1 } from "@/components/booking/booking-wizard-step1";
import { CalendarModal } from "@/components/booking/calendar-modal";
import type { DayAvailability } from "@/lib/availability/service";
import { translateApiError } from "@/lib/i18n/translate";

export type BookingStep = "details" | "confirm" | "success";
type StepTransitionDirection = "forward" | "backward";

type ClientState = "unknown" | "existing" | "new";
const STEP_ORDER: Record<BookingStep, number> = {
  details: 0,
  confirm: 1,
  success: 2,
};
const STEP_TRANSITION_MS = 260;

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
  whatsappPhone: string;
  whatsappData: {
    name: string;
    date: string;
    timeSlot: string;
  };
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
  checkClientAndAcquireLock?: (
    draft: BookingDraft,
  ) => Promise<ClientCheckLockResult>;
  releaseLock?: (lockToken: string) => Promise<void>;
  submitBooking?: (
    draft: BookingDraft,
    lockToken: string,
  ) => Promise<BookingSuccess>;
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
  const { t } = useTranslation(["common", "errors"]);
  const animationsEnabled = process.env.NODE_ENV !== "test";
  const [step, setStep] = useState<BookingStep>("details");
  const [clientState, setClientState] = useState<ClientState>("unknown");
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<BookingValidationErrors>({});
  const [submitErrorCode, setSubmitErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [activeLock, setActiveLock] = useState<SlotLock | null>(null);
  const [currentDays, setCurrentDays] = useState<DayAvailability[]>(days);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [visibleStep, setVisibleStep] = useState<BookingStep>("details");
  const [leavingStep, setLeavingStep] = useState<BookingStep | null>(null);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<StepTransitionDirection>("forward");
  const [isPending, startTransition] = useTransition();
  const visibleStepRef = useRef<BookingStep>("details");
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

  useEffect(() => {
    setCurrentDays(days);
    setDraft((current) => normalizeDraftByAvailability(current, days));
  }, [days]);

  useEffect(() => {
    visibleStepRef.current = visibleStep;
  }, [visibleStep]);

  useEffect(() => {
    const currentVisibleStep = visibleStepRef.current;

    if (step === currentVisibleStep) {
      return;
    }

    const direction = getTransitionDirection(currentVisibleStep, step);
    setTransitionDirection(direction);

    if (!animationsEnabled) {
      setLeavingStep(null);
      setVisibleStep(step);
      setIsStepTransitioning(false);
      return;
    }

    setLeavingStep(currentVisibleStep);
    setVisibleStep(step);
    setIsStepTransitioning(true);

    const timer = window.setTimeout(() => {
      setLeavingStep(null);
      setIsStepTransitioning(false);
    }, STEP_TRANSITION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [animationsEnabled, step]);

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
      const nextSeconds = Math.floor(
        (new Date(activeLock.expiresAt).getTime() - Date.now()) / 1000,
      );
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
      setSubmitErrorCode("LOCK_EXPIRED_OR_INVALID");
      setStep("details");
    });
  }, [activeLock, remainingSeconds, releaseLock, startTransition]);

  useEffect(() => {
    if (!submitErrorCode) {
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
  }, [month, refreshDays, submitErrorCode]);

  function updateDraft(nextDraft: Partial<BookingDraft>) {
    const shouldInvalidateActiveLock =
      activeLock &&
      step === "details" &&
      ((typeof nextDraft.date === "string" && nextDraft.date !== draft.date) ||
        (typeof nextDraft.timeSlot === "string" &&
          nextDraft.timeSlot !== draft.timeSlot) ||
        (typeof nextDraft.phone === "string" &&
          normalizePhone(nextDraft.phone) !== normalizePhone(draft.phone)));

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
    setSubmitErrorCode(null);
  }

  function handleContinue() {
    const nextErrors = validateDraft(draft, clientState === "new");
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (clientState === "new") {
      if (!activeLock?.lockToken) {
        setSubmitErrorCode("LOCK_EXPIRED_OR_INVALID");
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
        setRemainingSeconds(
          Math.max(
            0,
            Math.floor(
              (new Date(lock.expiresAt).getTime() - Date.now()) / 1000,
            ),
          ),
        );
        setSubmitErrorCode(null);

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
        const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        setSubmitErrorCode(code);
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
      setSubmitErrorCode(null);
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
      setSubmitErrorCode("LOCK_EXPIRED_OR_INVALID");
      setStep("details");
      return;
    }

    startTransition(async () => {
      setSubmitErrorCode(null);

      try {
        const result = await submitBooking(draft, activeLock.lockToken);
        setActiveLock(null);
        setRemainingSeconds(0);
        setClientState("unknown");
        setSuccess(result);
        setStep("success");
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        setSubmitErrorCode(code);
      }
    });
  }

  const translatedSubmitError = submitErrorCode
    ? translateApiError(t, submitErrorCode)
    : null;
  const currentStepPane = renderStep({
    step: visibleStep,
    draft,
    currentDays,
    errors,
    month,
    translatedSubmitError,
    isPending,
    clientState,
    activeLock,
    remainingSeconds,
    success,
    onContinue: handleContinue,
    onDraftChange: updateDraft,
    onOpenCalendar: () => setCalendarOpen(true),
    onBack: handleBack,
    onConfirm: handleConfirm,
    onWhatsAppRedirect,
  });
  const leavingStepPane = leavingStep
    ? renderStep({
        step: leavingStep,
        draft,
        currentDays,
        errors,
        month,
        translatedSubmitError,
        isPending,
        clientState,
        activeLock,
        remainingSeconds,
        success,
        onContinue: handleContinue,
        onDraftChange: updateDraft,
        onOpenCalendar: () => setCalendarOpen(true),
        onBack: handleBack,
        onConfirm: handleConfirm,
        onWhatsAppRedirect,
      })
    : null;

  return (
    <>
      <section className="booking-mobile-shell p-6 md:p-6 min-h-screen flex items-center justify-center">
        <div className="w-full">
          <div
            data-current-step={step}
            data-testid="booking-step-container"
            data-transition-direction={transitionDirection}
            data-transitioning={isStepTransitioning ? "true" : "false"}
            data-visible-step={visibleStep}
            className="relative min-h-[40rem] overflow-hidden md:min-h-[42rem]"
          >
            {leavingStepPane ? (
              <div
                aria-hidden="true"
                className={`booking-step-panel absolute inset-0 motion-reduce:animate-none ${
                  transitionDirection === "forward"
                    ? "booking-step-leave-forward"
                    : "booking-step-leave-backward"
                }`}
              >
                {leavingStepPane}
              </div>
            ) : null}
            <div
              className={`booking-step-panel motion-reduce:animate-none ${
                leavingStepPane ? "absolute inset-0" : "relative"
              } ${
                isStepTransitioning
                  ? transitionDirection === "forward"
                    ? "booking-step-enter-forward"
                    : "booking-step-enter-backward"
                  : ""
              }`}
            >
              {currentStepPane}
            </div>
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

  const payload = (await response.json()) as ClientCheckLockResult & {
    error?: string;
    errorCode?: string;
  };

  if (!response.ok) {
    throw new Error(payload.errorCode ?? payload.error ?? "UNKNOWN_ERROR");
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
    errorCode?: string;
  };

  if (!response.ok) {
    throw new Error(payload.errorCode ?? payload.error ?? "UNKNOWN_ERROR");
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

function normalizeDraftByAvailability(
  draft: BookingDraft,
  days: DayAvailability[],
) {
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

  const selectedDay =
    days.find((day) => day.date === draft.date) ?? days[0] ?? null;

  if (!selectedDay) {
    return {
      ...draft,
      date: null,
      timeSlot: null,
    };
  }

  const nextTimeSlot = selectedDay.slots.includes(draft.timeSlot ?? "")
    ? draft.timeSlot
    : (selectedDay.slots[0] ?? null);

  return {
    ...draft,
    date: selectedDay.date,
    timeSlot: nextTimeSlot,
  };
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function validateDraft(
  draft: BookingDraft,
  requiresName: boolean,
): BookingValidationErrors {
  const nextErrors: BookingValidationErrors = {};

  if (!draft.date) {
    nextErrors.date = "DATE_REQUIRED";
  }

  if (!draft.timeSlot) {
    nextErrors.timeSlot = "TIME_SLOT_REQUIRED";
  }

  if (!/^[0-9]{10}$/.test(normalizePhone(draft.phone))) {
    nextErrors.phone = "PHONE_INVALID";
  }

  if (requiresName && draft.name.trim().length < 3) {
    nextErrors.name = "NAME_REQUIRED";
  }

  if (nextErrors.date || nextErrors.timeSlot) {
    nextErrors.form = "FORM_INCOMPLETE";
  }

  return nextErrors;
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

function getTransitionDirection(
  fromStep: BookingStep,
  toStep: BookingStep,
): StepTransitionDirection {
  if (STEP_ORDER[toStep] > STEP_ORDER[fromStep]) {
    return "forward";
  }

  return "backward";
}

type RenderStepParams = {
  step: BookingStep;
  draft: BookingDraft;
  currentDays: DayAvailability[];
  errors: BookingValidationErrors;
  month: string;
  translatedSubmitError: string | null;
  isPending: boolean;
  clientState: ClientState;
  activeLock: SlotLock | null;
  remainingSeconds: number;
  success: BookingSuccess | null;
  onContinue: () => void;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onOpenCalendar: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onWhatsAppRedirect: (url: string) => void;
};

function renderStep({
  step,
  draft,
  currentDays,
  errors,
  month,
  translatedSubmitError,
  isPending,
  clientState,
  activeLock,
  remainingSeconds,
  success,
  onContinue,
  onDraftChange,
  onOpenCalendar,
  onBack,
  onConfirm,
  onWhatsAppRedirect,
}: RenderStepParams) {
  if (step === "details") {
    return (
      <BookingWizardStep1
        days={currentDays}
        errorMessage={translatedSubmitError}
        draft={draft}
        errors={errors}
        month={month}
        onContinue={onContinue}
        onDraftChange={onDraftChange}
        onOpenCalendar={onOpenCalendar}
        isPending={isPending}
        showNameField={clientState === "new"}
        hasActiveLock={clientState === "new" && Boolean(activeLock)}
        remainingSeconds={remainingSeconds}
      />
    );
  }

  if (step === "confirm") {
    return (
      <BookingConfirmStep
        draft={draft}
        errorMessage={translatedSubmitError}
        isPending={isPending}
        remainingSeconds={remainingSeconds}
        onBack={onBack}
        onConfirm={onConfirm}
      />
    );
  }

  if (!success) {
    return null;
  }

  return (
    <BookingSuccessStep
      draft={draft}
      onWhatsAppRedirect={onWhatsAppRedirect}
      success={success}
      onBack={() => {
        window.location.assign(`/citas/${month}`);
      }}
    />
  );
}
