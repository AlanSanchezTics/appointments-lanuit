"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/admin/ui/Button";
import { Select, type SelectOption } from "@/components/admin/ui/Select";
import type {
  AdminClientCatalogSort,
  AdminClientCatalogStatus,
} from "@/lib/admin/clients/types";

type ClientFiltersPanelProps = {
  query: string;
  status: AdminClientCatalogStatus;
  sort: AdminClientCatalogSort;
  isLoading: boolean;
  labels: {
    queryLabel: string;
    queryPlaceholder: string;
    statusLabel: string;
    sortLabel: string;
    apply: string;
    statusOptions: Record<AdminClientCatalogStatus, string>;
    sortOptions: Record<AdminClientCatalogSort, string>;
  };
  onApplyQuery: (query: string) => void;
  onStatusChange: (status: AdminClientCatalogStatus) => void;
  onSortChange: (sort: AdminClientCatalogSort) => void;
};

export function ClientFiltersPanel({
  query,
  status,
  sort,
  isLoading,
  labels,
  onApplyQuery,
  onStatusChange,
  onSortChange,
}: ClientFiltersPanelProps) {
  const [draftQuery, setDraftQuery] = useState(query);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  const statusOptions: SelectOption[] = [
    { value: "ALL", label: labels.statusOptions.ALL },
    {
      value: "WITH_FUTURE_APPOINTMENTS",
      label: labels.statusOptions.WITH_FUTURE_APPOINTMENTS,
    },
    {
      value: "WITHOUT_FUTURE_APPOINTMENTS",
      label: labels.statusOptions.WITHOUT_FUTURE_APPOINTMENTS,
    },
  ];

  const sortOptions: SelectOption[] = [
    { value: "RECENT", label: labels.sortOptions.RECENT },
    { value: "NAME_ASC", label: labels.sortOptions.NAME_ASC },
    { value: "NAME_DESC", label: labels.sortOptions.NAME_DESC },
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyQuery(draftQuery);
  }

  return (
    <section className="rounded-xl bg-[var(--admin-inactive-bg)] p-4">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label
            htmlFor="clients-catalog-search"
            className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]"
          >
            {labels.queryLabel}
          </label>
          <input
            id="clients-catalog-search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={labels.queryPlaceholder}
            className="h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)] outline-none transition focus:border-[var(--admin-accent)]"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="clients-catalog-status"
              className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]"
            >
              {labels.statusLabel}
            </label>
            <Select
              id="clients-catalog-status"
              value={status}
              options={statusOptions}
              onChange={(value) => onStatusChange(value as AdminClientCatalogStatus)}
              showPlaceholder={false}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="clients-catalog-sort"
              className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]"
            >
              {labels.sortLabel}
            </label>
            <Select
              id="clients-catalog-sort"
              value={sort}
              options={sortOptions}
              onChange={(value) => onSortChange(value as AdminClientCatalogSort)}
              showPlaceholder={false}
              disabled={isLoading}
            />
          </div>
        </div>

        <Button type="submit" fullWidth disabled={isLoading}>
          {labels.apply}
        </Button>
      </form>
    </section>
  );
}
