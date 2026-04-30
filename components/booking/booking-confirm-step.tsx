"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faEdit } from "@fortawesome/free-regular-svg-icons";
import { useTranslation } from "react-i18next";

import type { BookingDraft } from "@/components/booking/booking-wizard";
import { Button } from "@/components/ui/public/button";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

import LockMessage from "./lock-message";

type BookingConfirmStepProps = {
  draft: BookingDraft;
  isNewClient: boolean;
  isNonLoyal: boolean;
  errorMessage: string | null;
  isPending: boolean;
  remainingSeconds: number;
  onBack: () => void;
  onConfirm: () => void;
};

export function BookingConfirmStep({
  draft,
  isNewClient,
  isNonLoyal,
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
          {t("booking.step3Of3")}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[1.4rem] font-bold leading-[1.05] tracking-[-0.03em]">
          {t(isNewClient ? "booking.welcomeNew" : "booking.welcomeBack", {
            name: draft.name.split(" ")[0],
          })}
        </h2>
      </header>

      <p className="text-sm font-medium text-[var(--muted)] mb-[0.5rem]">
        {t("booking.confirmTitle")}
      </p>
      <section className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)] mb-[1rem]">
        <dl className="space-y-5">
          <div>
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {t("booking.name")}
            </dt>
            <dd className="mt-1 text-[0.97rem] font-semibold text-[var(--foreground)]">
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

      <div className="mb-[2rem]">
        <LockMessage remainingSeconds={remainingSeconds} />
      </div>

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
          ) : isNonLoyal ? (
            <>
              <span>{t("booking.next")}</span>
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faCheckCircle} />
              <span className="ml-[8px]">
                {t("booking.confirmAppointment")}
              </span>
            </>
          )}
        </Button>

        <div className="flex justify-center">
          <button
            className="inline-flex items-center justify-center gap-2 text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={onBack}
            type="button"
          >
            <FontAwesomeIcon icon={faEdit} color="var(--muted)" />{" "}
            {t("booking.editInformation")}
          </button>
        </div>
      </div>
    </div>
  );
}
