"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
};

export function BookingSuccessStep({
  draft,
  success,
  onWhatsAppRedirect,
}: BookingSuccessStepProps) {
  const { i18n, t } = useTranslation("common");
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";

  function handleWhatsAppClick() {
    const cancelUrl = typeof window === "undefined" ? "/cancelar" : `${window.location.origin}/cancelar`;
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
    <div className="space-y-8 text-center">
      <div className="relative pt-2">
        <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
        <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-[rgba(228,159,83,0.08)]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(228,159,83,0.1)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--accent)] text-[var(--accent)]">
              <CheckIcon />
            </div>
          </div>
        </div>
      </div>

      <header className="space-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-[2.6rem] font-semibold leading-[1] tracking-[-0.045em]">
          {t("booking.successTitle")}
        </h1>
        <p className="text-[0.98rem] font-medium tracking-[-0.01em] text-[var(--muted)]">
          {t("booking.thanks")}
        </p>
      </header>

      <section className="rounded-[1.9rem] border border-[var(--border)] bg-white/80 px-5 py-5 text-left shadow-[var(--shadow-soft)]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
          <dt className="font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {t("booking.date")}
          </dt>
          <dd className="text-[0.98rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            {formatLongDate(draft.date ?? "", language)}
          </dd>
          <dt className="font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {t("booking.time")}
          </dt>
          <dd className="text-[0.98rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            {formatTimeSlotLabel(draft.timeSlot ?? "09:00", language)}
          </dd>
          <dt className="font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {t("booking.name")}
          </dt>
          <dd className="text-[0.98rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
            {draft.name}
          </dd>
        </dl>
      </section>

      {success.status === "SYNC_FAILED" ? (
        <p className="rounded-[1.4rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-left text-[0.84rem] font-medium tracking-[-0.01em] text-[var(--muted)]">
          {t("booking.syncFailedInfo")}
        </p>
      ) : null}

      <div className="space-y-4">
        <Button
          className="w-full py-4 text-[1.02rem] font-semibold"
          onClick={handleWhatsAppClick}
          type="button"
        >
          {t("booking.sendWhatsapp")}
        </Button>
        <Link
          className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
          href="/"
        >
          {t("booking.backHome")}
        </Link>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="26"
      viewBox="0 0 24 24"
      width="26"
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
