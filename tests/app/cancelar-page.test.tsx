import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("legacy /cancelar page", () => {
  it("redirects to /citas/cancelar", async () => {
    const pageModule = await import("@/app/cancelar/page");

    expect(() => pageModule.default()).toThrow("REDIRECT:/citas/cancelar");
  });
});
