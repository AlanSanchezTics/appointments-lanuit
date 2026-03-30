import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const logoutMock = vi.fn();
let pathnameMock = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock,
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/hooks/admin/useAdminAuth", () => ({
  useAdminAuth: () => ({
    logout: logoutMock,
  }),
}));

describe("admin layout shell", () => {
  beforeEach(() => {
    pathnameMock = "/admin";
    pushMock.mockClear();
    refreshMock.mockClear();
    logoutMock.mockClear();
  });

  it("marks months item active for month detail paths", () => {
    pathnameMock = "/admin/months/2026-03";

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Meses" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-item-months")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks clients item active for client detail paths", () => {
    pathnameMock = "/admin/clients/42";

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Clientes" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-item-clients")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens mobile drawer from header menu", () => {
    pathnameMock = "/admin";

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    expect(screen.queryByTestId("sidebar-mobile-drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(screen.getByTestId("sidebar-mobile-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-mobile-overlay")).toBeInTheDocument();
  });

  it("logs out from sidebar button", async () => {
    pathnameMock = "/admin";
    logoutMock.mockResolvedValue(undefined);

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    fireEvent.click(screen.getByTestId("sidebar-logout-button"));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/admin/login");
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
