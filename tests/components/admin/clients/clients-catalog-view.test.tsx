import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsCatalogView } from "@/components/admin/clients/ClientsCatalogView";
import { useClientsCatalog } from "@/hooks/admin/clients/useClientsCatalog";
import type { AdminClientsCatalogResponse } from "@/lib/admin/clients/types";

vi.mock("@/hooks/admin/clients/useClientsCatalog", () => ({
  useClientsCatalog: vi.fn(),
}));

const useClientsCatalogMock = vi.mocked(useClientsCatalog);

const initialData: AdminClientsCatalogResponse = {
  filters: {
    query: "",
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
    page: 2,
    pageSize: 20,
    total: 2,
    totalPages: 3,
  },
  clients: [
    {
      clientId: 42,
      name: "Ana Pérez",
      phone: "5512345678",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      totalAppointments: 3,
      hasFutureActiveAppointments: true,
      lastAppointmentDate: "2026-03-20",
      nextAppointmentDate: "2026-04-01",
      nextAppointmentTimeSlot: "09:00",
    },
  ],
  currentDate: "2026-03-29",
};

describe("ClientsCatalogView", () => {
  beforeEach(() => {
    useClientsCatalogMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders catalog blocks and delegates filter/list actions", () => {
    const applyQueryMock = vi.fn();
    const updateStatusMock = vi.fn();
    const updateSortMock = vi.fn();
    const goToPageMock = vi.fn();
    const retryMock = vi.fn();
    const goToClientMock = vi.fn();

    useClientsCatalogMock.mockReturnValue({
      data: initialData,
      filters: initialData.filters,
      isLoading: false,
      errorCode: null,
      applyQuery: applyQueryMock,
      updateStatus: updateStatusMock,
      updateSort: updateSortMock,
      goToPage: goToPageMock,
      retry: retryMock,
      refresh: vi.fn(),
      goToClient: goToClientMock,
      hasRows: true,
    });

    render(<ClientsCatalogView initialData={initialData} />);

    expect(screen.getByText("Listado de clientes")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Futura")).toBeInTheDocument();
    expect(screen.getByText("3 citas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aplicar filtros/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: "Ana" },
    });
    vi.advanceTimersByTime(350);
    expect(applyQueryMock).toHaveBeenCalledWith("Ana");

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "WITHOUT_FUTURE_APPOINTMENTS" },
    });
    expect(updateStatusMock).toHaveBeenCalledWith("WITHOUT_FUTURE_APPOINTMENTS");

    fireEvent.change(screen.getByLabelText("Orden"), {
      target: { value: "APPOINTMENTS_DESC" },
    });
    expect(updateSortMock).toHaveBeenCalledWith("APPOINTMENTS_DESC");

    fireEvent.click(screen.getByText("Ana Pérez"));
    expect(goToClientMock).toHaveBeenCalledWith(42);

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(goToPageMock).toHaveBeenCalledWith(1);
    expect(goToPageMock).toHaveBeenCalledWith(3);
    expect(retryMock).not.toHaveBeenCalled();
  });

  it("shows retry block when catalog load fails", () => {
    const retryMock = vi.fn();

    useClientsCatalogMock.mockReturnValue({
      data: {
        ...initialData,
        clients: [],
      },
      filters: initialData.filters,
      isLoading: false,
      errorCode: "UNKNOWN_ERROR",
      applyQuery: vi.fn(),
      updateStatus: vi.fn(),
      updateSort: vi.fn(),
      goToPage: vi.fn(),
      retry: retryMock,
      refresh: vi.fn(),
      goToClient: vi.fn(),
      hasRows: false,
    });

    render(<ClientsCatalogView initialData={initialData} />);

    expect(
      screen.getByText("No se pudo cargar el catálogo de clientes."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retryMock).toHaveBeenCalledTimes(1);
  });
});
