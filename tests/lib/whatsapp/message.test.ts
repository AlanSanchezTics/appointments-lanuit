import { describe, expect, it } from "vitest";

import { buildWhatsappUrl } from "@/lib/whatsapp/message";

describe("whatsapp message", () => {
  it("encodes the outgoing message", () => {
    process.env.WHATSAPP_PHONE = "5215512345678";

    const result = buildWhatsappUrl({
      name: "Ana",
      date: "2026-03-04",
      timeSlot: "09:00",
    });

    expect(result).toContain("https://wa.me/5215512345678?text=");
    expect(result).toContain(encodeURIComponent("Hola Pau, soy Ana."));
  });
});
