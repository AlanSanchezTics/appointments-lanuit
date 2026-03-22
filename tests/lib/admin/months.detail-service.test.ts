import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";
import { findRegisteredMonth, listAppointmentsByMonth } from "@/lib/db/admin-months";

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: vi.fn(),
  listAppointmentsByMonth: vi.fn(),
}));

const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);
const listAppointmentsByMonthMock = vi.mocked(listAppointmentsByMonth);

describe("admin month detail service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
});
