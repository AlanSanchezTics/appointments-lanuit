import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { searchAdminClientsByQuery } from "@/lib/admin/clients/api-client";

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

vi.mock("@/lib/admin/clients/api-client", () => ({
  searchAdminClientsByQuery: vi.fn(),
}));

const searchAdminClientsByQueryMock = vi.mocked(searchAdminClientsByQuery);

describe("admin layout shell", () => {
  beforeEach(() => {
    pathnameMock = "/admin";
    pushMock.mockClear();
    refreshMock.mockClear();
    logoutMock.mockClear();
    searchAdminClientsByQueryMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    expect(
      screen.queryByTestId("sidebar-mobile-drawer"),
    ).not.toBeInTheDocument();

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

  it("searches clients from header with debounce and navigates on selection", async () => {
    vi.useFakeTimers();
    let resolveSearch:
      | ((value: {
          query: string;
          total: number;
          clients: Array<{
            clientId: number;
            clientNumber: number;
            name: string;
            phone: string;
            isLoyal: boolean;
          }>;
        }) => void)
      | null = null;

    searchAdminClientsByQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir buscador global" }),
    );

    const searchInput = screen.getByRole("textbox", {
      name: "Buscar clientes",
    });

    fireEvent.change(searchInput, { target: { value: "ana" } });

    expect(searchAdminClientsByQueryMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(searchAdminClientsByQueryMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(searchAdminClientsByQueryMock).toHaveBeenCalledWith(
      "ana",
      expect.objectContaining({
        limit: 8,
        signal: expect.any(AbortSignal),
      }),
    );

    expect(screen.getByText("Un momento...")).toBeInTheDocument();

    await act(async () => {
      resolveSearch?.({
        query: "ana",
        total: 1,
        clients: [
          {
            clientId: 42,
            clientNumber: 1001,
            name: "Ana Garcia",
            phone: "5512345678",
            isLoyal: true,
          },
        ],
      });
    });

    expect(
      screen.getByRole("button", { name: /Ana Garcia/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument();
    expect(screen.getByText("Fiel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ana Garcia/ }));

    expect(pushMock).toHaveBeenCalledWith("/admin/clients/42");
    expect(
      screen.queryByRole("textbox", { name: "Buscar clientes" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument();
  });

  it("shows empty state when no clients match", async () => {
    vi.useFakeTimers();
    searchAdminClientsByQueryMock.mockResolvedValueOnce({
      query: "zzz",
      total: 0,
      clients: [],
    });

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir buscador global" }),
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), {
      target: { value: "zzz" },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("No se encontraron clientes.")).toBeInTheDocument();
  });

  it("shows an error state when the search fails", async () => {
    vi.useFakeTimers();
    searchAdminClientsByQueryMock.mockRejectedValueOnce(
      new Error("CLIENT_SEARCH_FAILED"),
    );

    render(
      <AdminLayout>
        <div>content</div>
      </AdminLayout>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir buscador global" }),
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), {
      target: { value: "ana" },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(
      screen.getByText("No se pudo cargar la búsqueda."),
    ).toBeInTheDocument();
  });
});
