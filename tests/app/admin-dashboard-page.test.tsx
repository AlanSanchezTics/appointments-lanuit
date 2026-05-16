import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ContentWrapper } from "@/components/admin/layout/ContentWrapper";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Card } from "@/components/admin/ui/Card";
import { ListItem } from "@/components/admin/ui/ListItem";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { PendingAppointmentsCard } from "@/components/admin/ui/PendingAppointmentsCard";
import { ReminderAppointmentsCard } from "@/components/admin/ui/ReminderAppointmentsCard";
import { RetouchReminderCard } from "@/components/admin/ui/RetouchReminderCard";
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

vi.mock("sileo", () => ({
  sileo: {
    promise: vi.fn(async (promise: Promise<unknown>) => promise),
  },
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
          <ReminderAppointmentsCard
            language="es"
            nextDayItems={[
              {
                appointmentId: 92,
                clientNumber: 2233,
                date: "2026-03-31",
                timeSlot: "10:00",
                name: "Brenda Ruiz",
                phone: "5511112222",
                reminderType: "NEXT_DAY",
              },
            ]}
            nextWeekItems={[]}
          />
          <RetouchReminderCard
            items={[
              {
                clientId: 77,
                clientNumber: 3311,
                name: "Nora Diaz",
                phone: "5510009999",
                lastAppointmentDate: "2026-03-09",
                candidateReason: "NO_CONFIRMED_IN_31_DAYS",
              },
            ]}
          />
          <PendingAppointmentsCard
            language="es"
            items={[
              {
                appointmentId: 91,
                clientNumber: 1234,
                date: "2026-03-31",
                timeSlot: "09:00",
                name: "Ana Garcia",
                phone: "5512345678",
              },
            ]}
          />
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
    expect(screen.getByText("Recordatorios")).toBeInTheDocument();
    expect(screen.getByText("Recordatorios de retoque")).toBeInTheDocument();
    expect(screen.getByText("Pendientes de confirmación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    const reminderTitle = screen.getByRole("heading", {
      level: 2,
      name: "Recordatorios",
    });
    const retouchTitle = screen.getByRole("heading", {
      level: 2,
      name: "Recordatorios de retoque",
    });
    expect(
      reminderTitle.compareDocumentPosition(retouchTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.querySelector('svg[data-icon="calendar-day"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="calendar-days"]')).toBeInTheDocument();
  });
});
