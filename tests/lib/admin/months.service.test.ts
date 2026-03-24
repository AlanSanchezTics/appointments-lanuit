import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAdminMonths,
  getMonthsCatalog,
  updateAdminMonthStatus,
  updateAdminMonthSlotMode,
} from "@/lib/admin/months/service";
import {
  createInactiveMonths,
  countActiveMonthsByYear,
  countFutureAppointmentsByYear,
  countFutureMonthsByYear,
  countInactiveMonthsByYear,
  countPastAppointmentsByYear,
  countPastMonthsByYear,
  findRegisteredMonth,
  listExistingMonths,
  listMonthsByYear,
  updateRegisteredMonthStatus,
  updateRegisteredMonthSlotMode,
} from "@/lib/db/admin-months";

vi.mock("@/lib/db/admin-months", () => ({
  countActiveMonthsByYear: vi.fn(),
  countInactiveMonthsByYear: vi.fn(),
  countFutureMonthsByYear: vi.fn(),
  countPastMonthsByYear: vi.fn(),
  countPastAppointmentsByYear: vi.fn(),
  countFutureAppointmentsByYear: vi.fn(),
  listMonthsByYear: vi.fn(),
  listExistingMonths: vi.fn(),
  createInactiveMonths: vi.fn(),
  findRegisteredMonth: vi.fn(),
  updateRegisteredMonthStatus: vi.fn(),
  updateRegisteredMonthSlotMode: vi.fn(),
}));

const countActiveMonthsByYearMock = vi.mocked(countActiveMonthsByYear);
const countInactiveMonthsByYearMock = vi.mocked(countInactiveMonthsByYear);
const countFutureMonthsByYearMock = vi.mocked(countFutureMonthsByYear);
const countPastMonthsByYearMock = vi.mocked(countPastMonthsByYear);
const countPastAppointmentsByYearMock = vi.mocked(countPastAppointmentsByYear);
const countFutureAppointmentsByYearMock = vi.mocked(countFutureAppointmentsByYear);
const listMonthsByYearMock = vi.mocked(listMonthsByYear);
const listExistingMonthsMock = vi.mocked(listExistingMonths);
const createInactiveMonthsMock = vi.mocked(createInactiveMonths);
const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);
const updateRegisteredMonthStatusMock = vi.mocked(updateRegisteredMonthStatus);
const updateRegisteredMonthSlotModeMock = vi.mocked(updateRegisteredMonthSlotMode);

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

  it("creates only missing months and returns created/skipped summary", async () => {
    listExistingMonthsMock.mockResolvedValueOnce(["2026-07"]);
    createInactiveMonthsMock.mockResolvedValueOnce();

    const result = await createAdminMonths({
      year: 2026,
      months: ["2026-06", "2026-07", "2026-08"],
    });

    expect(createInactiveMonthsMock).toHaveBeenCalledWith(["2026-06", "2026-08"]);
    expect(result).toEqual({
      createdMonths: ["2026-06", "2026-08"],
      skippedMonths: ["2026-07"],
      totalCreated: 2,
      totalSkipped: 1,
    });
  });

  it("updates month slot mode for registered future month", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-06",
      status: "ACTIVE",
      slotMode: "BLOCK_MODE",
    });
    updateRegisteredMonthSlotModeMock.mockResolvedValueOnce({
      month: "2026-06",
      slotMode: "SECOND_ONLY_MODE",
    });

    const result = await updateAdminMonthSlotMode(
      "2026-06",
      "SECOND_ONLY_MODE",
      new Date("2026-03-10T15:00:00.000Z"),
    );

    expect(updateRegisteredMonthSlotModeMock).toHaveBeenCalledWith(
      "2026-06",
      "SECOND_ONLY_MODE",
    );
    expect(result).toEqual({
      month: "2026-06",
      slotMode: "SECOND_ONLY_MODE",
    });
  });

  it("rejects slot mode update when month is in the past", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-02",
      status: "ACTIVE",
      slotMode: "BLOCK_MODE",
    });

    await expect(
      updateAdminMonthSlotMode(
        "2026-02",
        "SECOND_ONLY_MODE",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_IN_PAST");
  });

  it("updates month status for a registered future month", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-06",
      status: "ACTIVE",
      slotMode: "BLOCK_MODE",
    });
    updateRegisteredMonthStatusMock.mockResolvedValueOnce({
      month: "2026-06",
      status: "INACTIVE",
    });

    const result = await updateAdminMonthStatus(
      "2026-06",
      "INACTIVE",
      new Date("2026-03-10T15:00:00.000Z"),
    );

    expect(updateRegisteredMonthStatusMock).toHaveBeenCalledWith(
      "2026-06",
      "INACTIVE",
    );
    expect(result).toEqual({
      month: "2026-06",
      status: "INACTIVE",
    });
  });

  it("rejects month status update when month is in the past", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-02",
      status: "ACTIVE",
      slotMode: "BLOCK_MODE",
    });

    await expect(
      updateAdminMonthStatus(
        "2026-02",
        "INACTIVE",
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_IN_PAST");
  });
});
