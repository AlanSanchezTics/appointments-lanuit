"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function CancelForm() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setMessage(null);

      const response = await fetch("/api/cancelar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const payload = (await response.json()) as { error?: string; status?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo cancelar la cita.");
        return;
      }

      setMessage("Tu cita fue cancelada correctamente.");
    });
  }

  return (
    <form className="space-y-4 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_20px_60px_rgba(31,26,23,0.08)]" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Cancelar</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none">Gestiona tu cita</h1>
      </header>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--muted)]" htmlFor="cancel-phone">
          Telefono
        </label>
        <input
          id="cancel-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-3 outline-none"
          placeholder="5512345678"
          inputMode="numeric"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Cancelando..." : "Cancelar cita"}
      </Button>
      {message ? <p className="text-sm text-[var(--accent-dark)]">{message}</p> : null}
    </form>
  );
}
