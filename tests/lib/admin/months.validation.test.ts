import { describe, expect, it } from "vitest";

import {
  parseMonthsCatalogQuery,
  parseMonthsCatalogQueryFromObject,
  parseMonthsCatalogQueryOrDefault,
} from "@/lib/admin/months/validation";

describe("admin months catalog validation", () => {
  const now = new Date("2026-03-21T12:00:00.000Z");

  it("uses current year and ALL status by default", () => {
    const result = parseMonthsCatalogQuery(new URLSearchParams(), now);

    expect(result).toEqual({
      year: 2026,
      status: "ALL",
      availableYears: [2026, 2027, 2028, 2029, 2030, 2031],
    });
  });

  it("parses explicit year and status", () => {
    const result = parseMonthsCatalogQuery(
      new URLSearchParams({
        year: "2028",
        status: "inactive",
      }),
      now,
    );

    expect(result.year).toBe(2028);
    expect(result.status).toBe("INACTIVE");
  });

  it("throws when year is out of range", () => {
    expect(() =>
      parseMonthsCatalogQuery(
        new URLSearchParams({
          year: "2035",
        }),
        now,
      ),
    ).toThrow("MONTHS_YEAR_OUT_OF_RANGE");
  });

  it("parses query object from page search params", () => {
    const result = parseMonthsCatalogQueryFromObject(
      {
        year: "2027",
        status: "ACTIVE",
      },
      now,
    );

    expect(result).toEqual({
      year: 2027,
      status: "ACTIVE",
      availableYears: [2026, 2027, 2028, 2029, 2030, 2031],
    });
  });

  it("falls back to defaults when query object is invalid", () => {
    const result = parseMonthsCatalogQueryOrDefault(
      {
        year: "invalid",
      },
      now,
    );

    expect(result.year).toBe(2026);
    expect(result.status).toBe("ALL");
  });
});
