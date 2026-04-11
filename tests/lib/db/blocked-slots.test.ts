import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    blockedSlot: {
      findMany: findManyMock,
      update: updateMock,
    },
  },
}));

describe("blocked slots db helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps persisted sync fields when listing month blocked slots", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: 4,
        date: new Date("2026-04-20T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T10:00:00.000Z"),
        reason: "DESCANSO",
        googleEventId: "event-1",
        calendarSyncStatus: "CONFIRMED",
        calendarSyncReason: null,
        createdByAdminId: 9,
      },
    ]);

    const { listMonthBlockedSlots } = await import("@/lib/db/blocked-slots");

    await expect(
      listMonthBlockedSlots("2026-04-01", "2026-05-01"),
    ).resolves.toEqual([
      {
        id: 4,
        date: "2026-04-20",
        timeSlot: "10:00",
        reason: "DESCANSO",
        googleEventId: "event-1",
        calendarSyncStatus: "CONFIRMED",
        calendarSyncReason: null,
        createdByAdminId: 9,
      },
    ]);
  });

  it("marks blocked slot as synced", async () => {
    const { markBlockedSlotSynced } = await import("@/lib/db/blocked-slots");

    await markBlockedSlotSynced(11, "google-event-11");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        googleEventId: "google-event-11",
        calendarSyncStatus: "CONFIRMED",
        calendarSyncReason: null,
      },
    });
  });

  it("marks blocked slot as sync failed", async () => {
    const { markBlockedSlotSyncFailed } = await import("@/lib/db/blocked-slots");

    await markBlockedSlotSyncFailed(15, "CALENDAR_SYNC_FAILED");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 15 },
      data: {
        calendarSyncStatus: "SYNC_FAILED",
        calendarSyncReason: "CALENDAR_SYNC_FAILED",
      },
    });
  });

  it("lists blocked slots pending retry by sync status", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: 20,
        date: new Date("2026-04-21T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T00:00:00.000Z"),
        reason: "OTRO",
        googleEventId: null,
        calendarSyncStatus: "SYNC_FAILED",
        calendarSyncReason: "CALENDAR_NOT_CONFIGURED",
        createdByAdminId: null,
      },
    ]);

    const { listBlockedSlotsWithSyncFailed } = await import("@/lib/db/blocked-slots");

    await expect(
      listBlockedSlotsWithSyncFailed({ take: 50, afterId: 10 }),
    ).resolves.toEqual([
      {
        id: 20,
        date: "2026-04-21",
        timeSlot: "00:00",
        reason: "OTRO",
        googleEventId: null,
        calendarSyncStatus: "SYNC_FAILED",
        calendarSyncReason: "CALENDAR_NOT_CONFIGURED",
        createdByAdminId: null,
      },
    ]);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        id: {
          gt: 10,
        },
        calendarSyncStatus: "SYNC_FAILED",
      },
      orderBy: {
        id: "asc",
      },
      take: 50,
    });
  });
});
