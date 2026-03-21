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
    expect(screen.getByRole("heading", { name: "Agendar cita" })).toBeInTheDocument();
  });

  it("shows local validation errors for invalid phone", () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "An", phone: "123" }}
        month="2026-03"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(screen.getByText("Ingresa un telefono de 10 digitos.")).toBeInTheDocument();
  });

  it("reveals name field when check+lock identifies a new client", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", phone: "5512345678" }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-123",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: false,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(await screen.findByLabelText("Nombre completo")).toBeInTheDocument();
  });

  it("renders the back to home button below continue", () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
        month="2026-03"
      />,
    );

    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Regresar" })).toHaveAttribute("href", "/citas/2026-03");
  });

  it("tracks transition direction across wizard steps", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-123",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: true,
          clientName: "Ana Garcia",
        })}
      />,
    );

    const stepContainer = screen.getByTestId("booking-step-container");
    expect(stepContainer).toHaveAttribute("data-transition-direction", "forward");

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByText("Confirmar Detalles");
    expect(stepContainer).toHaveAttribute("data-transition-direction", "forward");

    fireEvent.click(screen.getByRole("link", { name: /Editar información/i }));
    await screen.findByRole("heading", { name: "Agendar cita" });
    expect(stepContainer).toHaveAttribute("data-transition-direction", "backward");
  });
});
