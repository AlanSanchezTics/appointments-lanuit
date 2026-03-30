import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminClientDetail } from "@/lib/admin/clients/detail-service";
import { updateAdminClient } from "@/lib/admin/clients/update-service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/clients/detail-service", () => ({
  getAdminClientDetail: vi.fn(),
}));

vi.mock("@/lib/admin/clients/update-service", () => ({
  updateAdminClient: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getAdminClientDetailMock = vi.mocked(getAdminClientDetail);
const updateAdminClientMock = vi.mocked(updateAdminClient);

describe("GET/PATCH /api/admin/clients/[clientId]", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/clients/[clientId]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/42"),
      {
        params: Promise.resolve({
          clientId: "42",
        }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 200 with client detail", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminClientDetailMock.mockResolvedValueOnce({
      client: {
        clientId: 42,
        name: "Ana",
        phone: "5512345678",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
      },
      summary: {
        totalAppointments: 1,
        activeAppointments: 1,
        cancelledAppointments: 0,
        futureActiveAppointments: 1,
        lastAppointmentDate: "2026-03-29",
        nextAppointmentDate: "2026-03-29",
        nextAppointmentTimeSlot: "14:00",
      },
      appointments: [],
      currentDate: "2026-03-21",
    });

    const { GET } = await import("@/app/api/admin/clients/[clientId]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/42"),
      {
        params: Promise.resolve({
          clientId: "42",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(getAdminClientDetailMock).toHaveBeenCalledWith(42);
  });

  it("returns 404 when client detail does not exist", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminClientDetailMock.mockRejectedValueOnce(new Error("CLIENT_NOT_FOUND"));

    const { GET } = await import("@/app/api/admin/clients/[clientId]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/999"),
      {
        params: Promise.resolve({
          clientId: "999",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "CLIENT_NOT_FOUND",
      error: "CLIENT_NOT_FOUND",
    });
  });

  it("returns 200 on PATCH", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    updateAdminClientMock.mockResolvedValueOnce({
      clientId: 42,
      name: "Ana Garcia",
      phone: "5512345678",
      updatedAt: "2026-03-21T12:00:00.000Z",
    });

    const { PATCH } = await import("@/app/api/admin/clients/[clientId]/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/clients/42", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ana Garcia",
        }),
      }),
      {
        params: Promise.resolve({
          clientId: "42",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateAdminClientMock).toHaveBeenCalledWith(42, {
      name: "Ana Garcia",
    });
  });

  it("returns 400 when clientId param is invalid", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    const { GET } = await import("@/app/api/admin/clients/[clientId]/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/nope"),
      {
        params: Promise.resolve({
          clientId: "nope",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "CLIENT_ID_INVALID",
      error: "CLIENT_ID_INVALID",
    });
  });
});
