"use client";

import { Button } from "@/components/ui/button";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";

import type { BookingDraft } from "@/components/booking/booking-wizard";

type BookingConfirmStepProps = {
  draft: BookingDraft;
  errorMessage: string | null;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export function BookingConfirmStep({
  draft,
  errorMessage,
  isPending,
  onBack,
  onConfirm,
}: BookingConfirmStepProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-start gap-4">
          <button
            aria-label="Volver al paso anterior"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)] shadow-[var(--shadow-soft)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onBack}
            type="button"
          >
            <ArrowLeftIcon />
          </button>
          <div className="space-y-2">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
              Paso 2 de 2
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em]">
              Confirmar Detalles
            </h1>
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-[var(--border)] bg-white/80 p-6 shadow-[var(--shadow-soft)]">
        <dl className="space-y-5">
          <div>
            <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
              Fecha
            </dt>
            <dd className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
              {formatLongDate(draft.date ?? "")}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                Hora
              </dt>
              <dd className="mt-1 text-[1.08rem] font-semibold tracking-[-0.02em]">
                {formatTimeSlotLabel(draft.timeSlot ?? "09:00")}
              </dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                Telefono
              </dt>
              <dd className="mt-1 text-[1rem] font-semibold tracking-[-0.02em]">
                {formatPhoneForDisplay(draft.phone)}
              </dd>
            </div>
          </div>
          <div className="border-t border-[var(--border)] pt-5">
            <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
              Nombre
            </dt>
            <dd className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
              {draft.name}
            </dd>
          </div>
        </dl>
      </section>

      {errorMessage ? (
        <p className="rounded-3xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-4">
        <Button
          className="w-full py-4 text-[1.02rem] font-extrabold"
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {isPending ? "Un momento..." : "Confirmar cita"}
        </Button>
        <button
          className="mx-auto w-full text-[0.9rem] py-2 font-medium tracking-[-0.01em] text-[var(--muted)] cursor-pointer border border-[var(--border)] rounded-full transition hover:text-[var(--foreground)]"
          onClick={onBack}
          type="button"
        >
          Editar información
        </button>
        <div className="flex gap-3 rounded-[1.25rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-4 text-left">
          <span className="mt-0.5 text-[0.95rem] font-semibold text-[var(--accent-dark)]">
            i
          </span>
          <p className="text-[0.76rem] font-medium leading-relaxed tracking-[-0.01em] text-[var(--muted)]">
            Recibirás un recordatorio por WhatsApp un día antes de tu cita.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatPhoneForDisplay(phone: string) {
  const trimmed = phone.replace(/\D/g, "");

  if (trimmed.length !== 10) {
    return phone;
  }

  return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
}

function ArrowLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <path
        d="M11.25 14.25L6 9l5.25-5.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
