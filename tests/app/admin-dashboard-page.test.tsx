import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ContentWrapper } from "@/components/admin/layout/ContentWrapper";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Card } from "@/components/admin/ui/Card";
import { ListItem } from "@/components/admin/ui/ListItem";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { adminIcons } from "@/components/admin/ui/admin-icons";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
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
  it("renders base admin layout and dashboard icon blocks", () => {
    render(
      <AdminLayout>
        <ContentWrapper>
          <section>
            <MetricCard
              icon={<AdminIcon icon={adminIcons.appointmentsToday} />}
              label="Citas hoy"
              value="--"
            />
          </section>
          <Card>
            <h2>Navegación</h2>
            <ListItem icon={<AdminIcon icon={adminIcons.monthsManagement} />} title="Gestión de meses" />
          </Card>
          <Card>
            <h2>Próximas secciones</h2>
          </Card>
        </ContentWrapper>
      </AdminLayout>,
    );

    expect(screen.getByTestId("admin-app-header")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-item-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-item-months")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-item-clients")).toBeInTheDocument();
    expect(screen.getByText("Navegación")).toBeInTheDocument();
    expect(screen.getByText("Próximas secciones")).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="calendar-day"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="calendar-days"]')).toBeInTheDocument();
  });
});
