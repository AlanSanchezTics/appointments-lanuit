import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertMonthIsBookable,
  listBookableMonths,
  reconcileActiveMonths,
} from "@/lib/active-months/service";
import {
  findActiveMonth,
  listActiveMonths,
  reconcileActiveMonthsInDatabase,
} from "@/lib/db/active-months";

vi.mock("@/lib/db/active-months", () => ({
  findActiveMonth: vi.fn(),
  listActiveMonths: vi.fn(),
  reconcileActiveMonthsInDatabase: vi.fn(),
}));

const findActiveMonthMock = vi.mocked(findActiveMonth);
const listActiveMonthsMock = vi.mocked(listActiveMonths);
const reconcileActiveMonthsInDatabaseMock = vi.mocked(reconcileActiveMonthsInDatabase);

describe("active months service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("accepts a future active month", async () => {
    findActiveMonthMock.mockResolvedValueOnce({
      id: 1,
      month: "2026-04",
      status: "ACTIVE",
    });

    await expect(assertMonthIsBookable("2026-04", new Date("2026-03-03T12:00:00.000Z"))).resolves.toBeUndefined();
  });

  it("rejects past months even if they are marked active", async () => {
    findActiveMonthMock.mockResolvedValueOnce({
      id: 1,
      month: "2026-02",
      status: "ACTIVE",
    });

    await expect(assertMonthIsBookable("2026-02", new Date("2026-03-03T12:00:00.000Z"))).rejects.toThrow(
      "MONTH_NOT_ALLOWED",
    );
  });

  it("rejects inactive or missing months", async () => {
    findActiveMonthMock.mockResolvedValueOnce(null);

    await expect(assertMonthIsBookable("2026-04", new Date("2026-03-03T12:00:00.000Z"))).rejects.toThrow(
      "MONTH_NOT_ALLOWED",
    );
  });

  it("lists only active months from current month onwards", async () => {
    listActiveMonthsMock.mockResolvedValueOnce([
      { id: 1, month: "2026-02", status: "ACTIVE" },
      { id: 2, month: "2026-03", status: "ACTIVE" },
      { id: 3, month: "2026-04", status: "ACTIVE" },
    ]);

    const result = await listBookableMonths(new Date("2026-03-03T12:00:00.000Z"));

    expect(result).toEqual(["2026-03", "2026-04"]);
  });

  it("reconciles current month window", async () => {
    const result = await reconcileActiveMonths(new Date("2026-03-03T12:00:00.000Z"), 2);

    expect(reconcileActiveMonthsInDatabaseMock).toHaveBeenCalledWith({
      currentMonth: "2026-03",
      windowMonths: ["2026-03", "2026-04"],
    });
    expect(result).toEqual({
      currentMonth: "2026-03",
      windowMonths: ["2026-03", "2026-04"],
      windowSize: 2,
    });
  });
});
