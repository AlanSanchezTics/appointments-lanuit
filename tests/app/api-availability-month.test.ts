import { beforeEach, describe, expect, it, vi } from "vitest";

const getMonthAvailabilityMock = vi.fn();

vi.mock("@/lib/availability/service", () => ({
  getMonthAvailability: getMonthAvailabilityMock,
}));

describe("GET /api/availability/[month]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the month availability payload", async () => {
    getMonthAvailabilityMock.mockResolvedValueOnce([
      {
        date: "2026-03-04",
        slots: ["09:00", "13:00"],
      },
    ]);

    const { GET } = await import("@/app/api/availability/[month]/route");
    const response = await GET(new Request("http://localhost/api/availability/2026-03"), {
      params: Promise.resolve({ month: "2026-03" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      month: "2026-03",
      days: [
        {
          date: "2026-03-04",
          slots: ["09:00", "13:00"],
        },
      ],
    });
  });

  it("returns 422 when availability validation fails", async () => {
    getMonthAvailabilityMock.mockRejectedValueOnce(new Error("MONTH_NOT_ALLOWED"));

    const { GET } = await import("@/app/api/availability/[month]/route");
    const response = await GET(new Request("http://localhost/api/availability/2026-04"), {
      params: Promise.resolve({ month: "2026-04" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "MONTH_NOT_ALLOWED",
    });
  });
});
