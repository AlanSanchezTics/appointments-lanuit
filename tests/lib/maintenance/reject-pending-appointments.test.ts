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

  it("rejects pending appointments in batches and writes system logs", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1,
          clientId: 10,
          date: new Date("2026-03-10T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T09:00:00.000Z"),
          client: {
            clientNumber: 1001,
            name: "Ana Garcia",
            alias: null,
            phone: "5512345678",
          },
        },
        {
          id: 2,
          clientId: 11,
          date: new Date("2026-03-10T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T10:00:00.000Z"),
          client: {
            clientNumber: 1002,
            name: "Ana Garcia",
            alias: null,
            phone: "5512345678",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 3,
          clientId: 12,
          date: new Date("2026-03-10T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T11:00:00.000Z"),
          client: {
            clientNumber: 1003,
            name: "Ana Garcia",
            alias: null,
            phone: "5512345678",
          },
        },
      ]);
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findMany,
          updateMany,
        },
        appointmentLog: {
          createMany,
        },
      }),
    );

    const result = await rejectPendingAppointmentsInBatches(
      {
        $transaction: transaction,
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
        clientId: true,
        date: true,
        timeSlot: true,
        client: {
          select: {
            clientNumber: true,
            name: true,
            alias: true,
            phone: true,
          },
        },
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
    expect(createMany).toHaveBeenNthCalledWith(1, {
      data: [
        expect.objectContaining({
          appointmentId: 1,
          actionType: "REJECTED",
          actorType: "SYSTEM",
          clientId: 10,
        }),
        expect.objectContaining({
          appointmentId: 2,
          actionType: "REJECTED",
          actorType: "SYSTEM",
          clientId: 11,
        }),
      ],
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
    const createMany = vi.fn();
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findMany,
          updateMany,
        },
        appointmentLog: {
          createMany,
        },
      }),
    );

    const result = await rejectPendingAppointmentsInBatches(
      {
        $transaction: transaction,
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
    expect(createMany).not.toHaveBeenCalled();
  });

  it("rejects invalid configuration", async () => {
    await expect(
      rejectPendingAppointmentsInBatches(
        {
          $transaction: vi.fn(),
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
          $transaction: vi.fn(),
        },
        {
          olderThanHours: 36,
          batchSize: 0,
        },
      ),
    ).rejects.toThrow("INVALID_BATCH_SIZE");
  });
});
