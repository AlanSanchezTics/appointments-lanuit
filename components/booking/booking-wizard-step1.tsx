"use client";

import { Button } from "@/components/ui/public/button";
import { useTranslation } from "react-i18next";
import {
  formatDayOfMonthLabel,
  formatLongDate,
  formatMonthLabel,
  formatShortWeekdayLabel,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import {
  formatPhoneForDisplay,
  formatRemainingTime,
} from "@/lib/booking/formatters";
import type { AppLanguage } from "@/lib/i18n/config";
import { translateValidationError } from "@/lib/i18n/translate";
import type { DayAvailability } from "@/lib/availability/service";

import type {
  BookingDraft,
  BookingValidationErrors,
  RescheduleOption,
} from "@/components/booking/booking-wizard";
import Link from "next/link";

type BookingWizardStep1Props = {
  month: string;
  days: DayAvailability[];
  draft: BookingDraft;
  errors: BookingValidationErrors;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onContinue: () => void;
  onOpenCalendar: () => void;
  isPending: boolean;
  showNameField: boolean;
  hasActiveLock: boolean;
  rescheduleOptions: RescheduleOption[];
  canBookAsNewAppointment: boolean;
  isBookingAsNewAppointment: boolean;
  selectedRescheduleAppointmentId: number | null;
  onSelectRescheduleAppointment: (appointmentId: number) => void;
  onChooseBookAsNewAppointment: () => void;
  remainingSeconds: number;
  errorMessage?: string | null;
};

export function BookingWizardStep1({
  month,
  days,
  draft,
  errors,
  onDraftChange,
  onContinue,
  onOpenCalendar,
  isPending,
  showNameField,
  hasActiveLock,
  rescheduleOptions,
  canBookAsNewAppointment,
  isBookingAsNewAppointment,
  selectedRescheduleAppointmentId,
  onSelectRescheduleAppointment,
  onChooseBookAsNewAppointment,
  remainingSeconds,
  errorMessage,
}: BookingWizardStep1Props) {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const selectedDay = days.find((day) => day.date === draft.date) ?? null;
  const showRescheduleSelection = rescheduleOptions.length > 0;

  return (
    <div className="space-y-8">
      <header className="mb-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              {t("booking.step1Of2")}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-[2.25rem] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--foreground)]">
              {t("booking.title")}
            </h1>
          </div>
          {!showRescheduleSelection ? (
            <button
              aria-label={t("booking.openCalendar")}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--accent)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              onClick={onOpenCalendar}
              type="button"
            >
              <CalendarIcon />
            </button>
          ) : null}
        </div>
        <div className="h-0.5 w-full rounded-full bg-[rgba(43,36,33,0.08)]">
          <div className="h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      {errorMessage ? (
        <p className="rounded-2xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)] mb-[1.5rem]">
          {errorMessage}
        </p>
      ) : null}

      {!showRescheduleSelection ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              {t("booking.availableDays")}
            </p>
            <button
              className="text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)] transition hover:text-[var(--accent)]"
              onClick={onOpenCalendar}
              type="button"
            >
              {formatMonthLabel(month, language)}
            </button>
          </div>

          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 items-center justify-stretch">
            {days.map((day) => {
              const isSelected = draft.date === day.date;

              return (
                <button
                  key={day.date}
                  aria-label={t("booking.selectDay", {
                    weekday: formatShortWeekdayLabel(day.date, language),
                    day: formatDayOfMonthLabel(day.date),
                  })}
                  className={`min-h-24 ${days.length > 4 ? "min-w-[5rem] flex-none" : "w-[100%]"} flex flex-col items-center justify-center rounded-2xl px-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                    isSelected
                      ? "bg-[var(--admin-primary)] text-white shadow-sm"
                      : "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-primary)]"
                  }`}
                  onClick={() =>
                    onDraftChange({
                      date: day.date,
                      timeSlot: day.slots.includes(draft.timeSlot ?? "")
                        ? draft.timeSlot
                        : (day.slots[0] ?? null),
                    })
                  }
                  type="button"
                >
                  <span
                    className={`text-[12px] font-semibold ${isSelected ? "text-white/90" : "text-[var(--admin-text-secondary)]"}`}
                  >
                    {formatShortWeekdayLabel(day.date, language)}
                  </span>
                  <span className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em]">
                    {formatDayOfMonthLabel(day.date)}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.date ? (
            <p className="text-sm text-[var(--error)]">
              {translateValidationError(t, errors.date)}
            </p>
          ) : null}
        </section>
      ) : null}

      {showRescheduleSelection && hasActiveLock ? (
        <p className="rounded-3xl border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--accent-dark)]">
          {t("booking.slotLockedForYou", {
            time: formatRemainingTime(remainingSeconds),
          })}
        </p>
      ) : null}

      {showRescheduleSelection ? (
        <section className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">
            {t("booking.rescheduleCurrentSelectionTitle")}
          </p>
          <dl className="mt-4 space-y-5">
            <div>
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("booking.name")}
              </dt>
              <dd className="mt-1 text-[1.24rem] font-semibold text-[var(--foreground)]">
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
      ) : null}

      {showRescheduleSelection ? (
        <section className="space-y-4 rounded-[1.15rem] border border-[var(--warning-soft)] bg-[rgba(243,229,214,0.55)] p-5">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">
            {t("booking.rescheduleSelectionTitle")}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {rescheduleOptions.length > 1
              ? t("booking.rescheduleSelectionMultiple")
              : t("booking.rescheduleSelectionSingle")}
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
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {formatLongDate(option.date, language)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatTimeSlotLabel(option.timeSlot, language)}
                  </p>
                </button>
              );
            })}
          </div>
          {canBookAsNewAppointment ? (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("booking.orSeparator")}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <button
                className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isBookingAsNewAppointment
                    ? "border-[var(--accent)] bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]"
                    : "border-[var(--border)] bg-white/80 text-[var(--foreground)]"
                }`}
                onClick={onChooseBookAsNewAppointment}
                type="button"
              >
                {t("booking.bookAsNewAppointment")}
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {!showRescheduleSelection ? (
        <section className="space-y-4">
          <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("booking.selectTime")}
          </p>
          <div
            className={`grid ${(selectedDay?.slots?.length ?? 0) > 3 ? "grid-cols-2" : "grid-cols-1"} gap-4`}
          >
            {(selectedDay?.slots ?? []).map((slot) => {
              const isSelected = draft.timeSlot === slot;

              return (
                <button
                  key={slot}
                  aria-label={t("booking.selectTimeSlot", {
                    slot: formatTimeSlotLabel(slot, language),
                  })}
                  className={`min-h-14 rounded-full border px-4 text-[0.96rem] font-bold tracking-[-0.01em] transition ${
                    isSelected
                      ? "border-transparent bg-[var(--accent)] text-white"
                      : "border-[var(--border)] bg-white text-[var(--foreground)]"
                  }`}
                  onClick={() => onDraftChange({ timeSlot: slot })}
                  type="button"
                >
                  {formatTimeSlotLabel(slot, language)}
                </button>
              );
            })}
          </div>
          {errors.timeSlot ? (
            <p className="text-sm text-[var(--error)]">
              {translateValidationError(t, errors.timeSlot)}
            </p>
          ) : null}
        </section>
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
            </label>
            {errors.phone ? (
              <p className="text-sm text-[var(--error)]">
                {translateValidationError(t, errors.phone)}
              </p>
            ) : null}

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
                </label>
                {errors.name ? (
                  <p className="text-sm text-[var(--error)]">
                    {translateValidationError(t, errors.name)}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {!showRescheduleSelection && hasActiveLock ? (
        <p className="rounded-3xl border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--accent-dark)]">
          {t("booking.slotLockedForYou", {
            time: formatRemainingTime(remainingSeconds),
          })}
        </p>
      ) : null}

      {errors.form ? (
        <p className="text-sm text-[var(--error)]">
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
          {isPending ? (
            t("booking.wait")
          ) : (
            <>
              {t("booking.next")}
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </>
          )}
        </Button>
        <div className="flex justify-center">
          <Link
            className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            href="/"
          >
            {t("booking.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 20 20"
      width="20"
    >
      <rect
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
        width="14"
        x="3"
        y="4"
      />
      <path
        d="M6.5 2.75V5.5M13.5 2.75V5.5M3 8.5H17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
