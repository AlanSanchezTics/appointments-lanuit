"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/admin/ui/Button";
import { useAdminAuth } from "@/hooks/admin/useAdminAuth";

export function Header() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const { logout } = useAdminAuth();

  async function handleLogout() {
    await logout();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--admin-text-secondary)]">
          {t("header.panelLabel")}
        </p>
        <h1 className="text-lg font-bold text-[var(--admin-text-primary)]">
          {t("header.title")}
        </h1>
      </div>

      <Button type="button" variant="secondary" onClick={handleLogout}>
        {t("header.logout")}
      </Button>
    </header>
  );
}
