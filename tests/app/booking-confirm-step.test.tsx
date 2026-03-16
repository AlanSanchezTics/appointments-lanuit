import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const days = [
  {
    date: "2026-03-04",
    slots: ["09:00", "13:00"],
  },
];

describe("booking confirm step", () => {
  it("shows selected details and preserves the draft when returning to step 1", async () => {
    const checkClientAndAcquireLock = vi.fn().mockResolvedValue({
      lockToken: "lock-1",
      expiresAt: "2099-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Garcia",
    });
    const releaseLock = vi.fn().mockResolvedValue(undefined);

    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-17",
          timeSlot: "09:00",
          name: "Ana Garcia",
          phone: "5512345678",
        }}
        month="2026-03"
        checkClientAndAcquireLock={checkClientAndAcquireLock}
        releaseLock={releaseLock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(await screen.findByRole("heading", { name: "Confirmar Detalles" })).toBeInTheDocument();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByText("551 234 5678")).toBeInTheDocument();
    expect(screen.getByText("09:00 AM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Editar información/i }));

    expect(await screen.findByDisplayValue("5512345678")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Ana Garcia")).not.toBeInTheDocument();
    expect(releaseLock).toHaveBeenCalledWith("lock-1");
  });

  it("maps backend booking conflicts into inline feedback", async () => {
    const submitBooking = vi
      .fn()
      .mockRejectedValue(new Error("SLOT_NOT_AVAILABLE"));
    const checkClientAndAcquireLock = vi.fn().mockResolvedValue({
      lockToken: "lock-1",
      expiresAt: "2099-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Garcia",
    });

    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-17",
          timeSlot: "17:00",
          name: "Ana Garcia",
          phone: "5512345678",
        }}
        month="2026-03"
        submitBooking={submitBooking}
        checkClientAndAcquireLock={checkClientAndAcquireLock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByRole("heading", { name: "Confirmar Detalles" });
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cita" }));

    expect(
      await screen.findByText("Ese horario ya no esta disponible. Elige otro."),
    ).toBeInTheDocument();
  });

  it("returns to step 1 when the temporary lock expires", async () => {
    const checkClientAndAcquireLock = vi.fn().mockResolvedValue({
      lockToken: "lock-1",
      expiresAt: "2020-03-13T12:00:02.000Z",
      clientExists: true,
      clientName: "Ana Garcia",
    });
    const releaseLock = vi.fn().mockResolvedValue(undefined);

    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-17",
          timeSlot: "09:00",
          name: "Ana Garcia",
          phone: "5512345678",
        }}
        month="2026-03"
        checkClientAndAcquireLock={checkClientAndAcquireLock}
        releaseLock={releaseLock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await waitFor(() => {
      expect(releaseLock).toHaveBeenCalledWith("lock-1");
    });
    await waitFor(() => {
      expect(screen.getByText(/El bloqueo temporal expiro/i)).toBeInTheDocument();
    });
  });
});
