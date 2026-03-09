"use client";

import { Button } from "@/components/ui/button";
import {
  formatDayOfMonthLabel,
  formatMonthLabel,
  formatShortWeekdayLabel,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { DayAvailability } from "@/lib/availability/service";

import type { BookingDraft, BookingValidationErrors } from "@/components/booking/booking-wizard";

type BookingWizardStep1Props = {
  month: string;
  days: DayAvailability[];
  draft: BookingDraft;
  errors: BookingValidationErrors;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
  onContinue: () => void;
  onOpenCalendar: () => void;
};

export function BookingWizardStep1({
  month,
  days,
  draft,
  errors,
  onDraftChange,
  onContinue,
  onOpenCalendar,
}: BookingWizardStep1Props) {
  const selectedDay = days.find((day) => day.date === draft.date) ?? null;
  const highlightedDays = getHighlightedDays(days, draft.date);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">Paso 1 de 2</p>
            <h1 className="font-[family-name:var(--font-display)] text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--foreground)]">
              Agendar Cita
            </h1>
          </div>
          <button
            aria-label="Abrir calendario"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--accent-dark)] shadow-[var(--shadow-soft)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onOpenCalendar}
            type="button"
          >
            <CalendarIcon />
          </button>
        </div>
        <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
          <div className="h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      <section className="space-y-4 border-t border-[var(--border)] pt-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Dias disponibles</p>
          <button
            className="text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)] transition hover:text-[var(--accent-dark)]"
            onClick={onOpenCalendar}
            type="button"
          >
            {formatMonthLabel(month)}
          </button>
        </div>

        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {highlightedDays.map((day) => {
            const isSelected = draft.date === day.date;

            return (
              <button
                key={day.date}
                aria-label={`Seleccionar dia ${formatShortWeekdayLabel(day.date)} ${formatDayOfMonthLabel(day.date)}`}
                className={`min-h-24 min-w-16 flex-shrink-0 rounded-[1.7rem] border px-2 py-3 text-center transition ${
                  isSelected
                    ? "border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-soft)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
                }`}
                onClick={() =>
                  onDraftChange({
                    date: day.date,
                    timeSlot: day.slots.includes(draft.timeSlot ?? "") ? draft.timeSlot : day.slots[0] ?? null,
                  })
                }
                type="button"
              >
                <span className={`block text-[0.68rem] font-bold uppercase tracking-[0.12em] ${isSelected ? "text-white/80" : "text-[var(--muted)]"}`}>
                  {formatShortWeekdayLabel(day.date)}
                </span>
                <span className="mt-2 block text-[1.8rem] font-semibold leading-none tracking-[-0.04em]">{formatDayOfMonthLabel(day.date)}</span>
              </button>
            );
          })}
        </div>
        {errors.date ? <p className="text-sm text-[var(--error)]">{errors.date}</p> : null}
      </section>

      <section className="space-y-4">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Selecciona tu horario</p>
        <div className="grid grid-cols-2 gap-3">
          {(selectedDay?.slots ?? []).map((slot) => {
            const isSelected = draft.timeSlot === slot;

            return (
              <button
                key={slot}
                aria-label={`Seleccionar horario ${formatTimeSlotLabel(slot)}`}
                className={`min-h-15 rounded-full border px-4 text-[0.98rem] font-semibold tracking-[-0.02em] transition ${
                  isSelected
                    ? "border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-soft)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
                }`}
                onClick={() => onDraftChange({ timeSlot: slot })}
                type="button"
              >
                {formatTimeSlotLabel(slot)}
              </button>
            );
          })}
        </div>
        {errors.timeSlot ? <p className="text-sm text-[var(--error)]">{errors.timeSlot}</p> : null}
      </section>

      <section className="space-y-4">
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Tus datos</p>
        <div className="space-y-4">
          <label className="relative block" htmlFor="booking-name">
            <span className="absolute left-4 top-0 -translate-y-1/2 bg-[var(--surface-strong)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent-dark)]">
              Nombre completo
            </span>
            <input
              id="booking-name"
              className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              onChange={(event) => onDraftChange({ name: event.target.value })}
              placeholder="Ej. Ana Garcia"
              value={draft.name}
            />
          </label>
          {errors.name ? <p className="text-sm text-[var(--error)]">{errors.name}</p> : null}

          <label className="relative block" htmlFor="booking-phone">
            <span className="absolute left-4 top-0 -translate-y-1/2 bg-[var(--surface-strong)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent-dark)]">
              Telefono
            </span>
            <input
              id="booking-phone"
              className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              inputMode="numeric"
              onChange={(event) => onDraftChange({ phone: event.target.value })}
              placeholder="+52 55 1234 5678"
              value={draft.phone}
            />
          </label>
          {errors.phone ? <p className="text-sm text-[var(--error)]">{errors.phone}</p> : null}
        </div>
      </section>

      {errors.form ? <p className="text-sm text-[var(--error)]">{errors.form}</p> : null}

      <div className="space-y-4 pt-2">
        <Button className="w-full py-4 text-[1.02rem] font-semibold" onClick={onContinue} type="button">
          Siguiente
          <span aria-hidden="true" className="ml-2">
            →
          </span>
        </Button>
        <p className="text-center text-[0.83rem] font-medium tracking-[-0.01em] text-[var(--muted)]">Continuaras a la confirmacion de tu cita</p>
      </div>
    </div>
  );
}

function getHighlightedDays(days: DayAvailability[], selectedDate: string | null) {
  if (days.length <= 4) {
    return days;
  }

  const selectedIndex = Math.max(
    0,
    selectedDate ? days.findIndex((day) => day.date === selectedDate) : 0,
  );
  const start = Math.min(Math.max(selectedIndex - 1, 0), Math.max(days.length - 4, 0));

  return days.slice(start, start + 4);
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
      <rect height="13" rx="3" stroke="currentColor" strokeWidth="1.6" width="14" x="3" y="4" />
      <path d="M6.5 2.75V5.5M13.5 2.75V5.5M3 8.5H17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}
