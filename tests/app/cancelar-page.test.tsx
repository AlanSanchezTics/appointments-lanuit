import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CancelForm } from "@/components/cancel/cancel-form";

describe("cancel form", () => {
  it("renders the cancellation wizard first step", () => {
    render(<CancelForm />);

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancelar cita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar cita" })).toBeInTheDocument();
  });
});
