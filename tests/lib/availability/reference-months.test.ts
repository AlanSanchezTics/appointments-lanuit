import { describe, expect, it } from "vitest";

import { resolveMonthDays, type ResolvedDay } from "@/lib/availability/resolver";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";

// Meses de referencia del owner (spec US4 escenarios 1 y 2; D9, D11, D23, D27, D28). SC-001 y SC-007.
// Sin citas ni bloqueos. "now" en octubre de 2026: ningún día de los meses de referencia es hoy.
const NOW = new Date("2026-10-31T12:00:00.000Z");

const SIX_HOUR_PARAMS = {
  times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

function dates(month: string, days: number[]) {
  return days.map((day) => `${month}-${String(day).padStart(2, "0")}`);
}

function byDate(days: ResolvedDay[]) {
  return new Map(days.map((day) => [day.date, day]));
}

function totalSpaces(days: ResolvedDay[]) {
  return days.reduce((sum, day) => sum + day.availableSpaces, 0);
}

describe("meses de referencia de aceptación (US4, SC-001, SC-007)", () => {
  describe("diciembre 2026 (US4 escenario 1)", () => {
    const DEC = "2026-12";
    const december: MonthAvailabilityConfig = {
      month: DEC,
      availabilityVersion: 1,
      exceptions: [],
      rules: [
        {
          id: 1,
          startDate: "2026-12-01",
          endDate: "2026-12-13",
          weekdays: [1, 2, 3, 4, 5],
          ...SIX_HOUR_PARAMS,
        },
        {
          id: 2,
          startDate: "2026-12-14",
          endDate: "2026-12-23",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times: ["07:30", "11:00", "14:30", "18:00"],
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 4,
        },
      ],
    };

    const days = byDate(resolveMonthDays(december, { now: NOW }));

    // Martes 1, miércoles 2, jueves 3, viernes 4, lunes 7, martes 8, miércoles 9, jueves 10 y viernes 11.
    const workdaysRuleA = dates(DEC, [1, 2, 3, 4, 7, 8, 9, 10, 11]);
    // Sábados y domingos del 1 al 13: regla A no los cubre (D23).
    const weekendRuleA = dates(DEC, [5, 6, 12, 13]);
    // Del 14 al 23, regla B todos los días (incluye sábado 19 y domingo 20).
    const rangeRuleB = dates(DEC, [14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
    // Sin regla ni excepción (D23): no suman espacios.
    const uncovered = dates(DEC, [24, 25, 26, 27, 28, 29, 30, 31]);

    it("offers the six regla A hours and 3 spaces on each of the 9 workdays from 1 to 13", () => {
      expect(workdaysRuleA).toHaveLength(9);

      for (const date of workdaysRuleA) {
        expect(days.get(date)?.slots, date).toEqual(SIX_HOUR_PARAMS.times);
        expect(days.get(date)?.availableSpaces, date).toBe(3);
      }
    });

    it("closes weekends from 1 to 13 under regla A (D23)", () => {
      for (const date of weekendRuleA) {
        expect(days.get(date)?.dayRule, date).toBeNull();
        expect(days.get(date)?.slots, date).toEqual([]);
        expect(days.get(date)?.availableSpaces, date).toBe(0);
      }
    });

    it("offers the four regla B hours and 4 spaces on each of the 10 days from 14 to 23 (D11)", () => {
      expect(rangeRuleB).toHaveLength(10);

      for (const date of rangeRuleB) {
        expect(days.get(date)?.slots, date).toEqual(["07:30", "11:00", "14:30", "18:00"]);
        expect(days.get(date)?.availableSpaces, date).toBe(4);
      }
    });

    it("closes days 24 to 31 that no rule or exception covers (D23)", () => {
      for (const date of uncovered) {
        expect(days.get(date)?.dayRule, date).toBeNull();
        expect(days.get(date)?.slots, date).toEqual([]);
        expect(days.get(date)?.availableSpaces, date).toBe(0);
      }
    });

    it("totals 67 spaces for the empty month: 9 x 3 + 10 x 4 (SC-007, D11)", () => {
      const all = resolveMonthDays(december, { now: NOW });

      expect(totalSpaces(all)).toBe(67);
      expect(all.filter((day) => day.slots.length > 0)).toHaveLength(19);
    });
  });

  describe("enero 2027 (US4 escenario 2)", () => {
    const JAN = "2027-01";
    const january: MonthAvailabilityConfig = {
      month: JAN,
      availabilityVersion: 1,
      rules: [
        {
          id: 1,
          startDate: "2027-01-01",
          endDate: "2027-01-31",
          weekdays: [1, 2, 3, 4, 5],
          ...SIX_HOUR_PARAMS,
        },
      ],
      exceptions: [
        { id: 1, date: "2027-01-16", ...SIX_HOUR_PARAMS },
        { id: 2, date: "2027-01-23", ...SIX_HOUR_PARAMS },
        { id: 3, date: "2027-01-18", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
        { id: 4, date: "2027-01-25", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
      ],
    };

    const days = byDate(resolveMonthDays(january, { now: NOW }));

    // Lunes 4 y 11, y martes a viernes sin excepción (ver la lista en la spec, US4-2 bullet 3).
    const openWorkdays = dates(JAN, [1, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 19, 20, 21, 22, 26, 27, 28, 29]);
    const openSaturdays = dates(JAN, [16, 23]);
    const closedMondays = dates(JAN, [18, 25]);
    const closedSaturdaysAndSundays = dates(JAN, [2, 9, 30, 3, 10, 17, 24, 31]);

    it("offers the six hours and 3 spaces on the 19 covered weekdays", () => {
      expect(openWorkdays).toHaveLength(19);

      for (const date of openWorkdays) {
        expect(days.get(date)?.slots, date).toEqual(SIX_HOUR_PARAMS.times);
        expect(days.get(date)?.availableSpaces, date).toBe(3);
      }
    });

    it("opens Saturdays 16 and 23 through their exceptions with the six hours", () => {
      for (const date of openSaturdays) {
        expect(days.get(date)?.dayRule?.source, date).toBe("EXCEPTION");
        expect(days.get(date)?.slots, date).toEqual(SIX_HOUR_PARAMS.times);
        expect(days.get(date)?.availableSpaces, date).toBe(3);
      }
    });

    it("closes Mondays 18 and 25 through empty-list exceptions (D27)", () => {
      for (const date of closedMondays) {
        expect(days.get(date)?.dayRule?.source, date).toBe("EXCEPTION");
        expect(days.get(date)?.slots, date).toEqual([]);
        expect(days.get(date)?.availableSpaces, date).toBe(0);
      }
    });

    it("closes Saturdays 2, 9, 30 and every Sunday because the month has a rule and no exception (D23, D28)", () => {
      for (const date of closedSaturdaysAndSundays) {
        expect(days.get(date)?.dayRule, date).toBeNull();
        expect(days.get(date)?.slots, date).toEqual([]);
        expect(days.get(date)?.availableSpaces, date).toBe(0);
      }
    });

    it("totals 63 spaces: 21 open days x 3 (derived from US4-2 with D3 and D6, not an owner figure)", () => {
      const all = resolveMonthDays(january, { now: NOW });

      expect(all.filter((day) => day.slots.length > 0)).toHaveLength(21);
      expect(totalSpaces(all)).toBe(63);
    });
  });
});
