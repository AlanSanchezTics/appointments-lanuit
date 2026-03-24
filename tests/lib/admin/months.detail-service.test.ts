import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";
import { findRegisteredMonth, listAppointmentsByMonth } from "@/lib/db/admin-months";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: vi.fn(),
  listAppointmentsByMonth: vi.fn(),
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listMonthBlockedSlots: vi.fn(),
}));

const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);
const listAppointmentsByMonthMock = vi.mocked(listAppointmentsByMonth);
const listMonthBlockedSlotsMock = vi.mocked(listMonthBlockedSlots);

describe("admin month detail service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMonthBlockedSlotsMock.mockResolvedValue([]);
  });

  it("throws MONTH_NOT_REGISTERED when month does not exist in catalog", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce(null);

    await expect(
      getAdminMonthDetail("2026-03", new Date("2026-03-21T12:00:00.000Z")),
    ).rejects.toThrow("MONTH_NOT_REGISTERED");
  });

  it("returns month metrics and calendar availability", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-03",
      status: "ACTIVE",
    });

    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-02", timeSlot: "09:00", status: "CONFIRMED" },
      { date: "2026-03-02", timeSlot: "10:00", status: "CANCELLED" },
      { date: "2026-03-20", timeSlot: "09:00", status: "CONFIRMED" },
      { date: "2026-03-20", timeSlot: "13:00", status: "CONFIRMED" },
      { date: "2026-03-20", timeSlot: "17:00", status: "SYNC_FAILED" },
    ]);

    const result = await getAdminMonthDetail(
      "2026-03",
      new Date("2026-03-21T12:00:00.000Z"),
    );

    expect(result.month).toBe("2026-03");
    expect(result.monthStatus).toBe("ACTIVE");
    expect(result.currentMonth).toBe("2026-03");
    expect(result.currentDate).toBe("2026-03-21");
    expect(result.isPastMonth).toBe(false);
    expect(result.metrics.confirmedAppointments).toBe(4);
    expect(result.metrics.cancelledAppointments).toBe(1);
    expect(result.metrics.occupiedSpaces).toBe(4);
    expect(result.metrics.blockedSpaces).toBe(0);
    expect(result.metrics.availableSpaces).toBe(62);

    const weekendDay = result.calendarDays.find((day) => day.date === "2026-03-01");
    expect(weekendDay).toEqual({
      date: "2026-03-01",
      day: 1,
      isWeekend: true,
      availableSpaces: 0,
      tone: "weekend",
    });

    const availableDay = result.calendarDays.find((day) => day.date === "2026-03-03");
    expect(availableDay?.availableSpaces).toBe(3);
    expect(availableDay?.tone).toBe("available");

    const fullDay = result.calendarDays.find((day) => day.date === "2026-03-20");
    expect(fullDay?.availableSpaces).toBe(0);
    expect(fullDay?.tone).toBe("full");

    expect(result.projectedSaturationPercent).toBe(
      Math.round(
        (result.metrics.occupiedSpaces
          / (result.metrics.occupiedSpaces + result.metrics.availableSpaces))
          * 100,
      ),
    );
  });

  it("counts manually blocked slots in metrics and day tone", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-03",
      status: "ACTIVE",
    });
    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-02", timeSlot: "09:00", status: "CONFIRMED" },
    ]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      {
        id: 1,
        date: "2026-03-03",
        timeSlot: "13:00",
        reason: "DESCANSO",
        createdByAdminId: 10,
      },
      {
        id: 2,
        date: "2026-03-03",
        timeSlot: "17:00",
        reason: "PERSONAL",
        createdByAdminId: 10,
      },
    ]);

    const result = await getAdminMonthDetail(
      "2026-03",
      new Date("2026-03-01T12:00:00.000Z"),
    );

    expect(result.metrics.blockedSpaces).toBe(2);
    const day = result.calendarDays.find((entry) => entry.date === "2026-03-03");
    expect(day?.availableSpaces).toBe(1);
    expect(day?.tone).toBe("low");
  });
});
