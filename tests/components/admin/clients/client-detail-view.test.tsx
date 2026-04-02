import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientDetailView } from "@/components/admin/clients/ClientDetailView";
import { useClientDetail } from "@/hooks/admin/clients/useClientDetail";
import type { AdminClientDetailResponse } from "@/lib/admin/clients/types";

const { promiseMock } = vi.hoisted(() => ({
  promiseMock: vi.fn(async <T,>(promise: Promise<T>) => promise),
}));

vi.mock("@/hooks/admin/clients/useClientDetail", () => ({
  useClientDetail: vi.fn(),
}));

vi.mock("sileo", () => ({
  sileo: {
    promise: promiseMock,
  },
}));

const useClientDetailMock = vi.mocked(useClientDetail);

const initialData: AdminClientDetailResponse = {
  client: {
    clientId: 42,
    name: "Ana Pérez",
    phone: "5512345678",
    isLoyal: false,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
  },
  summary: {
    totalAppointments: 3,
    activeAppointments: 2,
    cancelledAppointments: 1,
    futureActiveAppointments: 1,
    lastAppointmentDate: "2026-03-20",
    nextAppointmentDate: "2026-04-01",
    nextAppointmentTimeSlot: "09:00",
  },
  appointments: [
    {
      appointmentId: 100,
      date: "2026-03-20",
      timeSlot: "09:00",
      status: "CONFIRMED",
    },
  ],
  currentDate: "2026-03-29",
};

describe("ClientDetailView", () => {
  beforeEach(() => {
    useClientDetailMock.mockReset();
    promiseMock.mockClear();
  });

  it("renders summary and timeline blocks", () => {
    useClientDetailMock.mockReturnValue({
      data: initialData,
      isLoading: false,
      isUpdating: false,
      errorCode: null,
      refresh: vi.fn(),
      retry: vi.fn(),
      updateName: vi.fn(),
      updateLoyalty: vi.fn(),
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    expect(screen.getByRole("heading", { name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.getByText("Historial de citas")).toBeInTheDocument();
    expect(screen.getByText("Cliente fiel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar como cliente fiel" })).toBeInTheDocument();
    expect(screen.getByText("Total de citas")).toBeInTheDocument();
    expect(screen.getByText("Activas")).toBeInTheDocument();
    expect(screen.getByText("Canceladas")).toBeInTheDocument();
    expect(screen.getByText("Futuras")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar cliente" })).toBeInTheDocument();
  });

  it("submits edit flow through sileo promise", async () => {
    const updateNameMock = vi.fn().mockResolvedValue(undefined);

    useClientDetailMock.mockReturnValue({
      data: initialData,
      isLoading: false,
      isUpdating: false,
      errorCode: null,
      refresh: vi.fn(),
      retry: vi.fn(),
      updateName: updateNameMock,
      updateLoyalty: vi.fn(),
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar cliente" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ana María Pérez" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(updateNameMock).toHaveBeenCalledWith("Ana María Pérez");
      expect(promiseMock).toHaveBeenCalledTimes(1);
    });
  });

  it("submits loyal toggle through sileo promise", async () => {
    const updateLoyaltyMock = vi.fn().mockResolvedValue(undefined);

    useClientDetailMock.mockReturnValue({
      data: initialData,
      isLoading: false,
      isUpdating: false,
      errorCode: null,
      refresh: vi.fn(),
      retry: vi.fn(),
      updateName: vi.fn(),
      updateLoyalty: updateLoyaltyMock,
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Marcar como cliente fiel" }));

    await waitFor(() => {
      expect(updateLoyaltyMock).toHaveBeenCalledWith(true);
      expect(promiseMock).toHaveBeenCalledTimes(1);
    });
  });
});
