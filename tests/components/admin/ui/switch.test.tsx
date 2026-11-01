import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "@/components/admin/ui/Switch";

describe("Switch", () => {
  it("toggles through its label and keeps the original structure without labelAdornment", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Switch id="sw" label="Activo" checked={false} onChange={onChange} />,
    );

    const label = screen.getByText("Activo");
    expect(label.tagName).toBe("LABEL");
    expect(label.parentElement).toBe(container.firstElementChild);

    fireEvent.click(label);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders labelAdornment next to the label without toggling when it is used", () => {
    const onChange = vi.fn();
    render(
      <Switch
        id="sw"
        label="Activo"
        checked={false}
        onChange={onChange}
        labelAdornment={<button type="button" aria-label="Ayuda">?</button>}
      />,
    );

    const help = screen.getByRole("button", { name: "Ayuda" });
    expect(help.closest("label")).toBeNull();

    fireEvent.click(help);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("switch", { name: "Activo" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
