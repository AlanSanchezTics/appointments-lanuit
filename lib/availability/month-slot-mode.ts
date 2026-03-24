import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

export const MONTH_SLOT_MODE_VALUES = ["BLOCK_MODE", "SECOND_ONLY_MODE"] as const;

export type MonthSlotMode = (typeof MONTH_SLOT_MODE_VALUES)[number];

export const DEFAULT_MONTH_SLOT_MODE: MonthSlotMode = "BLOCK_MODE";

const SECOND_ONLY_BASE_TIME_SLOTS = ["10:00", "14:00", "18:00"] as const;

export function resolveBaseSlotsByMonthMode(mode?: MonthSlotMode | null) {
  if (mode === "SECOND_ONLY_MODE") {
    return SECOND_ONLY_BASE_TIME_SLOTS;
  }

  return BASE_TIME_SLOTS;
}

