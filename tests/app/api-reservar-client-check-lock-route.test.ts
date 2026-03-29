import { beforeEach, describe, expect, it, vi } from "vitest";

const checkClientAndAcquireReservationSlotLockMock = vi.fn();

vi.mock("@/lib/appointments/lock-reservation-slot", () => ({
  checkClientAndAcquireReservationSlotLock: checkClientAndAcquireReservationSlotLockMock,
}));

describe("/api/reservar/client-check-lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 when check+lock succeeds", async () => {
    checkClientAndAcquireReservationSlotLockMock.mockResolvedValueOnce({
      lockToken: "lock-123",
      expiresAt: "2026-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Lopez",
      futureAppointmentsInMonth: [],
    });

    const { POST } = await import("@/app/api/reservar/client-check-lock/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/client-check-lock", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      lockToken: "lock-123",
      expiresAt: "2026-03-13T12:10:00.000Z",
      clientExists: true,
      clientName: "Ana Lopez",
      futureAppointmentsInMonth: [],
    });
  });

  it("returns 409 for lock conflicts", async () => {
    checkClientAndAcquireReservationSlotLockMock.mockRejectedValueOnce(new Error("SLOT_LOCKED"));

    const { POST } = await import("@/app/api/reservar/client-check-lock/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/client-check-lock", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ errorCode: "SLOT_LOCKED", error: "SLOT_LOCKED" });
  });
});
