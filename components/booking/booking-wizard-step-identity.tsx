"use client";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/public/button";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import {
  formatPhoneForDisplay,
  formatRemainingTime,
} from "@/lib/booking/formatters";
import type { AppLanguage } from "@/lib/i18n/config";
import { translateValidationError } from "@/lib/i18n/translate";
import type {
  BookingDraft,
  BookingValidationErrors,
  RescheduleOption,
} from "@/lib/booking/types";
import LockMessage from "./lock-message";

type BookingWizardStepIdentityProps = {
  draft: BookingDraft;
  errors: BookingValidationErrors;
  isPending: boolean;
  showNameField: boolean;
  hasActiveLock: boolean;
  remainingSeconds: number;
  clientState: "unknown" | "existing" | "new" | "reschedule";
  rescheduleOptions: RescheduleOption[];
  canBookAsNewAppointment: boolean;
  isBookingAsNewAppointment: boolean;
  selectedRescheduleAppointmentId: number | null;
  errorMessage?: string | null;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  onSelectRescheduleAppointment: (appointmentId: number) => void;
};

export function BookingWizardStepIdentity({
  draft,
  errors,
  isPending,
  showNameField,
  hasActiveLock,
  remainingSeconds,
  clientState,
  rescheduleOptions,
  canBookAsNewAppointment,
  isBookingAsNewAppointment,
  selectedRescheduleAppointmentId,
  errorMessage,
  onDraftChange,
  onContinue,
  onBack,
  onSelectRescheduleAppointment,
}: BookingWizardStepIdentityProps) {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const showRescheduleSelection =
    clientState === "reschedule" && rescheduleOptions.length > 0;
  const hasSelectedAppointmentToReschedule =
    !isBookingAsNewAppointment && selectedRescheduleAppointmentId !== null;
  const continueButtonLabel = showRescheduleSelection
    ? hasSelectedAppointmentToReschedule
      ? t("booking.rescheduleSelectedAppointment")
      : canBookAsNewAppointment
        ? t("booking.continueAsNewAppointment")
        : t("booking.next")
    : t("booking.next");

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-3">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            {t("booking.step2Of3")}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[1.45rem] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--foreground)]">
            {t("booking.identityTitle")}
          </h1>
        </div>
        <div className="h-0.5 w-full rounded-full bg-[rgba(43,36,33,0.08)]">
          <div className="h-full w-2/3 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      {hasActiveLock ? (
        <LockMessage remainingSeconds={remainingSeconds} />
      ) : null}

      {!showRescheduleSelection ? (
        <section className="space-y-4">
          <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("booking.yourDetails")}
          </p>
          <div className="space-y-5">
            <label className="relative block" htmlFor="booking-phone">
              <span className="absolute left-5 top-0 -translate-y-1/2 bg-[var(--surface)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                {t("booking.phone")}
              </span>
              <input
                id="booking-phone"
                className="w-full rounded-full border border-[var(--border)] bg-white px-6 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                inputMode="numeric"
                onChange={(event) =>
                  onDraftChange({ phone: event.target.value })
                }
                placeholder={t("booking.phonePlaceholder")}
                value={draft.phone}
              />
              {errors.phone ? (
                <p className="text-xs text-[var(--error)] mt-2 ml-3 mb-0">
                  {translateValidationError(t, errors.phone)}
                </p>
              ) : null}
            </label>

            {showNameField ? (
              <>
                <label className="relative block" htmlFor="booking-name">
                  <span className="absolute left-5 top-0 -translate-y-1/2 bg-[var(--surface)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                    {t("booking.fullName")}
                  </span>
                  <input
                    id="booking-name"
                    className="w-full rounded-full border border-[var(--border)] bg-white px-6 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    onChange={(event) =>
                      onDraftChange({ name: event.target.value })
                    }
                    placeholder={t("booking.namePlaceholder")}
                    value={draft.name}
                  />
                  {errors.name ? (
                    <p className="text-xs text-[var(--error)] mt-2 ml-3 mb-0">
                      {translateValidationError(t, errors.name)}
                    </p>
                  ) : null}
                </label>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {showRescheduleSelection ? (
        <>
          {/* Detalles de la cita */}
          <p className="text-sm font-medium text-[var(--muted)] mb-[0.5rem]">
            {t("booking.rescheduleCurrentSelectionTitle")}
          </p>
          <section className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
            <dl className="space-y-5">
              <div>
                <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("booking.name")}
                </dt>
                <dd className="mt-1 text-[0.97rem] font-semibold text-[var(--foreground)]">
                  {draft.name || "-"}
                </dd>
              </div>

              <div>
                <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("booking.phone")}
                </dt>
                <dd className="mt-1 text-[0.97rem] font-semibold text-[var(--foreground)]">
                  {draft.phone ? formatPhoneForDisplay(draft.phone) : "-"}
                </dd>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("booking.date")}
                  </dt>
                  <dd className="mt-1 text-[0.97rem] font-semibold leading-tight text-[var(--foreground)]">
                    {draft.date ? formatLongDate(draft.date, language) : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("booking.time")}
                  </dt>
                  <dd className="mt-1 text-[0.97rem] font-semibold text-[var(--foreground)]">
                    {draft.timeSlot
                      ? formatTimeSlotLabel(draft.timeSlot, language)
                      : "-"}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          <p className="rounded-2xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)] mb-[1rem] text-center">
            {t("booking.rescheduleSelectionTitle")}
          </p>
          <section className="space-y-4 rounded-[1.15rem] border border-[var(--warning-soft)] bg-[rgba(243,229,214,0.55)] p-5">
            <p className="text-[var(--muted)] text-center">
              {t("booking.rescheduleSelectionSingle")}
            </p>
            <div className="space-y-3">
              {rescheduleOptions.map((option) => {
                const isSelected =
                  !isBookingAsNewAppointment &&
                  selectedRescheduleAppointmentId === option.appointmentId;

                return (
                  <button
                    key={option.appointmentId}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-[var(--accent)] bg-[rgba(228,159,83,0.16)]"
                        : "border-[var(--border)] bg-white/80"
                    }`}
                    onClick={() =>
                      onSelectRescheduleAppointment(option.appointmentId)
                    }
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {formatLongDate(option.date, language)}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {formatTimeSlotLabel(option.timeSlot, language)}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? "border-[var(--accent)]"
                            : "border-[var(--muted)]"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            isSelected ? "bg-[var(--accent)]" : "bg-transparent"
                          }`}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-[var(--error)] text-center">
          {errorMessage}
        </p>
      ) : null}

      {errors.form ? (
        <p className="text-sm text-[var(--error)] text-center">
          {translateValidationError(t, errors.form)}
        </p>
      ) : null}

      <div className="space-y-4 pt-1">
        <Button
          className="w-full py-4 text-[1.02rem] font-semibold mb-[1rem]"
          disabled={isPending}
          onClick={onContinue}
          type="button"
        >
          {isPending ? t("booking.wait") : continueButtonLabel}
        </Button>

        <div className="flex justify-center">
          <button
            className="cursor-pointer inline-flex justify-center text-[0.9rem]! font-medium! tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={onBack}
            type="button"
          >
            {t("booking.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
