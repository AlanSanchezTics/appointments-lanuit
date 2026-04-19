"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar, faClock } from "@fortawesome/free-regular-svg-icons";
import {
  faBank,
  faCheck,
  faCopy,
  faCreditCard,
  faInfoCircle,
  faPhone,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { sileo, Toaster } from "sileo";

import type { BookingDraft } from "@/components/booking/booking-wizard";
import { Button } from "@/components/ui/public/button";
import { useClipboardCopyFeedback } from "@/hooks/booking/use-clipboard-copy-feedback";
import {
  formatAccountNumberForDisplay,
  formatPhoneForDisplay,
} from "@/lib/booking/formatters";
import {
  PAYMENTS_ACCOUNT_NAME,
  PAYMENTS_BANK,
  PAYMENTS_NUMBER_ACCOUNT,
} from "@/lib/constants/booking";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

type BookingPendingConfirmationStepProps = {
  draft: BookingDraft;
  onSendReceipt: () => void;
  onBack: () => void;
};

export function BookingPendingConfirmationStep({
  draft,
  onSendReceipt,
  onBack,
}: BookingPendingConfirmationStepProps) {
  const { i18n, t } = useTranslation("common");
  const language: AppLanguage = i18n.language.startsWith("en") ? "en" : "es";
  const handleCopiedToast = useCallback(() => {
    sileo.success({ title: t("booking.copiedText") });
  }, [t]);
  const accountNumberCopyFeedback = useClipboardCopyFeedback({
    onCopied: handleCopiedToast,
  });
  const accountNameCopyFeedback = useClipboardCopyFeedback({
    onCopied: handleCopiedToast,
  });
  const canRenderToaster =
    typeof window !== "undefined" && typeof window.matchMedia === "function";

  return (
    <div className="flex h-full flex-col space-y-7">
      {canRenderToaster ? <Toaster position="top-center" /> : null}
      <div className="flex flex-col items-center pt-1 text-center relative">
        <span className="absolute right-4 top-0 h-3.5 w-3.5 rounded-full bg-[rgba(222,195,121,0.9)]" />
        <span className="absolute left-10 top-18 h-5 w-5 rounded-full bg-[rgba(228,159,83,0.12)]" />
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(228,159,83,0.12)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-white bg-[var(--accent)]">
            <FontAwesomeIcon icon={faClock} size="2xl" />
          </div>
        </div>

        <h2 className="font-[family-name:var(--font-display)] text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
          {t("booking.pendingTitle")}
        </h2>
      </div>

      <section className="space-y-4">
        <p className="rounded-2xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)] mb-[1rem] text-center font-bold">
          {t("booking.pendingDescription")}
        </p>
        <p className="text-sm font-medium text-[var(--muted)] mb-[0.5rem]">
          {t("booking.paymentInfo")}
        </p>
        <div className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
          <dl className="space-y-4 text-sm mb-[1rem]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
                <FontAwesomeIcon
                  icon={faCreditCard}
                  color="var(--accent-dark)"
                />
              </span>
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.numberAccount")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatAccountNumberForDisplay(PAYMENTS_NUMBER_ACCOUNT)}
                </p>
              </div>
              <button
                className="cursor-pointer ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--accent-dark)] border border-[var(--border)] transition hover:bg-[rgba(228,159,83,0.16)]"
                disabled={accountNumberCopyFeedback.isCopied}
                onClick={() => {
                  void accountNumberCopyFeedback.copy(PAYMENTS_NUMBER_ACCOUNT);
                }}
                type="button"
              >
                <FontAwesomeIcon
                  className="transition-all duration-200"
                  color="var(--muted)"
                  icon={accountNumberCopyFeedback.isCopied ? faCheck : faCopy}
                />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
                <FontAwesomeIcon icon={faUser} color="var(--accent-dark)" />
              </span>
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.accountName")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {PAYMENTS_ACCOUNT_NAME}
                </p>
              </div>
              <button
                className="cursor-pointer ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--accent-dark)] border border-[var(--border)] transition hover:bg-[rgba(228,159,83,0.16)]"
                disabled={accountNameCopyFeedback.isCopied}
                onClick={() => {
                  void accountNameCopyFeedback.copy(PAYMENTS_ACCOUNT_NAME);
                }}
                type="button"
              >
                <FontAwesomeIcon
                  className="transition-all duration-200"
                  color="var(--muted)"
                  icon={accountNameCopyFeedback.isCopied ? faCheck : faCopy}
                />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
                <FontAwesomeIcon icon={faBank} color="var(--accent-dark)" />
              </span>
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.accountBank")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {PAYMENTS_BANK}
                </p>
              </div>
            </div>
          </dl>
          <p className="rounded-2xl border  border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-xs text-[var(--warning)] text-center font-bold">
            <FontAwesomeIcon icon={faInfoCircle} className="mr-0.5" />{" "}
            {t("booking.paymentConcept")}
          </p>
        </div>
        <p className="rounded-2xl border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-xs text-[var(--warning)] text-center font-bold">
          {t("booking.paymentImportant")}
          <br />
          <br />
          {t("booking.paymentAlert")}
        </p>
      </section>

      <div className="space-y-4">
        <Button
          className="w-full min-h-14 py-4 text-[1rem] font-bold mb-0"
          onClick={onSendReceipt}
          type="button"
        >
          {t("booking.pendingSendReceipt")}
        </Button>
      </div>

      <section className="space-y-4">
        <p className="text-sm font-medium text-[var(--muted)] mb-[0.5rem]">
          {t("booking.detailsOfYourAppointment")}
        </p>
        <div className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_8px_24px_rgba(99,93,90,0.08)]">
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
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
                <FontAwesomeIcon icon={faCalendar} color="var(--accent-dark)" />
              </span>
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.date")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatLongDate(draft.date ?? "", language)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
                <FontAwesomeIcon icon={faClock} color="var(--accent-dark)" />
              </span>
              <div>
                <p className="text-xs text-[var(--muted)]">
                  {t("booking.time")}
                </p>
                <p className="font-semibold text-[var(--foreground)]">
                  {formatTimeSlotLabel(draft.timeSlot ?? "09:00", language)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(228,159,83,0.16)] text-[var(--accent-dark)]">
                <FontAwesomeIcon icon={faPhone} color="var(--accent-dark)" />
              </span>
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
        </div>
      </section>

      <div className="space-y-4">
        <Button
          className="w-full min-h-14 py-4 text-[1rem] font-bold"
          onClick={onBack}
          type="button"
          variant="secondary"
        >
          {t("booking.pendingBack")}
        </Button>
      </div>
    </div>
  );
}
