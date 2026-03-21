"use client";

import { Button } from "@/components/ui/public/button";
import { useTranslation } from "react-i18next";
import {
  formatDayOfMonthLabel,
  formatMonthLabel,
  formatShortWeekdayLabel,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import { translateValidationError } from "@/lib/i18n/translate";
import type { DayAvailability } from "@/lib/availability/service";

import type {
  BookingDraft,
  BookingValidationErrors,
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
  remainingSeconds,
  errorMessage,
}: BookingWizardStep1Props) {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const selectedDay = days.find((day) => day.date === draft.date) ?? null;
  const highlightedDays = getHighlightedDays(days, draft.date);

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
          <button
            aria-label={t("booking.openCalendar")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--accent)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onOpenCalendar}
            type="button"
          >
            <CalendarIcon />
          </button>
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
          {highlightedDays.map((day) => {
            const isSelected = draft.date === day.date;

            return (
              <button
                key={day.date}
                aria-label={t("booking.selectDay", {
                  weekday: formatShortWeekdayLabel(day.date, language),
                  day: formatDayOfMonthLabel(day.date),
                })}
                className={`min-h-24 w-[100%] rounded-[2rem] border px-2 py-3 text-center transition ${
                  isSelected
                    ? "border-transparent bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
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
                  className={`block text-[0.68rem] font-bold uppercase tracking-[0.12em] ${isSelected ? "text-white/80" : "text-[var(--muted)]"}`}
                >
                  {formatShortWeekdayLabel(day.date, language)}
                </span>
                <span className="mt-2 block text-[1.8rem] font-bold leading-none tracking-[-0.04em]">
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

      <section className="space-y-4">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {t("booking.selectTime")}
        </p>
        <div className="grid grid-cols-2 gap-4">
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
              onChange={(event) => onDraftChange({ phone: event.target.value })}
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

      {hasActiveLock ? (
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
          className="w-full min-h-14 py-4 text-[1rem] font-bold"
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
            href={`/citas/${month}`}
          >
            {t("booking.back")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatRemainingTime(remainingSeconds: number) {
  const safeSeconds = Math.max(0, remainingSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getHighlightedDays(
  days: DayAvailability[],
  selectedDate: string | null,
) {
  if (days.length <= 4) {
    return days;
  }

  const selectedIndex = Math.max(
    0,
    selectedDate ? days.findIndex((day) => day.date === selectedDate) : 0,
  );
  const start = Math.min(
    Math.max(selectedIndex - 1, 0),
    Math.max(days.length - 4, 0),
  );

  return days.slice(start, start + 4);
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
