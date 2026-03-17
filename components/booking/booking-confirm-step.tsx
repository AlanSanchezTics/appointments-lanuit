"use client";

import { Button } from "@/components/ui/public/button";
import { useTranslation } from "react-i18next";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

import type { BookingDraft } from "@/components/booking/booking-wizard";
import Link from "next/link";

type BookingConfirmStepProps = {
  draft: BookingDraft;
  errorMessage: string | null;
  isPending: boolean;
  remainingSeconds: number;
  onBack: () => void;
  onConfirm: () => void;
};

export function BookingConfirmStep({
  draft,
  errorMessage,
  isPending,
  remainingSeconds,
  onBack,
  onConfirm,
}: BookingConfirmStepProps) {
  const { i18n, t } = useTranslation("common");
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  return (
    <div className="space-y-8">
      <header className="space-y-4 mb-[1.5rem]">
        <div className="flex items-start gap-4">
          <div className="space-y-2">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
              {t("booking.step2Of2")}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em]">
              {t("booking.confirmTitle")}
            </h1>
            <p className="mb-0 text-(--muted)">
              {t("booking.welcomeBack", { name: draft.name.split(" ")[0] })}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-[var(--border)] bg-white/80 p-6 shadow-[var(--shadow-soft)]">
        <dl className="space-y-5">
          <div>
            <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
              {t("booking.name")}
            </dt>
            <dd className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em]">
              {draft.name}
            </dd>
          </div>
          <div className="border-t border-[var(--border)] pt-5">
            <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
              {t("booking.date")}
            </dt>
            <dd className="mt-1 text-[1.05rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
              {formatLongDate(draft.date ?? "", language)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                {t("booking.time")}
              </dt>
              <dd className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
                {formatTimeSlotLabel(draft.timeSlot ?? "09:00", language)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                {t("booking.phone")}
              </dt>
              <dd className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
                {formatPhoneForDisplay(draft.phone)}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <p className="rounded-3xl border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--accent-dark)]">
        {t("booking.slotLockedForYou", {
          time: formatRemainingTime(remainingSeconds),
        })}
      </p>

      {errorMessage ? (
        <p className="rounded-3xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-4">
        <Button
          className="w-full py-4 text-[1.02rem]"
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {isPending ? (
            t("booking.wait")
          ) : (
            <>
              {t("booking.confirmAppointment")} <CheckCircleIcon />
            </>
          )}
        </Button>
        <div className="flex justify-center">
          <Link
            className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={onBack}
            href="#"
          >
            <PencilIcon /> {t("booking.editInformation")}
          </Link>
        </div>
        <div className="flex gap-3 rounded-[1.25rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-4 text-left">
          <span className="mt-0.5 text-[0.95rem] font-semibold text-[var(--accent-dark)]">
            i
          </span>
          <p className="text-[0.76rem] font-medium leading-relaxed tracking-[-0.01em] text-[var(--muted)]">
            {t("booking.whatsappReminder")}
          </p>
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

function formatPhoneForDisplay(phone: string) {
  const trimmed = phone.replace(/\D/g, "");

  if (trimmed.length !== 10) {
    return phone;
  }

  return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
}

function CheckCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6 text-white ml-1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="mr-1.5 h-5 w-5 text-(--muted)"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.688-1.688a2.25 2.25 0 113.182 3.182L10.5 17.213a4.5 4.5 0 01-1.897 1.13L6 19l.657-2.603a4.5 4.5 0 011.13-1.897l9.075-9.013z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25l3 3" />
    </svg>
  );
}
