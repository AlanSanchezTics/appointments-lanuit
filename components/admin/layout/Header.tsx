"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { useAdminAuth } from "@/hooks/admin/useAdminAuth";

export function Header() {
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
          Panel Administrativo
        </p>
        <h1 className="text-lg font-bold text-[var(--admin-text-primary)]">La Nuit</h1>
      </div>

      <Button type="button" variant="secondary" onClick={handleLogout}>
        Cerrar sesión
      </Button>
    </header>
  );
}
