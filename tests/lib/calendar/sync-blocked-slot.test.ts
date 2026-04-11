import { beforeEach, describe, expect, it, vi } from "vitest";

const createBlockedSlotCalendarEventMock = vi.fn();
const updateBlockedSlotCalendarEventSummaryMock = vi.fn();
const deleteBlockedSlotCalendarEventMock = vi.fn();
const markBlockedSlotSyncedMock = vi.fn();
const markBlockedSlotSyncFailedMock = vi.fn();

class GoogleCalendarConfigError extends Error {}

vi.mock("@/lib/calendar/google", () => ({
  createBlockedSlotCalendarEvent: createBlockedSlotCalendarEventMock,
  updateBlockedSlotCalendarEventSummary: updateBlockedSlotCalendarEventSummaryMock,
  deleteBlockedSlotCalendarEvent: deleteBlockedSlotCalendarEventMock,
  GoogleCalendarConfigError,
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  markBlockedSlotSynced: markBlockedSlotSyncedMock,
  markBlockedSlotSyncFailed: markBlockedSlotSyncFailedMock,
}));

describe("syncBlockedSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates calendar event and marks blocked slot as synced", async () => {
    createBlockedSlotCalendarEventMock.mockResolvedValueOnce("blocked-event-1");

    const { syncBlockedSlotCreate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotCreate({
        blockedSlotId: 5,
        date: "2026-04-20",
        timeSlot: "10:00",
        reason: "DESCANSO",
      }),
    ).resolves.toEqual({ status: "CONFIRMED", googleEventId: "blocked-event-1" });

    expect(markBlockedSlotSyncedMock).toHaveBeenCalledWith(5, "blocked-event-1");
    expect(createBlockedSlotCalendarEventMock).toHaveBeenCalledWith({
      date: "2026-04-20",
      timeSlot: "10:00",
      reason: "DESCANSO",
      durationHours: undefined,
    });
  });

  it("marks sync failed with not configured reason", async () => {
    createBlockedSlotCalendarEventMock.mockRejectedValueOnce(
      new GoogleCalendarConfigError("CALENDAR_NOT_CONFIGURED"),
    );

    const { syncBlockedSlotCreate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotCreate({
        blockedSlotId: 6,
        date: "2026-04-20",
        timeSlot: "00:00",
        reason: "PERSONAL",
      }),
    ).resolves.toEqual({
      status: "SYNC_FAILED",
      reason: "CALENDAR_NOT_CONFIGURED",
    });

    expect(markBlockedSlotSyncFailedMock).toHaveBeenCalledWith(
      6,
      "CALENDAR_NOT_CONFIGURED",
    );
  });

  it("updates existing event summary on reason update", async () => {
    const { syncBlockedSlotUpdate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotUpdate({
        blockedSlotId: 10,
        date: "2026-04-20",
        timeSlot: "10:00",
        reason: "OTRO",
        googleEventId: "event-10",
      }),
    ).resolves.toEqual({ status: "CONFIRMED" });

    expect(updateBlockedSlotCalendarEventSummaryMock).toHaveBeenCalledWith({
      eventId: "event-10",
      summary: "No disponible - OTRO",
    });
    expect(markBlockedSlotSyncedMock).toHaveBeenCalledWith(10, "event-10");
  });

  it("deletes existing calendar event for blocked-slot delete", async () => {
    const { syncBlockedSlotDelete } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotDelete({
        googleEventId: "event-delete-1",
      }),
    ).resolves.toEqual({ status: "CONFIRMED" });

    expect(deleteBlockedSlotCalendarEventMock).toHaveBeenCalledWith("event-delete-1");
  });

  it("surfaces delete failure without blocking local delete", async () => {
    deleteBlockedSlotCalendarEventMock.mockRejectedValueOnce(new Error("boom"));

    const { syncBlockedSlotDelete } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotDelete({
        googleEventId: "event-delete-2",
      }),
    ).resolves.toEqual({
      status: "SYNC_FAILED",
      reason: "CALENDAR_DELETE_FAILED",
    });
  });
});
