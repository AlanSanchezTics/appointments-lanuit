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
      whatsappUrl: "https://wa.me/test",
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
      whatsappUrl: "https://wa.me/test",
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
    await expect(response.json()).resolves.toEqual({ error: "LOCK_EXPIRED_OR_INVALID" });
  });
});
