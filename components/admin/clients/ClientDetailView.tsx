"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import { EditClientModal } from "@/components/admin/clients/EditClientModal";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { useClientDetail } from "@/hooks/admin/clients/useClientDetail";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import { formatLongDate, formatTimeSlotLabel } from "@/lib/datetime/mexico-city";
import type { AdminClientDetailResponse } from "@/lib/admin/clients/types";
import type { AppLanguage } from "@/lib/i18n/config";

type ClientDetailViewProps = {
  clientId: number;
  initialData: AdminClientDetailResponse;
};

function resolveAppLanguage(language: string): AppLanguage {
  return language === "en" ? "en" : "es";
}

function resolveUpdateErrorKey(errorCode: string) {
  if (errorCode === "CLIENT_NOT_FOUND") {
    return "clients.detail.notifications.errors.notFound";
  }

  if (errorCode === "VALIDATION_ERROR" || errorCode === "CLIENT_NAME_TOO_SHORT") {
    return "clients.detail.notifications.errors.validation";
  }

  return "clients.detail.notifications.errors.unknown";
}

export function ClientDetailView({ clientId, initialData }: ClientDetailViewProps) {
  const { t, i18n } = useTranslation("admin");
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? "es");
  const { data, isLoading, isUpdating, errorCode, retry, updateName } = useClientDetail({
    clientId,
    initialData,
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const labels = useMemo(
    () => ({
      total: t("clients.detail.summary.totalAppointments"),
      active: t("clients.detail.summary.activeAppointments"),
      cancelled: t("clients.detail.summary.cancelledAppointments"),
      future: t("clients.detail.summary.futureAppointments"),
      timeline: t("clients.detail.timeline.title"),
      emptyTimeline: t("clients.detail.timeline.empty"),
      editCta: t("clients.detail.actions.edit"),
      back: t("clients.detail.actions.back"),
    }),
    [t],
  );

  async function handleUpdateName(name: string) {
    try {
      await sileo.promise(updateName(name), {
        loading: {
          title: t("clients.detail.notifications.updateLoading"),
        },
        success: {
          title: t("clients.detail.notifications.updateSuccess"),
        },
        error: (error: unknown) => {
          const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";

          return {
            title: t("clients.detail.notifications.updateError"),
            description: t(resolveUpdateErrorKey(code)),
          };
        },
      });

      setIsEditModalOpen(false);
    } catch {
      // handled by toast notification
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[412px] flex-col gap-4 px-3 py-4">
      <section className="flex items-center justify-between">
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--admin-accent)]"
        >
          <AdminIcon icon={adminIcons.back} tone="secondary" />
          {labels.back}
        </Link>
        <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(true)}>
          {labels.editCta}
        </Button>
      </section>

      <Card>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[var(--admin-text-primary)]">
            {data.client.name}
          </h1>
          <p className="text-sm font-medium text-[var(--admin-text-secondary)]">
            {formatPhoneForDisplay(data.client.phone)}
          </p>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3">
        <Card className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">{labels.total}</p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)]">{data.summary.totalAppointments}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">{labels.active}</p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)]">{data.summary.activeAppointments}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">{labels.cancelled}</p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)]">{data.summary.cancelledAppointments}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">{labels.future}</p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)]">{data.summary.futureActiveAppointments}</p>
        </Card>
      </section>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--admin-text-primary)]">{labels.timeline}</h2>

        {errorCode ? (
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
            <p className="text-sm font-medium text-[var(--admin-text-primary)]">
              {t("clients.detail.errors.loadFailed")}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">{errorCode}</p>
            <div className="mt-3">
              <Button type="button" variant="secondary" onClick={retry}>
                {t("clients.detail.errors.retry")}
              </Button>
            </div>
          </div>
        ) : null}

        {!errorCode && data.appointments.length === 0 ? (
          <p className="text-sm text-[var(--admin-text-secondary)]">{labels.emptyTimeline}</p>
        ) : null}

        {!errorCode && data.appointments.length > 0 ? (
          <div className="space-y-2">
            {data.appointments.map((appointment) => (
              <div
                key={appointment.appointmentId}
                className="rounded-xl border border-[var(--admin-border)] px-3 py-2"
              >
                <p className="text-sm font-semibold text-[var(--admin-text-primary)]">
                  {formatLongDate(appointment.date, language)}
                </p>
                <p className="text-xs text-[var(--admin-text-secondary)]">
                  {formatTimeSlotLabel(appointment.timeSlot, language)} · {appointment.status}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <EditClientModal
        isOpen={isEditModalOpen}
        isSubmitting={isUpdating || isLoading}
        initialName={data.client.name}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateName}
        labels={{
          title: t("clients.editModal.title"),
          close: t("clients.editModal.close"),
          nameLabel: t("clients.editModal.nameLabel"),
          namePlaceholder: t("clients.editModal.namePlaceholder"),
          save: t("clients.editModal.save"),
          saving: t("clients.editModal.saving"),
          cancel: t("clients.editModal.cancel"),
          nameTooShort: t("clients.editModal.errors.nameTooShort"),
        }}
      />
    </main>
  );
}
