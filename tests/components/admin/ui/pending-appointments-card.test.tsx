import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingAppointmentsCard } from "@/components/admin/ui/PendingAppointmentsCard";
import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";
import { formatLongDate } from "@/lib/datetime/mexico-city";

const { refreshMock, sileoMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  sileoMock: {
    promise: vi.fn(async (promise: Promise<unknown>) => promise),
    action: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: refreshMock,
  }),
}));

vi.mock("sileo", () => ({ sileo: sileoMock }));

const pendingItem: AdminPendingAppointmentItem = {
  appointmentId: 91,
  clientNumber: 1234,
  date: "2026-03-31",
  timeSlot: "09:00",
  name: "Ana Garcia",
  phone: "5512345678",
};

function mockResponse(ok: boolean, payload: Record<string, unknown>) {
  return { ok, json: async () => payload } as Response;
}

function expectedWhatsappUrl() {
  return `https://wa.me/525512345678?text=${encodeURIComponent(
    `🗓️ *Nos vemos el ${formatLongDate("2026-03-31", "es")} a las 09:00 AM*!`,
  )}`;
}

describe("PendingAppointmentsCard WhatsApp confirmation", () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshMock.mockReset();
    sileoMock.action.mockReset();
    assignMock = vi.fn();
    // jsdom's window.location.assign is not configurable; stub the whole location object.
    vi.stubGlobal("location", {
      href: "http://localhost/admin",
      assign: assignMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("offers a WhatsApp action toast on CONFIRMED, opens WhatsApp only on button click, and refreshes the dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(true, { appointmentId: 91, status: "CONFIRMED" }),
    );

    render(<PendingAppointmentsCard language="es" items={[pendingItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(sileoMock.action).toHaveBeenCalledTimes(1));
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(assignMock).not.toHaveBeenCalled();

    const options = sileoMock.action.mock.calls[0]?.[0];
    expect(options.title).toBe("¿Avisar a la clienta por WhatsApp?");
    expect(options.description).toBeUndefined();
    expect(options.button.title).toBe("Enviar por WhatsApp");
    expect(assignMock).not.toHaveBeenCalled();

    options.button.onClick();

    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith(expectedWhatsappUrl());
  });

  it("also offers the WhatsApp action when the confirmation returns SYNC_FAILED", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(true, {
        appointmentId: 91,
        status: "SYNC_FAILED",
        syncReason: "CALENDAR_SYNC_FAILED",
      }),
    );

    render(<PendingAppointmentsCard language="es" items={[pendingItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(sileoMock.action).toHaveBeenCalledTimes(1));
    expect(assignMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the toast button working after the card unmounts on refresh", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(true, { appointmentId: 91, status: "CONFIRMED" }),
    );

    const { unmount } = render(
      <PendingAppointmentsCard language="es" items={[pendingItem]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(sileoMock.action).toHaveBeenCalledTimes(1));
    unmount();

    sileoMock.action.mock.calls[0]?.[0].button.onClick();

    expect(assignMock).toHaveBeenCalledWith(expectedWhatsappUrl());
  });

  it("does not offer WhatsApp and keeps the buttons usable when the confirmation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(false, { errorCode: "APPOINTMENT_NOT_FOUND" }),
    );

    render(<PendingAppointmentsCard language="es" items={[pendingItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirmar" }),
      ).not.toBeDisabled(),
    );
    expect(sileoMock.action).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("does not offer WhatsApp when the appointment is rejected and refreshes the dashboard", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        mockResponse(true, { appointmentId: 91, status: "REJECTED" }),
      );

    render(<PendingAppointmentsCard language="es" items={[pendingItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/appointments/91/reject",
      expect.anything(),
    );
    expect(sileoMock.action).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
