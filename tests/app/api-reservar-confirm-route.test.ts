import { beforeEach, describe, expect, it, vi } from "vitest";

const confirmAppointmentWithLockMock = vi.fn();

vi.mock("@/lib/appointments/book-appointment", () => ({
  confirmAppointmentWithLock: confirmAppointmentWithLockMock,
}));

describe("POST /api/reservar/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 when confirmation succeeds", async () => {
    confirmAppointmentWithLockMock.mockResolvedValueOnce({
      appointmentId: 1,
      status: "CONFIRMED",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-14",
        timeSlot: "09:00",
      },
    });

    const { POST } = await import("@/app/api/reservar/confirm/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/confirm", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
          lockToken: "lock-123",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      appointmentId: 1,
      status: "CONFIRMED",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-14",
        timeSlot: "09:00",
      },
    });
  });

  it("returns 201 when confirmation creates a pending appointment", async () => {
    confirmAppointmentWithLockMock.mockResolvedValueOnce({
      appointmentId: 2,
      status: "PENDING",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-14",
        timeSlot: "09:00",
      },
    });

    const { POST } = await import("@/app/api/reservar/confirm/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/confirm", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
          lockToken: "lock-123",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      appointmentId: 2,
      status: "PENDING",
      whatsappPhone: "5215512345678",
      whatsappData: {
        name: "Ana Lopez",
        date: "2026-03-14",
        timeSlot: "09:00",
      },
    });
  });

  it("returns 409 when lock is expired", async () => {
    confirmAppointmentWithLockMock.mockRejectedValueOnce(
      new Error("LOCK_EXPIRED_OR_INVALID"),
    );

    const { POST } = await import("@/app/api/reservar/confirm/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/confirm", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
          lockToken: "lock-123",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "LOCK_EXPIRED_OR_INVALID",
      error: "LOCK_EXPIRED_OR_INVALID",
    });
  });

  it("returns 409 when appointment selected for reschedule is not found", async () => {
    confirmAppointmentWithLockMock.mockRejectedValueOnce(
      new Error("APPOINTMENT_NOT_FOUND"),
    );

    const { POST } = await import("@/app/api/reservar/confirm/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/confirm", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
          lockToken: "lock-123",
          appointmentIdToReschedule: 31,
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_NOT_FOUND",
      error: "APPOINTMENT_NOT_FOUND",
    });
  });
});
