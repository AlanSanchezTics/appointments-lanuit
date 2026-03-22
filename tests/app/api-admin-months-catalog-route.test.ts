import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getMonthsCatalog } from "@/lib/admin/months/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/months/service", () => ({
  getMonthsCatalog: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getMonthsCatalogMock = vi.mocked(getMonthsCatalog);

describe("GET /api/admin/months/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/months/catalog/route");
    const response = await GET(new Request("http://localhost/api/admin/months/catalog"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns catalog payload with parsed filters", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getMonthsCatalogMock.mockResolvedValueOnce({
      filters: {
        year: 2026,
        status: "ACTIVE",
        availableYears: [2026, 2027, 2028],
      },
      metrics: {
        activeMonths: 4,
        inactiveMonths: 8,
        futureMonths: 5,
        pastMonths: 2,
        pastAppointments: 6,
        futureAppointments: 9,
      },
      months: [{ month: "2026-03", status: "ACTIVE" }],
      total: 1,
      currentMonth: "2026-03",
      currentDate: "2026-03-12",
    });

    const { GET } = await import("@/app/api/admin/months/catalog/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/catalog?year=2026&status=ACTIVE"),
    );

    expect(response.status).toBe(200);
    expect(getMonthsCatalogMock).toHaveBeenCalledWith({
      year: 2026,
      status: "ACTIVE",
      availableYears: [2026, 2027, 2028, 2029, 2030, 2031],
    });
    await expect(response.json()).resolves.toEqual({
      filters: {
        year: 2026,
        status: "ACTIVE",
        availableYears: [2026, 2027, 2028],
      },
      metrics: {
        activeMonths: 4,
        inactiveMonths: 8,
        futureMonths: 5,
        pastMonths: 2,
        pastAppointments: 6,
        futureAppointments: 9,
      },
      months: [{ month: "2026-03", status: "ACTIVE" }],
      total: 1,
      currentMonth: "2026-03",
      currentDate: "2026-03-12",
    });
  });

  it("returns 400 when query validation fails", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    const { GET } = await import("@/app/api/admin/months/catalog/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/catalog?year=2010&status=ALL"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTHS_YEAR_OUT_OF_RANGE",
      error: "MONTHS_YEAR_OUT_OF_RANGE",
    });
  });
});
