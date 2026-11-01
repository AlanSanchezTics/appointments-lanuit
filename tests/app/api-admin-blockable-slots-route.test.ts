import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminBlockableSlots } from "@/lib/admin/blocked-spaces/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/blocked-spaces/service", () => ({
  getAdminBlockableSlots: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getAdminBlockableSlotsMock = vi.mocked(getAdminBlockableSlots);

describe("GET /api/admin/months/[month]/blockable-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/months/[month]/blockable-slots/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/blockable-slots?date=2026-03-21"),
      {
        params: Promise.resolve({ month: "2026-03" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 with blockable slots payload", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminBlockableSlotsMock.mockResolvedValueOnce({
      month: "2026-03",
      currentDate: "2026-03-21",
      days: [
        {
          date: "2026-03-21",
          slots: ["13:00", "14:00"],
        },
      ],
    });

    const { GET } = await import("@/app/api/admin/months/[month]/blockable-slots/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/blockable-slots?date=2026-03-21"),
      {
        params: Promise.resolve({ month: "2026-03" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      month: "2026-03",
      currentDate: "2026-03-21",
      days: [
        {
          date: "2026-03-21",
          slots: ["13:00", "14:00"],
        },
      ],
    });
  });

  it("returns 200 with empty slots for a day without offered times (D46, resolvedor)", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminBlockableSlotsMock.mockResolvedValueOnce({
      month: "2026-03",
      currentDate: "2026-03-21",
      days: [{ date: "2026-03-22", slots: [] }],
    });

    const { GET } = await import("@/app/api/admin/months/[month]/blockable-slots/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/blockable-slots?date=2026-03-22"),
      { params: Promise.resolve({ month: "2026-03" }) },
    );

    expect(response.status).toBe(200);
    expect(getAdminBlockableSlotsMock).toHaveBeenCalledWith({ month: "2026-03", date: "2026-03-22" });
    await expect(response.json()).resolves.toMatchObject({ days: [{ date: "2026-03-22", slots: [] }] });
  });

  it("returns 404 MONTH_NOT_REGISTERED when the month is not registered", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminBlockableSlotsMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));

    const { GET } = await import("@/app/api/admin/months/[month]/blockable-slots/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/blockable-slots?date=2026-03-21"),
      { params: Promise.resolve({ month: "2026-03" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ errorCode: "MONTH_NOT_REGISTERED", error: "MONTH_NOT_REGISTERED" });
  });

  it.each(["2026-02-30", "2026/03/21"])(
    "returns 400 DATE_INVALID_FORMAT for the malformed or impossible date %s",
    async (date) => {
      authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

      const { GET } = await import("@/app/api/admin/months/[month]/blockable-slots/route");
      const response = await GET(
        new Request(`http://localhost/api/admin/months/2026-03/blockable-slots?date=${encodeURIComponent(date)}`),
        { params: Promise.resolve({ month: "2026-03" }) },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errorCode: "DATE_INVALID_FORMAT", error: "DATE_INVALID_FORMAT" });
      expect(getAdminBlockableSlotsMock).not.toHaveBeenCalled();
    },
  );
});
