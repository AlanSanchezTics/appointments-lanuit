import type { TFunction } from "i18next";

import { Button } from "@/components/ui/public/button";
import { formatPhoneForDisplay } from "@/lib/cancel/formatters";
import type { CancelableAppointment } from "@/lib/cancel/types";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

type CancelReviewStepProps = {
  appointment: CancelableAppointment;
  cancelError: string | null;
  isCancelling: boolean;
  language: AppLanguage;
  onCancel: () => void;
  onReset: () => void;
  t: TFunction;
};

export function CancelReviewStep({
  appointment,
  cancelError,
  isCancelling,
  language,
  onCancel,
  onReset,
  t,
}: CancelReviewStepProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
          {t("cancel.step2Of3")}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em] mb-1.25">
          {t("cancel.confirmTitle")}
        </h2>
        <p className="text-[var(--muted)]">{t("cancel.confirmIntro")}</p>
        <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
          <div className="h-full w-2/3 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      <section className="rounded-[2rem] border border-[var(--border)] bg-white/80 p-6 shadow-[var(--shadow-soft)]">
        <dl className="space-y-5">
          <div>
            <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
              {t("cancel.name")}
            </dt>
            <dd className="mt-1 text-[1.02rem] font-semibold tracking-[-0.02em]">
              {appointment.name}
            </dd>
          </div>
          <div className="border-t border-[var(--border)] pt-5">
            <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
              {t("cancel.date")}
            </dt>
            <dd className="mt-1 text-[1.2rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
              {formatLongDate(appointment.date, language)}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-5">
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                {t("cancel.time")}
              </dt>
              <dd className="mt-1 text-[1.02rem] font-semibold tracking-[-0.02em]">
                {formatTimeSlotLabel(appointment.timeSlot, language)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">
                {t("cancel.phone")}
              </dt>
              <dd className="mt-1 text-[1.02rem] font-semibold tracking-[-0.02em]">
                {formatPhoneForDisplay(appointment.phone)}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      {cancelError ? (
        <p className="rounded-3xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)]">
          {cancelError}
        </p>
      ) : null}

      <div className="flex items-start gap-3 rounded-[0.9rem] bg-[rgba(229,226,223,0.45)] px-4 py-3 text-left">
        <p className="text-[0.78rem] font-medium leading-relaxed text-[var(--muted)]">
          <b>{t("cancel.important")}</b>
          <br />
          {t("cancel.importantBody")}
        </p>
      </div>

      <div className="space-y-4 flex flex-col items-center">
        <Button
          className="w-full py-4 text-[1.02rem] font-semibold"
          onClick={onCancel}
          disabled={isCancelling}
        >
          {isCancelling ? t("cancel.cancelling") : t("cancel.cancelButton")}
        </Button>
        <button
          type="button"
          className="inline-flex justify-center text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
          onClick={onReset}
        >
          {t("cancel.backLink")}
        </button>
      </div>
    </div>
  );
}
