"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";

import { AdminIcon } from "./AdminIcon";
import { Button } from "./Button";
import { adminIcons } from "./admin-icons";

type PendingTransition = {
  appointmentId: number;
  action: "confirm" | "reject";
};

type PendingAppointmentsCardProps = {
  language: AppLanguage;
  items: AdminPendingAppointmentItem[];
};

function resolveTransitionErrorKey(rawCode: string) {
  if (rawCode === "APPOINTMENT_NOT_FOUND") {
    return "dashboard.pendingAppointments.notifications.errors.notFound";
  }

  if (rawCode === "APPOINTMENT_STATUS_INVALID_TRANSITION") {
    return "dashboard.pendingAppointments.notifications.errors.invalidTransition";
  }

  return "dashboard.pendingAppointments.notifications.errors.unknown";
}

async function submitPendingTransition(
  appointmentId: number,
  action: PendingTransition["action"],
) {
  const response = await fetch(
    `/api/admin/appointments/${appointmentId}/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    appointmentId?: number;
    status?: "CONFIRMED" | "REJECTED";
    errorCode?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.errorCode ?? payload.error ?? "UNKNOWN_ERROR");
  }

  return {
    appointmentId: payload.appointmentId ?? appointmentId,
    status: payload.status ?? (action === "confirm" ? "CONFIRMED" : "REJECTED"),
  };
}

export function PendingAppointmentsCard({
  language,
  items,
}: PendingAppointmentsCardProps) {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const [pendingTransition, setPendingTransition] =
    useState<PendingTransition | null>(null);

  const subtitle = useMemo(
    () =>
      t("dashboard.pendingAppointments.count", {
        count: items.length,
      }),
    [items.length, t],
  );

  async function handleTransition(
    appointmentId: number,
    action: PendingTransition["action"],
  ) {
    const transition = { appointmentId, action } as const;
    setPendingTransition(transition);

    try {
      await sileo.promise(submitPendingTransition(appointmentId, action), {
        loading: {
          title:
            action === "confirm"
              ? t("dashboard.pendingAppointments.notifications.confirmLoading")
              : t("dashboard.pendingAppointments.notifications.rejectLoading"),
        },
        success: {
          title:
            action === "confirm"
              ? t("dashboard.pendingAppointments.notifications.confirmSuccess")
              : t("dashboard.pendingAppointments.notifications.rejectSuccess"),
        },
        error: (error: unknown) => {
          const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";

          return {
            title: t("dashboard.pendingAppointments.notifications.errorTitle"),
            description: t(resolveTransitionErrorKey(code)),
          };
        },
      });

      router.refresh();
    } catch {
      // handled by toast notification
    } finally {
      setPendingTransition(null);
    }
  }

  const isBusy = pendingTransition !== null;

  return (
    <div className="space-y-4 mb-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[1rem] font-bold leading-[1.08] text-[var(--admin-text-primary)]">
              {t("dashboard.pendingAppointments.title")}
            </h2>
          </div>
          <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
            {subtitle}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl bg-[var(--admin-inactive-bg)] px-4 py-4 text-sm text-[var(--admin-text-secondary)]">
          {t("dashboard.pendingAppointments.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const formattedDate = formatLongDate(item.date, language);
            const formattedTime = formatTimeSlotLabel(item.timeSlot, language);

            return (
              <article
                key={item.appointmentId}
                className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--admin-inactive-bg)] text-[var(--admin-accent)]">
                      <AdminIcon icon={adminIcons.pending} size="sm" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-[14px] font-bold leading-[1.08] text-[var(--admin-text-primary)]">
                        {item.name}
                      </p>
                      <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
                        {`#${item.clientNumber}`}
                        {"・"}
                        {formatPhoneForDisplay(item.phone)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 lg:text-right">
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[var(--admin-text-secondary)]">
                      {t("dashboard.pendingAppointments.labels.dateTime")}
                    </p>
                    <p className="text-sm font-semibold text-[var(--admin-text-primary)]">
                      {formattedDate}
                    </p>
                    <p className="text-sm font-medium text-[var(--admin-text-secondary)]">
                      {formattedTime}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    disabled={isBusy}
                    onClick={() =>
                      void handleTransition(item.appointmentId, "confirm")
                    }
                  >
                    {t("dashboard.pendingAppointments.actions.confirm")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    disabled={isBusy}
                    onClick={() =>
                      void handleTransition(item.appointmentId, "reject")
                    }
                  >
                    {t("dashboard.pendingAppointments.actions.reject")}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
