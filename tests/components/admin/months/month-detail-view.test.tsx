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
          saturationComparison: {
            previousMonth: "2026-02",
            previousProjectedSaturationPercent: 72,
            deltaPercentPoints: 13,
          },
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
    expect(
      screen.getByText("Ocupación proyectada para este mes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("13% más comparado con Febrero de 2026"),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-icon="circle-arrow-up"]'),
    ).toBeInTheDocument();
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

  it("shows neutral occupancy comparison text and neutral icon when there is no change", () => {
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
          saturationComparison: {
            previousMonth: "2026-02",
            previousProjectedSaturationPercent: 85,
            deltaPercentPoints: 0,
          },
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
      screen.getByText("Misma ocupación comparada con el mes anterior"),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-icon="circle-minus"]'),
    ).toBeInTheDocument();
  });

  it("hides slot mode button for past months and keeps status tags under title", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
          currentMonth: "2026-04",
          currentDate: "2026-04-01",
          isPastMonth: true,
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

    const title = screen.getByRole("heading", { name: "Marzo de 2026" });
    const headerContent = title.parentElement;
    expect(headerContent).not.toBeNull();
    expect(within(headerContent!).getByText("Activo")).toBeInTheDocument();
    expect(within(headerContent!).getByText("Histórico")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Modalidad/i }),
    ).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Compartir agenda" })).toBeDisabled();
  });

  it("hides all action CTAs when month is past", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={{
          month: "2026-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
          currentMonth: "2026-04",
          currentDate: "2026-04-01",
          isPastMonth: true,
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
      screen.queryByRole("button", { name: "Compartir agenda" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agendar nueva cita" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bloquear espacios" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desactivar mes" }),
    ).not.toBeInTheDocument();
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

  it("shows daily action CTAs when selected day is eligible", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/blockable-slots?date=2026-03-02")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            currentDate: "2026-03-01",
            days: [
              {
                date: "2026-03-02",
                slots: ["09:00", "10:00"],
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

      if (url.includes("/api/admin/months/2026-03/days/2026-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-02",
            total: 0,
            appointments: [],
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

    const dayModal = await screen.findByRole("dialog", {
      name: /Detalles del/i,
    });

    expect(
      await within(dayModal).findByRole("button", { name: "Agendar nueva cita" }),
    ).toBeInTheDocument();
    expect(
      await within(dayModal).findByRole("button", { name: "Bloquear espacios" }),
    ).toBeInTheDocument();
  });

  it("opens booking modal from day action and loads booking availability", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/blockable-slots?date=2026-03-02")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            currentDate: "2026-03-01",
            days: [
              {
                date: "2026-03-02",
                slots: ["10:00"],
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

      if (url.includes("/api/admin/months/2026-03/days/2026-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-02",
            total: 0,
            appointments: [],
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

    const dayModal = await screen.findByRole("dialog", {
      name: /Detalles del/i,
    });
    fireEvent.click(
      await within(dayModal).findByRole("button", { name: "Agendar nueva cita" }),
    );

    const bookingModal = await screen.findByRole("dialog", {
      name: "Agendar cita",
    });
    expect(bookingModal).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/admin/months/2026-03/blockable-slots"),
      ),
    ).toBe(true);
  });

  it("hides daily action CTAs when selected day is not eligible", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/blockable-slots?date=2026-03-02")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            currentDate: "2026-03-01",
            days: [],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url.includes("/api/admin/months/2026-03/days/2026-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-02",
            total: 0,
            appointments: [],
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

    const dayModal = await screen.findByRole("dialog", {
      name: /Detalles del/i,
    });

    await waitFor(() => {
      expect(
        within(dayModal).queryByRole("button", { name: "Agendar nueva cita" }),
      ).not.toBeInTheDocument();
      expect(
        within(dayModal).queryByRole("button", { name: "Bloquear espacios" }),
      ).not.toBeInTheDocument();
    });
  });

  it("opens block modal from day action with selected day prefilled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/blockable-slots?date=2026-03-02")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            currentDate: "2026-03-01",
            days: [
              {
                date: "2026-03-02",
                slots: ["10:00"],
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

      if (url.includes("/api/admin/months/2026-03/blockable-slots")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            currentDate: "2026-03-01",
            days: [
              {
                date: "2026-03-03",
                slots: ["14:00"],
              },
              {
                date: "2026-03-02",
                slots: ["10:00"],
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

      if (url.includes("/api/admin/months/2026-03/days/2026-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-02",
            total: 0,
            appointments: [],
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

    const dayModal = await screen.findByRole("dialog", {
      name: /Detalles del/i,
    });
    fireEvent.click(
      await within(dayModal).findByRole("button", { name: "Bloquear espacios" }),
    );

    const blockModal = await screen.findByRole("dialog", {
      name: "Bloquear horario",
    });
    expect(within(blockModal).getByText(/10:00/)).toBeInTheDocument();
    expect(within(blockModal).queryByText(/02:00/)).not.toBeInTheDocument();
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

      if (url.includes("/api/admin/months/2099-03/days/2099-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2099-03",
            date: "2099-03-02",
            total: 1,
            appointments: [
              {
                appointmentId: 10,
                date: "2099-03-02",
                timeSlot: "09:00:00",
                status: "CONFIRMED",
                name: "Ana Garcia",
                phone: "5512345678",
              },
            ],
            blockedSlots: [
              {
                blockedSlotId: 51,
                date: "2099-03-02",
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
        month="2099-03"
        initialData={{
          month: "2099-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
          currentMonth: "2099-03",
          currentDate: "2099-03-01",
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
              date: "2099-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2099-03-02",
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

  it("disables edit and keeps cancel enabled for past appointments in day modal", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2000-03/days/2000-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2000-03",
            date: "2000-03-02",
            total: 1,
            appointments: [
              {
                appointmentId: 10,
                date: "2000-03-02",
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

      if (url.includes("/api/admin/appointments/10/cancel")) {
        return new Response(
          JSON.stringify({
            appointmentId: 10,
            status: "CANCELLED",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url.includes("/api/admin/months/2000-03")) {
        return new Response(
          JSON.stringify({
            month: "2000-03",
            monthStatus: "ACTIVE",
            slotMode: "BLOCK_MODE",
            currentMonth: "2000-03",
            currentDate: "2000-03-01",
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
                date: "2000-03-01",
                day: 1,
                isWeekend: true,
                availableSpaces: 0,
                tone: "weekend",
              },
              {
                date: "2000-03-02",
                day: 2,
                isWeekend: false,
                availableSpaces: 6,
                tone: "available",
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

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2000-03"
        initialData={{
          month: "2000-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
          currentMonth: "2000-03",
          currentDate: "2000-03-01",
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
              date: "2000-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2000-03-02",
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

    const editButton = screen.getByRole("button", { name: "Editar cita" });
    expect(editButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar cita" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(
        ([input, requestInit]) =>
          String(input).includes("/api/admin/appointments/10/cancel") &&
          requestInit?.method === "POST",
      ),
    ).toBe(true);
  });

  it("disables blocked-slot edit and keeps delete enabled for past blocked slots", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2000-03/days/2000-03-02/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2000-03",
            date: "2000-03-02",
            total: 0,
            appointments: [],
            blockedSlots: [
              {
                blockedSlotId: 50,
                date: "2000-03-02",
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

      if (url.includes("/api/admin/months/2000-03/blocked-slots/50")) {
        return new Response(
          JSON.stringify({
            month: "2000-03",
            blockedSlotId: 50,
            status: "DELETED",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url.includes("/api/admin/months/2000-03")) {
        return new Response(
          JSON.stringify({
            month: "2000-03",
            monthStatus: "ACTIVE",
            slotMode: "BLOCK_MODE",
            currentMonth: "2000-03",
            currentDate: "2000-03-01",
            isPastMonth: false,
            projectedSaturationPercent: 10,
            metrics: {
              confirmedAppointments: 0,
              cancelledAppointments: 0,
              availableSpaces: 64,
              blockedSpaces: 1,
              occupiedSpaces: 0,
            },
            calendarDays: [
              {
                date: "2000-03-01",
                day: 1,
                isWeekend: true,
                availableSpaces: 0,
                tone: "weekend",
              },
              {
                date: "2000-03-02",
                day: 2,
                isWeekend: false,
                availableSpaces: 6,
                tone: "available",
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

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2000-03"
        initialData={{
          month: "2000-03",
          monthStatus: "ACTIVE",
          slotMode: "BLOCK_MODE",
          currentMonth: "2000-03",
          currentDate: "2000-03-01",
          isPastMonth: false,
          projectedSaturationPercent: 10,
          metrics: {
            confirmedAppointments: 0,
            cancelledAppointments: 0,
            availableSpaces: 64,
            blockedSpaces: 1,
            occupiedSpaces: 0,
          },
          calendarDays: [
            {
              date: "2000-03-01",
              day: 1,
              isWeekend: true,
              availableSpaces: 0,
              tone: "weekend",
            },
            {
              date: "2000-03-02",
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

    const editBlockedButton = screen.getByRole("button", {
      name: "Editar espacio bloqueado",
    });
    expect(editBlockedButton).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar espacio bloqueado" }),
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(
        ([input, requestInit]) =>
          String(input).includes("/api/admin/months/2000-03/blocked-slots/50") &&
          requestInit?.method === "DELETE",
      ),
    ).toBe(true);
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

  it("renders slot mode options with SECOND_ONLY_MODE first", async () => {
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

    const optionButtons = within(modal)
      .getAllByRole("button")
      .filter(
        (button) =>
          button.textContent?.includes("Horario fijo") ||
          button.textContent?.includes("Bloques de horarios"),
      );

    expect(optionButtons).toHaveLength(2);
    expect(optionButtons[0]).toHaveTextContent("Horario fijo");
    expect(optionButtons[1]).toHaveTextContent("Bloques de horarios");
  });
});
