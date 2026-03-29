"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  ADMIN_SIDEBAR_NAV_ITEMS,
  type SidebarNavItem,
} from "@/components/admin/layout/sidebar-nav";
import { useAdminAuth } from "@/hooks/admin/useAdminAuth";

function isRouteActive(item: SidebarNavItem, pathname: string) {
  if (!item.href) {
    return false;
  }

  if (item.matchMode === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function resolveSectionTitleKey(pathname: string) {
  if (pathname === "/admin") {
    return "header.sectionTitle.dashboard";
  }

  if (pathname === "/admin/months" || pathname.startsWith("/admin/months/")) {
    return "header.sectionTitle.months";
  }

  return "header.sectionTitle.default";
}

export function useAdminShell() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigationItems = useMemo(
    () =>
      ADMIN_SIDEBAR_NAV_ITEMS.map((item) => ({
        ...item,
        isActive: isRouteActive(item, pathname),
      })),
    [pathname],
  );

  const sectionTitleKey = useMemo(
    () => resolveSectionTitleKey(pathname),
    [pathname],
  );

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
      closeDrawer();
      router.push("/admin/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }, [closeDrawer, isLoggingOut, logout, router]);

  return {
    isDrawerOpen,
    isLoggingOut,
    navigationItems,
    sectionTitleKey,
    openDrawer,
    closeDrawer,
    handleLogout,
  };
}
