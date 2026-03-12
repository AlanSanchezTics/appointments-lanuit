export const BASE_TIME_SLOTS = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"] as const;
export const DIRECTIONAL_SLOT_PAIRS = [
	["09:00", "10:00"],
	["13:00", "14:00"],
	["17:00", "18:00"],
] as const;
export const MAX_APPOINTMENTS_PER_DAY = 3;
export const GOOGLE_EVENT_DURATION_HOURS = 3;
export const REQUIRED_TIMEZONE = "America/Mexico_City";

export type BaseTimeSlot = (typeof BASE_TIME_SLOTS)[number];
