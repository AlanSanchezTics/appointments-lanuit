// Valores por defecto y límites del motor (D4, D6, D20, D21, D22 en America/Mexico_City).

export const AVAILABILITY_TIMEZONE = "America/Mexico_City";

// Valores válidos del selector de preset de PATCH slot-mode (RQ-1). Ya no es un campo persistido del mes.
export const SLOT_MODE_PRESET_VALUES = ["BLOCK_MODE", "SECOND_ONLY_MODE"] as const;
export type AvailabilityPresetMode = (typeof SLOT_MODE_PRESET_VALUES)[number];

export type AvailabilityParams = {
  weekdays: number[];
  times: string[];
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
};

// D4: presets de modo. El rango de fechas de un preset es el mes completo (PD-11).
export const SLOT_MODE_PRESETS: Record<AvailabilityPresetMode, AvailabilityParams> = {
  BLOCK_MODE: {
    weekdays: [1, 2, 3, 4, 5],
    times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
    minGapMinutes: 240,
    preserveCapacity: true,
    maxPerDay: 3,
  },
  SECOND_ONLY_MODE: {
    weekdays: [1, 2, 3, 4, 5],
    times: ["10:00", "14:00", "18:00"],
    minGapMinutes: 0,
    preserveCapacity: false,
    maxPerDay: 3,
  },
};

// D6: mes sin reglas. Solo lunes a viernes; el fin de semana queda cerrado (D28).
export const DEFAULT_DAY_RULE: Omit<AvailabilityParams, "weekdays"> = {
  times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};

// D55 (F4): 00:00 es el centinela de bloqueo de día completo (FULL_DAY_BLOCK_TIME_SLOT en lib/admin/blocked-spaces/day-block.ts), no una hora de reglas ni excepciones. Literal aquí para no importar lib/admin desde el motor; la prueba de rules-validation comprueba que coincide.
export const FULL_DAY_BLOCK_SENTINEL_TIME = "00:00";

// D20 y D21: límites de validación.
export const MIN_GAP_MINUTES_MIN = 0;
export const MIN_GAP_MINUTES_MAX = 1440;
export const MAX_PER_DAY_MIN = 1;
export const MAX_PER_DAY_MAX = 6;
export const MAX_TIMES_PER_DAY = 24;
