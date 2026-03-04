"use client";

import { useMemo, useState } from "react";

import { BookingForm } from "@/components/booking/booking-form";
import { DaySelector } from "@/components/booking/day-selector";
import { TimeSlotSelector } from "@/components/booking/time-slot-selector";
import type { DayAvailability } from "@/lib/availability/service";

type MonthViewProps = {
  month: string;
  days: DayAvailability[];
};

export function MonthView({ month, days }: MonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(days[0]?.date ?? null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(days[0]?.slots[0] ?? null);

  const selectedDay = useMemo(() => days.find((day) => day.date === selectedDate) ?? null, [days, selectedDate]);

  return (
    <section className="space-y-6 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_20px_60px_rgba(31,26,23,0.08)] backdrop-blur">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Mes activo</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none">{month}</h1>
        <p className="text-sm text-[var(--muted)]">Elige un dia disponible, luego un horario y confirma tus datos.</p>
      </header>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Dias disponibles</h2>
        <DaySelector
          days={days}
          selectedDate={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            const nextSlot = days.find((day) => day.date === date)?.slots[0] ?? null;
            setSelectedSlot(nextSlot);
          }}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Selecciona tu horario</h2>
        <TimeSlotSelector slots={selectedDay?.slots ?? []} selectedSlot={selectedSlot} onSelect={setSelectedSlot} />
      </div>

      <BookingForm selectedDate={selectedDate} selectedSlot={selectedSlot} />
    </section>
  );
}
