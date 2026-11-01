import {
  SLOT_MODE_PRESETS,
  type AvailabilityPresetMode,
} from "@/lib/availability/defaults";
import { daysInMonth } from "@/lib/availability/day-rule";
import type { AvailabilityRule } from "@/lib/availability/types";

type PresetCandidateRule = Omit<AvailabilityRule, "id">;

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
