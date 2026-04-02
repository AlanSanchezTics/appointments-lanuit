"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ClientFiltersPanel } from "@/components/admin/clients/ClientFiltersPanel";
import { ClientsList } from "@/components/admin/clients/ClientsList";
import { ClientsMetricsGrid } from "@/components/admin/clients/ClientsMetricsGrid";
import { Button } from "@/components/admin/ui/Button";
import { useClientsCatalog } from "@/hooks/admin/clients/useClientsCatalog";
import type { AdminClientsCatalogResponse } from "@/lib/admin/clients/types";

type ClientsCatalogViewProps = {
  initialData: AdminClientsCatalogResponse;
};

export function ClientsCatalogView({ initialData }: ClientsCatalogViewProps) {
  const { t } = useTranslation("admin");
  const {
    data,
    filters,
    isLoading,
    errorCode,
    applyQuery,
    updateStatus,
    updateSort,
    goToPage,
    retry,
    goToClient,
  } = useClientsCatalog({ initialData });

  const listTotalLabel = useMemo(
    () => t("clients.catalog.list.total", { count: data.pagination.total }),
    [data.pagination.total, t],
  );

  return (
    <main className="mx-auto flex w-full max-w-[412px] flex-col gap-4 px-3 py-4">
      <ClientsMetricsGrid
        totalClients={data.metrics.totalClients}
        withFutureAppointments={data.metrics.withFutureAppointments}
        withoutFutureAppointments={data.metrics.withoutFutureAppointments}
        loyalClients={data.metrics.loyalClients}
        loyalClientsPercentage={data.metrics.loyalClientsPercentage}
        labels={{
          totalClients: t("clients.catalog.metrics.totalClients"),
          withFutureAppointments: t("clients.catalog.metrics.withFutureAppointments"),
          withoutFutureAppointments: t("clients.catalog.metrics.withoutFutureAppointments"),
          loyalClients: t("clients.catalog.metrics.loyalClients"),
          loyalClientsPercentage: t("clients.catalog.metrics.loyalClientsPercentage"),
        }}
      />

      <ClientFiltersPanel
        query={filters.query}
        status={filters.status}
        sort={filters.sort}
        isLoading={isLoading}
        onApplyQuery={applyQuery}
        onStatusChange={updateStatus}
        onSortChange={updateSort}
        labels={{
          queryLabel: t("clients.catalog.filters.queryLabel"),
          queryPlaceholder: t("clients.catalog.filters.queryPlaceholder"),
          statusLabel: t("clients.catalog.filters.statusLabel"),
          sortLabel: t("clients.catalog.filters.sortLabel"),
          statusOptions: {
            ALL: t("clients.catalog.filters.statusOptions.ALL"),
            WITH_FUTURE_APPOINTMENTS: t(
              "clients.catalog.filters.statusOptions.WITH_FUTURE_APPOINTMENTS",
            ),
            WITHOUT_FUTURE_APPOINTMENTS: t(
              "clients.catalog.filters.statusOptions.WITHOUT_FUTURE_APPOINTMENTS",
            ),
            LOYAL: t("clients.catalog.filters.statusOptions.LOYAL"),
          },
          sortOptions: {
            RECENT: t("clients.catalog.filters.sortOptions.RECENT"),
            NAME_ASC: t("clients.catalog.filters.sortOptions.NAME_ASC"),
            NAME_DESC: t("clients.catalog.filters.sortOptions.NAME_DESC"),
            APPOINTMENTS_DESC: t("clients.catalog.filters.sortOptions.APPOINTMENTS_DESC"),
          },
        }}
      />

      {errorCode ? (
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-sm font-medium text-[var(--admin-text-primary)]">
            {t("clients.catalog.errors.loadFailed")}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">{errorCode}</p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={retry}>
              {t("clients.catalog.errors.retry")}
            </Button>
          </div>
        </div>
      ) : null}

      <ClientsList
        clients={data.clients}
        total={data.pagination.total}
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        isLoading={isLoading}
        onOpenClient={goToClient}
        onPrevPage={() => goToPage(Math.max(1, data.pagination.page - 1))}
        onNextPage={() => goToPage(Math.min(data.pagination.totalPages, data.pagination.page + 1))}
        labels={{
          title: t("clients.catalog.list.title"),
          total: listTotalLabel,
          empty: t("clients.catalog.list.empty"),
          previous: t("clients.catalog.list.previous"),
          next: t("clients.catalog.list.next"),
          page: t("clients.catalog.list.page", {
            page: data.pagination.page,
            totalPages: data.pagination.totalPages,
          }),
          futureBadge: t("clients.catalog.list.futureBadge"),
          loyalBadge: t("clients.catalog.list.loyalBadge"),
          appointmentsCount: (count: number) =>
            t("clients.catalog.list.appointmentsCount", { count }),
        }}
      />
    </main>
  );
}
