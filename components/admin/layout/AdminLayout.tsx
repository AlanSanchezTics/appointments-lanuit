"use client";

import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { AppHeader } from "@/components/admin/layout/AppHeader";
import { useAdminShell } from "@/hooks/admin/layout/useAdminShell";

export function AdminLayout({ children }: { children: ReactNode }) {
  const {
    navigationItems,
    isDrawerOpen,
    isLoggingOut,
    sectionTitleKey,
    openDrawer,
    closeDrawer,
    handleLogout,
  } = useAdminShell();

  return (
    <div className="relative min-h-screen bg-[var(--admin-canvas)]">
      <AdminSidebar
        items={navigationItems}
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={closeDrawer}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />
      <div className="min-w-0 flex-1 lg:pl-[var(--admin-sidebar-width)]">
        <AppHeader sectionTitleKey={sectionTitleKey} onMenuClick={openDrawer} />
        <div className="pb-6">{children}</div>
      </div>
    </div>
  );
}
