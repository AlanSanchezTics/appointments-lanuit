import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

const notFoundMock = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/months/detail-service", () => ({
  getAdminMonthDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("@/components/admin/months/MonthDetailView", () => ({
  MonthDetailView: () => <div>month-detail-view</div>,
}));

const authMock = vi.mocked(auth);
const getAdminMonthDetailMock = vi.mocked(getAdminMonthDetail);

describe("admin month detail page", () => {
  it("redirects to login when session does not exist", async () => {
    authMock.mockResolvedValueOnce(null as never);
    const pageModule = await import("@/app/admin/months/[month]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ month: "2026-03" }),
      }),
    ).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("calls notFound when route month key is invalid", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    const pageModule = await import("@/app/admin/months/[month]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ month: "2026-13" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("calls notFound when month is not registered", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminMonthDetailMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));
    const pageModule = await import("@/app/admin/months/[month]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ month: "2026-03" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders month detail view on valid authenticated request", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminMonthDetailMock.mockResolvedValueOnce({
      month: "2026-03",
      monthStatus: "ACTIVE",
      slotMode: "BLOCK_MODE",
      currentMonth: "2026-03",
      currentDate: "2026-03-21",
      isPastMonth: false,
      projectedSaturationPercent: 25,
      metrics: {
        confirmedAppointments: 3,
        cancelledAppointments: 1,
        availableSpaces: 9,
        blockedSpaces: 0,
        occupiedSpaces: 3,
      },
      calendarDays: [],
    });
    const pageModule = await import("@/app/admin/months/[month]/page");

    const result = await pageModule.default({
      params: Promise.resolve({ month: "2026-03" }),
    });

    expect(getAdminMonthDetailMock).toHaveBeenCalledWith("2026-03");
    expect(result).toBeTruthy();
  });
});
