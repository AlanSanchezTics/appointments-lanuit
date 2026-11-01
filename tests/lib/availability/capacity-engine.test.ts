import { describe, expect, it } from "vitest";

import { computeDayAvailability, best } from "@/lib/availability/capacity-engine";
import { SLOT_MODE_PRESETS } from "@/lib/availability/defaults";
import type { DayContext, DayRule, MonthAvailabilityConfig } from "@/lib/availability/types";
import { resolveDay, resolveMonthDays } from "@/lib/availability/resolver";

const BLOCK_DAY: DayRule = {
  source: "RULE",
  times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

function context(overrides: Partial<DayContext> = {}): DayContext {
  return {
    date: "2026-12-07",
    occupiedTimes: [],
    blockedTimes: [],
    fullDayBlocked: false,
    currentTime: null,
    ...overrides,
  };
}

const NOON_MEXICO_CITY_2026_12_10 = new Date("2026-12-10T18:00:00.000Z"); // 12:00 en America/Mexico_City
const BEFORE_DECEMBER = new Date("2026-10-28T12:00:00.000Z");

describe("best (máximo de citas con tope)", () => {
  it("returns the exhaustive maximum for the BLOCK grid", () => {
    expect(best([], ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"], 240, 3)).toBe(3);
  });

  it("respects the cap instead of a fixed constant of 3", () => {
    expect(best([], ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"], 240, 2)).toBe(2);
    expect(best([], ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"], 0, 6)).toBe(6);
  });

  it("counts fixed occupied times even when they are not in the grid", () => {
    expect(best(["11:00"], ["09:00", "17:00"], 240, 3)).toBe(2);
  });
});

describe("computeDayAvailability (pasos 1 a 6)", () => {
  it("offers 6 slots and 3 spaces on an empty BLOCK day (US3-1)", () => {
    expect(computeDayAvailability(BLOCK_DAY, context())).toEqual({
      slots: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
      availableSpaces: 3,
    });
  });

  it("excludes 10:00 after 09:00 and keeps the rest (US3-2)", () => {
    expect(computeDayAvailability(BLOCK_DAY, context({ occupiedTimes: ["09:00"] }))).toEqual({
      slots: ["13:00", "14:00", "17:00", "18:00"],
      availableSpaces: 2,
    });
  });

  it("drops 17:00 after 10:00 because preserveCapacity would reduce the day (US3-3)", () => {
    expect(computeDayAvailability(BLOCK_DAY, context({ occupiedTimes: ["10:00"] }))).toEqual({
      slots: ["14:00", "18:00"],
      availableSpaces: 2,
    });
  });

  it("offers 17:00 after 10:00 when preserveCapacity is false (US3-4)", () => {
    const noPreserve: DayRule = { ...BLOCK_DAY, preserveCapacity: false };

    expect(computeDayAvailability(noPreserve, context({ occupiedTimes: ["10:00"] })).slots).toEqual([
      "14:00",
      "17:00",
      "18:00",
    ]);
  });

  it("returns no slots and no spaces when the day has no times", () => {
    expect(computeDayAvailability({ ...BLOCK_DAY, times: [] }, context())).toEqual({
      slots: [],
      availableSpaces: 0,
    });
  });

  it("returns no slots and no spaces when the day has no rule (closed, D23)", () => {
    expect(computeDayAvailability(null, context())).toEqual({ slots: [], availableSpaces: 0 });
  });

  it("returns no slots and no spaces when the full day is blocked (D34)", () => {
    expect(computeDayAvailability(BLOCK_DAY, context({ fullDayBlocked: true }))).toEqual({
      slots: [],
      availableSpaces: 0,
    });
  });

  it("returns nothing once occupied reaches maxPerDay (FR-011) and uses maxPerDay, not a constant 3", () => {
    const twoPerDay: DayRule = { ...BLOCK_DAY, maxPerDay: 2 };

    expect(computeDayAvailability(twoPerDay, context()).availableSpaces).toBe(2);
    expect(computeDayAvailability(twoPerDay, context({ occupiedTimes: ["09:00", "13:00"] }))).toEqual({
      slots: [],
      availableSpaces: 0,
    });
  });

  it("removes manually blocked times from the grid before computing capacity (FR-013, literal)", () => {
    // Con 09:00 bloqueada la rejilla queda 10,13,14,17,18. 13 y 17 bajarían la capacidad, así que no se ofrecen.
    expect(computeDayAvailability(BLOCK_DAY, context({ blockedTimes: ["09:00"] }))).toEqual({
      slots: ["10:00", "14:00", "18:00"],
      availableSpaces: 3,
    });
  });

  it("keeps times equal to the current time and drops earlier ones (FR-014, D50)", () => {
    const dayWithNine = { ...BLOCK_DAY, times: ["09:00", "13:00"], minGapMinutes: 240 };

    expect(computeDayAvailability(dayWithNine, context({ currentTime: "13:00" })).slots).toEqual(["13:00"]);
    expect(computeDayAvailability(dayWithNine, context({ currentTime: "12:00" })).slots).toEqual(["13:00"]);
    expect(computeDayAvailability(dayWithNine, context({ currentTime: "13:01" })).slots).toEqual([]);
  });

  it("does not count a repeated hour twice when minGapMinutes is 0 (D37 guard)", () => {
    const repeated: DayRule = {
      source: "RULE",
      times: ["10:00", "09:00", "10:00"],
      minGapMinutes: 0,
      preserveCapacity: false,
      maxPerDay: 3,
    };

    expect(computeDayAvailability(repeated, context())).toEqual({
      slots: ["09:00", "10:00"],
      availableSpaces: 2,
    });
  });
});

describe("resolveDay y resolveMonthDays (resolvedor único)", () => {
  const December: MonthAvailabilityConfig = {
    month: "2026-12",
    availabilityVersion: 1,
    exceptions: [],
    rules: [
      {
        id: 1,
        startDate: "2026-12-01",
        endDate: "2026-12-13",
        weekdays: [1, 2, 3, 4, 5],
        times: [...SLOT_MODE_PRESETS.BLOCK_MODE.times],
        minGapMinutes: 240,
        preserveCapacity: true,
        maxPerDay: 3,
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

  it("sums 67 spaces for December 2026 (SC-007: 9 weekdays × 3 + 10 days × 4)", () => {
    const days = resolveMonthDays(December, { now: BEFORE_DECEMBER });
    const total = days.reduce((sum, day) => sum + day.availableSpaces, 0);

    expect(total).toBe(67);
    expect(resolveDay(December, "2026-12-01", { now: BEFORE_DECEMBER }).availableSpaces).toBe(3);
    expect(resolveDay(December, "2026-12-14", { now: BEFORE_DECEMBER }).availableSpaces).toBe(4);
    expect(resolveDay(December, "2026-12-24", { now: BEFORE_DECEMBER })).toMatchObject({
      dayRule: null,
      slots: [],
      availableSpaces: 0,
    });
  });

  it("sums 63 spaces for January 2027 with exceptions (21 open days × 3)", () => {
    const blockTimes = [...SLOT_MODE_PRESETS.BLOCK_MODE.times];
    const january: MonthAvailabilityConfig = {
      month: "2027-01",
      availabilityVersion: 1,
      rules: [
        {
          id: 1,
          startDate: "2027-01-01",
          endDate: "2027-01-31",
          weekdays: [1, 2, 3, 4, 5],
          times: blockTimes,
          minGapMinutes: 240,
          preserveCapacity: true,
          maxPerDay: 3,
        },
      ],
      exceptions: [
        { id: 1, date: "2027-01-18", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
        { id: 2, date: "2027-01-25", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
        { id: 3, date: "2027-01-16", times: blockTimes, minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
        { id: 4, date: "2027-01-23", times: blockTimes, minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
      ],
    };

    expect(resolveMonthDays(january, { now: BEFORE_DECEMBER }).reduce((sum, day) => sum + day.availableSpaces, 0)).toBe(63);
  });

  it("filters the current hour only for today in America/Mexico_City (D22, D50)", () => {
    const today: MonthAvailabilityConfig = {
      month: "2026-12",
      availabilityVersion: 1,
      exceptions: [],
      rules: [
        {
          id: 1,
          startDate: "2026-12-01",
          endDate: "2026-12-31",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times: ["09:00", "13:00"],
          minGapMinutes: 240,
          preserveCapacity: true,
          maxPerDay: 3,
        },
      ],
    };

    expect(resolveDay(today, "2026-12-10", { now: NOON_MEXICO_CITY_2026_12_10 }).slots).toEqual(["13:00"]);
    expect(resolveDay(today, "2026-12-11", { now: NOON_MEXICO_CITY_2026_12_10 }).slots).toEqual([
      "09:00",
      "13:00",
    ]);
  });

  it("gives 00:00 as the current time at local midnight (no 24:00)", () => {
    const midnight = new Date("2026-12-10T06:00:00.000Z");
    const config: MonthAvailabilityConfig = {
      month: "2026-12",
      availabilityVersion: 1,
      exceptions: [],
      rules: [
        {
          id: 1,
          startDate: "2026-12-01",
          endDate: "2026-12-31",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          // 01:00 y no 00:00: 00:00 es el centinela de bloqueo (F4, D55). Si la hora actual fuera 24:00, 01:00 quedaría fuera.
          times: ["01:00", "09:00"],
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 3,
        },
      ],
    };

    expect(resolveDay(config, "2026-12-10", { now: midnight }).slots).toEqual(["01:00", "09:00"]);
  });

  it("stays within the performance budget for a 31-day month with 24 hours and maxPerDay 6 (plan, presupuesto)", () => {
    const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

    for (const minGapMinutes of [60, 120, 240, 300, 360]) {
      const worst: MonthAvailabilityConfig = {
        month: "2026-12",
        availabilityVersion: 1,
        exceptions: [],
        rules: [
          {
            id: 1,
            startDate: "2026-12-01",
            endDate: "2026-12-31",
            weekdays: [1, 2, 3, 4, 5, 6, 7],
            times: hours,
            minGapMinutes,
            preserveCapacity: true,
            maxPerDay: 6,
          },
        ],
      };

      const started = performance.now();
      resolveMonthDays(worst, { now: BEFORE_DECEMBER });
      const elapsed = performance.now() - started;

      expect(elapsed, `minGapMinutes=${minGapMinutes}`).toBeLessThan(200);
    }
  });
});
