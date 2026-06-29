import { describe, expect, it } from "vitest";

describe("POST /api/cancelar", () => {
  it("returns 410 as a deprecated legacy endpoint", async () => {
    const { POST } = await import("@/app/api/cancelar/route");
    const response = await POST(new Request("http://localhost/api/cancelar", { method: "POST" }));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ENDPOINT_DEPRECATED_USE_MY_APPOINTMENTS",
      error: "ENDPOINT_DEPRECATED_USE_MY_APPOINTMENTS",
    });
  });
});
