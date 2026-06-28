import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentLogsView } from "@/components/admin/appointment-logs/AppointmentLogsView";
import { useAppointmentLogs } from "@/hooks/admin/appointment-logs/useAppointmentLogs";
import type { AdminAppointmentLogsResponse } from "@/lib/admin/appointment-logs/types";

vi.mock("@/hooks/admin/appointment-logs/useAppointmentLogs", () => ({
  useAppointmentLogs: vi.fn(),
}));

const useAppointmentLogsMock = vi.mocked(useAppointmentLogs);

const initialData: AdminAppointmentLogsResponse = {
  items: [
    {
      id: 1,
      appointmentNumber: 14,
      client: {
        name: "Ana Lopez",
        alias: "Mia",
        phone: "5512345678",
        clientNumber: 1200,
      },
      actionType: "CONFIRMED",
      actionLabel: "Cita confirmada",
      appointmentDateTime: "2026-08-14T18:00:00-06:00",
      actor: {
        type: "ADMIN",
        label: "Admin",
      },
      actionDateTime: "2026-08-14T18:30:00-06:00",
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
  filters: {
    client: "",
    actionType: null,
    month: "",
    actionDateFrom: null,
    actionDateTo: null,
  },
};

describe("AppointmentLogsView", () => {
  it("renders the client column label, puts actor last, and keeps the action filter aligned", () => {
    useAppointmentLogsMock.mockReturnValue({
      data: initialData,
      filters: {
        ...initialData.filters,
        page: 1,
        pageSize: 20,
        format: "json",
      },
      isLoading: false,
      errorCode: null,
      applyFilters: vi.fn(),
      clearFilters: vi.fn(),
      goToPage: vi.fn(),
    });

    const { container } = render(<AppointmentLogsView initialData={initialData} />);

    expect(screen.getAllByText("Admin")).toHaveLength(2);

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual([
      "No. de cita",
      "cliente",
      "Acción",
      "Fecha/Hora de cita",
      "Fecha/Hora de acción",
      "Actor",
    ]);
    expect(headers).toContain("cliente");

    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveClass("text-center");
    expect(cells[2]).toHaveClass("text-center");
    expect(cells[3]).toHaveClass("text-center");
    expect(cells[4]).toHaveClass("text-center");
    expect(cells[1]).not.toHaveClass("text-center");

    const mobileCards = container.querySelector(".lg\\:hidden");
    const desktopTable = container.querySelector(".hidden.lg\\:block");

    expect(mobileCards).not.toBeNull();
    expect(desktopTable).not.toBeNull();

    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select).toHaveClass("rounded-full");
    expect(select).toHaveClass("bg-white");
    expect(select).toHaveClass("h-[56px]");

    const monthInput = container.querySelector('input[type="month"]');
    expect(monthInput).not.toBeNull();

    expect(screen.queryByText("Exportar PDF")).toBeNull();

    expect(container.querySelectorAll(".space-y-4").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".flex.flex-col.gap-2.sm\\:flex-row").length).toBeGreaterThan(0);
  });
});
