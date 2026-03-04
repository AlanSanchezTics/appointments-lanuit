import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthView } from "@/components/booking/month-view";

describe("month view", () => {
  it("renders booking prompts", () => {
    render(
      <MonthView
        month="2026-03"
        days={[
          {
            date: "2026-03-04",
            slots: ["09:00", "13:00"],
          },
        ]}
      />,
    );

    expect(screen.getByText("Selecciona tu horario")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument();
  });
});
