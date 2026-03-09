import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingWizard } from "@/components/booking/booking-wizard";

const days = [
  {
    date: "2026-03-04",
    slots: ["09:00", "13:00"],
  },
];

describe("booking success step", () => {
  it("renders the success screen and redirects through the WhatsApp CTA", async () => {
    const onWhatsAppRedirect = vi.fn();

    render(
      <BookingWizard
        days={days}
        initialDraft={{ date: "2026-03-04", timeSlot: "09:00", name: "Ana Garcia", phone: "5512345678" }}
        month="2026-03"
        onWhatsAppRedirect={onWhatsAppRedirect}
        submitBooking={async () => ({
          appointmentId: 1,
          status: "SYNC_FAILED",
          syncReason: "CALENDAR_SYNC_FAILED",
          whatsappUrl: "https://wa.me/5215512345678?text=ok",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Cita" }));

    expect(await screen.findByRole("heading", { name: "Tu cita ha sido agendada exitosamente" })).toBeInTheDocument();
    expect(screen.getByText("La reserva quedo registrada. La sincronizacion con calendario se completara despues.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enviar confirmacion por WhatsApp" }));

    expect(onWhatsAppRedirect).toHaveBeenCalledWith("https://wa.me/5215512345678?text=ok");
  });
});
