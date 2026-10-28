import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MonthsCatalogView } from "@/components/admin/months/MonthsCatalogView";
import { useMonthsCatalog } from "@/hooks/admin/months/useMonthsCatalog";
import type { MonthsCatalogResponse } from "@/lib/admin/months/types";

vi.mock("@/hooks/admin/months/useMonthsCatalog", () => ({
  useMonthsCatalog: vi.fn(),
}));

vi.mock("@/components/admin/months/NewMonthModal", () => ({
  NewMonthModal: () => null,
}));

const initialData = {} as MonthsCatalogResponse;

const metrics = {
  activeMonths: 0,
  inactiveMonths: 0,
  futureMonths: 0,
  pastMonths: 0,
  pastAppointments: 0,
  futureAppointments: 0,
};

function hookResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { metrics, currentMonth: "2026-10", months: [], total: 0 },
    year: 2026,
    status: "ALL",
    availableYears: [2026, 2027],
    isLoading: false,
    isPending: false,
    isBusy: false,
    errorCode: null,
    showPast: false,
    visibleMonths: [
      { month: "2026-10", status: "ACTIVE" },
      { month: "2026-11", status: "INACTIVE" },
    ],
    hasHiddenPastMonths: true,
    updateYear: vi.fn(),
    updateStatus: vi.fn(),
    updateShowPast: vi.fn(),
    retry: vi.fn(),
    refreshCatalog: vi.fn(),
    goToMonth: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMonthsCatalog>;
}

function renderWith(overrides: Record<string, unknown>) {
  const result = hookResult(overrides);
  vi.mocked(useMonthsCatalog).mockReturnValue(result);
  render(<MonthsCatalogView initialData={initialData} />);
  return result;
}

describe("MonthsCatalogView filters", () => {
  it("disables year, status, switch and retry while a navigation or fetch is busy", () => {
    renderWith({ isBusy: true, errorCode: "UNKNOWN_ERROR" });

    for (const select of screen.getAllByRole("combobox")) {
      expect(select).toBeDisabled();
    }
    expect(screen.getByRole("switch", { name: "Mostrar meses anteriores" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
  });

  it("enables the controls when idle and forwards the switch change", () => {
    const result = renderWith({ isBusy: false });

    for (const select of screen.getAllByRole("combobox")) {
      expect(select).toBeEnabled();
    }
    const toggle = screen.getByRole("switch", { name: "Mostrar meses anteriores" });
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(result.updateShowPast).toHaveBeenCalledWith(true);
  });

  it("counts only the visible months in the badge", () => {
    renderWith({ visibleMonths: [{ month: "2026-10", status: "ACTIVE" }, { month: "2026-11", status: "INACTIVE" }] });

    expect(screen.getByText("2 Reg.")).toBeInTheDocument();
  });

  it("suggests showing past months when the filter hides everything but past months exist", () => {
    renderWith({ visibleMonths: [], hasHiddenPastMonths: true });

    expect(screen.getByText(/Mostrar meses anteriores/, { selector: "div" })).toBeInTheDocument();
    expect(screen.queryByText("No hay meses para los filtros seleccionados.")).not.toBeInTheDocument();
  });

  it("shows the general empty message when no past months are hidden", () => {
    renderWith({ visibleMonths: [], hasHiddenPastMonths: false });

    expect(screen.getByText("No hay meses para los filtros seleccionados.")).toBeInTheDocument();
  });
});
