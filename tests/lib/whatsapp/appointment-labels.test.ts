import { describe, expect, it } from "vitest";

import { formatWhatsappAppointmentLabels } from "@/lib/whatsapp/appointment-labels";

describe("formatWhatsappAppointmentLabels", () => {
  it("formats a Spanish capitalized weekday/month date and a lowercase time", () => {
    expect(
      formatWhatsappAppointmentLabels({
        date: "2026-03-18",
        timeSlot: "10:00",
        language: "es",
      }),
    ).toEqual({ date: "Miércoles, 18 de Marzo", time: "10:00 am" });
  });

  it("formats the afternoon time slot in lowercase PM for Spanish", () => {
    expect(
      formatWhatsappAppointmentLabels({
        date: "2026-03-18",
        timeSlot: "14:00",
        language: "es",
      }).time,
    ).toBe("02:00 pm");
  });

  it("formats English labels with the en-US locale", () => {
    expect(
      formatWhatsappAppointmentLabels({
        date: "2026-03-18",
        timeSlot: "10:00",
        language: "en",
      }),
    ).toEqual({ date: "Wednesday, March 18", time: "10:00 am" });
  });
});
