import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminClientsCatalog } from "@/lib/admin/clients/catalog-service";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/clients/catalog-service", () => ({
  getAdminClientsCatalog: vi.fn(),
}));

const authMock = vi.mocked(auth);
const getAdminClientsCatalogMock = vi.mocked(getAdminClientsCatalog);

describe("GET /api/admin/clients/catalog", () => {
  it("returns 401 when there is no admin session", async () => {
    authMock.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/admin/clients/catalog/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/catalog"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errorCode: "ADMIN_UNAUTHORIZED",
      error: "ADMIN_UNAUTHORIZED",
    });
  });

  it("returns 200 with catalog payload", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    getAdminClientsCatalogMock.mockResolvedValueOnce({
      filters: {
        query: "ana",
        status: "ALL",
        sort: "RECENT",
        page: 1,
        pageSize: 20,
      },
      metrics: {
        totalClients: 2,
        withFutureAppointments: 1,
        withoutFutureAppointments: 1,
      },
      pagination: {
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      },
      clients: [],
      currentDate: "2026-03-21",
    });

    const { GET } = await import("@/app/api/admin/clients/catalog/route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/clients/catalog?query=ana&page=1&pageSize=20",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      filters: {
        query: "ana",
        status: "ALL",
        sort: "RECENT",
        page: 1,
        pageSize: 20,
      },
      metrics: {
        totalClients: 2,
        withFutureAppointments: 1,
        withoutFutureAppointments: 1,
      },
      pagination: {
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      },
      clients: [],
      currentDate: "2026-03-21",
    });

    expect(getAdminClientsCatalogMock).toHaveBeenCalledWith({
      query: "ana",
      status: "ALL",
      sort: "RECENT",
      page: 1,
      pageSize: 20,
    });
  });

  it("returns 400 for invalid query params", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);

    const { GET } = await import("@/app/api/admin/clients/catalog/route");
    const response = await GET(
      new Request("http://localhost/api/admin/clients/catalog?page=0"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "VALIDATION_ERROR",
      error: "VALIDATION_ERROR",
    });
  });
});
