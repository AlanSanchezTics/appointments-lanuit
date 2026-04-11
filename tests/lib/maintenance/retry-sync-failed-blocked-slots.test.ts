import { describe, expect, it, vi } from "vitest";

import { retrySyncFailedBlockedSlotsInBatches } from "@/lib/maintenance/retry-sync-failed-blocked-slots";

describe("retrySyncFailedBlockedSlotsInBatches", () => {
  it("retries sync-failed blocked slots in batches", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1,
          date: new Date("2026-04-20T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T10:00:00.000Z"),
          reason: "DESCANSO",
          googleEventId: null,
        },
        {
          id: 2,
          date: new Date("2026-04-21T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T14:00:00.000Z"),
          reason: "PERSONAL",
          googleEventId: "event-2",
        },
      ])
      .mockResolvedValueOnce([]);
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const createCalendarEvent = vi.fn().mockResolvedValueOnce("event-1");

    const summary = await retrySyncFailedBlockedSlotsInBatches(
      {
        blockedSlot: {
          findMany,
          updateMany,
        },
      },
      {
        batchSize: 2,
        createCalendarEvent,
      },
    );

    expect(summary).toEqual({
      scanned: 2,
      recovered: 2,
      skippedByConcurrentChange: 0,
      calendarFailures: 0,
      dryRun: false,
      batchSize: 2,
    });
    expect(createCalendarEvent).toHaveBeenCalledWith({
      date: "2026-04-20",
      timeSlot: "10:00",
      reason: "DESCANSO",
    });
  });

  it("supports dry-run mode", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1,
          date: new Date("2026-04-20T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T10:00:00.000Z"),
          reason: "DESCANSO",
          googleEventId: null,
        },
      ])
      .mockResolvedValueOnce([]);
    const updateMany = vi.fn();
    const createCalendarEvent = vi.fn();

    const summary = await retrySyncFailedBlockedSlotsInBatches(
      {
        blockedSlot: {
          findMany,
          updateMany,
        },
      },
      {
        batchSize: 100,
        dryRun: true,
        createCalendarEvent,
      },
    );

    expect(summary).toEqual({
      scanned: 1,
      recovered: 0,
      skippedByConcurrentChange: 0,
      calendarFailures: 0,
      dryRun: true,
      batchSize: 100,
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid batch size", async () => {
    await expect(
      retrySyncFailedBlockedSlotsInBatches(
        {
          blockedSlot: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
          },
        },
        {
          batchSize: 0,
          createCalendarEvent: vi.fn(),
        },
      ),
    ).rejects.toThrow("INVALID_BATCH_SIZE");
  });
});
