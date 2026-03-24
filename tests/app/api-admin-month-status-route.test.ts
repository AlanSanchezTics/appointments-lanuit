import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { updateAdminMonthStatus } from "@/lib/admin/months/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/months/service", () => ({
  updateAdminMonthStatus: vi.fn(),
}));

const authMock = vi.mocked(auth);
const updateAdminMonthStatusMock = vi.mocked(updateAdminMonthStatus);

describe("PATCH /api/admin/months/[month]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { PATCH } = await import("@/app/api/admin/months/[month]/status/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 404 when month is not registered", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthStatusMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/status/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_NOT_REGISTERED",
      error: "MONTH_NOT_REGISTERED",
    });
  });

  it("returns 422 when trying to update a past month", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthStatusMock.mockRejectedValueOnce(new Error("MONTH_IN_PAST"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/status/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_IN_PAST",
      error: "MONTH_IN_PAST",
    });
  });

  it("updates month status when payload is valid", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthStatusMock.mockResolvedValueOnce({
      month: "2026-05",
      status: "INACTIVE",
    });

    const { PATCH } = await import("@/app/api/admin/months/[month]/status/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(200);
    expect(updateAdminMonthStatusMock).toHaveBeenCalledWith(
      "2026-05",
      "INACTIVE",
    );
    await expect(response.json()).resolves.toEqual({
      month: "2026-05",
      status: "INACTIVE",
    });
  });
});
