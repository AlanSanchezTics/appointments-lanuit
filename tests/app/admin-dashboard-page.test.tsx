import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ContentWrapper } from "@/components/admin/layout/ContentWrapper";
import { Card } from "@/components/admin/ui/Card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/admin/useAdminAuth", () => ({
  useAdminAuth: () => ({
    logout: vi.fn(),
  }),
}));

describe("admin dashboard page", () => {
  it("renders base admin layout and placeholders", () => {
    render(
      <AdminLayout>
        <ContentWrapper>
          <Card>
            <h2>Navegación</h2>
          </Card>
          <Card>
            <h2>Próximas secciones</h2>
          </Card>
        </ContentWrapper>
      </AdminLayout>,
    );

    expect(screen.getByText("Panel Administrativo")).toBeInTheDocument();
    expect(screen.getByText("Navegación")).toBeInTheDocument();
    expect(screen.getByText("Próximas secciones")).toBeInTheDocument();
  });
});
