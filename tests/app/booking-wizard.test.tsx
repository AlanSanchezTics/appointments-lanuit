import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const days = [
  {
    date: "2026-03-04",
    slots: ["09:00", "13:00"],
  },
  {
    date: "2026-03-05",
    slots: ["10:00", "14:00"],
  },
];

describe("booking wizard", () => {
  it("does not advance without a selected date and slot", () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: null, timeSlot: null, name: "", phone: "" }}
        month="2026-03"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(screen.getByText("Selecciona un dia disponible.")).toBeInTheDocument();
    expect(screen.getByText("Selecciona un horario antes de continuar.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agendar Cita" })).toBeInTheDocument();
  });

  it("shows local validation errors for invalid contact data", () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "An", phone: "123" }}
        month="2026-03"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(screen.getByText("Ingresa tu nombre completo.")).toBeInTheDocument();
    expect(screen.getByText("Ingresa un telefono de 10 digitos.")).toBeInTheDocument();
  });
});
