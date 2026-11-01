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

  // D15/D30 (T034): horario puntual nuevo = evento de 1 h; día completo = 06:00-23:00 (lo fija google.ts, ver tests/lib/calendar/google.test.ts).
  it("creates a one-hour event for a new punctual block without googleEventId (D15)", async () => {
    createBlockedSlotCalendarEventMock.mockResolvedValueOnce("event-new-punctual");

    const { syncBlockedSlotUpdate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotUpdate({
        blockedSlotId: 20,
        date: "2026-04-20",
        timeSlot: "10:00",
        reason: "DESCANSO",
        googleEventId: null,
      }),
    ).resolves.toEqual({ status: "CONFIRMED" });

    expect(createBlockedSlotCalendarEventMock).toHaveBeenCalledWith({
      date: "2026-04-20",
      timeSlot: "10:00",
      reason: "DESCANSO",
      durationHours: 1,
    });
    expect(markBlockedSlotSyncedMock).toHaveBeenCalledWith(20, "event-new-punctual");
    expect(updateBlockedSlotCalendarEventSummaryMock).not.toHaveBeenCalled();
  });

  it("creates the full-day event with the same call when there is no googleEventId (06:00-23:00 fixed by google.ts)", async () => {
    createBlockedSlotCalendarEventMock.mockResolvedValueOnce("event-new-day");

    const { syncBlockedSlotUpdate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotUpdate({
        blockedSlotId: 21,
        date: "2026-04-21",
        timeSlot: "00:00",
        reason: "PERSONAL",
        googleEventId: null,
      }),
    ).resolves.toEqual({ status: "CONFIRMED" });

    expect(createBlockedSlotCalendarEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ timeSlot: "00:00", durationHours: 1 }),
    );
    expect(markBlockedSlotSyncedMock).toHaveBeenCalledWith(21, "event-new-day");
  });

  it("changes only the summary of an existing full-day event and never creates a new one (D30)", async () => {
    const { syncBlockedSlotUpdate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotUpdate({
        blockedSlotId: 22,
        date: "2026-04-21",
        timeSlot: "00:00",
        reason: "VACACIONES",
        googleEventId: "event-day-22",
      }),
    ).resolves.toEqual({ status: "CONFIRMED" });

    expect(updateBlockedSlotCalendarEventSummaryMock).toHaveBeenCalledWith({
      eventId: "event-day-22",
      summary: "Día libre - VACACIONES",
    });
    expect(createBlockedSlotCalendarEventMock).not.toHaveBeenCalled();
    expect(markBlockedSlotSyncedMock).toHaveBeenCalledWith(22, "event-day-22");
  });

  it("marks sync failed when creating the one-hour event fails", async () => {
    createBlockedSlotCalendarEventMock.mockRejectedValueOnce(new Error("network"));

    const { syncBlockedSlotUpdate } = await import("@/lib/calendar/sync-blocked-slot");

    await expect(
      syncBlockedSlotUpdate({
        blockedSlotId: 23,
        date: "2026-04-20",
        timeSlot: "10:00",
        reason: "DESCANSO",
        googleEventId: null,
      }),
    ).resolves.toEqual({ status: "SYNC_FAILED", reason: "CALENDAR_SYNC_FAILED" });

    expect(markBlockedSlotSyncFailedMock).toHaveBeenCalledWith(23, "CALENDAR_SYNC_FAILED");
    expect(markBlockedSlotSyncedMock).not.toHaveBeenCalled();
  });
});
