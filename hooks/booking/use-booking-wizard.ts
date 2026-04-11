import { useCallback, useEffect, useState, useTransition } from "react";

import type { DayAvailability } from "@/lib/availability/service";
import {
  checkClientAndAcquireReservationLock,
  fetchMonthAvailability,
  releaseReservationLock,
  submitBookingDraft,
} from "@/lib/booking/api-client";
import {
  getInitialDraftField,
  normalizeDraftByAvailability,
  normalizePhone,
  validateDraft,
} from "@/lib/booking/draft-rules";
import type {
  BookingDraft,
  BookingStep,
  BookingSuccess,
  BookingValidationErrors,
  ClientCheckLockResult,
  ClientState,
  RescheduleOption,
  SlotLock,
} from "@/lib/booking/types";
import { useBookingLockTimer } from "@/hooks/booking/use-booking-lock-timer";
import { useBookingExitLockRelease } from "@/hooks/booking/use-booking-exit-lock-release";
import { useBookingStepTransition } from "@/hooks/booking/use-booking-step-transition";

type UseBookingWizardParams = {
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
    appointmentIdToReschedule?: number | null,
  ) => Promise<BookingSuccess>;
};

const RELOAD_REVALIDATION_RETRY_DELAY_MS = 500;

function dayAvailabilitiesMatch(a: DayAvailability[], b: DayAvailability[]) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const dayA = a[index];
    const dayB = b[index];

    if (!dayA || !dayB) {
      return false;
    }

    if (dayA.date !== dayB.date) {
      return false;
    }

    if (dayA.slots.length !== dayB.slots.length) {
      return false;
    }

    for (let slotIndex = 0; slotIndex < dayA.slots.length; slotIndex += 1) {
      if (dayA.slots[slotIndex] !== dayB.slots[slotIndex]) {
        return false;
      }
    }
  }

  return true;
}

function getInitialDraft(
  initialDraft: Partial<BookingDraft> | undefined,
  days: DayAvailability[],
): BookingDraft {
  return {
    date: getInitialDraftField(initialDraft, "date", days[0]?.date ?? null),
    timeSlot: getInitialDraftField(
      initialDraft,
      "timeSlot",
      days[0]?.slots[0] ?? null,
    ),
    name: getInitialDraftField(initialDraft, "name", ""),
    phone: getInitialDraftField(initialDraft, "phone", ""),
  };
}

export function useBookingWizard({
  month,
  days,
  initialDraft,
  refreshDays = fetchMonthAvailability,
  checkClientAndAcquireLock = checkClientAndAcquireReservationLock,
  releaseLock = releaseReservationLock,
  submitBooking = submitBookingDraft,
}: UseBookingWizardParams) {
  const animationsEnabled = process.env.NODE_ENV !== "test";
  const [step, setStep] = useState<BookingStep>("details");
  const [clientState, setClientState] = useState<ClientState>("unknown");
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<BookingValidationErrors>({});
  const [submitErrorCode, setSubmitErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingSuccess | null>(null);
  const [activeLock, setActiveLock] = useState<SlotLock | null>(null);
  const [rescheduleOptions, setRescheduleOptions] = useState<RescheduleOption[]>(
    [],
  );
  const [canBookAsNewAppointment, setCanBookAsNewAppointment] = useState(false);
  const [isBookingAsNewAppointment, setIsBookingAsNewAppointment] = useState(false);
  const [selectedRescheduleAppointmentId, setSelectedRescheduleAppointmentId] =
    useState<number | null>(null);
  const [currentDays, setCurrentDays] = useState<DayAvailability[]>(days);
  const [draft, setDraft] = useState<BookingDraft>(() =>
    getInitialDraft(initialDraft, days),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const entries = performance.getEntriesByType("navigation") as
      | Array<{ type?: string }>
      | undefined;
    const navigationType = entries?.[0]?.type;

    if (navigationType !== "reload") {
      return;
    }

    let isCancelled = false;
    let retryTimeoutId: number | null = null;

    const revalidateAfterReload = async () => {
      try {
        const nextDays = await refreshDays(month);

        if (isCancelled) {
          return;
        }

        setCurrentDays(nextDays);
        setDraft((current) => normalizeDraftByAvailability(current, nextDays));

        if (!dayAvailabilitiesMatch(days, nextDays)) {
          return;
        }

        retryTimeoutId = window.setTimeout(() => {
          void refreshDays(month)
            .then((retriedDays) => {
              if (isCancelled) {
                return;
              }

              setCurrentDays(retriedDays);
              setDraft((current) => normalizeDraftByAvailability(current, retriedDays));
            })
            .catch(() => undefined);
        }, RELOAD_REVALIDATION_RETRY_DELAY_MS);
      } catch {
        // no-op: keep SSR-provided days on revalidation failures.
      }
    };

    void revalidateAfterReload();

    return () => {
      isCancelled = true;

      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [days, month, refreshDays]);

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

  useBookingExitLockRelease({
    activeLockToken: activeLock?.lockToken ?? null,
  });

  const { remainingSeconds, setRemainingSeconds } = useBookingLockTimer({
    activeLock,
    isActive:
      Boolean(activeLock)
      && (step === "confirm" || clientState === "new" || clientState === "reschedule"),
    releaseLock,
    onExpired: () => {
      startTransition(() => {
        setActiveLock(null);
        setClientState("unknown");
        setRescheduleOptions([]);
        setCanBookAsNewAppointment(false);
        setIsBookingAsNewAppointment(false);
        setSelectedRescheduleAppointmentId(null);
        setSubmitErrorCode("LOCK_EXPIRED_OR_INVALID");
        setStep("details");
      });
    },
  });

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

  const updateDraft = useCallback(
    (nextDraft: Partial<BookingDraft>) => {
      const shouldInvalidateActiveLock =
        activeLock
        && step === "details"
        && ((typeof nextDraft.date === "string" && nextDraft.date !== draft.date)
          || (typeof nextDraft.timeSlot === "string"
            && nextDraft.timeSlot !== draft.timeSlot)
          || (typeof nextDraft.phone === "string"
            && normalizePhone(nextDraft.phone) !== normalizePhone(draft.phone)));

      if (shouldInvalidateActiveLock && activeLock) {
        void releaseLock(activeLock.lockToken).catch(() => undefined);
        setActiveLock(null);
        setRemainingSeconds(0);
        setClientState("unknown");
        setRescheduleOptions([]);
        setCanBookAsNewAppointment(false);
        setIsBookingAsNewAppointment(false);
        setSelectedRescheduleAppointmentId(null);
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
        setRescheduleOptions([]);
        setCanBookAsNewAppointment(false);
        setIsBookingAsNewAppointment(false);
        setSelectedRescheduleAppointmentId(null);
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
    },
    [
      activeLock,
      clientState,
      draft.date,
      draft.phone,
      draft.timeSlot,
      releaseLock,
      setRemainingSeconds,
      step,
    ],
  );

  const handleContinue = useCallback(() => {
    const nextErrors = validateDraft(draft, clientState === "new");

    if (
      clientState === "reschedule"
      && !isBookingAsNewAppointment
      && selectedRescheduleAppointmentId === null
    ) {
      nextErrors.form = "RESCHEDULE_DECISION_REQUIRED";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (clientState === "new" || clientState === "reschedule") {
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
            Math.floor((new Date(lock.expiresAt).getTime() - Date.now()) / 1000),
          ),
        );
        setSubmitErrorCode(null);

        const futureAppointmentsInMonth = response.futureAppointmentsInMonth ?? [];

        if (futureAppointmentsInMonth.length > 0) {
          const canBookAsNew = response.canBookAsNewAppointment ?? false;
          setClientState("reschedule");
          setRescheduleOptions(futureAppointmentsInMonth);
          setCanBookAsNewAppointment(canBookAsNew);
          setIsBookingAsNewAppointment(false);
          setSelectedRescheduleAppointmentId(
            !canBookAsNew && futureAppointmentsInMonth.length === 1
              ? (futureAppointmentsInMonth[0]?.appointmentId ?? null)
              : null,
          );
          setDraft((current) => ({
            ...current,
            name: response.clientName ?? current.name,
          }));
          return;
        }

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
  }, [
    activeLock?.lockToken,
    checkClientAndAcquireLock,
    clientState,
    draft,
    selectedRescheduleAppointmentId,
    isBookingAsNewAppointment,
    setRemainingSeconds,
  ]);

  const handleBack = useCallback(() => {
    startTransition(async () => {
      if (activeLock?.lockToken) {
        await releaseLock(activeLock.lockToken).catch(() => undefined);
      }

      setActiveLock(null);
      setRemainingSeconds(0);
      setSubmitErrorCode(null);
      setClientState("unknown");
      setRescheduleOptions([]);
      setCanBookAsNewAppointment(false);
      setIsBookingAsNewAppointment(false);
      setSelectedRescheduleAppointmentId(null);
      setStep("details");
    });
  }, [activeLock?.lockToken, releaseLock, setRemainingSeconds]);

  const handleConfirm = useCallback(() => {
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
        const result = await submitBooking(
          draft,
          activeLock.lockToken,
          isBookingAsNewAppointment ? null : selectedRescheduleAppointmentId,
        );
        setActiveLock(null);
        setRemainingSeconds(0);
        setClientState("unknown");
        setRescheduleOptions([]);
        setCanBookAsNewAppointment(false);
        setIsBookingAsNewAppointment(false);
        setSelectedRescheduleAppointmentId(null);
        setSuccess(result);
        setStep("success");
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        setSubmitErrorCode(code);
      }
    });
  }, [
    activeLock?.lockToken,
    clientState,
    draft,
    isBookingAsNewAppointment,
    selectedRescheduleAppointmentId,
    setRemainingSeconds,
    submitBooking,
  ]);

  const stepTransition = useBookingStepTransition({
    step,
    animationsEnabled,
  });

  return {
    state: {
      activeLock,
      clientState,
      currentDays,
      draft,
      errors,
      isCalendarOpen,
      isPending,
      remainingSeconds,
      rescheduleOptions,
      canBookAsNewAppointment,
      isBookingAsNewAppointment,
      selectedRescheduleAppointmentId,
      step,
      submitErrorCode,
      success,
    },
    transitions: stepTransition,
    actions: {
      handleBack,
      handleConfirm,
      handleContinue,
      setCalendarOpen,
      setSelectedRescheduleAppointmentId: (appointmentId: number | null) => {
        setSelectedRescheduleAppointmentId(appointmentId);
        if (typeof appointmentId === "number") {
          setIsBookingAsNewAppointment(false);
        }
      },
      chooseBookAsNewAppointment: () => {
        setSelectedRescheduleAppointmentId(null);
        setIsBookingAsNewAppointment(true);
        setErrors((current) => ({
          ...current,
          form: undefined,
        }));
      },
      setStep,
      updateDraft,
    },
  };
}
