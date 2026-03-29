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
  appointments: CancelableAppointment[];
  selectedAppointmentIds: number[];
  cancelError: string | null;
  isCancelling: boolean;
  language: AppLanguage;
  onCancel: () => void;
  onReset: () => void;
  onToggleAppointmentSelection: (appointmentId: number) => void;
  t: TFunction;
};

export function CancelReviewStep({
  appointments,
  selectedAppointmentIds,
  cancelError,
  isCancelling,
  language,
  onCancel,
  onReset,
  onToggleAppointmentSelection,
  t,
}: CancelReviewStepProps) {
  const displayName = appointments[0]?.name ?? "";

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[var(--accent-dark)]">
          {t("cancel.step2Of3")}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[2.08rem] font-semibold leading-[1.02] tracking-[-0.04em] mb-1.25">
          {t("cancel.confirmTitle")}
        </h2>
        <div className="h-1 w-full rounded-full bg-[rgba(43,36,33,0.06)]">
          <div className="h-full w-2/3 rounded-full bg-[var(--accent)]" />
        </div>
      </header>

      <section className="space-y-4 rounded-[1.15rem] border border-[rgba(194,165,138,0.42)] bg-[rgba(243,229,214,0.55)] p-5">
        <p className="text-sm font-semibold text-[var(--accent-dark)]">
          {t("cancel.helloName", { name: displayName })}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {t("cancel.confirmDetailsSubtitle")}
        </p>
        <div className="space-y-3">
          {appointments.map((appointment) => {
            const isSelected = selectedAppointmentIds.includes(
              appointment.appointmentId,
            );

            return (
              <button
                key={appointment.appointmentId}
                className={`w-full rounded-[0.95rem] border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[rgba(228,159,83,0.16)] shadow-[0_0_0_1px_rgba(228,159,83,0.16)]"
                    : "border-[rgba(43,36,33,0.12)] bg-white/80"
                }`}
                onClick={() =>
                  onToggleAppointmentSelection(appointment.appointmentId)
                }
                type="button"
              >
                <div className="space-y-1">
                  <p className="text-[0.95rem] font-semibold leading-tight text-[var(--foreground)]">
                    {formatLongDate(appointment.date, language)}
                  </p>
                  <p className="text-[0.92rem] font-medium text-[var(--muted)]">
                    {formatTimeSlotLabel(appointment.timeSlot, language)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
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
