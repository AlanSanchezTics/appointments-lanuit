import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PendingAppointmentsCard } from "@/components/admin/ui/PendingAppointmentsCard";
import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";
import { formatLongDate } from "@/lib/datetime/mexico-city";

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: refreshMock,
  }),
}));

vi.mock("sileo", () => ({
  sileo: {
    promise: vi.fn(async (promise: Promise<unknown>) => promise),
  },
}));

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

describe("PendingAppointmentsCard WhatsApp confirmation", () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshMock.mockReset();
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

  it("redirects the same tab to the prefilled WhatsApp message on CONFIRMED and does not refresh", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        mockResponse(true, { appointmentId: 91, status: "CONFIRMED" }),
      );

    render(<PendingAppointmentsCard language="es" items={[pendingItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/appointments/91/confirm",
      expect.anything(),
    );

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));

    const url = new URL(String(assignMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/525512345678");
    expect(url.searchParams.get("text")).toBe(
      `🗓️ *Nos vemos el ${formatLongDate("2026-03-31", "es")} a las 09:00 AM*!`,
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("also redirects when the confirmation returns SYNC_FAILED", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(true, {
        appointmentId: 91,
        status: "SYNC_FAILED",
        syncReason: "CALENDAR_SYNC_FAILED",
      }),
    );

    render(<PendingAppointmentsCard language="es" items={[pendingItem]} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledTimes(1));
    expect(String(assignMock.mock.calls[0]?.[0])).toContain(
      "https://wa.me/525512345678?text=",
    );
  });

  it("does not redirect and keeps the buttons usable when the confirmation fails", async () => {
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
    expect(assignMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("does not redirect when the appointment is rejected and refreshes the dashboard", async () => {
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
    expect(assignMock).not.toHaveBeenCalled();
  });
});
