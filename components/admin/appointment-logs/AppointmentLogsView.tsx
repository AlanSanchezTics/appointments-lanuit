"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { useAppointmentLogs } from "@/hooks/admin/appointment-logs/useAppointmentLogs";
import type { AdminAppointmentLogsResponse } from "@/lib/admin/appointment-logs/types";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import { formatAppointmentLogTableDateTime } from "@/lib/datetime/mexico-city";

type AppointmentLogsViewProps = {
  initialData: AdminAppointmentLogsResponse;
};

const ACTION_TYPE_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "REJECTED",
] as const;

export function AppointmentLogsView({ initialData }: AppointmentLogsViewProps) {
  const { t } = useTranslation("admin");
  const {
    data,
    filters,
    isLoading,
    errorCode,
    applyFilters,
    clearFilters,
    goToPage,
  } = useAppointmentLogs({ initialData });

  const [client, setClient] = useState(filters.client);
  const [actionType, setActionType] = useState(filters.actionType ?? "");
  const [month, setMonth] = useState(filters.month ?? "");
  const [actionDateFrom, setActionDateFrom] = useState(
    filters.actionDateFrom ?? "",
  );
  const [actionDateTo, setActionDateTo] = useState(filters.actionDateTo ?? "");

  useEffect(() => {
    setClient(data.filters.client);
    setActionType(data.filters.actionType ?? "");
    setMonth(data.filters.month ?? "");
    setActionDateFrom(data.filters.actionDateFrom ?? "");
    setActionDateTo(data.filters.actionDateTo ?? "");
  }, [data.filters]);

  const actionTypeOptions = useMemo(
    () =>
      ACTION_TYPE_OPTIONS.map((value) => ({
        value,
        label: t(`appointmentLogs.filters.actionTypeOptions.${value}`),
      })),
    [t],
  );

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              id="appointment-logs-client"
              type="text"
              label={t("appointmentLogs.filters.clientLabel")}
              value={client}
              onChange={(event) => setClient(event.target.value)}
              placeholder={t("appointmentLogs.filters.clientPlaceholder")}
              className="w-full"
            />
            <div className="min-w-0">
              <Select
                id="appointment-logs-action-type"
                label={t("appointmentLogs.filters.actionTypeLabel")}
                value={actionType}
                options={actionTypeOptions}
                onChange={setActionType}
                showPlaceholder
                placeholder={t("appointmentLogs.filters.actionTypePlaceholder")}
                className="h-[56px] px-6 pr-10"
              />
            </div>
            <Input
              id="appointment-logs-month"
              type="month"
              label={t("appointmentLogs.filters.monthLabel")}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full"
            />
            <Input
              id="appointment-logs-from"
              type="date"
              label={t("appointmentLogs.filters.actionDateFromLabel")}
              value={actionDateFrom}
              onChange={(event) => setActionDateFrom(event.target.value)}
              className="w-full"
            />
            <Input
              id="appointment-logs-to"
              type="date"
              label={t("appointmentLogs.filters.actionDateToLabel")}
              value={actionDateTo}
              onChange={(event) => setActionDateTo(event.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              fullWidth
              className="sm:w-auto"
              onClick={() =>
                applyFilters({
                  client,
                  actionType: actionType ? actionType : null,
                  month,
                  actionDateFrom,
                  actionDateTo,
                })
              }
            >
              <span className="mr-2 inline-flex">
                <AdminIcon icon={adminIcons.filter} className="text-white" />
              </span>
              {t("appointmentLogs.filters.apply")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              className="sm:w-auto"
              onClick={clearFilters}
            >
              {t("appointmentLogs.filters.clear")}
            </Button>
          </div>
        </div>
      </Card>

      {errorCode ? (
        <Card>
          <p className="text-sm font-medium text-[var(--admin-text-primary)]">
            {t("appointmentLogs.errors.loadFailed")}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
            {errorCode}
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[var(--admin-text-primary)]">
            {t("appointmentLogs.table.title")}
          </h2>
          <span className="text-xs font-medium text-[var(--admin-text-secondary)]">
            {t("appointmentLogs.table.total", {
              count: data.pagination.totalItems,
            })}
          </span>
        </div>

        <div className="mt-4 space-y-3 lg:hidden">
          {data.items.length === 0 ? (
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] px-4 py-10 text-center text-sm text-[var(--admin-text-secondary)]">
              {t("appointmentLogs.table.empty")}
            </div>
          ) : null}
          {data.items.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                    {t("appointmentLogs.table.headers.appointmentNumber")}
                  </p>
                  <p className="mt-1 text-base font-semibold text-[var(--admin-text-primary)]">
                    #{row.appointmentNumber}
                  </p>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold 
                    ${
                      row.actionType === "REJECTED"
                        ? "bg-[color-mix(in_srgb,var(--error)_18%,white)] text-[var(--error)]"
                        : row.actionType === "CANCELLED"
                          ? "bg-[color-mix(in_srgb,var(--error)_18%,white)] text-[var(--error)]"
                          : row.actionType === "PENDING"
                            ? "bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[var(--warning)]"
                            : "bg-[color-mix(in_srgb,var(--success)_18%,white)] text-[var(--success)]"
                    }`}
                >
                  {row.actionType === "REJECTED"
                    ? "🚫"
                    : row.actionType === "CANCELLED"
                      ? "❌"
                      : row.actionType === "PENDING"
                        ? "⏳"
                        : "✅"}
                  &nbsp;&nbsp;
                  {row.actionLabel}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                    {t("appointmentLogs.table.headers.client")}
                  </p>
                  <div className="mt-1 text-sm font-semibold text-[var(--admin-text-primary)]">
                    {row.client.name}
                  </div>
                  <div className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                    {row.client.clientNumber
                      ? `#${row.client.clientNumber} · `
                      : ""}
                    {row.client.alias ? `${row.client.alias} · ` : ""}
                    {formatPhoneForDisplay(row.client.phone)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                      {t("appointmentLogs.table.headers.appointmentDateTime")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--admin-text-primary)]">
                      {formatAppointmentLogTableDateTime(
                        row.appointmentDateTime,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                      {t("appointmentLogs.table.headers.actionDateTime")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--admin-text-primary)]">
                      {formatAppointmentLogTableDateTime(row.actionDateTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                      {t("appointmentLogs.table.headers.actor")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--admin-text-primary)]">
                      {row.actor.label}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                <th className="px-3 py-2 text-center">
                  {t("appointmentLogs.table.headers.appointmentNumber")}
                </th>
                <th className="px-3 py-2 text-left">
                  {t("appointmentLogs.table.headers.client")}
                </th>
                <th className="px-3 py-2 text-center">
                  {t("appointmentLogs.table.headers.action")}
                </th>
                <th className="px-3 py-2 text-center">
                  {t("appointmentLogs.table.headers.appointmentDateTime")}
                </th>
                <th className="px-3 py-2 text-center">
                  {t("appointmentLogs.table.headers.actionDateTime")}
                </th>
                <th className="px-3 py-2 text-center">
                  {t("appointmentLogs.table.headers.actor")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="rounded-xl bg-[var(--admin-inactive-bg)] px-3 py-10 text-center text-sm text-[var(--admin-text-secondary)]"
                  >
                    {t("appointmentLogs.table.empty")}
                  </td>
                </tr>
              ) : null}
              {data.items.map((row) => (
                <tr
                  key={row.id}
                  className="rounded-xl bg-[var(--admin-inactive-bg)] text-sm"
                >
                  <td className="px-3 py-3 text-center font-semibold text-[var(--admin-text-primary)]">
                    #{row.appointmentNumber}
                  </td>
                  <td className="px-3 py-3 text-[var(--admin-text-primary)]">
                    <div className="font-semibold">{row.client.name}</div>
                    <div className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                      {row.client.clientNumber
                        ? `#${row.client.clientNumber} · `
                        : ""}
                      {row.client.alias ? `${row.client.alias} · ` : ""}
                      {formatPhoneForDisplay(row.client.phone)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--admin-text-primary)]">
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-bold 
                    ${
                      row.actionType === "REJECTED"
                        ? "bg-[color-mix(in_srgb,var(--error)_18%,white)] text-[var(--error)]"
                        : row.actionType === "CANCELLED"
                          ? "bg-[color-mix(in_srgb,var(--error)_18%,white)] text-[var(--error)]"
                          : row.actionType === "PENDING"
                            ? "bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[var(--warning)]"
                            : "bg-[color-mix(in_srgb,var(--success)_18%,white)] text-[var(--success)]"
                    }`}
                    >
                      {row.actionType === "REJECTED"
                        ? "🚫"
                        : row.actionType === "CANCELLED"
                          ? "❌"
                          : row.actionType === "PENDING"
                            ? "⏳"
                            : "✅"}
                      &nbsp;&nbsp;
                      {row.actionLabel}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--admin-text-primary)]">
                    {formatAppointmentLogTableDateTime(row.appointmentDateTime)}
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--admin-text-primary)]">
                    {formatAppointmentLogTableDateTime(row.actionDateTime)}
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--admin-text-primary)]">
                    {row.actor.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--admin-text-secondary)]">
            {t("appointmentLogs.table.paginationSummary", {
              page: data.pagination.page,
              totalPages: data.pagination.totalPages,
              total: data.pagination.totalItems,
            })}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              className="sm:w-auto"
              disabled={isLoading || data.pagination.page <= 1}
              onClick={() => goToPage(Math.max(1, data.pagination.page - 1))}
            >
              {t("appointmentLogs.table.previous")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              className="sm:w-auto"
              disabled={
                isLoading || data.pagination.page >= data.pagination.totalPages
              }
              onClick={() =>
                goToPage(
                  Math.min(
                    data.pagination.totalPages,
                    data.pagination.page + 1,
                  ),
                )
              }
            >
              {t("appointmentLogs.table.next")}
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
