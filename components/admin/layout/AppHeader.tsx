"use client";

import { useTranslation } from "react-i18next";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";

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

  return adminIcons.menu;
}

export function AppHeader({ sectionTitleKey, onMenuClick }: AppHeaderProps) {
  const { t } = useTranslation("admin");
  const headerIcon = resolveHeaderIcon(sectionTitleKey);

  return (
    <header
      className="sticky top-0 z-[var(--admin-shell-z-header)] flex h-[var(--admin-header-height)] items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 lg:px-6"
      data-testid="admin-app-header"
    >
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
    </header>
  );
}
