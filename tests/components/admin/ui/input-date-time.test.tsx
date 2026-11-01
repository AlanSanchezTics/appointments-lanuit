import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/admin/ui/Input";

// Regresión iOS Safari: date/time necesitan min-w-0 y appearance:none para no salirse de la tarjeta.
describe("Input date/time containment", () => {
  it.each(["date", "time", "datetime-local"])("adds containment classes to type=%s", (type) => {
    render(<Input id={`f-${type}`} label="Campo" type={type} value="" onChange={() => {}} />);

    const input = screen.getByLabelText("Campo");
    expect(input).toHaveClass("min-w-0", "max-w-full", "appearance-none", "w-full", "box-border");
    expect(input.parentElement).toHaveClass("min-w-0");
  });

  it("does not add the containment classes to text inputs", () => {
    render(<Input id="f-text" label="Nombre" type="text" value="" onChange={() => {}} />);

    const input = screen.getByLabelText("Nombre");
    expect(input).not.toHaveClass("appearance-none");
    expect(input).not.toHaveClass("min-w-0");
    expect(input.parentElement).not.toHaveClass("min-w-0");
  });
});
