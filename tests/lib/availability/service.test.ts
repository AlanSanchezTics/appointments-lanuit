import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMonthAvailability } from "@/lib/availability/service";
import { listMonthActiveReservationLocks, listMonthAppointments } from "@/lib/db/appointments";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";
import { assertMonthIsBookable } from "@/lib/active-months/service";

vi.mock("@/lib/db/appointments", () => ({
  listMonthAppointments: vi.fn(),
  listMonthActiveReservationLocks: vi.fn(),
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listMonthBlockedSlots: vi.fn(),
}));

vi.mock("@/lib/active-months/service", () => ({
  assertMonthIsBookable: vi.fn(),
}));

const listMonthAppointmentsMock = vi.mocked(listMonthAppointments);
const listMonthActiveReservationLocksMock = vi.mocked(listMonthActiveReservationLocks);
const listMonthBlockedSlotsMock = vi.mocked(listMonthBlockedSlots);
const assertMonthIsBookableMock = vi.mocked(assertMonthIsBookable);

describe("availability service", () => {
  beforeEach(() => {
    listMonthBlockedSlotsMock.mockResolvedValue([]);
    assertMonthIsBookableMock.mockResolvedValue(undefined);
  });

  it("removes occupied slots with directional pair logic", async () => {
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "17:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["09:00", "13:00"]);
  });

  it("removes occupied slots and days before today", async () => {
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "17:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).not.toContain("17:00");
  });

  it("hides a day when 3 active appointments already exist", async () => {
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "09:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
      },
      {
        id: 2,
        name: "Bety Ruiz",
        phone: "5512345679",
        date: "2026-03-04",
        timeSlot: "14:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
      },
      {
        id: 3,
        name: "Carla Diaz",
        phone: "5512345680",
        date: "2026-03-04",
        timeSlot: "17:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));

    expect(result.find((entry) => entry.date === "2026-03-04")).toBeUndefined();
  });

  it("does not expose weekends", async () => {
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthAppointmentsMock.mockResolvedValueOnce([]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));

    expect(result.some((entry) => entry.date === "2026-03-07")).toBe(false);
    expect(result.some((entry) => entry.date === "2026-03-08")).toBe(false);
  });

  it("includes current day only with remaining slots", async () => {
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthAppointmentsMock.mockResolvedValueOnce([]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T19:30:00.000Z"));
    const today = result.find((entry) => entry.date === "2026-03-03");

    expect(today?.slots).toEqual(["14:00", "17:00", "18:00"]);
  });

  it("hides locked slots even when there is no confirmed appointment yet", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([
      {
        id: 10,
        date: "2026-03-04",
        timeSlot: "13:00",
        phone: "5512345678",
        lockToken: "lock-1",
        expiresAt: "2026-03-03T12:10:00.000Z",
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).not.toContain("13:00");
  });

  it("applies directional rule against active locks", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([
      {
        id: 10,
        date: "2026-03-04",
        timeSlot: "17:00",
        phone: "5512345678",
        lockToken: "lock-1",
        expiresAt: "2026-03-03T12:10:00.000Z",
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["09:00", "13:00"]);
  });

  it("applies directional availability for a single manually blocked first slot", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 40,
        date: "2026-03-04",
        timeSlot: "09:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["10:00", "14:00", "18:00"]);
  });

  it("keeps later full blocks available when first pair is fully blocked", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 40,
        date: "2026-03-04",
        timeSlot: "09:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
      {
        id: 41,
        date: "2026-03-04",
        timeSlot: "10:00",
        reason: "DESCANSO",
        createdByAdminId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["13:00", "14:00", "17:00", "18:00"]);
  });

  it("hides the full day when all slots are manually blocked", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce(
      ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"].map(
        (timeSlot, index) => ({
          id: 100 + index,
          date: "2026-03-04",
          timeSlot,
          reason: "DESCANSO" as const,
          createdByAdminId: 1,
        }),
      ),
    );

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day).toBeUndefined();
  });
});
