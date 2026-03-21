"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/public/button";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";

import type {
  BookingDraft,
  BookingSuccess,
} from "@/components/booking/booking-wizard";

type BookingSuccessStepProps = {
  draft: BookingDraft;
  success: BookingSuccess;
  onWhatsAppRedirect: (url: string) => void;
  onBack: () => void;
};

export function BookingSuccessStep({
  draft,
  success,
  onWhatsAppRedirect,
  onBack,
}: BookingSuccessStepProps) {
  const { i18n, t } = useTranslation("common");
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  function handleWhatsAppClick() {
    const cancelUrl =
      typeof window === "undefined"
        ? "/cancelar"
        : `${window.location.origin}/cancelar`;
    const message = t("whatsapp.messageTemplate", {
      name: success.whatsappData.name,
      date: formatLongDate(success.whatsappData.date, language),
      time: formatTimeSlotLabel(success.whatsappData.timeSlot, language),
      cancelUrl,
    });

    onWhatsAppRedirect(
      buildWhatsappUrlFromMessage({
        phone: success.whatsappPhone,
        message,
      }),
    );
  }

  return (
    <div className="flex h-full flex-col space-y-7">
      <div className="flex flex-col items-center pt-1 text-center relative">
        <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
        <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(228,159,83,0.12)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-white bg-[var(--accent)]">
            <CheckIcon />
          </div>
        </div>

        <h2 className="font-[family-name:var(--font-display)] text-[2rem] font-bold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
          {t("booking.confirmSuccessTitle", { name: draft.name.split(" ")[0] })}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {t("booking.confirmSuccessBody")}
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

      <div className="flex items-start gap-3 rounded-[0.9rem] bg-[rgba(229,226,223,0.45)] px-4 py-3 text-left">
        <MessageIcon />
        <p className="text-[0.78rem] font-medium leading-relaxed text-[var(--muted)]">
          {t("booking.whatsappReminder")}
        </p>
      </div>

      {success.status === "SYNC_FAILED" ? (
        <p className="rounded-[0.9rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm font-medium text-[var(--accent-dark)]">
          {t("booking.syncFailedInfo")}
        </p>
      ) : null}

      <div className="mt-auto space-y-4 pt-2">
        <Button
          className="w-full min-h-14 py-4 text-[1rem] font-bold"
          onClick={handleWhatsAppClick}
          type="button"
        >
          {t("booking.sendWhatsapp")}
        </Button>
        <Link
          className="inline-flex w-full items-center justify-center text-[0.9rem] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          href="#"
          onClick={onBack}
        >
          {t("booking.backHome")}
        </Link>
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="56"
      viewBox="0 0 24 24"
      width="56"
    >
      <path
        d="M6 12.75L10.25 17 18 8.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
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

function MessageIcon() {
  return (
    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-[var(--muted)]">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <path
          d="M7 18.5L4.5 20l.6-2.7A7.5 7.5 0 014 12.5C4 8.9 7.4 6 11.5 6S19 8.9 19 12.5 15.6 19 11.5 19c-1.6 0-3.1-.4-4.5-1.1z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path
          d="M8.8 12.5h5.4M8.8 9.9h7.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}
