import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewMonthModal } from "@/components/admin/months/NewMonthModal";

describe("NewMonthModal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows only future months for current year and allows multi-select save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        filters: {
          year: 2026,
          status: "ALL",
          availableYears: [2026, 2027],
        },
        metrics: {
          activeMonths: 1,
          inactiveMonths: 1,
          futureMonths: 2,
          pastMonths: 0,
          pastAppointments: 0,
          futureAppointments: 0,
        },
        months: [
          { month: "2026-04", status: "ACTIVE" },
          { month: "2026-05", status: "INACTIVE" },
        ],
        total: 2,
        currentMonth: "2026-03",
        currentDate: "2026-03-21",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <NewMonthModal
        isOpen
        availableYears={[2026, 2027]}
        currentMonth="2026-03"
        language="es"
        onClose={() => {}}
        onSave={onSave}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Abr." })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "May." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mar." })).not.toBeInTheDocument();

    const june = screen.getByRole("button", { name: "Jun." });
    const july = screen.getByRole("button", { name: "Jul." });
    const save = screen.getByRole("button", { name: "Guardar" });

    expect(save).toBeDisabled();

    fireEvent.click(june);
    fireEvent.click(july);

    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        year: 2026,
        months: ["2026-06", "2026-07"],
      });
    });
  });
});
