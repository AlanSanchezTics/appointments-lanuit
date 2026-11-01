import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthDetailView } from "@/components/admin/months/MonthDetailView";
import type { MonthDetailResponse } from "@/lib/admin/months/types";

function buildMonthDetail(overrides: Partial<MonthDetailResponse> = {}): MonthDetailResponse {
  return {
    month: "2026-03",
    monthStatus: "ACTIVE",
    rules: [],
    exceptions: [],
    availabilityVersion: 4,
    usesDefaultRule: true,
    currentMonth: "2026-03",
    currentDate: "2026-03-01",
    isPastMonth: false,
    projectedSaturationPercent: 0,
    metrics: {
      confirmedAppointments: 0,
      cancelledAppointments: 0,
      availableSpaces: 0,
      blockedSpaces: 0,
      occupiedSpaces: 0,
    },
    calendarDays: [],
    ...overrides,
  };
}

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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
            availableSlots: ["10:00"],
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
            availableSlots: ["10:00"],
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
            availableSlots: ["10:00"],
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
            availableSlots: ["10:00"],
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
            availableSlots: ["09:00", "10:00", "14:00"],
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
    expect(await screen.findByRole("option", { name: "02:00 PM" })).toBeInTheDocument();
    // La cita en edición se excluye en la agenda para que su hora actual siga ofrecida.
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("excludeAppointmentId=10")),
    ).toBe(true);
  });

  it("does not reschedule to a new date before its agenda loads, and sends the confirmed time afterwards", async () => {
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    let resolveNextDay!: (response: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2099-03/days/2099-03-02/agenda")) {
        return Promise.resolve(
          jsonResponse({
            month: "2099-03",
            date: "2099-03-02",
            total: 1,
            appointments: [
              {
                appointmentId: 10,
                date: "2099-03-02",
                timeSlot: "10:00:00",
                status: "CONFIRMED",
                name: "Ana Garcia",
                phone: "5512345678",
              },
            ],
            availableSlots: ["09:00", "10:00", "14:00"],
            blockedSlots: [],
          }),
        );
      }

      if (url.includes("/api/admin/months/2099-03/days/2099-03-03/agenda")) {
        return new Promise<Response>((resolve) => {
          resolveNextDay = resolve;
        });
      }

      if (url.includes("/api/admin/appointments/10/reschedule") && init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse({ appointmentId: 10, date: "2099-03-03", timeSlot: "09:00", status: "CONFIRMED" }),
        );
      }

      return Promise.resolve(jsonResponse({ errorCode: "NOT_FOUND" }, 404));
    });
    const reschedulePatches = () =>
      fetchMock.mock.calls.filter(
        ([input, init]) => String(input).includes("/reschedule") && init?.method === "PATCH",
      );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2099-03"
        initialData={{
          month: "2099-03",
          monthStatus: "ACTIVE",
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
            { date: "2099-03-02", day: 2, isWeekend: false, availableSpaces: 6, tone: "available" },
            { date: "2099-03-03", day: 3, isWeekend: false, availableSpaces: 6, tone: "available" },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Detalles del/i })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Editar cita" }));
    await within(dialog).findByRole("option", { name: "02:00 PM" });

    const [dateSelect, timeSelect] = within(dialog).getAllByRole("combobox");
    fireEvent.change(dateSelect, { target: { value: "2099-03-03" } });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("/days/2099-03-03/agenda")),
      ).toBe(true),
    );

    const saveButton = within(dialog).getByRole("button", { name: "Guardar" });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(reschedulePatches()).toHaveLength(0);
    expect(within(dialog).getByRole("status")).toHaveTextContent("Cargando horarios…");
    expect(timeSelect).toHaveAttribute("aria-busy", "true");

    resolveNextDay(
      jsonResponse({
        month: "2099-03",
        date: "2099-03-03",
        total: 0,
        appointments: [],
        availableSlots: ["09:00", "14:00"],
        blockedSlots: [],
      }),
    );
    await within(dialog).findByRole("option", { name: "09:00 AM" });
    expect(timeSelect).toHaveValue("09:00");
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    expect(timeSelect).toHaveAttribute("aria-busy", "false");

    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(reschedulePatches()).toHaveLength(1));
    expect(JSON.parse(String(reschedulePatches()[0][1]?.body))).toEqual({
      month: "2099-03",
      date: "2099-03-03",
      timeSlot: "09:00",
    });
  });

  it("does not show the reschedule loading text once the new day's times fail to load", async () => {
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    let failNextDay!: (response: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2099-03/days/2099-03-02/agenda")) {
        return Promise.resolve(
          jsonResponse({
            month: "2099-03",
            date: "2099-03-02",
            total: 1,
            appointments: [
              {
                appointmentId: 10,
                date: "2099-03-02",
                timeSlot: "10:00:00",
                status: "CONFIRMED",
                name: "Ana Garcia",
                phone: "5512345678",
              },
            ],
            availableSlots: ["09:00", "10:00", "14:00"],
            blockedSlots: [],
          }),
        );
      }

      if (url.includes("/api/admin/months/2099-03/days/2099-03-03/agenda")) {
        return new Promise<Response>((resolve) => {
          failNextDay = resolve;
        });
      }

      return Promise.resolve(jsonResponse({ errorCode: "NOT_FOUND" }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2099-03"
        initialData={buildMonthDetail({
          month: "2099-03",
          currentMonth: "2099-03",
          currentDate: "2099-03-01",
          calendarDays: [
            { date: "2099-03-02", day: 2, isWeekend: false, availableSpaces: 6, tone: "available" },
            { date: "2099-03-03", day: 3, isWeekend: false, availableSpaces: 6, tone: "available" },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Detalles del/i })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Editar cita" }));
    await within(dialog).findByRole("option", { name: "02:00 PM" });

    const [dateSelect] = within(dialog).getAllByRole("combobox");
    fireEvent.change(dateSelect, { target: { value: "2099-03-03" } });
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent("Cargando horarios…"),
    );

    failNextDay(jsonResponse({ errorCode: "INTERNAL_ERROR" }, 500));
    await waitFor(() => expect(within(dialog).queryByRole("status")).not.toBeInTheDocument());
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("opens the daily agenda for a weekend day the server marks open", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/admin/months/2026-03/days/2026-03-07/agenda")) {
        return new Response(
          JSON.stringify({
            month: "2026-03",
            date: "2026-03-07",
            total: 0,
            availableSlots: ["10:00"],
            appointments: [],
            blockedSlots: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ errorCode: "NOT_FOUND" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MonthDetailView
        month="2026-03"
        initialData={buildMonthDetail({
          calendarDays: [
            { date: "2026-03-07", day: 7, isWeekend: true, availableSpaces: 3, tone: "available" },
          ],
        })}
      />,
    );

    const weekendDay = screen.getAllByRole("button", { name: /Detalles del/i })[0];
    expect(weekendDay).toBeEnabled();
    expect(weekendDay).not.toHaveClass("bg-[var(--admin-availability-weekend)]");

    fireEvent.click(weekendDay);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("/days/2026-03-07/agenda")),
      ).toBe(true),
    );
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
                tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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
                tone: "closed",
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
          rules: [],
          exceptions: [],
          availabilityVersion: 1,
          usesDefaultRule: true,
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
              tone: "closed",
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

  it("shows the Reglas CTA and no Modalidad button for active months", () => {
    render(<MonthDetailView month="2026-03" initialData={buildMonthDetail()} />);

    expect(screen.getByRole("button", { name: "Reglas" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Modalidad/i })).not.toBeInTheDocument();
  });

  it("opens the availability rules editor from the Reglas CTA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/api/admin/months/2026-03/availability")) {
          return new Response(
            JSON.stringify({
              month: "2026-03",
              availabilityVersion: 4,
              rules: [],
              exceptions: [],
              usesDefaultRule: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ errorCode: "NOT_FOUND" }), { status: 404 });
      }),
    );

    render(<MonthDetailView month="2026-03" initialData={buildMonthDetail()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reglas" }));

    expect(await screen.findByText("Reglas semanales")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Disponibilidad del mes" })).toBeInTheDocument();
  });

  it("paints a day without resolved times in the closed tone", () => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={buildMonthDetail({
          calendarDays: [
            { date: "2026-03-02", day: 2, isWeekend: false, availableSpaces: 0, tone: "closed" },
            { date: "2026-03-03", day: 3, isWeekend: false, availableSpaces: 4, tone: "available" },
          ],
        })}
      />,
    );

    // Los botones de día siguen el orden de calendarDays: el primero es el 2 de marzo.
    const closedDay = screen.getAllByRole("button", { name: /Detalles del/i })[0];

    expect(closedDay).toHaveClass("bg-[var(--admin-availability-weekend)]");
  });

  it.each([
    [0, "bg-[var(--admin-availability-weekend)]"],
    [1, "bg-[var(--admin-availability-full)]"],
    [2, "bg-[var(--admin-availability-full)]"],
  ])("paints a full day with %i appointments in the matching tone", (appointmentsCount, expectedClass) => {
    render(
      <MonthDetailView
        month="2026-03"
        initialData={buildMonthDetail({
          calendarDays: [
            { date: "2026-03-02", day: 2, isWeekend: false, availableSpaces: 0, appointmentsCount, tone: "full" },
          ],
        })}
      />,
    );

    const fullDay = screen.getAllByRole("button", { name: /Detalles del/i })[0];

    expect(fullDay).toHaveClass(expectedClass);
  });

  // El grid de días va de lunes a domingo; los huecos iniciales dependen del día de la semana del día 1.
  it.each([
    ["2026-03", 6], // domingo
    ["2026-06", 0], // lunes
    ["2026-12", 1], // martes
  ])("lays out the calendar Monday to Sunday for %s with %i leading blanks", (month, leadingBlanks) => {
    const { container } = render(
      <MonthDetailView month={month} initialData={buildMonthDetail({ month, currentMonth: month })} />,
    );

    const [headerGrid, dayGrid] = Array.from(container.querySelectorAll(".grid-cols-7"));

    expect(Array.from(headerGrid.children).map((node) => node.textContent)).toEqual([
      "Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do",
    ]);
    expect(dayGrid.querySelectorAll("[aria-hidden]")).toHaveLength(leadingBlanks);
  });
});
