"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import { Button } from "@/components/admin/ui/Button";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { ListItem } from "@/components/admin/ui/ListItem";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { NewMonthModal } from "@/components/admin/months/NewMonthModal";
import { Select, type SelectOption } from "@/components/admin/ui/Select";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { useMonthsCatalog } from "@/hooks/admin/months/useMonthsCatalog";
import { createMonths } from "@/lib/admin/months/api-client";
import type {
  CreateAdminMonthsResponse,
  MonthsCatalogResponse,
  MonthsCatalogStatus,
} from "@/lib/admin/months/types";
import type { AppLanguage } from "@/lib/i18n/config";
import { formatMonthLabel } from "@/lib/datetime/mexico-city";

type MonthsCatalogViewProps = {
  initialData: MonthsCatalogResponse;
};

function resolveAppLanguage(language: string): AppLanguage {
  return language === "en" ? "en" : "es";
}

function getMonthItemIcon(
  month: string,
  status: MonthsCatalogStatus,
  currentMonth: string,
) {
  if (status === "ACTIVE") {
    return adminIcons.monthListCurrent;
  }

  if (month > currentMonth) {
    return adminIcons.monthListFuture;
  }

  if (month < currentMonth) {
    return adminIcons.monthListPast;
  }

  return adminIcons.monthListCurrent;
}

function getMonthItemTone(
  month: string,
  status: MonthsCatalogStatus,
  currentMonth: string,
) {
  if (status === "INACTIVE") {
    return "secondary" as const;
  }

  if (month < currentMonth) {
    return "secondary" as const;
  }

  return "accent" as const;
}

function resolveCreationErrorMessageKey(errorCode: string) {
  switch (errorCode) {
    case "MONTHS_YEAR_OUT_OF_RANGE":
      return "monthsCatalog.newModal.notifications.errors.yearOutOfRange";
    case "MONTHS_MONTH_NOT_FUTURE":
      return "monthsCatalog.newModal.notifications.errors.monthNotFuture";
    case "MONTHS_INVALID_FORMAT":
      return "monthsCatalog.newModal.notifications.errors.invalidFormat";
    case "MONTHS_EMPTY_SELECTION":
      return "monthsCatalog.newModal.notifications.errors.emptySelection";
    case "VALIDATION_ERROR":
      return "monthsCatalog.newModal.notifications.errors.validation";
    default:
      return "monthsCatalog.newModal.notifications.errors.unknown";
  }
}

export function MonthsCatalogView({ initialData }: MonthsCatalogViewProps) {
  const { t, i18n } = useTranslation("admin");
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? "es");
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState(false);
  const {
    data,
    isLoading,
    errorCode,
    year,
    status,
    availableYears,
    updateYear,
    updateStatus,
    retry,
    refreshCatalog,
    goToMonth,
  } = useMonthsCatalog({ initialData });

  const yearOptions = useMemo<SelectOption[]>(
    () =>
      availableYears.map((value) => ({
        label: String(value),
        value: String(value),
      })),
    [availableYears],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { label: t("monthsCatalog.filters.statusAll"), value: "ALL" },
      { label: t("monthsCatalog.filters.statusActive"), value: "ACTIVE" },
      { label: t("monthsCatalog.filters.statusInactive"), value: "INACTIVE" },
    ],
    [t],
  );

  const monthRows = data.months;

  async function handleCreateMonths(input: { year: number; months: string[] }) {
    const request = createMonths(input);
    await sileo.promise(request, {
      loading: {
        title: t("monthsCatalog.newModal.notifications.loadingTitle"),
        autopilot: false,
      },
      success: (result: CreateAdminMonthsResponse) => ({
        title:
          result.totalCreated > 0
            ? t("monthsCatalog.newModal.notifications.successTitle")
            : t("monthsCatalog.newModal.notifications.noChangesTitle"),
        description: t(
          "monthsCatalog.newModal.notifications.successDescription",
          {
            created: result.totalCreated,
            skipped: result.totalSkipped,
          },
        ),
        autopilot: result.totalSkipped + result.totalCreated > 0,
      }),
      error: (error: unknown) => {
        const errorCode =
          error instanceof Error ? error.message : "UNKNOWN_ERROR";
        return {
          title: t("monthsCatalog.newModal.notifications.errorTitle"),
          description: t(resolveCreationErrorMessageKey(errorCode)),
        };
      },
    });

    await refreshCatalog();
    setIsNewMonthModalOpen(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-[412px] flex-col gap-4 px-3 py-4">
      <section className="grid grid-cols-3 gap-3">
        <MetricCard
          icon={<AdminIcon icon={adminIcons.monthActive} />}
          label={t("monthsCatalog.metrics.activeMonths")}
          value={data.metrics.activeMonths}
          className="min-h-[112px] p-3"
        />
        <MetricCard
          icon={<AdminIcon icon={adminIcons.monthInactive} tone="secondary" />}
          label={t("monthsCatalog.metrics.inactiveMonths")}
          value={data.metrics.inactiveMonths}
          className="min-h-[112px] p-3"
        />
        <MetricCard
          icon={<AdminIcon icon={adminIcons.monthFuture} tone="secondary" />}
          label={t("monthsCatalog.metrics.futureMonths")}
          value={data.metrics.futureMonths}
          className="min-h-[112px] p-3"
        />
        <MetricCard
          icon={<AdminIcon icon={adminIcons.monthPast} tone="secondary" />}
          label={t("monthsCatalog.metrics.pastMonths")}
          value={data.metrics.pastMonths}
          className="min-h-[112px] p-3"
        />
        <MetricCard
          icon={<AdminIcon icon={adminIcons.pastAppointments} tone="primary" />}
          label={t("monthsCatalog.metrics.pastAppointments")}
          value={data.metrics.pastAppointments}
          className="min-h-[112px] p-3"
        />
        <MetricCard
          icon={<AdminIcon icon={adminIcons.futureAppointments} />}
          label={t("monthsCatalog.metrics.futureAppointments")}
          value={data.metrics.futureAppointments}
          className="min-h-[112px] p-3"
        />
      </section>

      <section className="rounded-xl bg-[var(--admin-inactive-bg)] p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="months-catalog-year"
              className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]"
            >
              {t("monthsCatalog.filters.year")}
            </label>
            <Select
              id="months-catalog-year"
              value={String(year)}
              options={yearOptions}
              onChange={(value) => updateYear(Number(value))}
              showPlaceholder={false}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="months-catalog-status"
              className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]"
            >
              {t("monthsCatalog.filters.status")}
            </label>
            <Select
              id="months-catalog-status"
              value={status}
              options={statusOptions}
              onChange={(value) => updateStatus(value as MonthsCatalogStatus)}
              showPlaceholder={false}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            fullWidth
            onClick={() => setIsNewMonthModalOpen(true)}
          >
            {t("monthsCatalog.cta.new")}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
            {t("monthsCatalog.list.title")}
          </h2>
          <span className="rounded-full bg-[rgba(228,159,83,0.2)] px-3 py-1 text-xs font-bold uppercase text-[var(--admin-accent)]">
            {t("monthsCatalog.list.total", { count: data.total })}
          </span>
        </div>

        {errorCode ? (
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <p className="text-sm font-medium text-[var(--admin-text-primary)]">
              {t("monthsCatalog.errors.loadFailed")}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
              {errorCode}
            </p>
            <div className="mt-3">
              <Button type="button" variant="secondary" onClick={retry}>
                {t("monthsCatalog.errors.retry")}
              </Button>
            </div>
          </div>
        ) : null}

        {!errorCode && monthRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm text-[var(--admin-text-secondary)]">
            {t("monthsCatalog.list.empty")}
          </div>
        ) : null}

        <div className="space-y-3">
          {monthRows.map((item) => (
            <ListItem
              key={item.month}
              icon={
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.status === "INACTIVE" ? "bg-[var(--admin-inactive-bg)]" : "bg-(--accent)"} `}
                >
                  <AdminIcon
                    icon={getMonthItemIcon(
                      item.month,
                      item.status,
                      data.currentMonth,
                    )}
                    tone={getMonthItemTone(
                      item.month,
                      item.status,
                      data.currentMonth,
                    )}
                    className={item.status !== "INACTIVE" ? "text-white!" : ""}
                  />
                </span>
              }
              title={formatMonthLabel(item.month, language)}
              onClick={() => goToMonth(item.month)}
              className={`${item.status === "INACTIVE" ? "opacity-70" : ""} min-h-[58px] px-3 py-3`}
              rightContent={
                <AdminIcon icon={adminIcons.chevronRight} tone="secondary" />
              }
            />
          ))}
        </div>
      </section>

      <NewMonthModal
        isOpen={isNewMonthModalOpen}
        availableYears={availableYears}
        currentMonth={data.currentMonth}
        language={language}
        onClose={() => setIsNewMonthModalOpen(false)}
        onSave={handleCreateMonths}
      />
    </main>
  );
}
