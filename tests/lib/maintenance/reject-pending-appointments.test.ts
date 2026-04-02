import { describe, expect, it, vi } from "vitest";

import {
  getPendingAppointmentRejectionCutoff,
  rejectPendingAppointmentsInBatches,
} from "@/lib/maintenance/reject-pending-appointments";

describe("rejectPendingAppointmentsInBatches", () => {
  it("calculates the rejection cutoff from the provided hour window", () => {
    const cutoff = getPendingAppointmentRejectionCutoff(
      new Date("2026-03-14T12:00:00.000Z"),
      36,
    );

    expect(cutoff.toISOString()).toBe("2026-03-13T00:00:00.000Z");
  });

  it("rejects pending appointments in batches and stops when the last batch is partial", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }]);
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await rejectPendingAppointmentsInBatches(
      {
        appointment: {
          findMany,
          updateMany,
        },
      },
      {
        olderThanHours: 36,
        batchSize: 2,
        now: new Date("2026-03-14T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      rejected: 3,
      olderThanHours: 36,
      batchSize: 2,
    });
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: "PENDING",
        createdAt: {
          lt: new Date("2026-03-13T00:00:00.000Z"),
        },
      },
      orderBy: {
        id: "asc",
      },
      take: 2,
      select: {
        id: true,
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: {
          in: [1, 2],
        },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: {
          in: [3],
        },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });
  });

  it("returns a no-op summary when no pending appointments match the cutoff", async () => {
    const findMany = vi.fn().mockResolvedValueOnce([]);
    const updateMany = vi.fn();

    const result = await rejectPendingAppointmentsInBatches(
      {
        appointment: {
          findMany,
          updateMany,
        },
      },
      {
        olderThanHours: 36,
        batchSize: 100,
        now: new Date("2026-03-14T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      rejected: 0,
      olderThanHours: 36,
      batchSize: 100,
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid configuration", async () => {
    await expect(
      rejectPendingAppointmentsInBatches(
        {
          appointment: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
          },
        },
        {
          olderThanHours: 0,
          batchSize: 100,
        },
      ),
    ).rejects.toThrow("INVALID_OLDER_THAN_HOURS");

    await expect(
      rejectPendingAppointmentsInBatches(
        {
          appointment: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
          },
        },
        {
          olderThanHours: 36,
          batchSize: 0,
        },
      ),
    ).rejects.toThrow("INVALID_BATCH_SIZE");
  });
});
