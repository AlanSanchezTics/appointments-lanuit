import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

export const BLOCK_REASON_VALUES = ["DESCANSO", "PERSONAL", "OTRO"] as const;

export type BlockReason = (typeof BLOCK_REASON_VALUES)[number];

export type BlockedSlotSyncWarningReason =
  | "CALENDAR_NOT_CONFIGURED"
  | "CALENDAR_SYNC_FAILED"
  | "CALENDAR_DELETE_FAILED";

export type BlockedSlotSyncWarning = {
  blockedSlotId: number | null;
  reason: BlockedSlotSyncWarningReason;
};

export type BlockedSlotSyncSummary = {
  total: number;
  synced: number;
  failed: number;
};

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
  fullDay?: false;
  reason: BlockReason;
} | {
  month: string;
  date: string;
  slots?: never;
  fullDay: true;
  reason: BlockReason;
};

export type CreateAdminBlockedSlotsResponse = {
  month: string;
  date: string;
  fullDay: boolean;
  reason: BlockReason;
  totalCreated: number;
  blockedSlots: Array<{
    date: string;
    timeSlot: (typeof BASE_TIME_SLOTS)[number];
    reason: BlockReason;
  }>;
  syncSummary: BlockedSlotSyncSummary;
  syncWarnings: BlockedSlotSyncWarning[];
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
  syncSummary: BlockedSlotSyncSummary;
  syncWarnings: BlockedSlotSyncWarning[];
};

export type DeleteAdminBlockedSlotPayload = {
  month: string;
  blockedSlotId: number;
};

export type DeleteAdminBlockedSlotResponse = {
  month: string;
  blockedSlotId: number;
  status: "DELETED";
  syncSummary: BlockedSlotSyncSummary;
  syncWarnings: BlockedSlotSyncWarning[];
};
