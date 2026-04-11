import { GoogleCalendarConfigError } from "@/lib/calendar/google";
import {
  createBlockedSlotCalendarEvent,
  deleteBlockedSlotCalendarEvent,
  updateBlockedSlotCalendarEventSummary,
} from "@/lib/calendar/google";
import {
  markBlockedSlotSynced,
  markBlockedSlotSyncFailed,
} from "@/lib/db/blocked-slots";

export type BlockedSlotSyncReason =
  | "CALENDAR_NOT_CONFIGURED"
  | "CALENDAR_SYNC_FAILED"
  | "CALENDAR_DELETE_FAILED";

type BlockedSlotSyncResult =
  | { status: "CONFIRMED"; googleEventId?: string }
  | {
      status: "SYNC_FAILED";
      reason: BlockedSlotSyncReason;
    };

function mapSyncReason(error: unknown): Exclude<BlockedSlotSyncReason, "CALENDAR_DELETE_FAILED"> {
  return error instanceof GoogleCalendarConfigError
    ? "CALENDAR_NOT_CONFIGURED"
    : "CALENDAR_SYNC_FAILED";
}

function buildBlockedSlotSummary(input: { reason: string; timeSlot: string }) {
  return input.timeSlot === "00:00"
    ? `Día libre - ${input.reason}`
    : `No disponible - ${input.reason}`;
}

export async function syncBlockedSlotCreate(input: {
  blockedSlotId: number;
  date: string;
  timeSlot: string;
  reason: string;
  durationHours?: number;
}): Promise<BlockedSlotSyncResult> {
  try {
    const googleEventId = await createBlockedSlotCalendarEvent({
      date: input.date,
      timeSlot: input.timeSlot,
      reason: input.reason,
      durationHours: input.durationHours,
    });

    await markBlockedSlotSynced(input.blockedSlotId, googleEventId);

    return { status: "CONFIRMED", googleEventId };
  } catch (error) {
    const reason = mapSyncReason(error);

    await markBlockedSlotSyncFailed(input.blockedSlotId, reason);

    return {
      status: "SYNC_FAILED",
      reason,
    };
  }
}

export async function syncBlockedSlotUpdate(input: {
  blockedSlotId: number;
  date: string;
  timeSlot: string;
  reason: string;
  googleEventId: string | null;
}): Promise<BlockedSlotSyncResult> {
  try {
    if (input.googleEventId) {
      await updateBlockedSlotCalendarEventSummary({
        eventId: input.googleEventId,
        summary: buildBlockedSlotSummary({
          reason: input.reason,
          timeSlot: input.timeSlot,
        }),
      });

      await markBlockedSlotSynced(input.blockedSlotId, input.googleEventId);
      return { status: "CONFIRMED" };
    }

    const googleEventId = await createBlockedSlotCalendarEvent({
      date: input.date,
      timeSlot: input.timeSlot,
      reason: input.reason,
    });

    await markBlockedSlotSynced(input.blockedSlotId, googleEventId);
    return { status: "CONFIRMED" };
  } catch (error) {
    const reason = mapSyncReason(error);
    await markBlockedSlotSyncFailed(input.blockedSlotId, reason);

    return {
      status: "SYNC_FAILED",
      reason,
    };
  }
}

export async function syncBlockedSlotDelete(input: {
  googleEventId: string | null;
}): Promise<BlockedSlotSyncResult> {
  if (!input.googleEventId) {
    return { status: "CONFIRMED" };
  }

  try {
    await deleteBlockedSlotCalendarEvent(input.googleEventId);
    return { status: "CONFIRMED" };
  } catch {
    return {
      status: "SYNC_FAILED",
      reason: "CALENDAR_DELETE_FAILED",
    };
  }
}
