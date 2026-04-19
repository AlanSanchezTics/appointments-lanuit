import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthView } from "@/components/booking/month-view";

describe("month view", () => {
  it("renders the booking wizard shell", () => {
    render(
      <MonthView
        month="2026-03"
        days={[
          {
            date: "2026-03-04",
            slots: ["09:00", "13:00"],
          },
          {
            date: "2026-03-05",
            slots: ["10:00", "14:00"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Selecciona la fecha y hora de tu cita/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Siguiente$/i })).toBeInTheDocument();
  });
});
