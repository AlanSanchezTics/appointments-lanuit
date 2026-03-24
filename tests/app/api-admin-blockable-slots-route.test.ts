import { describe, expect, it, vi } from "vitest";

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
});
