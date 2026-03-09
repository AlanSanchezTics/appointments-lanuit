import { describe, expect, it, vi } from "vitest";

import { getMonthAvailability } from "@/lib/availability/service";

vi.mock("@/lib/db/appointments", () => ({
  listMonthAppointments: vi.fn(async () => [
    {
      id: 1,
      name: "Ana Lopez",
      phone: "5512345678",
      date: "2026-03-04",
      timeSlot: "17:00",
      status: "CONFIRMED",
      googleEventId: null,
    },
  ]),
}));

describe("availability service", () => {
  it("removes occupied slots and days before today", async () => {
    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).not.toContain("17:00");
  });

  it("enforces minimum gap only against occupied slots", async () => {
    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).not.toContain("14:00");
    expect(day?.slots).toContain("10:00");
    expect(day?.slots).toContain("13:00");
    expect(day?.slots).not.toContain("18:00");
  });

  it("does not expose weekends", async () => {
    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));

    expect(result.some((entry) => entry.date === "2026-03-07")).toBe(false);
    expect(result.some((entry) => entry.date === "2026-03-08")).toBe(false);
  });
});
