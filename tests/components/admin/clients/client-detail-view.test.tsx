import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    clientNumber: 1001,
    name: "Ana Pérez",
    alias: null,
    phone: "5512345678",
    isLoyal: false,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
  },
  summary: {
    totalAppointments: 5,
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
    {
      appointmentId: 101,
      date: "2026-04-02",
      timeSlot: "10:00",
      status: "CANCELLED",
    },
    {
      appointmentId: 102,
      date: "2026-04-03",
      timeSlot: "11:00",
      status: "PENDING",
    },
    {
      appointmentId: 103,
      date: "2026-04-04",
      timeSlot: "12:00",
      status: "REJECTED",
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
      updateClientIdentity: vi.fn(),
      updateLoyalty: vi.fn(),
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    expect(screen.getByRole("heading", { name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.getByText("Historial de citas")).toBeInTheDocument();
    expect(screen.getByText("Cliente fiel")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Cambiar estado de cliente fiel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Número de cliente: #1001")).toBeInTheDocument();
    expect(screen.getByText("Total de citas")).toBeInTheDocument();
    expect(screen.getByText("Pasadas")).toBeInTheDocument();
    expect(screen.getByText("Futuras")).toBeInTheDocument();
    expect(
      within(screen.getByText("Total de citas").closest("div") as HTMLElement).getByText("1"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("Pasadas").closest("div") as HTMLElement).getByText("1"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("Futuras").closest("div") as HTMLElement).getByText("0"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar cliente" })).toBeInTheDocument();
  });

  it("submits edit flow through sileo promise", async () => {
    const updateClientIdentityMock = vi.fn().mockResolvedValue(undefined);

    useClientDetailMock.mockReturnValue({
      data: initialData,
      isLoading: false,
      isUpdating: false,
      errorCode: null,
      refresh: vi.fn(),
      retry: vi.fn(),
      updateClientIdentity: updateClientIdentityMock,
      updateLoyalty: vi.fn(),
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar cliente" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ana María Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Teléfono"), {
      target: { value: "5512345678" },
    });
    fireEvent.change(screen.getByLabelText("Número de cliente"), {
      target: { value: "1002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(updateClientIdentityMock).toHaveBeenCalledWith({
        name: "Ana María Pérez",
        alias: null,
        phone: "5512345678",
        clientNumber: 1002,
      });
      expect(promiseMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows inline client number error when backend reports duplication", async () => {
    const updateClientIdentityMock = vi
      .fn()
      .mockRejectedValue(new Error("CLIENT_NUMBER_ALREADY_EXISTS"));

    useClientDetailMock.mockReturnValue({
      data: initialData,
      isLoading: false,
      isUpdating: false,
      errorCode: null,
      refresh: vi.fn(),
      retry: vi.fn(),
      updateClientIdentity: updateClientIdentityMock,
      updateLoyalty: vi.fn(),
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar cliente" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(
        screen.getByText("Este número de cliente ya está en uso."),
      ).toBeInTheDocument();
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
      updateClientIdentity: vi.fn(),
      updateLoyalty: updateLoyaltyMock,
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    fireEvent.click(screen.getByRole("switch", { name: "Cambiar estado de cliente fiel" }));

    await waitFor(() => {
      expect(updateLoyaltyMock).toHaveBeenCalledWith(true);
      expect(promiseMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render pending or rejected appointments in timeline", () => {
    useClientDetailMock.mockReturnValue({
      data: initialData,
      isLoading: false,
      isUpdating: false,
      errorCode: null,
      refresh: vi.fn(),
      retry: vi.fn(),
      updateClientIdentity: vi.fn(),
      updateLoyalty: vi.fn(),
    });

    render(<ClientDetailView clientId={42} initialData={initialData} />);

    expect(screen.getByText(/09:00/i)).toBeInTheDocument();
    expect(screen.getByText(/10:00/i)).toBeInTheDocument();
    expect(screen.queryByText(/11:00/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/12:00/i)).not.toBeInTheDocument();
  });
});
