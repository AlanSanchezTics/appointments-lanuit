import { z } from "zod";

import { BLOCK_REASON_VALUES } from "@/lib/admin/blocked-spaces/types";
import { parseAdminMonthKey } from "@/lib/admin/months/validation";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(date: string) {
  if (!DATE_KEY_PATTERN.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function parseBlockableSlotsParams(input: { month: string; date?: string | null }) {
  const month = parseAdminMonthKey(input.month);

  if (input.date == null || input.date === "") {
    return {
      month,
      date: null,
    };
  }

  if (!isValidDateKey(input.date)) {
    throw new Error("DATE_INVALID_FORMAT");
  }

  if (!input.date.startsWith(`${month}-`)) {
    throw new Error("DATE_OUTSIDE_MONTH");
  }

  return {
    month,
    date: input.date,
  };
}

const CREATE_BLOCKED_SLOTS_SCHEMA = z.discriminatedUnion("fullDay", [
  z.object({
    month: z.string(),
    date: z.string(),
    fullDay: z.literal(true),
    reason: z.enum(BLOCK_REASON_VALUES),
  }),
  z.object({
    month: z.string(),
    date: z.string(),
    fullDay: z.literal(false).optional(),
    slots: z.array(z.enum(BASE_TIME_SLOTS)).min(1),
    reason: z.enum(BLOCK_REASON_VALUES),
  }),
]);

export function parseCreateBlockedSlotsPayload(payload: unknown) {
  const parsed = CREATE_BLOCKED_SLOTS_SCHEMA.parse(payload);
  const { month, date } = parseBlockableSlotsParams({
    month: parsed.month,
    date: parsed.date,
  });

  if (date === null) {
    throw new Error("DATE_INVALID_FORMAT");
  }

  if (parsed.fullDay) {
    return {
      month,
      date,
      fullDay: true as const,
      reason: parsed.reason,
    };
  }

  const uniqueSlots = Array.from(new Set(parsed.slots));

  if (uniqueSlots.length !== parsed.slots.length) {
    throw new Error("DUPLICATE_SLOTS");
  }

  return {
    month,
    date,
    fullDay: false as const,
    slots: uniqueSlots,
    reason: parsed.reason,
  };
}

const UPDATE_BLOCKED_SLOT_SCHEMA = z.object({
  month: z.string(),
  reason: z.enum(BLOCK_REASON_VALUES),
});

export function parseBlockedSlotIdParam(rawValue: string) {
  if (!/^\d+$/.test(rawValue)) {
    throw new Error("BLOCKED_SLOT_ID_INVALID");
  }

  const blockedSlotId = Number(rawValue);

  if (!Number.isSafeInteger(blockedSlotId) || blockedSlotId <= 0) {
    throw new Error("BLOCKED_SLOT_ID_INVALID");
  }

  return blockedSlotId;
}

export function parseUpdateBlockedSlotPayload(payload: unknown) {
  const parsed = UPDATE_BLOCKED_SLOT_SCHEMA.parse(payload);

  return {
    month: parseAdminMonthKey(parsed.month),
    reason: parsed.reason,
  };
}

const DELETE_BLOCKED_SLOT_SCHEMA = z.object({
  month: z.string(),
});

export function parseDeleteBlockedSlotPayload(payload: unknown) {
  const parsed = DELETE_BLOCKED_SLOT_SCHEMA.parse(payload);

  return {
    month: parseAdminMonthKey(parsed.month),
  };
}
