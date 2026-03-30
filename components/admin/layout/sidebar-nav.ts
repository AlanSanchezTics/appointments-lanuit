import type { IconProp } from "@fortawesome/fontawesome-svg-core";

import { adminIcons } from "@/components/admin/ui/admin-icons";

export type SidebarMatchMode = "exact" | "prefix";

export type SidebarNavItemId = "dashboard" | "months" | "clients";

export interface SidebarNavItem {
  id: SidebarNavItemId;
  labelKey: string;
  icon: IconProp;
  href?: string;
  disabled?: boolean;
  matchMode: SidebarMatchMode;
}

export const ADMIN_SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: "dashboard",
    labelKey: "sidebar.dashboard",
    icon: adminIcons.dashboard,
    href: "/admin",
    matchMode: "exact",
  },
  {
    id: "months",
    labelKey: "sidebar.months",
    icon: adminIcons.monthsManagement,
    href: "/admin/months",
    matchMode: "prefix",
  },
  {
    id: "clients",
    labelKey: "sidebar.clients",
    icon: adminIcons.clients,
    href: "/admin/clients",
    matchMode: "prefix",
  },
];
