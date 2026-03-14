import { describe, expect, it, vi } from "vitest";

import { cleanupExpiredReservationLocksInBatches } from "@/lib/maintenance/cleanup-reservation-locks";

describe("cleanupExpiredReservationLocksInBatches", () => {
  it("deletes expired locks in batches and keeps active ones", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);
    const deleteMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await cleanupExpiredReservationLocksInBatches(
      {
        reservationLock: {
          findMany,
          deleteMany,
        },
      },
      {
        olderThanDays: 7,
        batchSize: 2,
        now: new Date("2026-03-14T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      deleted: 3,
      olderThanDays: 7,
      batchSize: 2,
    });
    expect(deleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: {
          in: [1, 2],
        },
      },
    });
    expect(deleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: {
          in: [3],
        },
      },
    });
  });

  it("rejects invalid configuration", async () => {
    await expect(
      cleanupExpiredReservationLocksInBatches(
        {
          reservationLock: {
            findMany: vi.fn(),
            deleteMany: vi.fn(),
          },
        },
        {
          olderThanDays: 0,
          batchSize: 100,
        },
      ),
    ).rejects.toThrow("INVALID_OLDER_THAN_DAYS");

    await expect(
      cleanupExpiredReservationLocksInBatches(
        {
          reservationLock: {
            findMany: vi.fn(),
            deleteMany: vi.fn(),
          },
        },
        {
          olderThanDays: 7,
          batchSize: 0,
        },
      ),
    ).rejects.toThrow("INVALID_BATCH_SIZE");
  });
});
