import Link from "next/link";

import {
  formatMonthLabel,
  getCurrentMonthKey,
} from "@/lib/datetime/mexico-city";
import { Button, buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  const month = getCurrentMonthKey();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[2.5rem] border border-[var(--border)] bg-white p-8 shadow-[0_30px_80px_rgba(31,26,23,0.08)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            La Nuit
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none md:text-7xl">
            Reserva tu cita del mes de {formatMonthLabel(month)}.
          </h1>
          <p className="max-w-xl text-base text-[var(--muted)]">
            Sistema de reservas directo, sin sobreventa y con horarios filtrados
            en tiempo real.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="py-4 text-[1.02rem] font-semibold"
              variant="primary"
            >
              <Link href={`/citas/${month}`} className="w-full">
                Reservar ahora
              </Link>
            </Button>
            <Button
              className="py-4 text-[1.02rem] font-semibold"
              variant="secondary"
            >
              <Link href="/cancelar" className="w-full">
                Cancelar cita
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
