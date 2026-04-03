import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { trackAdminAppointmentReminder } from "@/lib/admin/appointments/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/appointments/service", () => ({
  trackAdminAppointmentReminder: vi.fn(),
}));

const authMock = vi.mocked(auth);
const trackAdminAppointmentReminderMock = vi.mocked(trackAdminAppointmentReminder);

describe("POST /api/admin/appointments/[appointmentId]/reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reminders/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderType: "NEXT_DAY",
          targetPhone: "5512345678",
          message: "Hola, tienes una cita mañana.",
        }),
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

  it("returns 200 when reminder tracking succeeds", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "7", name: "admin" } } as never);
    trackAdminAppointmentReminderMock.mockResolvedValueOnce({
      appointmentId: 15,
      reminderType: "NEXT_DAY",
      targetPhone: "5512345678",
      message: "Hola, tienes una cita mañana.",
      sentByAdminUserId: 7,
      openedAt: "2026-04-03T12:00:00.000Z",
    });

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reminders/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderType: "NEXT_DAY",
          targetPhone: "5512345678",
          message: "Hola, tienes una cita mañana.",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(200);
    expect(trackAdminAppointmentReminderMock).toHaveBeenCalledWith(15, {
      reminderType: "NEXT_DAY",
      targetPhone: "5512345678",
      message: "Hola, tienes una cita mañana.",
      sentByAdminUserId: 7,
    });
    await expect(response.json()).resolves.toEqual({
      appointmentId: 15,
      reminderType: "NEXT_DAY",
      targetPhone: "5512345678",
      message: "Hola, tienes una cita mañana.",
      sentByAdminUserId: 7,
      openedAt: "2026-04-03T12:00:00.000Z",
    });
  });

  it("returns 404 when the appointment does not exist", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "7", name: "admin" } } as never);
    trackAdminAppointmentReminderMock.mockRejectedValueOnce(
      new Error("APPOINTMENT_NOT_FOUND"),
    );

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reminders/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderType: "NEXT_WEEK",
          targetPhone: "5512345678",
          message: "Hola, tenemos un recordatorio para ti.",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_NOT_FOUND",
      error: "APPOINTMENT_NOT_FOUND",
    });
  });

  it("returns 409 when the reminder was already sent", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "7", name: "admin" } } as never);
    trackAdminAppointmentReminderMock.mockRejectedValueOnce(
      new Error("APPOINTMENT_REMINDER_ALREADY_SENT"),
    );

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reminders/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/15/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderType: "NEXT_DAY",
          targetPhone: "5512345678",
          message: "Hola, tienes una cita mañana.",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "15" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_REMINDER_ALREADY_SENT",
      error: "APPOINTMENT_REMINDER_ALREADY_SENT",
    });
  });

  it("returns 400 when appointmentId is invalid", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "7", name: "admin" } } as never);

    const { POST } = await import(
      "@/app/api/admin/appointments/[appointmentId]/reminders/route"
    );
    const response = await POST(
      new Request("http://localhost/api/admin/appointments/nope/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reminderType: "NEXT_DAY",
          targetPhone: "5512345678",
          message: "Hola, tienes una cita mañana.",
        }),
      }),
      {
        params: Promise.resolve({ appointmentId: "nope" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_ID_INVALID",
      error: "APPOINTMENT_ID_INVALID",
    });
    expect(trackAdminAppointmentReminderMock).not.toHaveBeenCalled();
  });
});
