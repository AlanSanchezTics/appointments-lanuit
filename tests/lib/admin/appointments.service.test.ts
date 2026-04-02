import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmPendingAppointment,
  createAdminAppointment,
  rejectPendingAppointment,
} from "@/lib/admin/appointments/service";
import { findRegisteredMonth } from "@/lib/db/admin-months";

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: vi.fn(),
}));

const {
  transactionMock,
  appointmentFindUniqueMock,
  appointmentUpdateManyMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  appointmentFindUniqueMock: vi.fn(),
  appointmentUpdateManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    appointment: {
      findUnique: appointmentFindUniqueMock,
      updateMany: appointmentUpdateManyMock,
    },
  },
}));

const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);

describe("admin appointments service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findUnique: appointmentFindUniqueMock,
          updateMany: appointmentUpdateManyMock,
        },
      }),
    );
  });

  it("rejects booking when month is not registered", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce(null);

    await expect(
      createAdminAppointment(
        {
          month: "2026-03",
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        },
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_NOT_REGISTERED");
  });

  it("rejects booking when month is inactive", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce({
      month: "2026-03",
      status: "INACTIVE",
      slotMode: "BLOCK_MODE",
    });

    await expect(
      createAdminAppointment(
        {
          month: "2026-03",
          date: "2026-03-21",
          timeSlot: "10:00",
          clientId: 1,
        },
        new Date("2026-03-10T15:00:00.000Z"),
      ),
    ).rejects.toThrow("MONTH_NOT_ACTIVE");
  });

  it("confirms a pending appointment", async () => {
    appointmentFindUniqueMock.mockResolvedValueOnce({
      id: 15,
      status: "PENDING",
    });
    appointmentUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(confirmPendingAppointment(15)).resolves.toEqual({
      appointmentId: 15,
      status: "CONFIRMED",
    });
    expect(appointmentUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: 15,
        status: "PENDING",
      },
      data: {
        status: "CONFIRMED",
      },
    });
  });

  it("rejects a pending appointment", async () => {
    appointmentFindUniqueMock.mockResolvedValueOnce({
      id: 18,
      status: "PENDING",
    });
    appointmentUpdateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(rejectPendingAppointment(18)).resolves.toEqual({
      appointmentId: 18,
      status: "REJECTED",
    });
    expect(appointmentUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: 18,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });
  });

  it("rejects invalid transitions from non-pending appointments", async () => {
    appointmentFindUniqueMock.mockResolvedValueOnce({
      id: 22,
      status: "CONFIRMED",
    });

    await expect(confirmPendingAppointment(22)).rejects.toThrow(
      "APPOINTMENT_STATUS_INVALID_TRANSITION",
    );
    expect(appointmentUpdateManyMock).not.toHaveBeenCalled();
  });
});
