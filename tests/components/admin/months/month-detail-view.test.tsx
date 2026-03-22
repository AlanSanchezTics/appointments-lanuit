import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthDetailView } from "@/components/admin/months/MonthDetailView";

describe("MonthDetailView", () => {
  it("renders month metrics, saturation and calendar section", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          currentMonth: "2026-03",
          currentDate: "2026-03-21",
          isPastMonth: false,
          projectedSaturationPercent: 85,
          metrics: {
            confirmedAppointments: 8,
            cancelledAppointments: 1,
            availableSpaces: 54,
            blockedSpaces: 0,
            occupiedSpaces: 8,
          },
          calendarDays: [
            {
              date: "2026-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              tone: "available",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Marzo de 2026")).toBeInTheDocument();
    expect(screen.getByText("Confirmadas")).toBeInTheDocument();
    expect(screen.getByText("Canceladas")).toBeInTheDocument();
    expect(screen.getByText("Disponibles")).toBeInTheDocument();
    expect(screen.getByText("Bloqueados")).toBeInTheDocument();
    expect(screen.getByText("Saturación proyectada")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Vista mensual")).toBeInTheDocument();
  });
});
