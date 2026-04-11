import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import {
  deleteAdminBlockedSlot,
  updateAdminBlockedSlot,
} from "@/lib/admin/blocked-spaces/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/blocked-spaces/service", () => ({
  updateAdminBlockedSlot: vi.fn(),
  deleteAdminBlockedSlot: vi.fn(),
}));

const authMock = vi.mocked(auth);
const updateAdminBlockedSlotMock = vi.mocked(updateAdminBlockedSlot);
const deleteAdminBlockedSlotMock = vi.mocked(deleteAdminBlockedSlot);

describe("PATCH/DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { PATCH } = await import(
      "@/app/api/admin/months/[month]/blocked-slots/[blockedSlotId]/route"
    );
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-03/blocked-slots/12", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "DESCANSO" }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
          blockedSlotId: "12",
        }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 on update", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    updateAdminBlockedSlotMock.mockResolvedValueOnce({
      month: "2026-03",
      blockedSlotId: 12,
      date: "2026-03-21",
      timeSlot: "13:00",
      reason: "PERSONAL",
      syncSummary: {
        total: 1,
        synced: 1,
        failed: 0,
      },
      syncWarnings: [],
    });

    const { PATCH } = await import(
      "@/app/api/admin/months/[month]/blocked-slots/[blockedSlotId]/route"
    );
    const response = await PATCH(
      new Request("http://localhost/api/admin/months/2026-03/blocked-slots/12", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "PERSONAL" }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
          blockedSlotId: "12",
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      month: "2026-03",
      blockedSlotId: 12,
      date: "2026-03-21",
      timeSlot: "13:00",
      reason: "PERSONAL",
      syncSummary: {
        total: 1,
        synced: 1,
        failed: 0,
      },
      syncWarnings: [],
    });
    expect(updateAdminBlockedSlotMock).toHaveBeenCalledWith({
      month: "2026-03",
      blockedSlotId: 12,
      reason: "PERSONAL",
    });
  });

  it("returns 200 on delete", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    deleteAdminBlockedSlotMock.mockResolvedValueOnce({
      month: "2026-03",
      blockedSlotId: 12,
      status: "DELETED",
      syncSummary: {
        total: 1,
        synced: 1,
        failed: 0,
      },
      syncWarnings: [],
    });

    const { DELETE } = await import(
      "@/app/api/admin/months/[month]/blocked-slots/[blockedSlotId]/route"
    );
    const response = await DELETE(
      new Request("http://localhost/api/admin/months/2026-03/blocked-slots/12", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
          blockedSlotId: "12",
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      month: "2026-03",
      blockedSlotId: 12,
      status: "DELETED",
      syncSummary: {
        total: 1,
        synced: 1,
        failed: 0,
      },
      syncWarnings: [],
    });
    expect(deleteAdminBlockedSlotMock).toHaveBeenCalledWith({
      month: "2026-03",
      blockedSlotId: 12,
    });
  });
});
