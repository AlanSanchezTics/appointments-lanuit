import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminClientsCatalog } from "@/lib/admin/clients/catalog-service";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/clients/catalog-service", () => ({
  getAdminClientsCatalog: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/admin/clients/ClientsCatalogView", () => ({
  ClientsCatalogView: () => <div>clients-catalog-view</div>,
}));

const authMock = vi.mocked(auth);
const getAdminClientsCatalogMock = vi.mocked(getAdminClientsCatalog);

describe("admin clients page", () => {
  it("redirects to login when session does not exist", async () => {
    authMock.mockResolvedValueOnce(null as never);
    const pageModule = await import("@/app/admin/clients/page");

    await expect(
      pageModule.default({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("renders clients catalog view for authenticated request", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminClientsCatalogMock.mockResolvedValueOnce({
      filters: {
        query: "",
        status: "ALL",
        sort: "RECENT",
        page: 1,
        pageSize: 20,
      },
      metrics: {
        totalClients: 0,
        withFutureAppointments: 0,
        withoutFutureAppointments: 0,
      },
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
      },
      clients: [],
      currentDate: "2026-03-21",
    });

    const pageModule = await import("@/app/admin/clients/page");

    const result = await pageModule.default({
      searchParams: Promise.resolve({
        status: "ALL",
      }),
    });

    expect(getAdminClientsCatalogMock).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
