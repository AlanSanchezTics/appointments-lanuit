import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CitasCancelPage from "@/app/citas/cancelar/page";

describe("/citas/cancelar page", () => {
  it("renders the cancellation wizard first step", () => {
    render(<CitasCancelPage />);

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancelar cita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar cita" })).toBeInTheDocument();
  });
});
