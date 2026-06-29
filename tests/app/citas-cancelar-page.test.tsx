import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("/citas/cancelar page", () => {
  it("redirects to /my-appointments", async () => {
    const pageModule = await import("@/app/citas/cancelar/page");

    expect(() => pageModule.default()).toThrow("REDIRECT:/my-appointments");
  });
});
