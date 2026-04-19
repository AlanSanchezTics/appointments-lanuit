import { useCallback, useEffect, useState, useTransition } from "react";

import type { DayAvailability } from "@/lib/availability/service";
import {
  acquireReservationLockForSchedule,
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
  validateIdentityDraft,
  validateScheduleDraft,
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
  availableMonths?: string[];
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

function createTempPhone() {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  const timestamp = Date.now().toString().slice(-4);
  return `9${timestamp}${random.slice(0, 5)}`;
}

export function useBookingWizard({
  month,
  days,
  availableMonths,
  initialDraft,
  refreshDays = fetchMonthAvailability,
  checkClientAndAcquireLock = checkClientAndAcquireReservationLock,
  releaseLock = releaseReservationLock,
  submitBooking = submitBookingDraft,
}: UseBookingWizardParams) {
  const animationsEnabled = process.env.NODE_ENV !== "test";
  const resolvedMonths =
    availableMonths && availableMonths.length > 0 ? availableMonths : [month];
  const [step, setStep] = useState<BookingStep>("schedule");
  const [currentMonth, setCurrentMonth] = useState(month);
  const [clientState, setClientState] = useState<ClientState>("unknown");
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
    if (process.env.NODE_ENV === "test") {
      return;
    }

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
        const nextDays = await refreshDays(currentMonth);

        if (isCancelled) {
          return;
        }

        setCurrentDays(nextDays);
        setDraft((current) => normalizeDraftByAvailability(current, nextDays));

        if (!dayAvailabilitiesMatch(days, nextDays)) {
          return;
        }

        retryTimeoutId = window.setTimeout(() => {
          void refreshDays(currentMonth)
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
        // no-op
      }
    };

    void revalidateAfterReload();

    return () => {
      isCancelled = true;

      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [currentMonth, days, refreshDays]);

  useEffect(() => {
    setCurrentMonth(month);
    setCurrentDays(days);
    setDraft((current) => normalizeDraftByAvailability(current, days));
  }, [days, month]);

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
    isActive: Boolean(activeLock),
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
        setStep("schedule");
      });
    },
  });

  useEffect(() => {
    if (!submitErrorCode) {
      return;
    }

    let isCancelled = false;

    void refreshDays(currentMonth)
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
  }, [currentMonth, refreshDays, submitErrorCode]);

  const goToMonth = useCallback(
    (nextMonth: string) => {
      if (!nextMonth || nextMonth === currentMonth) {
        return;
      }

      startTransition(async () => {
        try {
          const nextDays = await refreshDays(nextMonth);
          setCurrentMonth(nextMonth);
          setCurrentDays(nextDays);
          setDraft((current) => normalizeDraftByAvailability(current, nextDays));
          setSubmitErrorCode(null);
        } catch {
          setSubmitErrorCode("AVAILABILITY_REFRESH_FAILED");
        }
      });
    },
    [currentMonth, refreshDays],
  );

  const goToPreviousMonth = useCallback(() => {
    const index = resolvedMonths.indexOf(currentMonth);
    if (index > 0) {
      goToMonth(resolvedMonths[index - 1] ?? "");
    }
  }, [currentMonth, goToMonth, resolvedMonths]);

  const goToNextMonth = useCallback(() => {
    const index = resolvedMonths.indexOf(currentMonth);
    if (index >= 0 && index < resolvedMonths.length - 1) {
      goToMonth(resolvedMonths[index + 1] ?? "");
    }
  }, [currentMonth, goToMonth, resolvedMonths]);

  const resetIdentityState = useCallback(() => {
    setClientState("unknown");
    setRescheduleOptions([]);
    setCanBookAsNewAppointment(false);
    setIsBookingAsNewAppointment(false);
    setSelectedRescheduleAppointmentId(null);
  }, []);

  const updateDraft = useCallback(
    (nextDraft: Partial<BookingDraft>) => {
      const dateChanged =
        typeof nextDraft.date === "string" && nextDraft.date !== draft.date;
      const timeSlotChanged =
        typeof nextDraft.timeSlot === "string" && nextDraft.timeSlot !== draft.timeSlot;
      const phoneChanged =
        typeof nextDraft.phone === "string"
        && normalizePhone(nextDraft.phone) !== normalizePhone(draft.phone);

      if ((dateChanged || timeSlotChanged) && activeLock?.lockToken) {
        void releaseLock(activeLock.lockToken).catch(() => undefined);
        setActiveLock(null);
        setRemainingSeconds(0);
        resetIdentityState();
        setStep("schedule");
      }

      if (phoneChanged) {
        resetIdentityState();

        setDraft((current) => ({
          ...current,
          ...nextDraft,
          // Prevent leaking previous client's identity when phone changes.
          name: "",
        }));
      } else {
        setDraft((current) => ({
          ...current,
          ...nextDraft,
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
      resetIdentityState,
      setRemainingSeconds,
    ],
  );

  const handleScheduleContinue = useCallback(() => {
    const nextErrors = validateScheduleDraft(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    startTransition(async () => {
      try {
        if (activeLock?.lockToken) {
          await releaseLock(activeLock.lockToken).catch(() => undefined);
        }

        const lock = await acquireReservationLockForSchedule({
          phone: createTempPhone(),
          date: draft.date,
          timeSlot: draft.timeSlot,
        });

        setActiveLock({
          lockToken: lock.lockToken,
          expiresAt: lock.expiresAt,
          kind: "schedule",
        });
        setRemainingSeconds(
          Math.max(
            0,
            Math.floor((new Date(lock.expiresAt).getTime() - Date.now()) / 1000),
          ),
        );
        resetIdentityState();
        setSubmitErrorCode(null);
        setStep("identity");
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        setSubmitErrorCode(code);
      }
    });
  }, [activeLock?.lockToken, draft, releaseLock, resetIdentityState, setRemainingSeconds]);

  const handleContinue = useCallback(() => {
    if (step !== "identity") {
      return;
    }

    if (!activeLock?.lockToken) {
      setSubmitErrorCode("LOCK_EXPIRED_OR_INVALID");
      setStep("schedule");
      return;
    }

    if (clientState === "unknown") {
      const nextErrors = validateIdentityDraft(draft, false);
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      startTransition(async () => {
        try {
          await releaseLock(activeLock.lockToken).catch(() => undefined);

          const response = await checkClientAndAcquireLock(draft);
          const lock = {
            lockToken: response.lockToken,
            expiresAt: response.expiresAt,
            kind: "identity",
          } satisfies SlotLock;

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
            setSelectedRescheduleAppointmentId(null);
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
          setDraft((current) => ({
            ...current,
            name: "",
          }));
        } catch (error) {
          const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
          setSubmitErrorCode(code);
        }
      });

      return;
    }

    const nextErrors = validateIdentityDraft(draft, clientState === "new");

    if (
      clientState === "reschedule"
      && !isBookingAsNewAppointment
      && selectedRescheduleAppointmentId === null
      && !canBookAsNewAppointment
    ) {
      nextErrors.form = "RESCHEDULE_DECISION_REQUIRED";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (
      clientState === "reschedule"
      && selectedRescheduleAppointmentId === null
      && canBookAsNewAppointment
    ) {
      setIsBookingAsNewAppointment(true);
    }

    setStep("confirm");
  }, [
    activeLock,
    canBookAsNewAppointment,
    checkClientAndAcquireLock,
    clientState,
    draft,
    isBookingAsNewAppointment,
    releaseLock,
    selectedRescheduleAppointmentId,
    setRemainingSeconds,
    step,
  ]);

  const handleBack = useCallback(() => {
    startTransition(async () => {
      if (step === "confirm") {
        setStep("identity");
        return;
      }

      if (step === "identity") {
        if (activeLock?.lockToken) {
          await releaseLock(activeLock.lockToken).catch(() => undefined);
        }

        setActiveLock(null);
        setRemainingSeconds(0);
        setSubmitErrorCode(null);
        resetIdentityState();
        setStep("schedule");
      }
    });
  }, [activeLock?.lockToken, releaseLock, resetIdentityState, setRemainingSeconds, step]);

  const handleConfirm = useCallback(() => {
    const nextErrors = validateDraft(draft, clientState === "new");
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStep("identity");
      return;
    }

    if (!activeLock?.lockToken) {
      setSubmitErrorCode("LOCK_EXPIRED_OR_INVALID");
      setStep("schedule");
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
        resetIdentityState();
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
    resetIdentityState,
  ]);

  const stepTransition = useBookingStepTransition({
    step,
    animationsEnabled,
  });

  return {
    state: {
      activeLock,
      availableMonths: resolvedMonths,
      currentMonth,
      clientState,
      currentDays,
      draft,
      errors,
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
      goToPreviousMonth,
      goToNextMonth,
      handleBack,
      handleConfirm,
      handleContinue,
      handleScheduleContinue,
      setSelectedRescheduleAppointmentId: (appointmentId: number | null) => {
        const isDeselectingCurrent =
          typeof appointmentId === "number"
          && appointmentId === selectedRescheduleAppointmentId;

        if (isDeselectingCurrent) {
          setSelectedRescheduleAppointmentId(null);
          setIsBookingAsNewAppointment(canBookAsNewAppointment);
        } else {
          setSelectedRescheduleAppointmentId(appointmentId);
        }

        if (typeof appointmentId === "number" && !isDeselectingCurrent) {
          setIsBookingAsNewAppointment(false);
        }
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
