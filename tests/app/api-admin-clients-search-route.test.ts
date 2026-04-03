import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { searchAdminClients } from "@/lib/admin/clients/service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/clients/service", () => ({
  searchAdminClients: vi.fn(),
}));

const authMock = vi.mocked(auth);
const searchAdminClientsMock = vi.mocked(searchAdminClients);

describe("GET /api/admin/clients/search", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/clients/search/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/search?query=ana"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 200 with search payload", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    searchAdminClientsMock.mockResolvedValueOnce({
      query: "ana",
      total: 1,
      clients: [
        {
          clientId: 1,
          name: "Ana Garcia",
          phone: "5512345678",
          isLoyal: true,
        },
      ],
    });

    const { GET } = await import("@/app/api/admin/clients/search/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/search?query=ana&limit=5"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      query: "ana",
      total: 1,
      clients: [
        {
          clientId: 1,
          name: "Ana Garcia",
          phone: "5512345678",
          isLoyal: true,
        },
      ],
    });
    expect(searchAdminClientsMock).toHaveBeenCalledWith({
      query: "ana",
      limit: 5,
    });
  });

  it("returns 400 for invalid query params", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    const { GET } = await import("@/app/api/admin/clients/search/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/search?query=a"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "VALIDATION_ERROR",
      error: "VALIDATION_ERROR",
    });
  });
});
