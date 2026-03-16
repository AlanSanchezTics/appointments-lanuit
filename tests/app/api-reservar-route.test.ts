import { describe, expect, it } from "vitest";

describe("POST /api/reservar", () => {
  it("returns 410 because legacy endpoint is deprecated", async () => {
    const { POST } = await import("@/app/api/reservar/route");
    const response = await POST(
      new Request("http://localhost/api/reservar", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ENDPOINT_DEPRECATED_USE_CHECK_LOCK_CONFIRM",
      error: "ENDPOINT_DEPRECATED_USE_CHECK_LOCK_CONFIRM",
    });
  });
});
