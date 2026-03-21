"use client";

import { Button } from "@/components/ui/public/button";
import { useTranslation } from "react-i18next";
import {
  formatDayOfMonthLabel,
  formatMonthLabel,
  formatShortWeekdayLabel,
  isWeekdayInMexicoCity,
} from "@/lib/datetime/mexico-city";
import {
  getLeadingBlanks,
  getMonthDates,
} from "@/lib/booking/calendar-helpers";
import type { AppLanguage } from "@/lib/i18n/config";
import type { DayAvailability } from "@/lib/availability/service";

type CalendarModalProps = {
  month: string;
  days: DayAvailability[];
  selectedDate: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
};

const WEEKDAY_HEADERS = {
  es: ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
} as const;

export function CalendarModal({
  month,
  days,
  selectedDate,
  isOpen,
  onClose,
  onSelect,
}: CalendarModalProps) {
  const { i18n, t } = useTranslation("common");
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  if (!isOpen) {
    return null;
  }

  const monthDates = getMonthDates(month);
  const availableDates = new Set(days.map((day) => day.date));
  const leadingBlanks = getLeadingBlanks(month);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(33,24,20,0.28)] px-3 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-sm rounded-[2.2rem] border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-[0_30px_80px_rgba(51,36,30,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex items-center justify-center">
          <h2 className="font-[family-name:var(--font-display)] text-[2rem] leading-none font-semibold text-[var(--foreground)]">
            {formatMonthLabel(month, language)}
          </h2>
          <button
            aria-label={t("booking.calendarClose")}
            className="absolute right-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-7 gap-y-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {WEEKDAY_HEADERS[language].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-7 gap-y-3 text-center">
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <span
              key={`blank-${index}`}
              aria-hidden="true"
              className="h-11 w-11"
            />
          ))}
          {monthDates.map((date) => {
            const isSelected = date === selectedDate;
            const isAvailable = availableDates.has(date);
            const isInactive = !isAvailable || !isWeekdayInMexicoCity(date);

            return (
              <button
                key={date}
                aria-label={`${isSelected ? t("booking.calendarAriaSelected") : t("booking.calendarAriaSelect")} ${formatShortWeekdayLabel(date, language)} ${formatDayOfMonthLabel(date)}`}
                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-base font-medium transition ${
                  isSelected
                    ? "bg-[var(--accent)] text-white shadow-[var(--shadow-soft)]"
                    : isInactive
                      ? "cursor-not-allowed text-[var(--muted-light)]"
                      : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                }`}
                disabled={isInactive}
                onClick={() => onSelect(date)}
                type="button"
              >
                {formatDayOfMonthLabel(date)}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--muted)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            {t("booking.calendarSelected")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-[var(--border-strong)] bg-transparent" />
            {t("booking.calendarAvailable")}
          </span>
        </div>

        <Button
          className="mt-10 w-full py-3 text-base"
          onClick={onClose}
          type="button"
        >
          {t("booking.calendarDone")}
        </Button>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          {t("booking.calendarHint")}
        </p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <path
        d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
