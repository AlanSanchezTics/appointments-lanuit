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
import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
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

  if (
    errorCode === "VALIDATION_ERROR" ||
    errorCode === "CLIENT_NAME_TOO_SHORT" ||
    errorCode === "CLIENT_ALIAS_TOO_LONG" ||
    errorCode === "VALIDATION_PHONE_INVALID"
  ) {
    return "clients.detail.notifications.errors.validation";
  }

  if (errorCode === "CLIENT_PHONE_ALREADY_EXISTS") {
    return "clients.detail.notifications.errors.phoneAlreadyExists";
  }

  if (errorCode === "CLIENT_NUMBER_ALREADY_EXISTS") {
    return "clients.detail.notifications.errors.clientNumberAlreadyExists";
  }

  if (errorCode === "CLIENT_NUMBER_INVALID") {
    return "clients.detail.notifications.errors.clientNumberInvalid";
  }

  return "clients.detail.notifications.errors.unknown";
}

export function ClientDetailView({
  clientId,
  initialData,
}: ClientDetailViewProps) {
  const { t, i18n } = useTranslation("admin");
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? "es");
  const {
    data,
    isLoading,
    isUpdating,
    errorCode,
    retry,
    updateClientIdentity,
    updateLoyalty,
  } = useClientDetail({
    clientId,
    initialData,
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editServerErrorCode, setEditServerErrorCode] = useState<string | null>(
    null,
  );

  const labels = useMemo(
    () => ({
      total: t("clients.detail.summary.totalAppointments"),
      past: t("clients.detail.summary.pastAppointments"),
      future: t("clients.detail.summary.futureAppointments"),
      timeline: t("clients.detail.timeline.title"),
      emptyTimeline: t("clients.detail.timeline.empty"),
      editCta: t("clients.detail.actions.edit"),
      back: t("clients.detail.actions.back"),
      loyaltyTitle: t("clients.detail.loyalty.title"),
      loyaltyEnabled: t("clients.detail.loyalty.enabled"),
      loyaltyDisabled: t("clients.detail.loyalty.disabled"),
      loyaltyToggleLabel: t("clients.detail.loyalty.toggleLabel"),
      clientNumber: t("clients.detail.identity.clientNumber"),
      alias: t("clients.detail.identity.alias"),
    }),
    [t],
  );

  async function handleUpdateIdentity(payload: {
    name: string;
    alias: string | null;
    phone: string;
    clientNumber: number;
  }) {
    setEditServerErrorCode(null);

    try {
      await sileo.promise(updateClientIdentity(payload), {
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

      setEditServerErrorCode(null);
      setIsEditModalOpen(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";

      if (code === "CLIENT_NUMBER_ALREADY_EXISTS") {
        setEditServerErrorCode(code);
      }
    }
  }

  async function handleToggleLoyalty(nextIsLoyal: boolean) {
    try {
      await sileo.promise(updateLoyalty(nextIsLoyal), {
        loading: {
          title: t("clients.detail.notifications.loyaltyUpdateLoading"),
        },
        success: {
          title: t("clients.detail.notifications.loyaltyUpdateSuccess"),
        },
        error: (error: unknown) => {
          const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";

          return {
            title: t("clients.detail.notifications.loyaltyUpdateError"),
            description: t(resolveUpdateErrorKey(code)),
          };
        },
      });
    } catch {
      // handled by toast notification
    }
  }

  const appointmentsMetrics = useMemo(() => {
    const confirmedAppointments = data.appointments.filter(
      (appointment) => appointment.status === "CONFIRMED",
    );

    const pastAppointments = confirmedAppointments.filter(
      (appointment) => appointment.date < data.currentDate,
    ).length;
    const futureAppointments = confirmedAppointments.filter(
      (appointment) => appointment.date > data.currentDate,
    ).length;

    return {
      totalAppointments: confirmedAppointments.length,
      pastAppointments,
      futureAppointments,
    };
  }, [data.appointments, data.currentDate]);

  const timelineAppointments = useMemo(
    () =>
      data.appointments.filter(
        (appointment) =>
          appointment.status !== "PENDING" && appointment.status !== "REJECTED",
      ),
    [data.appointments],
  );

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
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditServerErrorCode(null);
            setIsEditModalOpen(true);
          }}
        >
          {labels.editCta}
        </Button>
      </section>

      <Card className="space-y-4 py-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--admin-inactive-bg)] mb-0.5">
          <AdminIcon icon={adminIcons.client} tone="accent" size="3x" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--admin-text-primary)] mb-0.5">
            {data.client.name}
          </h1>
          {data.client.alias ? (
            <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
              {data.client.alias}
            </p>
          ) : null}
          <p className="text-base font-medium text-[var(--admin-text-secondary)] inline-flex items-center">
            <span className="mr-1 inline-flex" aria-hidden>
              <AdminIcon icon={adminIcons.phone} tone="secondary" />
            </span>
            {formatPhoneForDisplay(data.client.phone)}
          </p>
          <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">
            {labels.clientNumber}: #{data.client.clientNumber}
          </p>
        </div>
      </Card>

      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AdminIcon icon={adminIcons.busiestDay} tone="accent" />
          <span className="text-base font-bold text-[var(--admin-text-primary)]">
            {labels.loyaltyTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleToggleLoyalty(!data.client.isLoyal)}
          disabled={isUpdating || isLoading}
          role="switch"
          aria-checked={data.client.isLoyal}
          aria-label={labels.loyaltyToggleLabel}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full border transition",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            data.client.isLoyal
              ? "border-[var(--admin-accent)] bg-[var(--admin-accent)]"
              : "border-[var(--admin-border)] bg-[var(--admin-inactive-bg)]",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition",
              data.client.isLoyal ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </Card>

      <section className="grid grid-cols-3 gap-3">
        <Card className="space-y-1">
          <div className="text-xl text-[var(--admin-accent)] text-center">
            <AdminIcon icon={adminIcons.appointmentsToday} tone="accent" />
          </div>
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)] text-center">
            {labels.total}
          </p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)] text-center">
            {appointmentsMetrics.totalAppointments}
          </p>
        </Card>
        <Card className="space-y-1">
          <div className="text-xl text-[var(--admin-accent)] text-center">
            <AdminIcon icon={adminIcons.pastAppointments} tone="accent" />
          </div>
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)] text-center">
            {labels.past}
          </p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)] text-center">
            {appointmentsMetrics.pastAppointments}
          </p>
        </Card>
        <Card className="space-y-1">
          <div className="text-xl text-[var(--admin-accent)] text-center">
            <AdminIcon icon={adminIcons.futureAppointments} tone="accent" />
          </div>
          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)] text-center">
            {labels.future}
          </p>
          <p className="text-lg font-bold text-[var(--admin-text-primary)] text-center">
            {appointmentsMetrics.futureAppointments}
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
            {labels.timeline}
          </h2>
        </div>

        {errorCode ? (
          <Card>
            <p className="text-sm font-medium text-[var(--admin-text-primary)]">
              {t("clients.detail.errors.loadFailed")}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
              {errorCode}
            </p>
            <div className="mt-3">
              <Button type="button" variant="secondary" onClick={retry}>
                {t("clients.detail.errors.retry")}
              </Button>
            </div>
          </Card>
        ) : null}

        {!errorCode && timelineAppointments.length === 0 ? (
          <Card className="border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] py-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-inactive-bg)]">
              <AdminIcon
                icon={adminIcons.syncFailed}
                tone="secondary"
                size="lg"
              />
            </div>
            <p className="text-base font-medium text-[var(--admin-text-secondary)]">
              {labels.emptyTimeline}
            </p>
          </Card>
        ) : null}

        {!errorCode && timelineAppointments.length > 0 ? (
          <div className="space-y-2">
            {timelineAppointments.map((appointment) => (
              <Card
                key={appointment.appointmentId}
                className={`flex items-center justify-between ${appointment.date < data.currentDate ? "opacity-50" : ""}`}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-text-primary)]">
                    {formatLongDate(appointment.date, language)}
                  </p>
                  <p className="text-xs text-[var(--admin-text-secondary)]">
                    {formatTimeSlotLabel(appointment.timeSlot, language)}
                  </p>
                </div>
                {appointment.status === "CANCELLED" ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--error)_18%,white)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--error)]">
                    {"Cancelada"}
                  </span>
                ) : null}
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      <EditClientModal
        isOpen={isEditModalOpen}
        isSubmitting={isUpdating || isLoading}
        initialName={data.client.name}
        initialAlias={data.client.alias ?? null}
        initialPhone={data.client.phone}
        initialClientNumber={data.client.clientNumber}
        serverErrorCode={editServerErrorCode}
        onClose={() => {
          setEditServerErrorCode(null);
          setIsEditModalOpen(false);
        }}
        onSubmit={handleUpdateIdentity}
        labels={{
          title: t("clients.editModal.title"),
          close: t("clients.editModal.close"),
          nameLabel: t("clients.editModal.nameLabel"),
          namePlaceholder: t("clients.editModal.namePlaceholder"),
          aliasLabel: t("clients.editModal.aliasLabel"),
          aliasPlaceholder: t("clients.editModal.aliasPlaceholder"),
          phoneLabel: t("clients.editModal.phoneLabel"),
          phonePlaceholder: t("clients.editModal.phonePlaceholder"),
          clientNumberLabel: t("clients.editModal.clientNumberLabel"),
          clientNumberPlaceholder: t(
            "clients.editModal.clientNumberPlaceholder",
          ),
          save: t("clients.editModal.save"),
          saving: t("clients.editModal.saving"),
          cancel: t("clients.editModal.cancel"),
          nameTooShort: t("clients.editModal.errors.nameTooShort"),
          aliasTooLong: t("clients.editModal.errors.aliasTooLong"),
          phoneInvalid: t("clients.editModal.errors.phoneInvalid"),
          clientNumberInvalid: t(
            "clients.editModal.errors.clientNumberInvalid",
          ),
          clientNumberAlreadyExists: t(
            "clients.editModal.errors.clientNumberAlreadyExists",
          ),
        }}
      />
    </main>
  );
}
