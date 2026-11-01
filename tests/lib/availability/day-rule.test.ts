import { describe, expect, it } from "vitest";

import { DEFAULT_DAY_RULE } from "@/lib/availability/defaults";
import { daysInMonth, isoWeekdayOf, isValidIsoDate, resolveDayRule } from "@/lib/availability/day-rule";
import type { AvailabilityException, AvailabilityRule, MonthAvailabilityConfig } from "@/lib/availability/types";

// 2026-12-05 sábado, 2026-12-07 lunes, 2026-12-12 sábado, 2026-12-14 lunes.
const DECEMBER_RULE: AvailabilityRule = {
  id: 1,
  startDate: "2026-12-01",
  endDate: "2026-12-13",
  weekdays: [1, 2, 3, 4, 5],
  times: ["09:00", "13:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

function config(overrides: Partial<MonthAvailabilityConfig> = {}): MonthAvailabilityConfig {
  return { month: "2026-12", rules: [], exceptions: [], availabilityVersion: 1, ...overrides };
}

const EXCEPTION_OPEN: AvailabilityException = {
  id: 10,
  date: "2026-12-07",
  times: ["10:00", "14:00"],
  minGapMinutes: 0,
  preserveCapacity: false,
  maxPerDay: 2,
};

describe("resolveDayRule (prioridad excepción > regla > default D6 > cerrado)", () => {
  it("uses the rule that covers the date and ISO weekday", () => {
    expect(resolveDayRule(config({ rules: [DECEMBER_RULE] }), "2026-12-07")).toEqual({
      source: "RULE",
      times: ["09:00", "13:00"],
      minGapMinutes: 240,
      preserveCapacity: true,
      maxPerDay: 3,
    });
  });

  it("closes a covered date whose weekday is not in the rule", () => {
    expect(resolveDayRule(config({ rules: [DECEMBER_RULE] }), "2026-12-12")).toBeNull();
  });

  it("closes a Monday not covered by the rule once the month has rules (D42, D23)", () => {
    expect(resolveDayRule(config({ rules: [DECEMBER_RULE] }), "2026-12-14")).toBeNull();
  });

  it("opens Monday to Friday with the D6 default when the month has no rules", () => {
    expect(resolveDayRule(config(), "2026-12-07")).toEqual({ source: "DEFAULT", ...DEFAULT_DAY_RULE, times: DEFAULT_DAY_RULE.times });
    expect(resolveDayRule(config(), "2026-12-05")).toBeNull();
  });

  it("returns a fresh times array for the default so callers cannot mutate the constant", () => {
    const first = resolveDayRule(config(), "2026-12-07");

    first?.times.push("23:00");

    expect(resolveDayRule(config(), "2026-12-07")?.times).toEqual(DEFAULT_DAY_RULE.times);
  });

  // F2: una fecha de otro mes no hereda ni el default D6 ni una regla ajena.
  it("throws AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH for a date outside the config month (F2)", () => {
    expect(() => resolveDayRule(config(), "2027-01-04")).toThrow("AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
    expect(() => resolveDayRule(config({ rules: [DECEMBER_RULE] }), "2027-01-04")).toThrow(
      "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    );
  });

  // F3: una fecha malformada no cierra el día en silencio (isoWeekdayOf daría NaN).
  it("throws AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH for a malformed date (F3)", () => {
    expect(() => resolveDayRule(config({ rules: [DECEMBER_RULE] }), "2026-12-7")).toThrow(
      "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    );
    expect(() => resolveDayRule(config(), "2026-13-01")).toThrow("AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
  });

  it("lets an exception win over the rule on the same date", () => {
    expect(resolveDayRule(config({ rules: [DECEMBER_RULE], exceptions: [EXCEPTION_OPEN] }), "2026-12-07")).toEqual({
      source: "EXCEPTION",
      times: ["10:00", "14:00"],
      minGapMinutes: 0,
      preserveCapacity: false,
      maxPerDay: 2,
    });
  });

  it("opens a weekend day with an exception even without rules (US2-1)", () => {
    const saturday = { ...EXCEPTION_OPEN, date: "2026-12-12" };

    expect(resolveDayRule(config({ exceptions: [saturday] }), "2026-12-12")).toMatchObject({
      source: "EXCEPTION",
      times: ["10:00", "14:00"],
    });
  });

  it("closes a day with an empty exception list (A2)", () => {
    const closed = { ...EXCEPTION_OPEN, times: [] };

    expect(resolveDayRule(config({ rules: [DECEMBER_RULE], exceptions: [closed] }), "2026-12-07")).toMatchObject({
      source: "EXCEPTION",
      times: [],
    });
  });

  it("throws AVAILABILITY_RULE_OVERLAP when two rules cover the same date", () => {
    const overlapping = { ...DECEMBER_RULE, id: 2, startDate: "2026-12-10", endDate: "2026-12-20" };

    expect(() => resolveDayRule(config({ rules: [DECEMBER_RULE, overlapping] }), "2026-12-10")).toThrow(
      "AVAILABILITY_RULE_OVERLAP",
    );
  });
});

describe("fechas de calendario", () => {
  it("uses ISO weekdays with Sunday as 7", () => {
    expect(isoWeekdayOf("2026-12-07")).toBe(1);
    expect(isoWeekdayOf("2026-12-06")).toBe(7);
  });

  it("validates calendar dates including leap years", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-12-7")).toBe(false);
  });

  it("counts days in a month", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-12")).toBe(31);
  });
});
