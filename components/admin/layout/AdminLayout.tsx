import type { ReactNode } from "react";

import { Header } from "@/components/admin/layout/Header";

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--admin-canvas)]">
      <Header />
      {children}
    </div>
  );
}
