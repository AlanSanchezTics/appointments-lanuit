import { describe, expect, it } from "vitest";

import { buildWhatsappMessage, buildWhatsappUrl } from "@/lib/whatsapp/message";

describe("whatsapp message", () => {
  it("builds the base message using the specification format", () => {
    process.env.APP_URL = "https://miapp.com";

    const result = buildWhatsappMessage({
      name: "Ana",
      date: "2026-03-04",
      timeSlot: "09:00",
    });

    expect(result).toBe(
      "Hola Pau ✨\nsoy Ana ✌️.\nYa te agendé para el día 4 de marzo de 2026 a las 09:00 AM.\nMuchas gracias y bonito día 😊\n\n(Para cancelar tu cita accede a https://miapp.com/cancelar)",
    );
  });

  it("encodes the outgoing message", () => {
    process.env.APP_URL = "https://miapp.com/";
    process.env.WHATSAPP_PHONE = "5215512345678";

    const result = buildWhatsappUrl({
      name: "Ana",
      date: "2026-03-04",
      timeSlot: "09:00",
    });

    expect(result).toContain("https://wa.me/5215512345678?text=");
    expect(result).toContain(
      encodeURIComponent(
        "Hola Pau ✨\nsoy Ana ✌️.\nYa te agendé para el día 4 de marzo de 2026 a las 09:00 AM.\nMuchas gracias y bonito día 😊\n\n(Para cancelar tu cita accede a https://miapp.com/cancelar)",
      ),
    );
  });
});
