import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvailabilityParamsFields } from "@/components/admin/months/availability/AvailabilityParamsFields";

function renderFields(onChange = vi.fn()) {
  render(
    <AvailabilityParamsFields
      idPrefix="rule-1"
      minGapMinutes={240}
      preserveCapacity
      maxPerDay={3}
      disabled={false}
      onChange={onChange}
    />,
  );

  return onChange;
}

describe("AvailabilityParamsFields", () => {
  it("explains preserve capacity in a keyboard-reachable help tooltip", () => {
    renderFields();

    const help = screen.getByRole("button", { name: "Ayuda: conservar capacidad" });
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(
      "solo se ofrecen las horas que no le quitan lugar a otras citas",
    );

    fireEvent.focus(help);
    expect(screen.getByRole("tooltip")).toBeVisible();
  });

  it("still emits preserveCapacity changes from the switch", () => {
    const onChange = renderFields();

    fireEvent.click(screen.getByRole("switch", { name: "Conservar capacidad" }));
    expect(onChange).toHaveBeenCalledWith({ preserveCapacity: false });
  });
});
