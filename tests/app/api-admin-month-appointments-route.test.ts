import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { createAdminAppointment } from "@/lib/admin/appointments/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointments/service", () => ({
  createAdminAppointment: vi.fn(),
}));

const authMock = vi.mocked(auth);
const createAdminAppointmentMock = vi.mocked(createAdminAppointment);

describe("POST /api/admin/months/[month]/appointments", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 201 for existing client payload", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", name: "admin" } } as never);
    createAdminAppointmentMock.mockResolvedValueOnce({
      appointmentId: 100,
      date: "2026-03-21",
      timeSlot: "10:00",
      status: "CONFIRMED",
      client: {
        clientId: 1,
        name: "Ana Garcia",
        phone: "5512345678",
      },
    });

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(createAdminAppointmentMock).toHaveBeenCalledWith({
      month: "2026-03",
      date: "2026-03-21",
      timeSlot: "10:00",
      clientId: 1,
    });
  });

  it("returns 201 for inline new client payload", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", name: "admin" } } as never);
    createAdminAppointmentMock.mockResolvedValueOnce({
      appointmentId: 101,
      date: "2026-03-21",
      timeSlot: "14:00",
      status: "SYNC_FAILED",
      syncReason: "CALENDAR_NOT_CONFIGURED",
      client: {
        clientId: 44,
        name: "Maria Perez",
        phone: "5511112233",
      },
    });

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "14:00",
          client: {
            name: "Maria Perez",
            phone: "5511112233",
          },
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(createAdminAppointmentMock).toHaveBeenCalledWith({
      month: "2026-03",
      date: "2026-03-21",
      timeSlot: "14:00",
      client: {
        name: "Maria Perez",
        phone: "5511112233",
      },
    });
  });

  it("returns 422 for inactive month", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", name: "admin" } } as never);
    createAdminAppointmentMock.mockRejectedValueOnce(new Error("MONTH_NOT_ACTIVE"));

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      errorCode: "MONTH_NOT_ACTIVE",
      error: "MONTH_NOT_ACTIVE",
    });
  });

  it("returns 404 when client does not exist", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", name: "admin" } } as never);
    createAdminAppointmentMock.mockRejectedValueOnce(new Error("CLIENT_NOT_FOUND"));

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 999,
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "CLIENT_NOT_FOUND",
      error: "CLIENT_NOT_FOUND",
    });
  });

  it("returns 409 when slot is not available", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", name: "admin" } } as never);
    createAdminAppointmentMock.mockRejectedValueOnce(new Error("SLOT_NOT_AVAILABLE"));

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "SLOT_NOT_AVAILABLE",
      error: "SLOT_NOT_AVAILABLE",
    });
  });

  it("returns 400 for invalid payload", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1", name: "admin" } } as never);

    const { POST } = await import("@/app/api/admin/months/[month]/appointments/route");
    const response = await POST(
      new Request("http://localhost/api/admin/months/2026-03/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-03-21",
          timeSlot: "10:00",
        }),
      }),
      {
        params: Promise.resolve({
          month: "2026-03",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "VALIDATION_ERROR",
      error: "VALIDATION_ERROR",
    });
  });
});
