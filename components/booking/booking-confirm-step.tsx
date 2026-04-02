"use client";

import { Button } from "@/components/ui/public/button";
import { useTranslation } from "react-i18next";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import {
  formatPhoneForDisplay,
  formatRemainingTime,
} from "@/lib/booking/formatters";
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

type BookingPendingConfirmationStepProps = {
  draft: BookingDraft;
  onSendReceipt: () => void;
  onBack: () => void;
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
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          {t("booking.step2Of2")}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[2rem] font-bold leading-[1.05] tracking-[-0.03em]">
          {t("booking.welcomeBack", { name: draft.name.split(" ")[0] })}
        </h2>
      </header>

      <p className="text-sm font-medium text-[var(--muted)] mb-[0.5rem]">
        {t("booking.confirmTitle")}
      </p>
      <section className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
        <dl className="space-y-5">
          <div>
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {t("booking.name")}
            </dt>
            <dd className="mt-1 text-[1.24rem] font-semibold text-[var(--foreground)]">
              {draft.name}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("booking.date")}
              </dt>
              <dd className="mt-1 text-[0.97rem] font-semibold leading-tight text-[var(--foreground)]">
                {formatLongDate(draft.date ?? "", language)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("booking.time")}
              </dt>
              <dd className="mt-1 text-[0.97rem] font-semibold text-[var(--foreground)]">
                {formatTimeSlotLabel(draft.timeSlot ?? "09:00", language)}
              </dd>
            </div>
          </div>

          <div>
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {t("booking.phone")}
            </dt>
            <dd className="mt-1 text-[0.97rem] font-semibold text-[var(--foreground)]">
              {formatPhoneForDisplay(draft.phone)}
            </dd>
          </div>
        </dl>
      </section>

      <p className="flex items-center gap-2 rounded-[0.9rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm font-medium text-[var(--accent-dark)]">
        <ClockIcon />
        {t("booking.slotLockedForYou", {
          time: formatRemainingTime(remainingSeconds),
        })}
      </p>

      {errorMessage ? (
        <p className="rounded-[0.9rem] border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-4">
        <Button
          className="w-full min-h-14 py-4 text-[1rem] font-bold"
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {isPending ? (
            t("booking.wait")
          ) : (
            <>
              <span className="mr-[8px]">
                {t("booking.confirmAppointment")}
              </span>
              <CheckCircleIcon />
            </>
          )}
        </Button>

        <div className="flex justify-center">
          <Link
            className="inline-flex items-center justify-center gap-2 text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={onBack}
            href="#"
          >
            <PencilIcon /> {t("booking.editInformation")}
          </Link>
        </div>

        <div className="flex items-start gap-3 rounded-[0.9rem] bg-[rgba(229,226,223,0.45)] px-4 py-3 text-left">
          <InfoIcon />
          <p className="text-[0.78rem] font-medium leading-relaxed text-[var(--muted)]">
            {t("booking.whatsappReminder")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BookingPendingConfirmationStep({
  draft,
  onSendReceipt,
  onBack,
}: BookingPendingConfirmationStepProps) {
  const { i18n, t } = useTranslation("common");
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  return (
    <div className="flex h-full flex-col space-y-7">
      <div className="flex flex-col items-center pt-1 text-center relative">
        <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
        <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(228,159,83,0.12)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-white bg-[var(--accent)]">
            <BigClockIcon />
          </div>
        </div>

        <h2 className="font-[family-name:var(--font-display)] text-[2rem] font-bold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
          {t("booking.pendingTitle")}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">
          {t("booking.pendingDescription")}
        </p>
      </div>

      <section className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
        <dl className="space-y-4 text-sm">
          <div className="border-b border-[var(--border)] pb-3 mb-5">
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {t("booking.name")}
            </dt>
            <dd className="mt-1 text-base font-semibold text-[var(--foreground)]">
              {draft.name}
            </dd>
          </div>
          <div className="flex items-start gap-3">
            <CalendarIcon />
            <div>
              <p className="text-xs text-[var(--muted)]">{t("booking.date")}</p>
              <p className="font-semibold text-[var(--foreground)]">
                {formatLongDate(draft.date ?? "", language)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ClockIcon />
            <div>
              <p className="text-xs text-[var(--muted)]">{t("booking.time")}</p>
              <p className="font-semibold text-[var(--foreground)]">
                {formatTimeSlotLabel(draft.timeSlot ?? "09:00", language)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <PhoneIcon />
            <div>
              <p className="text-xs text-[var(--muted)]">
                {t("booking.phone")}
              </p>
              <p className="font-semibold text-[var(--foreground)]">
                {formatPhoneForDisplay(draft.phone)}
              </p>
            </div>
          </div>
        </dl>
      </section>

      <div className="mt-auto space-y-4 pt-2">
        <Button
          className="w-full min-h-14 py-4 text-[1rem] font-bold"
          onClick={onSendReceipt}
          type="button"
        >
          {t("booking.pendingSendReceipt")}
        </Button>
        <Button
          className="w-full min-h-14 py-4 text-[1rem] font-bold"
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          {t("booking.pendingBack")}
        </Button>
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 20 20"
        width="18"
      >
        <rect
          height="13"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.6"
          width="14"
          x="3"
          y="4"
        />
        <path
          d="M6.5 2.75V5.5M13.5 2.75V5.5M3 8.5H17"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}

function PhoneIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <path
          d="M6.2 3.5h2.5l1.2 4-1.8 1.8a14.5 14.5 0 006.7 6.7l1.8-1.8 4 1.2v2.5a2 2 0 01-2.2 2A16.9 16.9 0 013.5 5.7a2 2 0 012-2.2z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M16.862 4.487l1.688-1.688a2.25 2.25 0 113.182 3.182L10.5 17.213a4.5 4.5 0 01-1.897 1.13L6 19l.657-2.603a4.5 4.5 0 011.13-1.897l9.075-9.013z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M15.75 5.25l3 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 8v4l2.75 1.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function BigClockIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="48"
      viewBox="0 0 24 24"
      width="48"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4l2.75 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 11.3v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="8.2" fill="currentColor" r="1" />
    </svg>
  );
}
