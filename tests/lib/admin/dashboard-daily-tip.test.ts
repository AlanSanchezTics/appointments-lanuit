import { describe, expect, it } from "vitest";

import {
  parseTipsCsv,
  resolveDailyTipFromCatalog,
  resolveDailyTipIndex,
} from "@/lib/admin/dashboard/daily-tip";

describe("admin dashboard daily tip", () => {
  it("parses csv rows with quoted values", () => {
    const csv = "\"Tip one\"\n\"Tip two\"\n";
    expect(parseTipsCsv(csv)).toEqual(["Tip one", "Tip two"]);
  });

  it("resolves index with deterministic daily rotation", () => {
    expect(resolveDailyTipIndex("2026-03-29", 30)).toBe(0);
    expect(resolveDailyTipIndex("2026-03-30", 30)).toBe(1);
    expect(resolveDailyTipIndex("2026-04-28", 30)).toBe(0);
  });

  it("falls back to spanish tips when english catalog is missing or misaligned", () => {
    const result = resolveDailyTipFromCatalog(
      {
        es: ["Consejo ES 1", "Consejo ES 2"],
        en: ["Tip EN 1"],
      },
      "en",
      "2026-03-30",
    );

    expect(result.content).toBe("Consejo ES 2");
    expect(result.total).toBe(2);
    expect(result.index).toBe(2);
  });

  it("uses english catalog when present with matching length", () => {
    const result = resolveDailyTipFromCatalog(
      {
        es: ["Consejo ES 1", "Consejo ES 2"],
        en: ["Tip EN 1", "Tip EN 2"],
      },
      "en",
      "2026-03-29",
    );

    expect(result.title).toBe("Tip of the day");
    expect(result.content).toBe("Tip EN 1");
    expect(result.total).toBe(2);
    expect(result.index).toBe(1);
  });
});

