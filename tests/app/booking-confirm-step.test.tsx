import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const days = [
  {
    date: "2026-03-04",
    slots: ["09:00", "13:00"],
  },
];

describe("booking confirm step", () => {
  it("shows selected details and preserves the draft when returning to step 1", () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
        month="2026-03"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(screen.getByRole("heading", { name: "Confirmar Detalles" })).toBeInTheDocument();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByText("+52 55 1234 5678")).toBeInTheDocument();
    expect(screen.getByText("09:00 AM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Volver al paso anterior/i }));

    expect(screen.getByDisplayValue("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5512345678")).toBeInTheDocument();
  });

  it("maps backend booking conflicts into inline feedback", async () => {
    const submitBooking = vi.fn().mockRejectedValue(new Error("SLOT_NOT_AVAILABLE"));

    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
        month="2026-03"
        submitBooking={submitBooking}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Cita" }));

    expect(await screen.findByText("Ese horario ya no esta disponible. Elige otro.")).toBeInTheDocument();
  });
});
