import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

export const BLOCK_REASON_VALUES = ["DESCANSO", "PERSONAL", "OTRO"] as const;

export type BlockReason = (typeof BLOCK_REASON_VALUES)[number];

export type AdminBlockableDay = {
  date: string;
  slots: (typeof BASE_TIME_SLOTS)[number][];
};

export type GetAdminBlockableSlotsResponse = {
  month: string;
  currentDate: string;
  days: AdminBlockableDay[];
};

export type CreateAdminBlockedSlotsPayload = {
  month: string;
  date: string;
  slots: (typeof BASE_TIME_SLOTS)[number][];
  reason: BlockReason;
};

export type CreateAdminBlockedSlotsResponse = {
  month: string;
  date: string;
  reason: BlockReason;
  totalCreated: number;
  blockedSlots: Array<{
    date: string;
    timeSlot: (typeof BASE_TIME_SLOTS)[number];
    reason: BlockReason;
  }>;
};

export type UpdateAdminBlockedSlotPayload = {
  month: string;
  blockedSlotId: number;
  reason: BlockReason;
};

export type UpdateAdminBlockedSlotResponse = {
  month: string;
  blockedSlotId: number;
  date: string;
  timeSlot: (typeof BASE_TIME_SLOTS)[number];
  reason: BlockReason;
};

export type DeleteAdminBlockedSlotPayload = {
  month: string;
  blockedSlotId: number;
};

export type DeleteAdminBlockedSlotResponse = {
  month: string;
  blockedSlotId: number;
  status: "DELETED";
};
