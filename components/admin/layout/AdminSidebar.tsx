"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import type { SidebarNavItem } from "@/components/admin/layout/sidebar-nav";

type SidebarNavItemView = SidebarNavItem & { isActive: boolean };

interface AdminSidebarProps {
  items: SidebarNavItemView[];
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
}

function SidebarItem({ item }: { item: SidebarNavItemView }) {
  const { t } = useTranslation("admin");
  const baseClassName =
    "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]";
  const activeClassName =
    "bg-[color-mix(in_srgb,var(--admin-primary)_16%,white)] text-[var(--admin-primary)]";
  const idleClassName = "text-[var(--admin-text-primary)] hover:bg-[var(--admin-inactive-bg)]";

  if (item.disabled || !item.href) {
    return (
      <div
        aria-disabled
        className={`${baseClassName} cursor-not-allowed opacity-55`}
        data-testid={`sidebar-item-${item.id}`}
      >
        <AdminIcon icon={item.icon} tone="secondary" />
        <span>{t(item.labelKey)}</span>
        <span className="ml-auto rounded-full bg-[var(--admin-inactive-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--admin-text-secondary)]">
          {t("sidebar.comingSoon")}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${baseClassName} ${item.isActive ? activeClassName : idleClassName}`}
      aria-current={item.isActive ? "page" : undefined}
      data-testid={`sidebar-item-${item.id}`}
    >
      <AdminIcon icon={item.icon} tone={item.isActive ? "accent" : "secondary"} />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

function SidebarContent({
  items,
  onLogout,
  isLoggingOut,
  onCloseDrawer,
  showCloseButton,
}: {
  items: SidebarNavItemView[];
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
  onCloseDrawer?: () => void;
  showCloseButton?: boolean;
}) {
  const { t } = useTranslation("admin");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--admin-border)] px-4 py-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[var(--admin-accent)]">
              {t("sidebar.title")}
            </p>
            <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">
              {t("sidebar.subtitle")}
            </p>
          </div>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onCloseDrawer}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-text-secondary)] transition hover:bg-[var(--admin-inactive-bg)] hover:text-[var(--admin-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
              aria-label={t("sidebar.close")}
            >
              <AdminIcon icon={adminIcons.close} tone="secondary" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4" aria-label={t("sidebar.navAriaLabel")}>
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} />
        ))}
      </nav>

      <div className="border-t border-[var(--admin-border)] px-3 py-4">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-[#d24b4b] transition hover:bg-[rgba(210,75,75,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d24b4b] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="sidebar-logout-button"
        >
          <AdminIcon icon={adminIcons.logout} tone="secondary" />
          <span>{t("sidebar.logout")}</span>
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({
  items,
  isDrawerOpen,
  onCloseDrawer,
  onLogout,
  isLoggingOut,
}: AdminSidebarProps) {
  const [isDrawerMounted, setIsDrawerMounted] = useState(isDrawerOpen);
  const [isDrawerLeaving, setIsDrawerLeaving] = useState(false);

  useEffect(() => {
    if (isDrawerOpen) {
      setIsDrawerMounted(true);
      setIsDrawerLeaving(false);
      return;
    }

    if (!isDrawerMounted) {
      return;
    }

    setIsDrawerLeaving(true);

    const timeoutId = window.setTimeout(() => {
      setIsDrawerMounted(false);
      setIsDrawerLeaving(false);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [isDrawerMounted, isDrawerOpen]);

  return (
    <>
      <aside className="fixed left-0 top-0 hidden h-[100dvh] w-[var(--admin-sidebar-width)] border-r border-[var(--admin-border)] bg-[var(--admin-surface)] lg:block">
        <SidebarContent
          items={items}
          onLogout={onLogout}
          isLoggingOut={isLoggingOut}
        />
      </aside>

      {isDrawerMounted ? (
        <div
          className={`fixed inset-0 z-[var(--admin-shell-z-sidebar)] bg-black/30 lg:hidden ${isDrawerLeaving ? "admin-drawer-overlay-leave" : "admin-drawer-overlay-enter"}`}
          onClick={onCloseDrawer}
          data-testid="sidebar-mobile-overlay"
        >
          <aside
            className={`h-full w-[min(86vw,var(--admin-sidebar-width))] border-r border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl ${isDrawerLeaving ? "admin-drawer-panel-leave" : "admin-drawer-panel-enter"}`}
            onClick={(event) => event.stopPropagation()}
            data-testid="sidebar-mobile-drawer"
          >
            <SidebarContent
              items={items}
              onCloseDrawer={onCloseDrawer}
              showCloseButton
              onLogout={onLogout}
              isLoggingOut={isLoggingOut}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
