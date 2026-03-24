import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { createAdminBlockedSlots } from "@/lib/admin/blocked-spaces/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/blocked-spaces/service", () => ({
  createAdminBlockedSlots: vi.fn(),
}));

const authMock = vi.mocked(auth);
const createAdminBlockedSlotsMock = vi.mocked(createAdminBlockedSlots);

describe("POST /api/admin/months/[month]/blocked-slots", () => {
  it("returns 401 when no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/admin/months/[month]/blocked-slots/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          slots: ["13:00"],
          reason: "DESCANSO",
        }),
      }),
      {
        params: Promise.resolve({ month: "2026-03" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 when blocked slots are created", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "7", name: "admin" } } as never);
    createAdminBlockedSlotsMock.mockResolvedValueOnce({
      month: "2026-03",
      date: "2026-03-21",
      reason: "DESCANSO",
      totalCreated: 1,
      blockedSlots: [
        {
          date: "2026-03-21",
          timeSlot: "13:00",
          reason: "DESCANSO",
        },
      ],
    });

    const { POST } = await import("@/app/api/admin/months/[month]/blocked-slots/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          slots: ["13:00"],
          reason: "DESCANSO",
        }),
      }),
      {
        params: Promise.resolve({ month: "2026-03" }),
      },
    );

    expect(response.status).toBe(200);
    expect(createAdminBlockedSlotsMock).toHaveBeenCalledWith({
      month: "2026-03",
      date: "2026-03-21",
      slots: ["13:00"],
      reason: "DESCANSO",
      createdByAdminId: 7,
    });
  });
});
