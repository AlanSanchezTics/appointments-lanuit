import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getNextClientNumberSuggestion } from "@/lib/clients/client-number-service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/clients/client-number-service", () => ({
  getNextClientNumberSuggestion: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getNextClientNumberSuggestionMock = vi.mocked(getNextClientNumberSuggestion);

describe("GET /api/admin/clients/next-number", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/clients/next-number/route");
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns next client number suggestion", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "1" } } as never);
    getNextClientNumberSuggestionMock.mockResolvedValueOnce(1234);

    const { GET } = await import("@/app/api/admin/clients/next-number/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nextClientNumber: 1234,
    });
  });
});
