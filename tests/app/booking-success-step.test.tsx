import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const days = [
  {
    date: "2026-03-18",
    slots: ["09:00", "13:00"],
  },
];

describe("booking success step", () => {
  it("auto-redirects to WhatsApp once on success for SYNC_FAILED and keeps CTA as fallback", async () => {
    const onWhatsAppRedirect = vi.fn();
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
          date: "2026-03-18",
          timeSlot: "09:00",
          name: "Ana Garcia",
          phone: "5512345678",
        }}
        month="2026-03"
        onWhatsAppRedirect={onWhatsAppRedirect}
        checkClientAndAcquireLock={checkClientAndAcquireLock}
        submitBooking={async () => ({
          appointmentId: 1,
          status: "SYNC_FAILED",
          syncReason: "CALENDAR_SYNC_FAILED",
          whatsappPhone: "5215512345678",
          whatsappData: {
            name: "Ana Garcia",
            date: "2026-03-18",
            timeSlot: "09:00",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByText("Confirmar detalles");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cita" }));

    expect(
      await screen.findByRole("heading", {
        name: /¡Todo listo, Ana!/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Tu cita ha sido agendada con éxito/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Enviar confirmación por WhatsApp" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(onWhatsAppRedirect).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar confirmación por WhatsApp" }),
    );
    expect(onWhatsAppRedirect).toHaveBeenCalledTimes(2);
  });

  it("auto-redirects to WhatsApp once on success for CONFIRMED", async () => {
    const onWhatsAppRedirect = vi.fn();
    const checkClientAndAcquireLock = vi.fn().mockResolvedValue({
      lockToken: "lock-3",
      expiresAt: "2099-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Garcia",
    });

    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-18",
          timeSlot: "09:00",
          name: "Ana Garcia",
          phone: "5512345678",
        }}
        month="2026-03"
        onWhatsAppRedirect={onWhatsAppRedirect}
        checkClientAndAcquireLock={checkClientAndAcquireLock}
        submitBooking={async () => ({
          appointmentId: 3,
          status: "CONFIRMED",
          whatsappPhone: "5215512345678",
          whatsappData: {
            name: "Ana Garcia",
            date: "2026-03-18",
            timeSlot: "09:00",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByText("Confirmar detalles");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cita" }));

    await waitFor(() => {
      expect(onWhatsAppRedirect).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps pending confirmation manual and redirects through the receipt CTA only on click", async () => {
    const onWhatsAppRedirect = vi.fn();
    const checkClientAndAcquireLock = vi.fn().mockResolvedValue({
      lockToken: "lock-2",
      expiresAt: "2099-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Garcia",
    });

    render(
      <BookingWizard
        days={days}
        initialDraft={{
          date: "2026-03-18",
          timeSlot: "09:00",
          name: "Ana Garcia",
          phone: "5512345678",
        }}
        month="2026-03"
        onWhatsAppRedirect={onWhatsAppRedirect}
        checkClientAndAcquireLock={checkClientAndAcquireLock}
        submitBooking={async () => ({
          appointmentId: 2,
          status: "PENDING",
          whatsappPhone: "5215512345678",
          whatsappData: {
            name: "Ana Garcia",
            date: "2026-03-18",
            timeSlot: "09:00",
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    await screen.findByText("Confirmar detalles");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cita" }));

    expect(
      await screen.findByRole("heading", {
        name: /Ya casi estamos listas; solo nos queda un paso por realizar\./i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Tu cita ya se encuentra prerregistrada\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar comprobante" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Volver" }),
    ).toBeInTheDocument();
    expect(onWhatsAppRedirect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante" }));

    expect(onWhatsAppRedirect).toHaveBeenCalledWith(
      expect.stringContaining("Adjunto%20el%20comprobante%20del%20dep%C3%B3sito"),
    );
  });
});
