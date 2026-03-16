import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CancelForm } from "@/components/cancel/cancel-form";

describe("cancel wizard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates phone format before search", () => {
    render(<CancelForm />);

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar cita" }));

    expect(screen.getByText("Ingresa un telefono de 10 digitos.")).toBeInTheDocument();
  });

  it("shows appointment details in step 2 and allows reset to step 1", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appointmentId: 9,
        name: "Ana Garcia",
        phone: "5512345678",
        date: "2026-03-18",
        timeSlot: "13:00",
        status: "CONFIRMED",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CancelForm />);

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar cita" }));

    expect(await screen.findByRole("heading", { name: "Confirmar Cancelación" })).toBeInTheDocument();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Volver" }));

    expect(screen.getByRole("heading", { name: "Cancelar cita" })).toBeInTheDocument();
  });

  it("completes cancellation and renders success message in step 3", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appointmentId: 5,
          name: "Ana Garcia",
          phone: "5512345678",
          date: "2026-03-18",
          timeSlot: "13:00",
          status: "CONFIRMED",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appointmentId: 5,
          status: "CANCELLED",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<CancelForm />);

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar cita" }));
    await screen.findByRole("heading", { name: "Confirmar Cancelación" });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar cita" }));

    expect(
      await screen.findByRole("heading", {
        name: "Tu cita ha sido cancelada con éxito",
      }),
    ).toBeInTheDocument();
  });
});
