import {
  SLOT_MODE_PRESETS,
  type AvailabilityParams,
  type AvailabilityPresetMode,
} from "@/lib/availability/defaults";
import { daysInMonth } from "@/lib/availability/day-rule";
import type { AvailabilityRule } from "@/lib/availability/types";

type PresetCandidateRule = Omit<AvailabilityRule, "id">;

// Valores de listas en orden canónico para comparar sin depender del orden de llegada.
function sameValues(first: readonly (number | string)[], second: readonly (number | string)[]) {
  const order = (left: number | string, right: number | string) => (left < right ? -1 : left > right ? 1 : 0);

  return JSON.stringify([...first].sort(order)) === JSON.stringify([...second].sort(order));
}

function coversWholeMonth(rule: PresetCandidateRule) {
  const month = rule.startDate.slice(0, 7);

  return (
    rule.startDate === `${month}-01` &&
    rule.endDate === `${month}-${String(daysInMonth(month)).padStart(2, "0")}`
  );
}

function matchesPreset(rule: PresetCandidateRule, preset: AvailabilityParams) {
  return (
    sameValues(rule.weekdays, preset.weekdays) &&
    sameValues(rule.times, preset.times) &&
    rule.minGapMinutes === preset.minGapMinutes &&
    rule.preserveCapacity === preset.preserveCapacity &&
    rule.maxPerDay === preset.maxPerDay
  );
}

// D19/D31/FR-033: sin reglas → BLOCK_MODE; una sola regla de mes completo igual a un preset → ese preset; si no, se conserva.
// Las excepciones no entran en la comparación (default técnico A-09). Un mes sin reglas queda en BLOCK_MODE aunque tuviera otro valor.
export function deriveSlotMode(
  rules: readonly PresetCandidateRule[],
  currentSlotMode: AvailabilityPresetMode,
): AvailabilityPresetMode {
  if (rules.length === 0) {
    return "BLOCK_MODE";
  }

  if (rules.length === 1 && coversWholeMonth(rules[0])) {
    const preset = (Object.keys(SLOT_MODE_PRESETS) as AvailabilityPresetMode[]).find((mode) =>
      matchesPreset(rules[0], SLOT_MODE_PRESETS[mode]),
    );

    if (preset) {
      return preset;
    }
  }

  return currentSlotMode;
}

// D16: PATCH slot-mode reemplaza las reglas del mes por una regla de mes completo con los valores del preset.
export function buildSlotModePresetRules(
  month: string,
  mode: AvailabilityPresetMode,
): PresetCandidateRule[] {
  const preset = SLOT_MODE_PRESETS[mode];

  return [
    {
      startDate: `${month}-01`,
      endDate: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
      weekdays: [...preset.weekdays],
      times: [...preset.times],
      minGapMinutes: preset.minGapMinutes,
      preserveCapacity: preset.preserveCapacity,
      maxPerDay: preset.maxPerDay,
    },
  ];
}
