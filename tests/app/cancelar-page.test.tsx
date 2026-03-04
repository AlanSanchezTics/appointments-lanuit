import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CancelForm } from "@/components/cancel/cancel-form";

describe("cancel form", () => {
  it("renders the cancellation call to action", () => {
    render(<CancelForm />);

    expect(screen.getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();
  });
});
