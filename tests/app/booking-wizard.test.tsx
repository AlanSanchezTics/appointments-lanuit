import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

async function clickNextWhenReady() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^Siguiente$/i })).toBeEnabled();
  });
  fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }));
}

describe("booking wizard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("validates schedule step before continuing", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: null, timeSlot: null, name: "", phone: "" }}
        month="2026-03"
      />,
    );

    await clickNextWhenReady();

    expect(screen.getByText("Selecciona un día disponible.")).toBeInTheDocument();
    expect(
      screen.getByText("Selecciona un horario antes de continuar."),
    ).toBeInTheDocument();
  });

  it("moves to identity step after schedule step and checks existing client by phone", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-04",
          timeSlot: "09:00",
          phone: "5512345678",
        }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-123",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: true,
          clientName: "Ana Garcia",
        })}
      />,
    );

    await clickNextWhenReady();

    expect(
      await screen.findByRole("heading", { name: "Cuéntanos un poco sobre ti" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    await clickNextWhenReady();

    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  });

  it("shows name field for new phone and validates minimum name length", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-04",
          timeSlot: "09:00",
          phone: "5512345678",
        }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-123",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: false,
        })}
      />,
    );

    await clickNextWhenReady();
    expect(await screen.findByLabelText("Teléfono")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    await clickNextWhenReady();

    expect(await screen.findByLabelText("Nombre completo")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "An" },
    });
    await clickNextWhenReady();

    expect(
      screen.getByText("Ingresa tu nombre completo."),
    ).toBeInTheDocument();
  });

  it("resets previous existing-client identity when going back and changing phone", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-04",
          timeSlot: "09:00",
          phone: "5512345678",
        }}
        month="2026-03"
        checkClientAndAcquireLock={async (draft) => {
          if (draft.phone === "5512345678") {
            return {
              lockToken: "lock-existing",
              expiresAt: "2099-01-01T00:10:00.000Z",
              clientExists: true,
              clientName: "Ana Garcia",
            };
          }

          return {
            lockToken: "lock-new",
            expiresAt: "2099-01-01T00:10:00.000Z",
            clientExists: false,
          };
        }}
      />,
    );

    await clickNextWhenReady();
    expect(await screen.findByLabelText("Teléfono")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    await clickNextWhenReady();
    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Editar información/i }));
    expect(await screen.findByLabelText("Teléfono")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5598765432" },
    });
    await clickNextWhenReady();

    expect(await screen.findByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.queryByText("Confirmar detalles")).not.toBeInTheDocument();
  });

  it("keeps lock when going back from confirm to identity for a new client", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-04",
          timeSlot: "09:00",
          phone: "5598765432",
        }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-new-client",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: false,
        })}
      />,
    );

    await clickNextWhenReady();
    expect(await screen.findByLabelText("Teléfono")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5598765432" },
    });
    await clickNextWhenReady();
    expect(await screen.findByLabelText("Nombre completo")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Cliente Nueva" },
    });
    await clickNextWhenReady();
    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Editar información/i }));
    expect(await screen.findByLabelText("Teléfono")).toBeInTheDocument();

    await clickNextWhenReady();
    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();
    expect(
      screen.queryByText("El bloqueo temporal expiró. Selecciona de nuevo tu horario."),
    ).not.toBeInTheDocument();
  });

  it("shows reschedule decision view when same-month active appointments exist", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-04",
          timeSlot: "09:00",
          phone: "5512345678",
          name: "Ana Garcia",
        }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-123",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: true,
          clientName: "Ana Garcia",
          canBookAsNewAppointment: true,
          futureAppointmentsInMonth: [
            {
              appointmentId: 11,
              date: "2026-03-10",
              timeSlot: "10:00",
            },
          ],
        })}
      />,
    );

    await clickNextWhenReady();
    fireEvent.change(await screen.findByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    await clickNextWhenReady();

    expect(
      await screen.findByText("Ya tienes citas activas en este mes"),
    ).toBeInTheDocument();
  });

  it("reaches pending success screen after confirm for non-loyal client", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-04",
          timeSlot: "09:00",
          phone: "5512345678",
        }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-123",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: false,
        })}
        submitBooking={async () => ({
          appointmentId: 42,
          status: "PENDING",
          whatsappPhone: "5215512345678",
          whatsappData: {
            name: "Ana Garcia",
            date: "2026-03-04",
            timeSlot: "09:00",
          },
        })}
      />,
    );

    await clickNextWhenReady();
    fireEvent.change(await screen.findByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    await clickNextWhenReady();

    const nameInput = await screen.findByLabelText("Nombre completo");
    fireEvent.change(nameInput, { target: { value: "Ana Garcia" } });
    await clickNextWhenReady();

    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Enviar comprobante" }),
      ).toBeInTheDocument();
    });
  });
});
