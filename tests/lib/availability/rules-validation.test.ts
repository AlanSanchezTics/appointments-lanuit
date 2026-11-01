import { describe, expect, it } from "vitest";

import { FULL_DAY_BLOCK_TIME_SLOT } from "@/lib/admin/blocked-spaces/day-block";
import { FULL_DAY_BLOCK_SENTINEL_TIME } from "@/lib/availability/defaults";
import { normalizeAvailabilityConfig, normalizeTimes, type AvailabilityRuleDraft } from "@/lib/availability/rules-validation";

// Verificación mínima de T010. T016 completa la cobertura por código de FR-025.
const MONTH = "2026-12";

const RULE: AvailabilityRuleDraft = {
  startDate: "2026-12-01",
  endDate: "2026-12-13",
  weekdays: [1, 2, 3, 4, 5],
  times: ["09:00", "13:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

function normalize(rules: AvailabilityRuleDraft[], exceptions: { date: string; times: string[]; minGapMinutes: number; preserveCapacity: boolean; maxPerDay: number }[] = []) {
  return () => normalizeAvailabilityConfig({ month: MONTH, rules, exceptions });
}

describe("rules validation (mínimo T010)", () => {
  it("sorts and deduplicates hours (D37)", () => {
    expect(normalizeTimes(["10:00", "09:00", "10:00"])).toEqual(["09:00", "10:00"]);
  });

  it("rejects a malformed hour (AVAILABILITY_TIME_INVALID)", () => {
    expect(() => normalizeTimes(["24:00"])).toThrow("AVAILABILITY_TIME_INVALID");
  });

  it("rejects more than 24 hours after normalization (D21)", () => {
    const twentyFive = Array.from({ length: 25 }, (_, minute) => `01:${String(minute).padStart(2, "0")}`);

    expect(() => normalizeTimes(twentyFive)).toThrow("AVAILABILITY_TIMES_LIMIT_EXCEEDED");
    // El duplicado se elimina antes de contar: 24 horas únicas más una repetida son válidas.
    expect(normalizeTimes([...twentyFive.slice(0, 24), "01:00"])).toHaveLength(24);
  });

  // F4 (D55): 00:00 es el centinela de bloqueo de día completo, no una hora de reglas ni excepciones.
  it("rejects 00:00 as an hour, in rules and exceptions (F4, D55)", () => {
    expect(() => normalizeTimes(["00:00"])).toThrow("AVAILABILITY_TIME_INVALID");
    expect(normalize([{ ...RULE, times: ["00:00", "09:00"] }])).toThrow("AVAILABILITY_TIME_INVALID");

    const midnight = { date: "2026-12-07", times: ["00:00"], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 1 };

    expect(normalize([], [midnight])).toThrow("AVAILABILITY_TIME_INVALID");
  });

  it("keeps the 00:00 literal in sync with the full-day block sentinel (F4)", () => {
    expect(FULL_DAY_BLOCK_SENTINEL_TIME).toBe(FULL_DAY_BLOCK_TIME_SLOT);
  });

  it("rejects a rule range outside the month and an inverted range", () => {
    expect(normalize([{ ...RULE, endDate: "2027-01-02" }])).toThrow("AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
    expect(normalize([{ ...RULE, startDate: "2026-12-13", endDate: "2026-12-01" }])).toThrow("AVAILABILITY_RULE_RANGE_INVALID");
  });

  it("rejects a rule without weekdays or without hours (D38)", () => {
    expect(normalize([{ ...RULE, weekdays: [] }])).toThrow("AVAILABILITY_RULE_WEEKDAYS_REQUIRED");
    expect(normalize([{ ...RULE, times: [] }])).toThrow("AVAILABILITY_RULE_TIMES_REQUIRED");
  });

  it("rejects gap and maxPerDay out of range (D20)", () => {
    expect(normalize([{ ...RULE, minGapMinutes: 1441 }])).toThrow("AVAILABILITY_MIN_GAP_OUT_OF_RANGE");
    expect(normalize([{ ...RULE, maxPerDay: 7 }])).toThrow("AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE");
  });

  it("rejects overlapping rule dates even when weekdays differ (A1, FR-003)", () => {
    const weekend = { ...RULE, startDate: "2026-12-10", endDate: "2026-12-20", weekdays: [6, 7] };

    expect(normalize([RULE, weekend])).toThrow("AVAILABILITY_RULE_OVERLAP");
  });

  it("accepts an exception with an empty hour list (A2)", () => {
    const closed = { date: "2026-12-07", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 };

    expect(normalize([RULE], [closed])()).toEqual({ rules: [RULE], exceptions: [closed] });
  });

  it("rejects two exceptions for the same date before the database does (N3)", () => {
    const first = { date: "2026-12-07", times: ["10:00"], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 2 };

    expect(normalize([], [first, { ...first, times: ["11:00"] }])).toThrow("AVAILABILITY_EXCEPTION_DATE_DUPLICATE");
  });

  it("rejects an exception outside the month", () => {
    const outside = { date: "2027-01-01", times: [], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 1 };

    expect(normalize([], [outside])).toThrow("AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH");
  });

  // T016 (FR-025): un caso por código y los límites de D20, D21, D37 y D38.
  it("accepts the D20 limits for gap and maxPerDay", () => {
    expect(normalize([{ ...RULE, minGapMinutes: 0, maxPerDay: 1 }])).not.toThrow();
    expect(normalize([{ ...RULE, minGapMinutes: 1440, maxPerDay: 6 }])).not.toThrow();
  });

  it("rejects a non-integer gap and a maxPerDay of 0 (D20)", () => {
    expect(normalize([{ ...RULE, minGapMinutes: 1.5 }])).toThrow("AVAILABILITY_MIN_GAP_OUT_OF_RANGE");
    expect(normalize([{ ...RULE, maxPerDay: 0 }])).toThrow("AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE");
  });

  it("applies the same gap and maxPerDay limits to exceptions", () => {
    const exception = { date: "2026-12-07", times: ["10:00"], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 };

    expect(normalize([], [{ ...exception, minGapMinutes: 1441 }])).toThrow("AVAILABILITY_MIN_GAP_OUT_OF_RANGE");
    expect(normalize([], [{ ...exception, maxPerDay: 7 }])).toThrow("AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE");
  });

  it("accepts exactly 24 different hours and rejects 25 (D21)", () => {
    const twentyFour = Array.from({ length: 24 }, (_, minute) => `01:${String(minute).padStart(2, "0")}`);

    expect(normalizeTimes(twentyFour)).toHaveLength(24);
    expect(normalize([{ ...RULE, times: [...twentyFour, "02:00"] }])).toThrow("AVAILABILITY_TIMES_LIMIT_EXCEEDED");
  });

  it("rejects an hour without zero padding (HH:mm, FR-025)", () => {
    expect(() => normalizeTimes(["9:00"])).toThrow("AVAILABILITY_TIME_INVALID");
  });

  it("rejects weekdays outside 1 to 7 (D38, A-10)", () => {
    expect(normalize([{ ...RULE, weekdays: [0] }])).toThrow("AVAILABILITY_RULE_WEEKDAYS_REQUIRED");
    expect(normalize([{ ...RULE, weekdays: [8] }])).toThrow("AVAILABILITY_RULE_WEEKDAYS_REQUIRED");
  });

  it("rejects a rule whose start date is outside the month (FR-025)", () => {
    expect(normalize([{ ...RULE, startDate: "2026-11-30" }])).toThrow("AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH");
  });

  it("accepts a rule covering the whole month and two adjacent rules (A1)", () => {
    const first = { ...RULE, startDate: "2026-12-01", endDate: "2026-12-13" };
    const second = { ...RULE, id: 2, startDate: "2026-12-14", endDate: "2026-12-31", weekdays: [1, 2, 3, 4, 5, 6, 7] };

    expect(normalize([{ ...RULE, startDate: "2026-12-01", endDate: "2026-12-31" }])).not.toThrow();
    expect(normalize([first, second])).not.toThrow();
  });

  it("returns weekdays sorted and without duplicates, and hours normalized (D37)", () => {
    const result = normalizeAvailabilityConfig({
      month: MONTH,
      rules: [{ ...RULE, weekdays: [5, 1, 5, 3], times: ["13:00", "09:00", "13:00"] }],
      exceptions: [],
    });

    expect(result.rules[0].weekdays).toEqual([1, 3, 5]);
    expect(result.rules[0].times).toEqual(["09:00", "13:00"]);
  });
});
