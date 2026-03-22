import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMonthsCatalog } from "@/lib/admin/months/service";
import {
  countActiveMonthsByYear,
  countFutureAppointmentsByYear,
  countFutureMonthsByYear,
  countInactiveMonthsByYear,
  countPastAppointmentsByYear,
  countPastMonthsByYear,
  listMonthsByYear,
} from "@/lib/db/admin-months";

vi.mock("@/lib/db/admin-months", () => ({
  countActiveMonthsByYear: vi.fn(),
  countInactiveMonthsByYear: vi.fn(),
  countFutureMonthsByYear: vi.fn(),
  countPastMonthsByYear: vi.fn(),
  countPastAppointmentsByYear: vi.fn(),
  countFutureAppointmentsByYear: vi.fn(),
  listMonthsByYear: vi.fn(),
}));

const countActiveMonthsByYearMock = vi.mocked(countActiveMonthsByYear);
const countInactiveMonthsByYearMock = vi.mocked(countInactiveMonthsByYear);
const countFutureMonthsByYearMock = vi.mocked(countFutureMonthsByYear);
const countPastMonthsByYearMock = vi.mocked(countPastMonthsByYear);
const countPastAppointmentsByYearMock = vi.mocked(countPastAppointmentsByYear);
const countFutureAppointmentsByYearMock = vi.mocked(countFutureAppointmentsByYear);
const listMonthsByYearMock = vi.mocked(listMonthsByYear);

describe("admin months catalog service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns dashboard metrics and month rows for the selected filters", async () => {
    countActiveMonthsByYearMock.mockResolvedValueOnce(4);
    countInactiveMonthsByYearMock.mockResolvedValueOnce(8);
    countFutureMonthsByYearMock.mockResolvedValueOnce(6);
    countPastMonthsByYearMock.mockResolvedValueOnce(2);
    countPastAppointmentsByYearMock.mockResolvedValueOnce(15);
    countFutureAppointmentsByYearMock.mockResolvedValueOnce(21);
    listMonthsByYearMock.mockResolvedValueOnce([
      { month: "2026-03", status: "ACTIVE" },
      { month: "2026-04", status: "INACTIVE" },
    ]);

    const result = await getMonthsCatalog(
      {
        year: 2026,
        status: "ALL",
        availableYears: [2026, 2027, 2028],
      },
      new Date("2026-03-10T15:00:00.000Z"),
    );

    expect(result).toEqual({
      filters: {
        year: 2026,
        status: "ALL",
        availableYears: [2026, 2027, 2028],
      },
      metrics: {
        activeMonths: 4,
        inactiveMonths: 8,
        futureMonths: 6,
        pastMonths: 2,
        pastAppointments: 15,
        futureAppointments: 21,
      },
      months: [
        { month: "2026-03", status: "ACTIVE" },
        { month: "2026-04", status: "INACTIVE" },
      ],
      total: 2,
      currentMonth: "2026-03",
      currentDate: "2026-03-10",
    });

    expect(listMonthsByYearMock).toHaveBeenCalledWith(2026, "ALL");
  });

  it("maps ACTIVE status filter to persistence query", async () => {
    countActiveMonthsByYearMock.mockResolvedValueOnce(1);
    countInactiveMonthsByYearMock.mockResolvedValueOnce(0);
    countFutureMonthsByYearMock.mockResolvedValueOnce(1);
    countPastMonthsByYearMock.mockResolvedValueOnce(0);
    countPastAppointmentsByYearMock.mockResolvedValueOnce(0);
    countFutureAppointmentsByYearMock.mockResolvedValueOnce(0);
    listMonthsByYearMock.mockResolvedValueOnce([
      { month: "2026-03", status: "ACTIVE" },
    ]);

    await getMonthsCatalog(
      {
        year: 2026,
        status: "ACTIVE",
        availableYears: [2026, 2027],
      },
      new Date("2026-03-10T15:00:00.000Z"),
    );

    expect(listMonthsByYearMock).toHaveBeenCalledWith(2026, "ACTIVE");
  });
});
