import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAdminMonths,
  getMonthsCatalog,
  updateAdminMonthStatus,
  updateAdminMonthSlotMode,
} from "@/lib/admin/months/service";
import { buildSlotModePresetRules } from "@/lib/availability/slot-mode-derivation";
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
  listMonthActiveAppointmentsForAvailability,
  listMonthsByYear,
  updateRegisteredMonthStatus,
} from "@/lib/db/admin-months";
import {
  findMonthAvailabilityForUpdate,
  replaceMonthAvailability,
} from "@/lib/db/availability-rules";

const { transactionMock } = vi.hoisted(() => ({ transactionMock: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailability: vi.fn(),
  findMonthAvailabilityForUpdate: vi.fn(),
  replaceMonthAvailability: vi.fn(),
}));

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
  listMonthActiveAppointmentsForAvailability: vi.fn(),
  updateRegisteredMonthStatus: vi.fn(),
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
const listMonthActiveAppointmentsForAvailabilityMock = vi.mocked(listMonthActiveAppointmentsForAvailability);
const findMonthAvailabilityForUpdateMock = vi.mocked(findMonthAvailabilityForUpdate);
const replaceMonthAvailabilityMock = vi.mocked(replaceMonthAvailability);

describe("admin months catalog service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // La transacción ejecuta el callback con un cliente vacío; las lecturas y escrituras se mockean por prueba.
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({}));
    listMonthActiveAppointmentsForAvailabilityMock.mockResolvedValue([]);
  });

  const juneRecord = {
    activeMonthId: 6,
    month: "2026-06",
    slotMode: "BLOCK_MODE" as const,
    availabilityVersion: 3,
    rules: [],
    exceptions: [],
  };

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
    // D17: el alta de meses no crea reglas.
    expect(replaceMonthAvailabilityMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      createdMonths: ["2026-06", "2026-08"],
      skippedMonths: ["2026-07"],
      totalCreated: 2,
      totalSkipped: 1,
    });
  });

  it("replaces rules with the preset and returns the new version (D16, D69)", async () => {
    findMonthAvailabilityForUpdateMock
      .mockResolvedValueOnce(juneRecord)
      .mockResolvedValueOnce({ ...juneRecord, slotMode: "SECOND_ONLY_MODE", availabilityVersion: 4 });

    const result = await updateAdminMonthSlotMode(
      "2026-06",
      { slotMode: "SECOND_ONLY_MODE", expectedVersion: 3, confirmAffectedAppointments: false },
      new Date("2026-03-10T15:00:00.000Z"),
    );

    expect(replaceMonthAvailabilityMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        month: "2026-06",
        expectedVersion: 3,
        slotMode: "SECOND_ONLY_MODE",
        rules: buildSlotModePresetRules("2026-06", "SECOND_ONLY_MODE"),
        exceptions: [],
      }),
    );
    expect(result).toEqual({
      month: "2026-06",
      slotMode: "SECOND_ONLY_MODE",
      availabilityVersion: 4,
    });
  });

  it("applies the preset even when the requested mode is already the current one (D69)", async () => {
    const customRules = [
      { id: 1, startDate: "2026-06-01", endDate: "2026-06-15", weekdays: [1], times: ["10:00"], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 1 },
    ];
    findMonthAvailabilityForUpdateMock
      .mockResolvedValueOnce({ ...juneRecord, slotMode: "SECOND_ONLY_MODE", rules: customRules })
      .mockResolvedValueOnce({ ...juneRecord, slotMode: "SECOND_ONLY_MODE", availabilityVersion: 4 });

    await updateAdminMonthSlotMode(
      "2026-06",
      { slotMode: "SECOND_ONLY_MODE", confirmAffectedAppointments: false },
      new Date("2026-03-10T15:00:00.000Z"),
    );

    expect(replaceMonthAvailabilityMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        rules: buildSlotModePresetRules("2026-06", "SECOND_ONLY_MODE"),
      }),
    );
  });

  it("rejects slot mode update with a stale expectedVersion before writing (FR-041)", async () => {
    findMonthAvailabilityForUpdateMock.mockResolvedValueOnce(juneRecord);

    await expect(
      updateAdminMonthSlotMode(
        "2026-06",
        { slotMode: "SECOND_ONLY_MODE", expectedVersion: 2, confirmAffectedAppointments: false },
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("AVAILABILITY_VERSION_CONFLICT");
    expect(replaceMonthAvailabilityMock).not.toHaveBeenCalled();
  });

  it("rejects slot mode update when month is in the past", async () => {
    findMonthAvailabilityForUpdateMock.mockResolvedValueOnce({ ...juneRecord, month: "2026-02" });

    await expect(
      updateAdminMonthSlotMode(
        "2026-02",
        { slotMode: "SECOND_ONLY_MODE", confirmAffectedAppointments: false },
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_IN_PAST");
    expect(replaceMonthAvailabilityMock).not.toHaveBeenCalled();
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
