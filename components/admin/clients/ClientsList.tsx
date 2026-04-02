"use client";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { ListItem } from "@/components/admin/ui/ListItem";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import type { AdminClientCatalogItem } from "@/lib/admin/clients/types";

type ClientsListProps = {
  clients: AdminClientCatalogItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  labels: {
    title: string;
    total: string;
    empty: string;
    next: string;
    previous: string;
    page: string;
    futureBadge: string;
    appointmentsCount: (count: number) => string;
  };
  onOpenClient: (clientId: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
};

export function ClientsList({
  clients,
  total,
  page,
  totalPages,
  isLoading,
  labels,
  onOpenClient,
  onNextPage,
  onPrevPage,
}: ClientsListProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
          {labels.title}
        </h2>
        <span className="rounded-full bg-[rgba(228,159,83,0.2)] px-3 py-1 text-xs font-bold uppercase text-[var(--admin-accent)]">
          {labels.total}
        </span>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm text-[var(--admin-text-secondary)]">
          {labels.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ListItem
              key={client.clientId}
              icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-inactive-bg)]">
                  <AdminIcon
                    icon={adminIcons.clients}
                    tone="accent"
                    size="lg"
                  />
                </span>
              }
              title={client.name}
              subtitle={formatPhoneForDisplay(client.phone)}
              rightContent={
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--admin-inactive-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--admin-text-secondary)]">
                    {labels.appointmentsCount(client.totalAppointments)}
                  </span>
                  {client.hasFutureActiveAppointments ? (
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_18%,white)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--admin-accent)]">
                      {labels.futureBadge}
                    </span>
                  ) : null}
                  <AdminIcon icon={adminIcons.chevronRight} tone="secondary" />
                </div>
              }
              onClick={() => onOpenClient(client.clientId)}
              className="min-h-[58px] px-3 py-3"
            />
          ))}
        </div>
      )}

      {total > 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={isLoading || page <= 1}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--admin-text-primary)] disabled:opacity-50"
          >
            {labels.previous}
          </button>
          <span className="text-xs font-semibold text-[var(--admin-text-secondary)]">
            {labels.page}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={isLoading || page >= totalPages}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-[var(--admin-text-primary)] disabled:opacity-50"
          >
            {labels.next}
          </button>
        </div>
      ) : null}
    </section>
  );
}
