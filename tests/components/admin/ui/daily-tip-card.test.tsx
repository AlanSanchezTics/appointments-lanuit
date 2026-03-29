import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DailyTipCard } from "@/components/admin/ui/DailyTipCard";

describe("DailyTipCard", () => {
  it("renders title and tip content", () => {
    render(
      <DailyTipCard
        title="Tip del día"
        tip={{
          title: "Tip del día",
          content: "Confirma las citas de mañana antes de las 6:00 PM.",
          index: 1,
          total: 30,
        }}
      />,
    );

    expect(screen.getByText("Tip del día")).toBeInTheDocument();
    expect(
      screen.getByText("Confirma las citas de mañana antes de las 6:00 PM."),
    ).toBeInTheDocument();
  });
});

