import { describe, expect, it } from "vitest";

import { resolveDay, resolveMonthDays } from "@/lib/availability/resolver";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";

const NOW = new Date("2026-10-28T12:00:00.000Z");

const DECEMBER_WITHOUT_RULES: MonthAvailabilityConfig = {
  month: "2026-12",
  availabilityVersion: 1,
  rules: [],
  exceptions: [],
};

describe("resolveDay (fechas fuera del mes o malformadas)", () => {
  // F2: el mes de la configuración es el único rango válido para resolver días.
  it("throws AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH for a date of another month (F2)", () => {
    expect(() => resolveDay(DECEMBER_WITHOUT_RULES, "2027-01-04", { now: NOW })).toThrow(
      "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    );
  });

  // F3: fechas malformadas se rechazan en el punto de entrada.
  it("throws AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH for malformed dates (F3)", () => {
    expect(() => resolveDay(DECEMBER_WITHOUT_RULES, "2026-12-7", { now: NOW })).toThrow(
      "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    );
    expect(() => resolveDay(DECEMBER_WITHOUT_RULES, "2026-13-01", { now: NOW })).toThrow(
      "AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH",
    );
  });

  it("still resolves a valid date of the config month (D6 default on a Monday)", () => {
    expect(resolveDay(DECEMBER_WITHOUT_RULES, "2026-12-07", { now: NOW }).dayRule?.source).toBe("DEFAULT");
  });

  it("resolves every day of the config month without throwing", () => {
    expect(resolveMonthDays(DECEMBER_WITHOUT_RULES, { now: NOW })).toHaveLength(31);
  });
});
