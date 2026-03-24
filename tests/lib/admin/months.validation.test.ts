import { describe, expect, it } from "vitest";

import {
  parseAdminMonthKey,
  parseCreateAdminMonthsPayload,
  parseMonthsCatalogQuery,
  parseMonthsCatalogQueryFromObject,
  parseMonthsCatalogQueryOrDefault,
  parseUpdateMonthStatusPayload,
  parseUpdateMonthSlotModePayload,
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

  it("parses create payload and deduplicates months", () => {
    const result = parseCreateAdminMonthsPayload(
      {
        year: 2026,
        months: ["2026-06", "2026-07", "2026-06"],
      },
      now,
    );

    expect(result).toEqual({
      year: 2026,
      months: ["2026-06", "2026-07"],
    });
  });

  it("rejects months that are not in the future", () => {
    expect(() =>
      parseCreateAdminMonthsPayload(
        {
          year: 2026,
          months: ["2026-03"],
        },
        now,
      ),
    ).toThrow("MONTHS_MONTH_NOT_FUTURE");
  });

  it("rejects empty month selection", () => {
    expect(() =>
      parseCreateAdminMonthsPayload(
        {
          year: 2026,
          months: [],
        },
        now,
      ),
    ).toThrow("MONTHS_EMPTY_SELECTION");
  });

  it("accepts valid admin month route key", () => {
    expect(parseAdminMonthKey("2026-03")).toBe("2026-03");
  });

  it("rejects invalid admin month route key", () => {
    expect(() => parseAdminMonthKey("2026-13")).toThrow("MONTHS_INVALID_FORMAT");
    expect(() => parseAdminMonthKey("2026-00")).toThrow("MONTHS_INVALID_FORMAT");
  });

  it("parses valid update slot mode payload", () => {
    expect(
      parseUpdateMonthSlotModePayload({
        slotMode: "SECOND_ONLY_MODE",
      }),
    ).toEqual({
      slotMode: "SECOND_ONLY_MODE",
    });
  });

  it("rejects invalid update slot mode payload", () => {
    expect(() =>
      parseUpdateMonthSlotModePayload({
        slotMode: "INVALID",
      }),
    ).toThrow();
  });

  it("parses valid update month status payload", () => {
    expect(
      parseUpdateMonthStatusPayload({
        status: "INACTIVE",
      }),
    ).toEqual({
      status: "INACTIVE",
    });
  });

  it("rejects invalid update month status payload", () => {
    expect(() =>
      parseUpdateMonthStatusPayload({
        status: "INVALID",
      }),
    ).toThrow();
  });
});
