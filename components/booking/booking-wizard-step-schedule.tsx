"use client";

import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/public/button";
import {
  formatDayOfMonthLabel,
  formatMonthLabel,
  formatShortWeekdayLabel,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import {
  getLeadingBlanks,
  getMonthDates,
} from "@/lib/booking/calendar-helpers";
import type { AppLanguage } from "@/lib/i18n/config";
import type { DayAvailability } from "@/lib/availability/service";
import type {
  BookingDraft,
  BookingValidationErrors,
} from "@/lib/booking/types";
import { translateValidationError } from "@/lib/i18n/translate";
import ErrorMessage from "./error-message";

const WEEKDAY_HEADERS = {
  es: ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
} as const;

type BookingWizardStepScheduleProps = {
  month: string;
  monthLabel: string;
  availableMonths: string[];
  days: DayAvailability[];
  draft: BookingDraft;
  errors: BookingValidationErrors;
  isPending: boolean;
  errorMessage?: string | null;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onContinue: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

export function BookingWizardStepSchedule({
  month,
  monthLabel,
  availableMonths,
  days,
  draft,
  errors,
  isPending,
  errorMessage,
  onDraftChange,
  onContinue,
  onPreviousMonth,
  onNextMonth,
}: BookingWizardStepScheduleProps) {
  const { i18n, t } = useTranslation(["common", "errors"]);
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const selectedDay = days.find((day) => day.date === draft.date) ?? null;
  const monthIndex = availableMonths.indexOf(month);
  const canGoPrev = monthIndex > 0;
  const canGoNext = monthIndex >= 0 && monthIndex < availableMonths.length - 1;
  const monthDates = getMonthDates(month);
  const leadingBlanks = getLeadingBlanks(month);
  const availabilityByDate = new Map(
    days.map((day) => [day.date, day] as const),
  );

  return (
    <div className="space-y-8">
      <header className="mb-8 space-y-4">
        <div className="space-y-3">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            {t("booking.step1Of3")}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[1.45rem] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--foreground)]">
            {t("booking.scheduleTitle")}
          </h1>
        </div>
        <div className="h-0.5 w-full rounded-full bg-[rgba(43,36,33,0.08)]">
          <div className="h-full w-1/3 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

      <section className="space-y-4 mb-[1rem]">
        {errors.date ? (
          <ErrorMessage message={translateValidationError(t, errors.date)} />
        ) : null}
        {/* Navegación de meses */}
        <div className="grid w-full grid-cols-[2.25rem_1fr_2.25rem] items-center gap-3">
          <button
            aria-label={t("booking.previousMonth")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] disabled:opacity-40"
            disabled={!canGoPrev || isPending}
            onClick={onPreviousMonth}
            type="button"
          >
            <FontAwesomeIcon icon={faChevronLeft} color="var(--foreground)" />
          </button>
          <span className="w-full text-center text-xl font-bold text-[var(--foreground)]">
            {monthLabel || formatMonthLabel(month, language)}
          </span>
          <button
            aria-label={t("booking.nextMonth")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] disabled:opacity-40"
            disabled={!canGoNext || isPending}
            onClick={onNextMonth}
            type="button"
          >
            <FontAwesomeIcon icon={faChevronRight} color="var(--foreground)" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-y-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {WEEKDAY_HEADERS[language].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        {/* Grilla con días del mes */}
        <div className="grid grid-cols-7 gap-y-2 text-center mb-0">
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <span
              key={`blank-${index}`}
              aria-hidden="true"
              className="h-11 w-11"
            />
          ))}
          {monthDates.map((date) => {
            const isSelected = draft.date === date;
            const day = availabilityByDate.get(date);
            const isAvailable = Boolean(day && day.slots.length > 0);

            return (
              <button
                key={date}
                aria-label={`${isSelected ? t("booking.calendarAriaSelected") : t("booking.calendarAriaSelect")} ${formatShortWeekdayLabel(date, language)} ${formatDayOfMonthLabel(date)}`}
                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-lg text-base font-medium transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[rgba(228,159,83,0.16)] border border-[var(--accent)] text-[var(--accent-dark)] font-bold!"
                    : isAvailable
                      ? "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                      : "cursor-not-allowed text-[var(--muted-light)]"
                }`}
                disabled={!isAvailable}
                onClick={() =>
                  onDraftChange({
                    date,
                    timeSlot: day?.slots.includes(draft.timeSlot ?? "")
                      ? draft.timeSlot
                      : (day?.slots[0] ?? null),
                  })
                }
                type="button"
              >
                {formatDayOfMonthLabel(date)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          {t("booking.selectTime")}
        </p>
        {/* Slots de horarios disponibles */}
        <div
          className={`grid ${
            (selectedDay?.slots?.length ?? 0) > 3
              ? "grid-cols-2"
              : `grid-cols-${selectedDay?.slots?.length ?? 1}`
          } gap-4`}
        >
          {(selectedDay?.slots ?? []).map((slot) => {
            const isSelected = draft.timeSlot === slot;

            return (
              <button
                key={slot}
                aria-label={t("booking.selectTimeSlot", {
                  slot: formatTimeSlotLabel(slot, language),
                })}
                className={`min-h-14 rounded-full border px-4 text-[0.96rem] tracking-[-0.01em] transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[rgba(228,159,83,0.16)] border border-[var(--accent)] text-[var(--accent-dark)] font-bold!"
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
          <ErrorMessage
            message={translateValidationError(t, errors.timeSlot)}
          />
        ) : null}
      </section>

      {errors.form ? (
        <ErrorMessage message={translateValidationError(t, errors.form)} />
      ) : null}

      {/* Acciones */}
      <div className="space-y-4 pt-1">
        <Button
          className="w-full py-4 text-[1.02rem] font-semibold mb-[1rem]"
          disabled={isPending}
          onClick={onContinue}
          type="button"
        >
          {isPending ? t("booking.wait") : t("booking.next")}
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
