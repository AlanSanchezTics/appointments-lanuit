import { describe, expect, it } from "vitest";

import { resolveMonthDays } from "@/lib/availability/resolver";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";

// Presupuesto de rendimiento (plan, Performance Goals; contracts/availability-engine.md): un mes de 31 días,
// 24 horas por día y maxPerDay 6 se resuelve en menos de 200 ms en CI.
// Robustez: calentamiento antes de medir y mediana de varias ejecuciones por separación mínima, no un solo tiempo.
const BUDGET_MS = 200;
const WARMUP_RUNS = 2;
const TIMED_RUNS = 7;
const GAPS_MINUTES = [0, 60, 120, 240, 300, 360];

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

function worstCaseConfig(minGapMinutes: number): MonthAvailabilityConfig {
  return {
    month: "2026-12",
    availabilityVersion: 1,
    exceptions: [],
    rules: [
      {
        id: 1,
        startDate: "2026-12-01",
        endDate: "2026-12-31",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        times: HOURS,
        minGapMinutes,
        preserveCapacity: true,
        maxPerDay: 6,
      },
    ],
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)];
}

function measureMedianMs(config: MonthAvailabilityConfig) {
  const now = new Date("2026-10-31T12:00:00.000Z");

  for (let run = 0; run < WARMUP_RUNS; run += 1) {
    resolveMonthDays(config, { now });
  }

  const samples = Array.from({ length: TIMED_RUNS }, () => {
    const started = performance.now();
    resolveMonthDays(config, { now });

    return performance.now() - started;
  });

  return { medianMs: median(samples), samples };
}

describe("presupuesto de rendimiento del motor (plan, Performance Goals)", () => {
  it.each(GAPS_MINUTES)(
    "resolves a 31-day month with 24 hours and maxPerDay 6 within the 200 ms budget (minGapMinutes=%i)",
    (minGapMinutes) => {
      const { medianMs, samples } = measureMedianMs(worstCaseConfig(minGapMinutes));

      // Medición real visible en la salida de vitest para el informe.
      console.info(
        `[perf] minGapMinutes=${minGapMinutes} median=${medianMs.toFixed(1)}ms max=${Math.max(...samples).toFixed(1)}ms`,
      );

      expect(medianMs, `minGapMinutes=${minGapMinutes} samples=${samples.map((ms) => ms.toFixed(1)).join(",")}`).toBeLessThan(
        BUDGET_MS,
      );
    },
  );
});
