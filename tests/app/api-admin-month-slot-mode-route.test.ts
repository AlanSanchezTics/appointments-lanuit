import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { updateAdminMonthSlotMode } from "@/lib/admin/months/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/months/service", () => ({
  updateAdminMonthSlotMode: vi.fn(),
}));

const authMock = vi.mocked(auth);
const updateAdminMonthSlotModeMock = vi.mocked(updateAdminMonthSlotMode);

describe("PATCH /api/admin/months/[month]/slot-mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
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
    updateAdminMonthSlotModeMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
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
    updateAdminMonthSlotModeMock.mockRejectedValueOnce(new Error("MONTH_IN_PAST"));

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_IN_PAST",
      error: "MONTH_IN_PAST",
    });
  });

  it("updates month slot mode when payload is valid", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    updateAdminMonthSlotModeMock.mockResolvedValueOnce({
      month: "2026-05",
      slotMode: "SECOND_ONLY_MODE",
    });

    const { PATCH } = await import("@/app/api/admin/months/[month]/slot-mode/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-05/slot-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotMode: "SECOND_ONLY_MODE" }),
      }),
      { params: Promise.resolve({ month: "2026-05" }) },
    );

    expect(response.status).toBe(200);
    expect(updateAdminMonthSlotModeMock).toHaveBeenCalledWith(
      "2026-05",
      "SECOND_ONLY_MODE",
    );
    await expect(response.json()).resolves.toEqual({
      month: "2026-05",
      slotMode: "SECOND_ONLY_MODE",
    });
  });
});

