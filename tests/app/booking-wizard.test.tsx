import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByText("Selecciona un día disponible.")).toBeInTheDocument();
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

    expect(screen.getByText("Ingresa un teléfono de 10 dígitos.")).toBeInTheDocument();
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
    await screen.findByText("Confirmar detalles");
    expect(stepContainer).toHaveAttribute("data-transition-direction", "forward");

    fireEvent.click(screen.getByRole("link", { name: /Editar información/i }));
    await screen.findByRole("heading", { name: "Agendar cita" });
    expect(stepContainer).toHaveAttribute("data-transition-direction", "backward");
  });

  it("shows reschedule selection when phone already has active appointments in month", async () => {
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
          futureAppointmentsInMonth: [
            {
              appointmentId: 11,
              date: "2026-03-10",
              timeSlot: "10:00",
            },
            {
              appointmentId: 12,
              date: "2026-03-12",
              timeSlot: "14:00",
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(await screen.findByText("Ya tienes citas activas en este mes")).toBeInTheDocument();
    expect(screen.getByText("Detalles de tu nueva cita")).toBeInTheDocument();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByText("551 234 5678")).toBeInTheDocument();
    expect(screen.queryByText("Días disponibles")).not.toBeInTheDocument();
    expect(screen.queryByText("Selecciona tu horario")).not.toBeInTheDocument();
    expect(screen.queryByText("Tus datos")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Teléfono")).not.toBeInTheDocument();
    expect(screen.getByText("10:00 AM")).toBeInTheDocument();
    expect(screen.getByText("02:00 PM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agendar como nueva cita" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /10:00 AM/i }));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();
  });

  it("shows OR separator and allows booking as new appointment when rule allows it", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-20", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
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
              date: "2026-03-01",
              timeSlot: "10:00",
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(await screen.findByText("Ya tienes citas activas en este mes")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agendar como nueva cita" }));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(await screen.findByText("Confirmar detalles")).toBeInTheDocument();
  });

  it("shows decision-specific validation when no option is selected in decision view", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-20", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
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
              date: "2026-03-01",
              timeSlot: "10:00",
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(await screen.findByText("Ya tienes citas activas en este mes")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Siguiente/i }),
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(
      screen.getByText("Selecciona una de las opciones disponibles para continuar."),
    ).toBeInTheDocument();
  });

  it("transitions to the pending confirmation screen after a non-loyal booking is confirmed", async () => {
    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
        month="2026-03"
        checkClientAndAcquireLock={async () => ({
          lockToken: "lock-456",
          expiresAt: "2099-01-01T00:10:00.000Z",
          clientExists: true,
          clientName: "Ana Garcia",
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

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByText("Confirmar detalles");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cita" }));

    expect(
      await screen.findByRole("heading", {
        name: /Ya casi estamos listas; solo nos queda un paso por realizar\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar comprobante" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });
});
