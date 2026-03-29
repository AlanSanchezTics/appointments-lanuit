import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { cancelAdminAppointment } from "@/lib/admin/appointments/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointments/service", () => ({
  cancelAdminAppointment: vi.fn(),
}));

const authMock = vi.mocked(auth);
const cancelAdminAppointmentMock = vi.mocked(cancelAdminAppointment);

describe("POST /api/admin/appointments/[appointmentId]/cancel", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/admin/appointments/[appointmentId]/cancel/route");
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/cancel", {
        method: "POST",
        body: JSON.stringify({
          month: "2026-03",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 when cancellation succeeds", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    cancelAdminAppointmentMock.mockResolvedValueOnce({
      appointmentId: 15,
      status: "CANCELLED",
    });

    const { POST } = await import("@/app/api/admin/appointments/[appointmentId]/cancel/route");
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/cancel", {
        method: "POST",
        body: JSON.stringify({
          month: "2026-03",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(200);
    expect(cancelAdminAppointmentMock).toHaveBeenCalledWith(15, {
      month: "2026-03",
    });
  });

  it("returns 404 when appointment is not found", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    cancelAdminAppointmentMock.mockRejectedValueOnce(new Error("APPOINTMENT_NOT_FOUND"));

    const { POST } = await import("@/app/api/admin/appointments/[appointmentId]/cancel/route");
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/cancel", {
        method: "POST",
        body: JSON.stringify({
          month: "2026-03",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(404);
  });
});
