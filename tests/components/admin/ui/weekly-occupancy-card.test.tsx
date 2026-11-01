import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklyOccupancyCard } from "@/components/admin/ui/WeeklyOccupancyCard";
import type { WeeklyOccupancySummary } from "@/lib/admin/dashboard/types";

// 2026-11-02 es lunes; la semana completa va de lunes a domingo (D57).
const weekDates = [
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
];

const days = weekDates.map((date, index) => ({
  date,
  occupiedSlots: index,
  capacity: 10,
  occupancyPercent: index * 10,
}));

const data = {
  days,
  busiestDay: days[6],
  currentWeekOccupancyPercent: 30,
  previousWeekOccupancyPercent: 20,
  deltaPercentPoints: 10,
} as WeeklyOccupancySummary;

describe("WeeklyOccupancyCard", () => {
  it("renders one column per day of the week, Monday to Sunday, in a 7-column grid", () => {
    render(
      <WeeklyOccupancyCard
        language="es"
        data={data}
        title="Ocupación semanal"
        versusLabel="Vs semana pasada"
        dayAppointmentsTooltip="{{count}} citas"
      />,
    );

    const bars = screen.getAllByRole("button");
    expect(bars).toHaveLength(7);

    const grid = bars[0].parentElement!.parentElement!;
    expect(grid).toHaveClass("grid-cols-7");
    expect(grid.children).toHaveLength(7);

    // La etiqueta del día es el último hijo de cada columna; el primer span está dentro del tooltip.
    const labels = Array.from(grid.children).map(
      (column) => column.lastElementChild?.textContent,
    );
    expect(labels).toEqual(["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]);
  });
});
