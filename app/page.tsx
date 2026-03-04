import Link from "next/link";

import { getCurrentMonthKey } from "@/lib/datetime/mexico-city";

export default function HomePage() {
  const month = getCurrentMonthKey();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_30px_80px_rgba(31,26,23,0.08)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">La Nuit</p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-none md:text-7xl">Reserva tu cita del mes activo.</h1>
          <p className="max-w-xl text-base text-[var(--muted)]">
            Sistema de reservas directo, sin sobreventa y con horarios filtrados en tiempo real.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
              href={`/citas/${month}`}
            >
              Reservar ahora
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold"
              href="/cancelar"
            >
              Cancelar cita
            </Link>
          </div>
        </div>
        <aside className="rounded-[2.5rem] border border-[var(--border)] bg-[rgba(255,255,255,0.5)] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Reglas</p>
          <ul className="mt-6 space-y-3 text-sm text-[var(--foreground)]">
            <li>Solo se agenda dentro del mes actual.</li>
            <li>No se aceptan citas el mismo dia.</li>
            <li>Solo lunes a viernes.</li>
            <li>Separacion minima de 4 horas.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
