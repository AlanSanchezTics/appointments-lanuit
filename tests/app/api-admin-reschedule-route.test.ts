import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { rescheduleAdminAppointment } from "@/lib/admin/appointments/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointments/service", () => ({
  rescheduleAdminAppointment: vi.fn(),
}));

const authMock = vi.mocked(auth);
const rescheduleAdminAppointmentMock = vi.mocked(rescheduleAdminAppointment);

describe("PATCH /api/admin/appointments/[appointmentId]/reschedule", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { PATCH } = await import("@/app/api/admin/appointments/[appointmentId]/reschedule/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/appointments/11/reschedule", {
        method: "PATCH",
        body: JSON.stringify({
          month: "2026-03",
          date: "2026-03-17",
          timeSlot: "14:00",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "11" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 200 with reschedule response", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    rescheduleAdminAppointmentMock.mockResolvedValueOnce({
      appointmentId: 11,
      date: "2026-03-17",
      timeSlot: "14:00",
      status: "CONFIRMED",
    });

    const { PATCH } = await import("@/app/api/admin/appointments/[appointmentId]/reschedule/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/appointments/11/reschedule", {
        method: "PATCH",
        body: JSON.stringify({
          month: "2026-03",
          date: "2026-03-17",
          timeSlot: "14:00",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "11" }),
      },
    );

    expect(response.status).toBe(200);
    expect(rescheduleAdminAppointmentMock).toHaveBeenCalledWith(11, {
      month: "2026-03",
      date: "2026-03-17",
      timeSlot: "14:00",
    });
  });

  it("returns 409 when slot is not available", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    rescheduleAdminAppointmentMock.mockRejectedValueOnce(new Error("SLOT_NOT_AVAILABLE"));

    const { PATCH } = await import("@/app/api/admin/appointments/[appointmentId]/reschedule/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/appointments/11/reschedule", {
        method: "PATCH",
        body: JSON.stringify({
          month: "2026-03",
          date: "2026-03-17",
          timeSlot: "14:00",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "11" }),
      },
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when appointment is not editable", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    rescheduleAdminAppointmentMock.mockRejectedValueOnce(
      new Error("APPOINTMENT_NOT_EDITABLE"),
    );

    const { PATCH } = await import("@/app/api/admin/appointments/[appointmentId]/reschedule/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/appointments/11/reschedule", {
        method: "PATCH",
        body: JSON.stringify({
          month: "2026-03",
          date: "2026-03-17",
          timeSlot: "14:00",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "11" }),
      },
    );

    expect(response.status).toBe(409);
  });
});
