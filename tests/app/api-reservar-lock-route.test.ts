import { beforeEach, describe, expect, it, vi } from "vitest";

const acquireReservationSlotLockMock = vi.fn();
const releaseReservationSlotLockMock = vi.fn();

vi.mock("@/lib/appointments/lock-reservation-slot", () => ({
  acquireReservationSlotLock: acquireReservationSlotLockMock,
  releaseReservationSlotLock: releaseReservationSlotLockMock,
}));

describe("/api/reservar/lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 when lock acquisition succeeds", async () => {
    acquireReservationSlotLockMock.mockResolvedValueOnce({
      lockToken: "lock-123",
      expiresAt: "2026-03-13T12:10:00.000Z",
    });

    const { POST } = await import("@/app/api/reservar/lock/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/lock", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
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
    });
  });

  it("returns 409 when slot is already locked", async () => {
    acquireReservationSlotLockMock.mockRejectedValueOnce(new Error("SLOT_LOCKED"));

    const { POST } = await import("@/app/api/reservar/lock/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/lock", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-14",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "SLOT_LOCKED" });
  });

  it("returns 200 when releasing a lock", async () => {
    releaseReservationSlotLockMock.mockResolvedValueOnce({ released: true });

    const { DELETE } = await import("@/app/api/reservar/lock/route");
    const response = await DELETE(
      new Request("http://localhost/api/reservar/lock", {
        method: "DELETE",
        body: JSON.stringify({
          lockToken: "lock-123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ released: true });
  });
});
