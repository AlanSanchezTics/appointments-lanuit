import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminDayAgenda } from "@/lib/admin/appointments/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointments/service", () => ({
  getAdminDayAgenda: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getAdminDayAgendaMock = vi.mocked(getAdminDayAgenda);

describe("GET /api/admin/months/[month]/days/[date]/agenda", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/months/[month]/days/[date]/agenda/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/days/2026-03-13/agenda"),
      {
        params: Promise.resolve({
          month: "2026-03",
          date: "2026-03-13",
        }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 200 with day agenda payload", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminDayAgendaMock.mockResolvedValueOnce({
      month: "2026-03",
      date: "2026-03-13",
      total: 1,
      appointments: [
        {
          appointmentId: 100,
          date: "2026-03-13",
          timeSlot: "09:00",
          status: "CONFIRMED",
          name: "Ana Garcia",
          phone: "5512345678",
        },
      ],
    });

    const { GET } = await import("@/app/api/admin/months/[month]/days/[date]/agenda/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/days/2026-03-13/agenda"),
      {
        params: Promise.resolve({
          month: "2026-03",
          date: "2026-03-13",
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      month: "2026-03",
      date: "2026-03-13",
      total: 1,
      appointments: [
        {
          appointmentId: 100,
          date: "2026-03-13",
          timeSlot: "09:00",
          status: "CONFIRMED",
          name: "Ana Garcia",
          phone: "5512345678",
        },
      ],
    });
    expect(getAdminDayAgendaMock).toHaveBeenCalledWith({
      month: "2026-03",
      date: "2026-03-13",
    });
  });

  it("returns 404 when month is not registered", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminDayAgendaMock.mockRejectedValueOnce(new Error("MONTH_NOT_REGISTERED"));

    const { GET } = await import("@/app/api/admin/months/[month]/days/[date]/agenda/route");
    const response = await GET(
      new Request("http://localhost/api/admin/months/2026-03/days/2026-03-13/agenda"),
      {
        params: Promise.resolve({
          month: "2026-03",
          date: "2026-03-13",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_NOT_REGISTERED",
      error: "MONTH_NOT_REGISTERED",
    });
  });
});
