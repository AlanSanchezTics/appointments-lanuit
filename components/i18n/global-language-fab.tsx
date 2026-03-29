"use client";

import { usePathname } from "next/navigation";

import { LanguageSelector } from "@/components/i18n/language-selector";

export function GlobalLanguageFab() {
  const pathname = usePathname();
  const isAdminShellRoute = pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (isAdminShellRoute) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <LanguageSelector />
    </div>
  );
}
