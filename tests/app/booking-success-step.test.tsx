import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const days = [
  {
    date: "2026-03-18",
    slots: ["09:00", "13:00"],
  },
];

describe("booking success step", () => {
  it("renders the success screen and redirects through the WhatsApp CTA", async () => {
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
    await screen.findByText("Confirmar Detalles");
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
  });
});
