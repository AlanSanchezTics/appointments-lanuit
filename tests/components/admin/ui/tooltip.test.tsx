import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "@/components/admin/ui/Tooltip";

function renderTooltip() {
  render(
    <Tooltip label="Ayuda de prueba">
      <span>Texto de ayuda</span>
    </Tooltip>,
  );

  return screen.getByRole("button", { name: "Ayuda de prueba" });
}

describe("Tooltip", () => {
  it("is described by its help text, which is hidden until opened", () => {
    const trigger = renderTooltip();
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    expect(tooltip).toHaveTextContent("Texto de ayuda");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).not.toBeVisible();
  });

  it("opens on keyboard focus and closes on blur or Escape", () => {
    const trigger = renderTooltip();

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeVisible();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on tap (click) for touch users", () => {
    const trigger = renderTooltip();

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Texto de ayuda");
  });
});
