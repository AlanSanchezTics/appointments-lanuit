"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type BookingFormProps = {
  selectedDate: string | null;
  selectedSlot: string | null;
};

export function BookingForm({ selectedDate, selectedSlot }: BookingFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDate || !selectedSlot) {
      setMessage("Selecciona un dia y horario antes de continuar.");
      return;
    }

    startTransition(async () => {
      setMessage(null);

      const response = await fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          date: selectedDate,
          timeSlot: selectedSlot,
        }),
      });

      const payload = (await response.json()) as { error?: string; whatsappUrl?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo reservar la cita.");
        return;
      }

      if (payload.whatsappUrl) {
        window.location.assign(payload.whatsappUrl);
        return;
      }

      setMessage("Cita reservada.");
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--muted)]" htmlFor="booking-name">
          Nombre
        </label>
        <input
          id="booking-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none ring-0"
          placeholder="Tu nombre"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--muted)]" htmlFor="booking-phone">
          Telefono
        </label>
        <input
          id="booking-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none ring-0"
          placeholder="5512345678"
          inputMode="numeric"
          required
        />
      </div>
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Reservando..." : "Confirmar cita"}
      </Button>
      {message ? <p className="text-sm text-[var(--accent-dark)]">{message}</p> : null}
    </form>
  );
}
