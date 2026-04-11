"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { BookingConfirmStep } from "@/components/booking/booking-confirm-step";
import { BookingSuccessStep } from "@/components/booking/booking-success-step";
import { BookingWizardStep1 } from "@/components/booking/booking-wizard-step1";
import { CalendarModal } from "@/components/booking/calendar-modal";
import { useBookingWizard } from "@/hooks/booking/use-booking-wizard";
import type { DayAvailability } from "@/lib/availability/service";
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
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onOpenCalendar: () => void;
  onSelectRescheduleAppointment: (appointmentId: number) => void;
  onWhatsAppRedirect: (url: string) => void;
  onBack: () => void;
  onConfirm: () => void;
};

export function BookingWizard({
  month,
  days,
  initialDraft,
  refreshDays,
  checkClientAndAcquireLock,
  releaseLock,
  submitBooking,
  onWhatsAppRedirect,
}: BookingWizardProps) {
  const { t } = useTranslation(["common", "errors"]);
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
    month,
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
    onDraftChange: actions.updateDraft,
    onOpenCalendar: () => actions.setCalendarOpen(true),
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
        month,
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
        onDraftChange: actions.updateDraft,
        onOpenCalendar: () => actions.setCalendarOpen(true),
        onSelectRescheduleAppointment: actions.setSelectedRescheduleAppointmentId,
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
            data-transitioning={transitions.isStepTransitioning ? "true" : "false"}
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

      <CalendarModal
        days={state.currentDays}
        isOpen={state.isCalendarOpen}
        month={month}
        onClose={() => actions.setCalendarOpen(false)}
        onSelect={(date) => {
          const nextDay =
            state.currentDays.find((day) => day.date === date) ?? null;
          actions.updateDraft({
            date,
            timeSlot: nextDay?.slots.includes(state.draft.timeSlot ?? "")
              ? state.draft.timeSlot
              : (nextDay?.slots[0] ?? null),
          });
        }}
        selectedDate={state.draft.date}
      />
    </>
  );
}

function renderStep({
  step,
  draft,
  currentDays,
  errors,
  month,
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
  onDraftChange,
  onOpenCalendar,
  onSelectRescheduleAppointment,
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
        onBack={onBack}
        onDraftChange={onDraftChange}
        onOpenCalendar={onOpenCalendar}
        isPending={isPending}
        showNameField={clientState === "new"}
        hasActiveLock={(clientState === "new" || clientState === "reschedule") && Boolean(activeLock)}
        rescheduleOptions={rescheduleOptions}
        canBookAsNewAppointment={canBookAsNewAppointment}
        isBookingAsNewAppointment={isBookingAsNewAppointment}
        selectedRescheduleAppointmentId={selectedRescheduleAppointmentId}
        onSelectRescheduleAppointment={onSelectRescheduleAppointment}
        remainingSeconds={remainingSeconds}
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
        window.location.assign("/");
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
