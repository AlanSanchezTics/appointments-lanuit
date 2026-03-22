import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { createAdminMonths } from "@/lib/admin/months/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/months/service", () => ({
  createAdminMonths: vi.fn(),
}));

const authMock = vi.mocked(auth);
const createAdminMonthsMock = vi.mocked(createAdminMonths);

describe("POST /api/admin/months", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when request is unauthenticated", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/admin/months/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months", {
        method: "POST",
        body: JSON.stringify({
          year: 2026,
          months: ["2026-06"],
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("creates missing months and returns summary payload", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    createAdminMonthsMock.mockResolvedValueOnce({
      createdMonths: ["2026-06", "2026-07"],
      skippedMonths: ["2026-08"],
      totalCreated: 2,
      totalSkipped: 1,
    });

    const { POST } = await import("@/app/api/admin/months/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months", {
        method: "POST",
        body: JSON.stringify({
          year: 2026,
          months: ["2026-06", "2026-07", "2026-08"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createAdminMonthsMock).toHaveBeenCalledWith({
      year: 2026,
      months: ["2026-06", "2026-07", "2026-08"],
    });
    await expect(response.json()).resolves.toEqual({
      createdMonths: ["2026-06", "2026-07"],
      skippedMonths: ["2026-08"],
      totalCreated: 2,
      totalSkipped: 1,
    });
  });

  it("returns 400 when month selection is empty", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    const { POST } = await import("@/app/api/admin/months/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months", {
        method: "POST",
        body: JSON.stringify({
          year: 2026,
          months: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTHS_EMPTY_SELECTION",
      error: "MONTHS_EMPTY_SELECTION",
    });
  });
});
