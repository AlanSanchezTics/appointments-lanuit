import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
          slotMode: "BLOCK_MODE",
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
              appointmentsCount: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              appointmentsCount: 2,
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
    expect(screen.getAllByTestId("2026-03-02-appointment-dot")).toHaveLength(2);
  });

  it("shows month status tag and contextual toggle action", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
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
              appointmentsCount: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              appointmentsCount: 2,
              tone: "available",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desactivar mes" }),
    ).toBeInTheDocument();
  });

  it("renders schedule CTA before block spaces CTA", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
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
              appointmentsCount: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              appointmentsCount: 2,
              tone: "available",
            },
          ],
        }}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const scheduleIndex = buttons.findIndex((button) =>
      button.textContent?.includes("Agendar nueva cita"),
    );
    const blockIndex = buttons.findIndex((button) =>
      button.textContent?.includes("Bloquear espacios"),
    );

    expect(scheduleIndex).toBeGreaterThan(-1);
    expect(blockIndex).toBeGreaterThan(-1);
    expect(scheduleIndex).toBeLessThan(blockIndex);
  });

  it("disables schedule CTA when month is inactive", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "INACTIVE",
          slotMode: "BLOCK_MODE",
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
              appointmentsCount: 0,
              tone: "weekend",
            },
            {
              date: "2026-03-02",
              day: 2,
              isWeekend: false,
              availableSpaces: 6,
              appointmentsCount: 2,
              tone: "available",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Agendar nueva cita" }),
    ).toBeDisabled();
  });

  it("opens booking modal from schedule CTA", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/blockable-slots")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            currentDate: "2026-03-01",
            days: [
              {
                date: "2026-03-02",
                slots: ["10:00", "14:00"],
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
          slotMode: "BLOCK_MODE",
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

    fireEvent.click(screen.getByRole("button", { name: "Agendar nueva cita" }));

    expect(await screen.findByRole("dialog", { name: "Agendar cita" })).toBeInTheDocument();
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
            blockedSlots: [
              {
                blockedSlotId: 50,
                date: "2026-03-02",
                timeSlot: "13:00",
                reason: "DESCANSO",
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
          slotMode: "BLOCK_MODE",
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
    expect(await screen.findByText("Espacios bloqueados")).toBeInTheDocument();
    expect(await screen.findByText("Descanso")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/months/2026-03/days/2026-03-02/agenda"),
        expect.objectContaining({
          method: "GET",
        }),
      );
    });
  });

  it("does not open the daily agenda modal when weekend day is clicked", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
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
    expect(dayButtons[0]).toBeDisabled();
    fireEvent.click(dayButtons[0]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
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
            blockedSlots: [],
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
          slotMode: "BLOCK_MODE",
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

  it("does not include manually blocked slots in reschedule options", async () => {
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
            blockedSlots: [
              {
                blockedSlotId: 51,
                date: "2026-03-02",
                timeSlot: "13:00",
                reason: "DESCANSO",
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
          slotMode: "BLOCK_MODE",
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

    fireEvent.click(screen.getByRole("button", { name: "Editar cita" }));

    expect(screen.queryByRole("option", { name: "01:00 PM" })).not.toBeInTheDocument();
  });

  it("shows contextual helper text in slot mode modal based on selected option", async () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
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

    fireEvent.click(screen.getByRole("button", { name: /Modalidad/i }));
    const modal = await screen.findByRole("dialog", {
      name: /Modalidad de disponibilidad/i,
    });

    expect(
      within(modal).getByText(/09:00am - 10:00am/i),
    ).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole("button", { name: "Horario fijo" }));

    expect(
      within(modal).getByText(/10:00am, 02:00pm y 06:00pm/i),
    ).toBeInTheDocument();
  });
});
