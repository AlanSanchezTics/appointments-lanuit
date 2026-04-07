import { beforeEach, describe, expect, it, vi } from "vitest";

import { listHomeAvailableMonths } from "@/lib/home/service";
import { listBookableMonths } from "@/lib/active-months/service";
import { getMonthAvailability } from "@/lib/availability/service";

vi.mock("@/lib/active-months/service", () => ({
  listBookableMonths: vi.fn(),
}));

vi.mock("@/lib/availability/service", () => ({
  getMonthAvailability: vi.fn(),
}));

const listBookableMonthsMock = vi.mocked(listBookableMonths);
const getMonthAvailabilityMock = vi.mocked(getMonthAvailability);

describe("home service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns only active months that still have available slots", async () => {
    listBookableMonthsMock.mockResolvedValueOnce(["2026-03", "2026-04", "2026-05"]);
    getMonthAvailabilityMock.mockImplementation(async (month: string) => {
      if (month === "2026-03") {
        return [{ date: "2026-03-10", slots: ["09:00"] }];
      }

      if (month === "2026-04") {
        return [];
      }

      return [{ date: "2026-05-12", slots: ["10:00"] }];
    });

    const result = await listHomeAvailableMonths(new Date("2026-03-03T12:00:00.000Z"));

    expect(result).toEqual(["2026-03", "2026-05"]);
    expect(getMonthAvailabilityMock).toHaveBeenCalledTimes(3);
  });

  it("skips months that fail availability resolution", async () => {
    listBookableMonthsMock.mockResolvedValueOnce(["2026-03", "2026-04"]);
    getMonthAvailabilityMock.mockImplementation(async (month: string) => {
      if (month === "2026-03") {
        return [{ date: "2026-03-10", slots: ["09:00"] }];
      }

      throw new Error("MONTH_NOT_ALLOWED");
    });

    const result = await listHomeAvailableMonths(new Date("2026-03-03T12:00:00.000Z"));

    expect(result).toEqual(["2026-03"]);
  });
});
