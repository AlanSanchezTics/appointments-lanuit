import { beforeEach, describe, expect, it, vi } from "vitest";

const releaseReservationSlotLockMock = vi.fn();

vi.mock("@/lib/appointments/lock-reservation-slot", () => ({
  releaseReservationSlotLock: releaseReservationSlotLockMock,
}));

describe("/api/reservar/lock/release-beacon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when lock release succeeds", async () => {
    releaseReservationSlotLockMock.mockResolvedValueOnce({ released: true });

    const { POST } = await import("@/app/api/reservar/lock/release-beacon/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/lock/release-beacon", {
        method: "POST",
        body: JSON.stringify({
          lockToken: "lock-123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ released: true });
  });

  it("returns 400 when payload is invalid", async () => {
    releaseReservationSlotLockMock.mockRejectedValueOnce(new Error("LOCK_TOKEN_REQUIRED"));

    const { POST } = await import("@/app/api/reservar/lock/release-beacon/route");
    const response = await POST(
      new Request("http://localhost/api/reservar/lock/release-beacon", {
        method: "POST",
        body: JSON.stringify({
          lockToken: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "LOCK_TOKEN_REQUIRED",
      error: "LOCK_TOKEN_REQUIRED",
    });
  });
});
