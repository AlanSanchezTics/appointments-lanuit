import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthDetailView } from "@/components/admin/months/MonthDetailView";

describe("MonthDetailView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders month metrics, saturation and calendar section", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          currentMonth: "2026-03",
          currentDate: "2026-03-21",
          isPastMonth: false,
          projectedSaturationPercent: 85,
          metrics: {
            confirmedAppointments: 8,
            cancelledAppointments: 1,
            availableSpaces: 54,
            blockedSpaces: 0,
            occupiedSpaces: 8,
          },
          calendarDays: [
            {
              date: "2026-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              tone: "available",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Marzo de 2026")).toBeInTheDocument();
    expect(screen.getByText("Confirmadas")).toBeInTheDocument();
    expect(screen.getByText("Canceladas")).toBeInTheDocument();
    expect(screen.getByText("Disponibles")).toBeInTheDocument();
    expect(screen.getByText("Bloqueados")).toBeInTheDocument();
    expect(screen.getByText("Saturación proyectada")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Vista mensual")).toBeInTheDocument();
  });

  it("opens the daily agenda modal when a day is selected", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/days/2026-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-02",
            total: 1,
            appointments: [
              {
                appointmentId: 10,
                date: "2026-03-02",
                timeSlot: "09:00:00",
                status: "CONFIRMED",
                name: "Ana Garcia",
                phone: "5512345678",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return new Response(JSON.stringify({ errorCode: "NOT_FOUND" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          currentMonth: "2026-03",
          currentDate: "2026-03-01",
          isPastMonth: false,
          projectedSaturationPercent: 85,
          metrics: {
            confirmedAppointments: 8,
            cancelledAppointments: 1,
            availableSpaces: 54,
            blockedSpaces: 0,
            occupiedSpaces: 8,
          },
          calendarDays: [
            {
              date: "2026-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              tone: "available",
            },
          ],
        }}
      />,
    );

    const dayButtons = screen.getAllByRole("button", { name: /Detalles del/i });
    fireEvent.click(dayButtons[1]);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Agenda del día")).toBeInTheDocument();
    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument();
    expect(await screen.findByText("5512345678")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/months/2026-03/days/2026-03-02/agenda"),
        expect.objectContaining({
          method: "GET",
        }),
      );
    });
  });

  it("does not cancel appointment when confirmation is rejected", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/days/2026-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-02",
            total: 1,
            appointments: [
              {
                appointmentId: 10,
                date: "2026-03-02",
                timeSlot: "09:00:00",
                status: "CONFIRMED",
                name: "Ana Garcia",
                phone: "5512345678",
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return new Response(JSON.stringify({ errorCode: "NOT_FOUND" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          currentMonth: "2026-03",
          currentDate: "2026-03-01",
          isPastMonth: false,
          projectedSaturationPercent: 85,
          metrics: {
            confirmedAppointments: 8,
            cancelledAppointments: 1,
            availableSpaces: 54,
            blockedSpaces: 0,
            occupiedSpaces: 8,
          },
          calendarDays: [
            {
              date: "2026-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              tone: "available",
            },
          ],
        }}
      />,
    );

    const dayButtons = screen.getAllByRole("button", { name: /Detalles del/i });
    fireEvent.click(dayButtons[1]);
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cita" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/admin/appointments/10/cancel"),
      ),
    ).toBe(false);
  });
});
