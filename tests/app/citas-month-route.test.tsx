import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("/citas/[month] page", () => {
  it("redirects to /citas/[month]/booking", async () => {
    const pageModule = await import("@/app/citas/[month]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ month: "2026-03" }),
      }),
    ).rejects.toThrow("REDIRECT:/citas/2026-03/booking");
  });
});
