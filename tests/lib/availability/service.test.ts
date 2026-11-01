import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMonthAvailability } from "@/lib/availability/service";
import { listMonthActiveReservationLocks, listMonthAppointments } from "@/lib/db/appointments";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";
import { getBookableMonthConfig } from "@/lib/active-months/service";

vi.mock("@/lib/db/appointments", () => ({
  listMonthAppointments: vi.fn(),
  listMonthActiveReservationLocks: vi.fn(),
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listMonthBlockedSlots: vi.fn(),
}));

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailability: vi.fn(),
}));

vi.mock("@/lib/active-months/service", () => ({
  getBookableMonthConfig: vi.fn(),
}));

const listMonthAppointmentsMock = vi.mocked(listMonthAppointments);
const listMonthActiveReservationLocksMock = vi.mocked(listMonthActiveReservationLocks);
const listMonthBlockedSlotsMock = vi.mocked(listMonthBlockedSlots);
const findMonthAvailabilityMock = vi.mocked(findMonthAvailability);
const getBookableMonthConfigMock = vi.mocked(getBookableMonthConfig);

// D4 BLOCK_MODE como regla de mes completo (PD-11): L-V, 9/10/13/14/17/18, separación 240 min, capacidad preservada, tope 3.
const BLOCK_RULE = {
  id: 1,
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  weekdays: [1, 2, 3, 4, 5],
  times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

// D4 SECOND_ONLY_MODE como regla de mes completo: 10/14/18, sin separación.
const SECOND_ONLY_RULE = {
  ...BLOCK_RULE,
  times: ["10:00", "14:00", "18:00"],
  minGapMinutes: 0,
  preserveCapacity: false,
};

function monthConfig(rules: Array<typeof BLOCK_RULE>, exceptions: Array<Record<string, unknown>> = []) {
  return {
    activeMonthId: 1,
    month: "2026-03",
    slotMode: "BLOCK_MODE" as const,
    availabilityVersion: 1,
    rules,
    exceptions,
  } as never;
}

describe("availability service", () => {
  beforeEach(() => {
    listMonthBlockedSlotsMock.mockResolvedValue([]);
    getBookableMonthConfigMock.mockResolvedValue({
      id: 1,
      month: "2026-03",
      status: "ACTIVE",
      slotMode: "BLOCK_MODE",
    });
    findMonthAvailabilityMock.mockResolvedValue(monthConfig([BLOCK_RULE]));
  });

  it("removes occupied slots that break the 240-minute spacing", async () => {
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
        alias: null,
        clientNumber: 1,
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
        alias: null,
        clientNumber: 1,
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
        alias: null,
        clientNumber: 1,
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
        alias: null,
        clientNumber: 1,
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
        alias: null,
        clientNumber: 1,
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

    // Con capacidad preservada, 17:00 bajaría la capacidad del día (FR-013): solo quedan 14:00 y 18:00.
    expect(today?.slots).toEqual(["14:00", "18:00"]);
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

  it("hides slots occupied by pending appointments", async () => {
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 11,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "13:00",
        status: "PENDING",
        googleEventId: null,
        clientId: 1,
        alias: null,
        clientNumber: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).not.toContain("13:00");
  });

  it("applies the spacing rule against active locks", async () => {
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

  it("applies the spacing rule after a single manual block", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 40,
        date: "2026-03-04",
        timeSlot: "09:00",
        reason: "DESCANSO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED" as const,
        calendarSyncReason: null,
        createdByAdminId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["10:00", "14:00", "18:00"]);
  });

  it("keeps later hours available when the first hours are manually blocked", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 40,
        date: "2026-03-04",
        timeSlot: "09:00",
        reason: "DESCANSO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED" as const,
        calendarSyncReason: null,
        createdByAdminId: 1,
      },
      {
        id: 41,
        date: "2026-03-04",
        timeSlot: "10:00",
        reason: "DESCANSO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED" as const,
        calendarSyncReason: null,
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
          googleEventId: null,
          calendarSyncStatus: "CONFIRMED" as const,
          calendarSyncReason: null,
          createdByAdminId: 1,
        }),
      ),
    );

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day).toBeUndefined();
  });

  it("hides the full day when full-day marker is persisted", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 400,
        date: "2026-03-04",
        timeSlot: "00:00",
        reason: "DESCANSO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED" as const,
        calendarSyncReason: null,
        createdByAdminId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day).toBeUndefined();
  });

  it("limits availability to 10:00, 14:00 and 18:00 in SECOND_ONLY_MODE", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    findMonthAvailabilityMock.mockResolvedValueOnce(monthConfig([SECOND_ONLY_RULE]));

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["10:00", "14:00", "18:00"]);
  });

  it("keeps 10:00 available in SECOND_ONLY_MODE when 18:00 is occupied and 14:00 is manually blocked", async () => {
    findMonthAvailabilityMock.mockResolvedValueOnce(monthConfig([SECOND_ONLY_RULE]));
    listMonthAppointmentsMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Lopez",
        phone: "5512345678",
        date: "2026-03-04",
        timeSlot: "18:00",
        status: "CONFIRMED",
        googleEventId: null,
        clientId: 1,
        alias: null,
        clientNumber: 1,
      },
    ]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 40,
        date: "2026-03-04",
        timeSlot: "14:00",
        reason: "DESCANSO",
        googleEventId: null,
        calendarSyncStatus: "CONFIRMED" as const,
        calendarSyncReason: null,
        createdByAdminId: 1,
      },
    ]);

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const day = result.find((entry) => entry.date === "2026-03-04");

    expect(day?.slots).toEqual(["10:00"]);
  });

  it("opens a closed weekend day through an exception", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    findMonthAvailabilityMock.mockResolvedValueOnce(
      monthConfig([BLOCK_RULE], [
        { id: 5, date: "2026-03-07", times: ["10:00"], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 3 },
      ]),
    );

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));
    const saturday = result.find((entry) => entry.date === "2026-03-07");

    expect(saturday?.slots).toEqual(["10:00"]);
  });

  it("hides a weekday that an empty exception closes", async () => {
    listMonthAppointmentsMock.mockResolvedValueOnce([]);
    listMonthActiveReservationLocksMock.mockResolvedValueOnce([]);
    findMonthAvailabilityMock.mockResolvedValueOnce(
      monthConfig([BLOCK_RULE], [
        { id: 6, date: "2026-03-04", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
      ]),
    );

    const result = await getMonthAvailability("2026-03", new Date("2026-03-03T12:00:00.000Z"));

    expect(result.find((entry) => entry.date === "2026-03-04")).toBeUndefined();
  });
});
