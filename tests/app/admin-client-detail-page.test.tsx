import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getAdminClientDetail } from "@/lib/admin/clients/detail-service";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

const notFoundMock = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/admin/clients/detail-service", () => ({
  getAdminClientDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("@/components/admin/clients/ClientDetailView", () => ({
  ClientDetailView: () => <div>client-detail-view</div>,
}));

const authMock = vi.mocked(auth);
const getAdminClientDetailMock = vi.mocked(getAdminClientDetail);

describe("admin client detail page", () => {
  it("redirects to login when session does not exist", async () => {
    authMock.mockResolvedValueOnce(null as never);
    const pageModule = await import("@/app/admin/clients/[clientId]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ clientId: "42" }),
      }),
    ).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("calls notFound when clientId is invalid", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    const pageModule = await import("@/app/admin/clients/[clientId]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ clientId: "abc" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("calls notFound when client does not exist", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminClientDetailMock.mockRejectedValueOnce(new Error("CLIENT_NOT_FOUND"));
    const pageModule = await import("@/app/admin/clients/[clientId]/page");

    await expect(
      pageModule.default({
        params: Promise.resolve({ clientId: "999" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders detail view for valid request", async () => {
    authMock.mockResolvedValueOnce({ user: { name: "admin" } } as never);
    getAdminClientDetailMock.mockResolvedValueOnce({
      client: {
        clientId: 42,
        name: "Ana",
        phone: "5512345678",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
      },
      summary: {
        totalAppointments: 0,
        activeAppointments: 0,
        cancelledAppointments: 0,
        futureActiveAppointments: 0,
        lastAppointmentDate: null,
        nextAppointmentDate: null,
        nextAppointmentTimeSlot: null,
      },
      appointments: [],
      currentDate: "2026-03-21",
    });
    const pageModule = await import("@/app/admin/clients/[clientId]/page");

    const result = await pageModule.default({
      params: Promise.resolve({ clientId: "42" }),
    });

    expect(getAdminClientDetailMock).toHaveBeenCalledWith(42);
    expect(result).toBeTruthy();
  });
});
