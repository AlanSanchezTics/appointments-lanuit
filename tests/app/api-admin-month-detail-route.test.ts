import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/months/detail-service", () => ({
  getAdminMonthDetail: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getAdminMonthDetailMock = vi.mocked(getAdminMonthDetail);

describe("GET /api/admin/months/[month]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/months/[month]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03"),
      { params: Promise.resolve({ month: "2026-03" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 400 when month format is invalid", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    const { GET } = await import("@/app/api/admin/months/[month]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-13"),
      { params: Promise.resolve({ month: "2026-13" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTHS_INVALID_FORMAT",
      error: "MONTHS_INVALID_FORMAT",
    });
  });

  it("returns 404 when month is not registered", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminMonthDetailMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));

    const { GET } = await import("@/app/api/admin/months/[month]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03"),
      { params: Promise.resolve({ month: "2026-03" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_NOT_REGISTERED",
      error: "MONTH_NOT_REGISTERED",
    });
  });

  it("returns detail payload when request is valid", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminMonthDetailMock.mockResolvedValueOnce({
      month: "2026-03",
      monthStatus: "ACTIVE",
      currentMonth: "2026-03",
      currentDate: "2026-03-21",
      isPastMonth: false,
      projectedSaturationPercent: 15,
      metrics: {
        confirmedAppointments: 8,
        cancelledAppointments: 1,
        availableSpaces: 46,
        blockedSpaces: 0,
        occupiedSpaces: 8,
      },
      calendarDays: [],
    });

    const { GET } = await import("@/app/api/admin/months/[month]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03"),
      { params: Promise.resolve({ month: "2026-03" }) },
    );

    expect(response.status).toBe(200);
    expect(getAdminMonthDetailMock).toHaveBeenCalledWith("2026-03");
    await expect(response.json()).resolves.toEqual({
      month: "2026-03",
      monthStatus: "ACTIVE",
      currentMonth: "2026-03",
      currentDate: "2026-03-21",
      isPastMonth: false,
      projectedSaturationPercent: 15,
      metrics: {
        confirmedAppointments: 8,
        cancelledAppointments: 1,
        availableSpaces: 46,
        blockedSpaces: 0,
        occupiedSpaces: 8,
      },
      calendarDays: [],
    });
  });
});
