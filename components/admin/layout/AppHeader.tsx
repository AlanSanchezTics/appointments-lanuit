"use client";

import { useTranslation } from "react-i18next";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Modal } from "@/components/admin/ui/Modal";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import { useGlobalClientSearch } from "@/hooks/admin/layout/useGlobalClientSearch";

interface AppHeaderProps {
  sectionTitleKey: string;
  onMenuClick: () => void;
}

function resolveHeaderIcon(sectionTitleKey: string) {
  if (sectionTitleKey === "header.sectionTitle.dashboard") {
    return adminIcons.dashboard;
  }

  if (sectionTitleKey === "header.sectionTitle.months") {
    return adminIcons.monthsManagement;
  }

  if (sectionTitleKey === "header.sectionTitle.clients") {
    return adminIcons.clients;
  }

  return adminIcons.menu;
}

function getClientInitials(name: string) {
  const segments = name.trim().split(/\s+/).filter(Boolean);

  if (segments.length === 0) {
    return "CL";
  }

  const initials = segments
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

  return initials.length > 0 ? initials : "CL";
}

function GlobalClientSearchResult({
  client,
  onSelect,
  loyalBadgeLabel,
  resultAriaLabel,
}: {
  client: {
    clientId: number;
    name: string;
    phone: string;
    clientNumber: number;
    isLoyal: boolean;
  };
  onSelect: (clientId: number) => void;
  loyalBadgeLabel: string;
  resultAriaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(client.clientId)}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3 text-left transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
      aria-label={resultAriaLabel}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-primary)_18%,white)] text-sm font-bold text-[var(--admin-accent)]">
        {getClientInitials(client.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[var(--admin-text-primary)]">
          {client.name}
        </span>
        <span className="block truncate text-xs font-medium text-[var(--admin-text-secondary)]">
          #{client.clientNumber} · {formatPhoneForDisplay(client.phone)}
        </span>
      </span>
      {client.isLoyal ? (
        <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_18%,white)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--admin-accent)]">
          {loyalBadgeLabel}
        </span>
      ) : null}
      <AdminIcon icon={adminIcons.chevronRight} tone="secondary" />
    </button>
  );
}

export function AppHeader({ sectionTitleKey, onMenuClick }: AppHeaderProps) {
  const { t } = useTranslation("admin");
  const headerIcon = resolveHeaderIcon(sectionTitleKey);
  const {
    isModalOpen,
    query,
    results,
    errorCode,
    status,
    isDropdownOpen,
    handleOpenSearchModal,
    handleCloseSearchModal,
    handleQueryChange,
    handleClearSearch,
    handleSelectClient,
  } = useGlobalClientSearch();
  const searchInputId = "admin-global-client-search";
  const searchResultsId = "admin-global-client-search-results";
  const searchModalId = "admin-global-client-search-modal";
  const hasQuery = query.trim().length > 0;

  return (
    <header
      className="sticky top-0 z-[var(--admin-shell-z-header)] border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 lg:px-6"
      data-testid="admin-app-header"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)] transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] lg:hidden"
          aria-label={t("header.menu")}
        >
          <AdminIcon icon={adminIcons.menu} tone="secondary" />
        </button>
        <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_22%,white)] text-[var(--admin-accent)]">
          <AdminIcon icon={headerIcon} className="text-xs" />
        </div>
        <h1 className="text-[15px] font-bold text-[var(--admin-text-primary)]">
          {t(sectionTitleKey)}
        </h1>
        <button
          type="button"
          onClick={handleOpenSearchModal}
          aria-label={t("header.search.open")}
          aria-haspopup="dialog"
          aria-expanded={isModalOpen}
          aria-controls={searchModalId}
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm shadow-sm transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
        >
          <AdminIcon icon={faMagnifyingGlass} tone="secondary" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector variant="inline" />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        title={t("header.search.modalTitle")}
        closeLabel={t("header.search.modalClose")}
        onClose={handleCloseSearchModal}
      >
        <div id={searchModalId} className="relative">
          <label htmlFor={searchInputId} className="sr-only">
            {t("header.search.label")}
          </label>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] px-3 shadow-sm">
            <AdminIcon icon={faMagnifyingGlass} tone="secondary" />
            <input
              id={searchInputId}
              type="text"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={t("header.search.placeholder")}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              aria-controls={searchResultsId}
              aria-label={t("header.search.label")}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--admin-text-primary)] outline-none placeholder:text-[var(--admin-text-secondary)]"
            />
            {hasQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--admin-text-secondary)] transition hover:bg-[var(--admin-surface)] hover:text-[var(--admin-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
                aria-label={t("header.search.clear")}
              >
                <AdminIcon icon={adminIcons.close} tone="secondary" />
              </button>
            ) : null}
          </div>
        </div>
        {status === "loading" ? (
          <p
            className="px-3 py-3 text-sm font-medium text-[var(--admin-text-secondary)] text-center mt-2"
            role="status"
          >
            {t("header.search.loading")}
          </p>
        ) : null}
        {isDropdownOpen ? (
          <div id={searchResultsId} className="mt-4">
            {status === "error" ? (
              <p
                className="px-3 py-3 text-sm font-medium text-[var(--admin-text-secondary)] text-center mt-2"
                role="status"
              >
                {t("header.search.error")}
                {errorCode ? (
                  <span className="ml-2 text-xs text-[var(--admin-text-secondary)]">
                    {errorCode}
                  </span>
                ) : null}
              </p>
            ) : null}

            {status === "empty" ? (
              <p
                className="px-3 py-3 text-sm font-medium text-[var(--admin-text-secondary)] text-center mt-2"
                role="status"
              >
                {t("header.search.empty")}
              </p>
            ) : null}

            {status === "results" ? (
              <div
                className="space-y-2"
                role="listbox"
                aria-label={t("header.search.label")}
              >
                {results.map((client) => (
                  <GlobalClientSearchResult
                    key={client.clientId}
                    client={client}
                    onSelect={handleSelectClient}
                    loyalBadgeLabel={t("header.search.loyalBadge")}
                    resultAriaLabel={t("header.search.resultAriaLabel", {
                      name: client.name,
                    })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </header>
  );
}
