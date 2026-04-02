import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { rejectPendingAppointment } from "@/lib/admin/appointments/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointments/service", () => ({
  rejectPendingAppointment: vi.fn(),
}));

const authMock = vi.mocked(auth);
const rejectPendingAppointmentMock = vi.mocked(rejectPendingAppointment);

describe("POST /api/admin/appointments/[appointmentId]/reject", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reject/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reject", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 200 when the pending appointment is rejected", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    rejectPendingAppointmentMock.mockResolvedValueOnce({
      appointmentId: 15,
      status: "REJECTED",
    });

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reject/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reject", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appointmentId: 15,
      status: "REJECTED",
    });
  });

  it("returns 409 when the appointment is not pending anymore", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    rejectPendingAppointmentMock.mockRejectedValueOnce(
      new Error("APPOINTMENT_STATUS_INVALID_TRANSITION"),
    );

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reject/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reject", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_STATUS_INVALID_TRANSITION",
      error: "APPOINTMENT_STATUS_INVALID_TRANSITION",
    });
  });
});
