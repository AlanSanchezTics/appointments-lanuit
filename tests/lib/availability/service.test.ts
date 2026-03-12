import { describe, expect, it, vi } from "vitest";

import { getMonthAvailability } from "@/lib/availability/service";
import { listMonthAppointments } from "@/lib/db/appointments";

vi.mock("@/lib/db/appointments", () => ({
  listMonthAppointments: vi.fn(),
}));

const listMonthAppointmentsMock = vi.mocked(listMonthAppointments);

describe("availability service", () => {
  it("removes occupied slots with directional pair logic", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "17:00",
        status: "CONFIRMED",
        googleEventId: null,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["09:00", "13:00"]);
  });

  it("removes occupied slots and days before today", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "17:00",
        status: "CONFIRMED",
        googleEventId: null,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).not.toContain("17:00");
  });

  it("hides a day when 3 active appointments already exist", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
        status: "CONFIRMED",
        googleEventId: null,
      },
      {
        id: 2,
        name: "Bety Ruiz",
        phone: "5512345679",
        date: "2026-03-04",
        timeSlot: "14:00",
        status: "CONFIRMED",
        googleEventId: null,
      },
      {
        id: 3,
        name: "Carla Diaz",
        phone: "5512345680",
        date: "2026-03-04",
        timeSlot: "17:00",
        status: "CONFIRMED",
        googleEventId: null,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));

    expect(result.find((entry) => entry.date === "2026-03-04")).toBeUndefined();
  });

  it("does not expose weekends", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));

    expect(result.some((entry) => entry.date === "2026-03-07")).toBe(false);
    expect(result.some((entry) => entry.date === "2026-03-08")).toBe(false);
  });
});
