import { describe, expect, it } from "vitest";

import { buildWhatsappUrlFromMessage, getAppUrl, getWhatsappPhone } from "@/lib/whatsapp/message";

describe("whatsapp message helpers", () => {
  it("returns configured app URL without trailing slash", () => {
    process.env.APP_URL = "https://miapp.com/";

    expect(getAppUrl()).toBe("https://miapp.com");
  });

  it("returns configured whatsapp phone", () => {
    process.env.WHATSAPP_PHONE = "5215512345678";

    expect(getWhatsappPhone()).toBe("5215512345678");
  });

  it("encodes message into wa.me URL", () => {
    const result = buildWhatsappUrlFromMessage({
      phone: "5215512345678",
      message: "Hola Pau ✨",
    });

    expect(result).toBe("https://wa.me/5215512345678?text=Hola%20Pau%20%E2%9C%A8");
  });
});
