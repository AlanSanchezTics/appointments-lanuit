"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { BookingConfirmStep } from "@/components/booking/booking-confirm-step";
import { BookingSuccessStep } from "@/components/booking/booking-success-step";
import { BookingWizardStepIdentity } from "@/components/booking/booking-wizard-step-identity";
import { BookingWizardStepSchedule } from "@/components/booking/booking-wizard-step-schedule";
import { useBookingWizard } from "@/hooks/booking/use-booking-wizard";
import type { DayAvailability } from "@/lib/availability/service";
import { formatMonthLabel } from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import { translateApiError } from "@/lib/i18n/translate";
import type {
  BookingDraft,
  RescheduleOption,
  BookingSuccess,
  BookingStep,
  BookingValidationErrors,
  ClientCheckLockResult,
  SlotLock,
} from "@/lib/booking/types";

type BookingWizardProps = {
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
  onWhatsAppRedirect?: (url: string) => void;
};

type RenderStepParams = {
  step: BookingStep;
  draft: BookingDraft;
  currentDays: DayAvailability[];
  errors: BookingValidationErrors;
  month: string;
  monthLabel: string;
  availableMonths: string[];
  translatedSubmitError: string | null;
  isPending: boolean;
  clientState: "unknown" | "existing" | "new" | "reschedule";
  rescheduleOptions: RescheduleOption[];
  canBookAsNewAppointment: boolean;
  isBookingAsNewAppointment: boolean;
  selectedRescheduleAppointmentId: number | null;
  activeLock: SlotLock | null;
  remainingSeconds: number;
  success: BookingSuccess | null;
  onContinue: () => void;
  onContinueFromSchedule: () => void;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectRescheduleAppointment: (appointmentId: number) => void;
  onWhatsAppRedirect: (url: string) => void;
  onBack: () => void;
  onConfirm: () => void;
};

export function BookingWizard({
  month,
  days,
  availableMonths,
  initialDraft,
  refreshDays,
  checkClientAndAcquireLock,
  releaseLock,
  submitBooking,
  onWhatsAppRedirect,
}: BookingWizardProps) {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const handleWhatsAppRedirect = useCallback(
    (url: string) => {
      if (onWhatsAppRedirect) {
        onWhatsAppRedirect(url);
        return;
      }

      window.location.assign(url);
    },
    [onWhatsAppRedirect],
  );
  const { state, actions, transitions } = useBookingWizard({
    month,
    days,
    availableMonths,
    initialDraft,
    refreshDays,
    checkClientAndAcquireLock,
    releaseLock,
    submitBooking,
  });

  const translatedSubmitError = state.submitErrorCode
    ? translateApiError(t, state.submitErrorCode)
    : null;

  const currentStepPane = renderStep({
    step: transitions.visibleStep,
    draft: state.draft,
    currentDays: state.currentDays,
    errors: state.errors,
    month: state.currentMonth,
    monthLabel: formatMonthLabel(state.currentMonth, language),
    availableMonths: state.availableMonths,
    translatedSubmitError,
    isPending: state.isPending,
    clientState: state.clientState,
    rescheduleOptions: state.rescheduleOptions,
    canBookAsNewAppointment: state.canBookAsNewAppointment,
    isBookingAsNewAppointment: state.isBookingAsNewAppointment,
    selectedRescheduleAppointmentId: state.selectedRescheduleAppointmentId,
    activeLock: state.activeLock,
    remainingSeconds: state.remainingSeconds,
    success: state.success,
    onContinue: actions.handleContinue,
    onContinueFromSchedule: actions.handleScheduleContinue,
    onDraftChange: actions.updateDraft,
    onPreviousMonth: actions.goToPreviousMonth,
    onNextMonth: actions.goToNextMonth,
    onSelectRescheduleAppointment: actions.setSelectedRescheduleAppointmentId,
    onBack: actions.handleBack,
    onConfirm: actions.handleConfirm,
    onWhatsAppRedirect: handleWhatsAppRedirect,
  });
  const leavingStepPane = transitions.leavingStep
    ? renderStep({
        step: transitions.leavingStep,
        draft: state.draft,
        currentDays: state.currentDays,
        errors: state.errors,
        month: state.currentMonth,
        monthLabel: formatMonthLabel(state.currentMonth, language),
        availableMonths: state.availableMonths,
        translatedSubmitError,
        isPending: state.isPending,
        clientState: state.clientState,
        rescheduleOptions: state.rescheduleOptions,
        canBookAsNewAppointment: state.canBookAsNewAppointment,
        isBookingAsNewAppointment: state.isBookingAsNewAppointment,
        selectedRescheduleAppointmentId: state.selectedRescheduleAppointmentId,
        activeLock: state.activeLock,
        remainingSeconds: state.remainingSeconds,
        success: state.success,
        onContinue: actions.handleContinue,
        onContinueFromSchedule: actions.handleScheduleContinue,
        onDraftChange: actions.updateDraft,
        onPreviousMonth: actions.goToPreviousMonth,
        onNextMonth: actions.goToNextMonth,
        onSelectRescheduleAppointment:
          actions.setSelectedRescheduleAppointmentId,
        onBack: actions.handleBack,
        onConfirm: actions.handleConfirm,
        onWhatsAppRedirect: handleWhatsAppRedirect,
      })
    : null;

  return (
    <>
      <section className="booking-mobile-shell p-6 md:p-6 min-h-screen flex items-center justify-center">
        <div className="w-full">
          <div
            data-current-step={state.step}
            data-testid="booking-step-container"
            data-transition-direction={transitions.transitionDirection}
            data-transitioning={
              transitions.isStepTransitioning ? "true" : "false"
            }
            data-visible-step={transitions.visibleStep}
            className="relative min-h-[40rem] overflow-hidden md:min-h-[42rem]"
          >
            {leavingStepPane ? (
              <div
                aria-hidden="true"
                className={`booking-step-panel absolute inset-0 motion-reduce:animate-none ${
                  transitions.transitionDirection === "forward"
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
                transitions.isStepTransitioning
                  ? transitions.transitionDirection === "forward"
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
    </>
  );
}

function renderStep({
  step,
  draft,
  currentDays,
  errors,
  month,
  monthLabel,
  availableMonths,
  translatedSubmitError,
  isPending,
  clientState,
  rescheduleOptions,
  canBookAsNewAppointment,
  isBookingAsNewAppointment,
  selectedRescheduleAppointmentId,
  activeLock,
  remainingSeconds,
  success,
  onContinue,
  onContinueFromSchedule,
  onDraftChange,
  onPreviousMonth,
  onNextMonth,
  onSelectRescheduleAppointment,
  onBack,
  onConfirm,
  onWhatsAppRedirect,
}: RenderStepParams) {
  if (step === "schedule") {
    return (
      <BookingWizardStepSchedule
        month={month}
        monthLabel={monthLabel}
        availableMonths={availableMonths}
        days={currentDays}
        errorMessage={translatedSubmitError}
        draft={draft}
        errors={errors}
        onContinue={onContinueFromSchedule}
        onDraftChange={onDraftChange}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
        isPending={isPending}
      />
    );
  }

  if (step === "identity") {
    return (
      <BookingWizardStepIdentity
        draft={draft}
        errors={errors}
        isPending={isPending}
        showNameField={clientState === "new"}
        hasActiveLock={Boolean(activeLock)}
        remainingSeconds={remainingSeconds}
        clientState={clientState}
        rescheduleOptions={rescheduleOptions}
        canBookAsNewAppointment={canBookAsNewAppointment}
        isBookingAsNewAppointment={isBookingAsNewAppointment}
        selectedRescheduleAppointmentId={selectedRescheduleAppointmentId}
        onSelectRescheduleAppointment={onSelectRescheduleAppointment}
        errorMessage={translatedSubmitError}
        onDraftChange={onDraftChange}
        onContinue={onContinue}
        onBack={onBack}
      />
    );
  }

  if (step === "confirm") {
    return (
      <BookingConfirmStep
        draft={draft}
        isNewClient={clientState === "new"}
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
        window.location.assign("/booking");
      }}
    />
  );
}

export type {
  BookingDraft,
  RescheduleOption,
  BookingSuccess,
  BookingStep,
  BookingValidationErrors,
  SlotLock,
};
