export const MONTH_SLOT_MODE_VALUES = ["BLOCK_MODE", "SECOND_ONLY_MODE"] as const;

export type MonthSlotMode = (typeof MONTH_SLOT_MODE_VALUES)[number];

// D17/D31: meses nuevos o sin reglas guardan BLOCK_MODE (columna legada hasta fase 4, FR-033).
export const DEFAULT_MONTH_SLOT_MODE: MonthSlotMode = "BLOCK_MODE";
