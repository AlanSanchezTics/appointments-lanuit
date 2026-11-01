import { describe, expect, it } from "vitest";

import { findAffectedAppointments, type AppointmentForAvailabilityCheck } from "@/lib/availability/affected-appointments";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";

// Verificación mínima de T012. T017 completa los casos de FR-024.
const NOW = new Date("2026-10-28T12:00:00.000Z"); // 06:00 en America/Mexico_City

const TIMES_BEFORE = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"];
const TIMES_AFTER = ["13:00", "14:00", "17:00", "18:00"];

function config(times: string[], exceptions: MonthAvailabilityConfig["exceptions"] = []): MonthAvailabilityConfig {
  return {
    month: "2026-12",
    availabilityVersion: 1,
    exceptions,
    rules: [
      {
        id: 1,
        startDate: "2026-12-01",
        endDate: "2026-12-31",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        times,
        minGapMinutes: 240,
        preserveCapacity: true,
        maxPerDay: 3,
      },
    ],
  };
}

const appointments: AppointmentForAvailabilityCheck[] = [
  { id: 1, date: "2026-12-10", timeSlot: "09:00", status: "PENDING" }, // sale del horario: afectada
  { id: 2, date: "2026-12-10", timeSlot: "13:00", status: "CONFIRMED" }, // sigue dentro
  { id: 3, date: "2026-12-10", timeSlot: "10:00", status: "CANCELLED" }, // no activa
  { id: 4, date: "2026-10-20", timeSlot: "09:00", status: "PENDING" }, // pasada
  { id: 5, date: "2026-12-10", timeSlot: "11:00", status: "PENDING" }, // ya estaba fuera antes (A-03)
  { id: 6, date: "2026-12-11", timeSlot: "14:00", status: "SYNC_FAILED" }, // el día queda cerrado: afectada
];

describe("findAffectedAppointments (mínimo T012)", () => {
  it("lists only active future appointments that leave the grid (A-03, A-04, D35)", () => {
    const proposed = config(TIMES_AFTER, [
      { id: 2, date: "2026-12-11", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
    ]);

    const affected = findAffectedAppointments({
      current: config(TIMES_BEFORE),
      proposed,
      appointments,
      now: NOW,
    });

    expect(affected.map((appointment) => appointment.id)).toEqual([1, 6]);
  });

  // F1: una cita de otro mes no es afectada, aunque el mes actual no tenga reglas (D6 abre el día).
  it("ignores an active future appointment outside the current month (F1)", () => {
    const currentWithoutRules: MonthAvailabilityConfig = {
      month: "2026-12",
      availabilityVersion: 1,
      rules: [],
      exceptions: [],
    };
    const outsideMonth: AppointmentForAvailabilityCheck = {
      id: 7,
      date: "2027-01-04",
      timeSlot: "09:00",
      status: "PENDING",
    };

    expect(
      findAffectedAppointments({
        current: currentWithoutRules,
        proposed: config(TIMES_AFTER),
        appointments: [outsideMonth],
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("does not list anything when nothing changes for the grid", () => {
    expect(
      findAffectedAppointments({
        current: config(TIMES_BEFORE),
        proposed: config(TIMES_BEFORE),
        appointments,
        now: NOW,
      }),
    ).toEqual([]);
  });

  // T017 (FR-024, D35, D40, D50, A-03, A-04).
  const OCTOBER_TIMES_BEFORE = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"];

  function octoberConfig(times: string[]): MonthAvailabilityConfig {
    return {
      month: "2026-10",
      availabilityVersion: 1,
      exceptions: [],
      rules: [
        {
          id: 1,
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times,
          minGapMinutes: 240,
          preserveCapacity: true,
          maxPerDay: 3,
        },
      ],
    };
  }

  it("treats an appointment at the current hour as future and skips earlier hours of today (D50)", () => {
    // 2026-10-28 16:00 UTC = 10:00 en America/Mexico_City.
    const today: AppointmentForAvailabilityCheck[] = [
      { id: 20, date: "2026-10-28", timeSlot: "09:00", status: "PENDING" },
      { id: 21, date: "2026-10-28", timeSlot: "10:00", status: "CONFIRMED" },
    ];

    const affected = findAffectedAppointments({
      current: octoberConfig(OCTOBER_TIMES_BEFORE),
      proposed: octoberConfig(["13:00", "14:00", "17:00", "18:00"]),
      appointments: today,
      now: new Date("2026-10-28T16:00:00.000Z"),
    });

    expect(affected.map((appointment) => appointment.id)).toEqual([21]);
  });

  it("orders the affected list by date and then by hour", () => {
    const unordered: AppointmentForAvailabilityCheck[] = [
      { id: 30, date: "2026-12-12", timeSlot: "18:00", status: "PENDING" },
      { id: 31, date: "2026-12-10", timeSlot: "17:00", status: "CONFIRMED" },
      { id: 32, date: "2026-12-10", timeSlot: "18:00", status: "SYNC_FAILED" },
    ];

    const affected = findAffectedAppointments({
      current: config(TIMES_BEFORE),
      proposed: config(["13:00", "14:00"]),
      appointments: unordered,
      now: NOW,
    });

    expect(affected.map((appointment) => appointment.id)).toEqual([31, 32, 30]);
  });

  it("does not list a cancelled appointment even when it leaves the grid", () => {
    const cancelled: AppointmentForAvailabilityCheck[] = [
      { id: 33, date: "2026-12-10", timeSlot: "09:00", status: "CANCELLED" },
    ];

    expect(
      findAffectedAppointments({
        current: config(TIMES_BEFORE),
        proposed: config(TIMES_AFTER),
        appointments: cancelled,
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("uses D6 as the current grid when the current month has no rules (A-04)", () => {
    const currentWithoutRules: MonthAvailabilityConfig = {
      month: "2026-12",
      availabilityVersion: 1,
      rules: [],
      exceptions: [],
    };
    const weekday: AppointmentForAvailabilityCheck = { id: 34, date: "2026-12-07", timeSlot: "09:00", status: "CONFIRMED" };
    const saturday: AppointmentForAvailabilityCheck = { id: 35, date: "2026-12-05", timeSlot: "09:00", status: "CONFIRMED" };

    expect(
      findAffectedAppointments({
        current: currentWithoutRules,
        proposed: config(TIMES_AFTER),
        appointments: [weekday, saturday],
        now: NOW,
      }).map((appointment) => appointment.id),
    ).toEqual([34]);
  });

  it("does not list an appointment whose hour was never in the current grid (A-03)", () => {
    const outsideCurrentGrid: AppointmentForAvailabilityCheck[] = [
      { id: 36, date: "2026-12-20", timeSlot: "09:00", status: "CONFIRMED" },
    ];

    expect(
      findAffectedAppointments({
        current: config(TIMES_BEFORE, [
          { id: 3, date: "2026-12-20", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
        ]),
        proposed: config(TIMES_AFTER),
        appointments: outsideCurrentGrid,
        now: NOW,
      }),
    ).toEqual([]);
  });

  // D40/CF8: los bloqueos manuales no son entradas de la función; quitar una hora de la rejilla sin cita no lista nada.
  it("lists nothing when a grid hour without appointments is removed (D40)", () => {
    expect(
      findAffectedAppointments({
        current: config(TIMES_BEFORE),
        proposed: config(["13:00", "17:00", "18:00"]),
        appointments: [{ id: 37, date: "2026-12-10", timeSlot: "13:00", status: "CONFIRMED" }],
        now: NOW,
      }),
    ).toEqual([]);
  });

  // N-R2 (1B, cerrado en 1E-r1): comparar dos meses distintos no tiene sentido; la función se niega a hacerlo.
  it("refuses to compare configurations of different months (N-R2)", () => {
    expect(() =>
      findAffectedAppointments({
        current: config(TIMES_BEFORE),
        proposed: { ...config(TIMES_AFTER), month: "2026-11" },
        appointments: [],
        now: NOW,
      }),
    ).toThrow("AFFECTED_MONTH_MISMATCH");
  });
});
