import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmPendingAppointment,
  createAdminAppointment,
  rejectPendingAppointment,
} from "@/lib/admin/appointments/service";
import { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import { findRegisteredMonth } from "@/lib/db/admin-months";

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: vi.fn(),
}));

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(),
}));

const {
  transactionMock,
  appointmentFindUniqueMock,
  appointmentUpdateManyMock,
  appointmentLogCreateMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  appointmentFindUniqueMock: vi.fn(),
  appointmentUpdateManyMock: vi.fn(),
  appointmentLogCreateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    appointment: {
      findUnique: appointmentFindUniqueMock,
      updateMany: appointmentUpdateManyMock,
    },
    appointmentLog: {
      create: appointmentLogCreateMock,
    },
  },
}));

const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);
const syncAppointmentToCalendarMock = vi.mocked(syncAppointmentToCalendar);

describe("admin appointments service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          findUnique: appointmentFindUniqueMock,
          updateMany: appointmentUpdateManyMock,
        },
        appointmentLog: {
          create: appointmentLogCreateMock,
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
      date: new Date("2026-03-21T00:00:00.000Z"),
      timeSlot: new Date("1970-01-01T10:00:00.000Z"),
      clientId: 71,
      client: {
        id: 71,
        clientNumber: 1001,
        name: "Maria Perez",
        alias: "Mia",
        phone: "5512345678",
      },
    });
    appointmentUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    syncAppointmentToCalendarMock.mockResolvedValueOnce({
      status: "CONFIRMED",
    });

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
    expect(syncAppointmentToCalendarMock).toHaveBeenCalledWith({
      appointmentId: 15,
      name: "Maria Perez",
      date: "2026-03-21",
      timeSlot: "10:00",
    });
    expect(appointmentLogCreateMock).toHaveBeenCalledWith({
      data: {
        appointmentId: 15,
        actionType: "CONFIRMED",
        actorType: "SYSTEM",
        clientId: 71,
      },
    });
  });

  it("returns sync_failed when calendar sync fails after confirming pending appointment", async () => {
    appointmentFindUniqueMock.mockResolvedValueOnce({
      id: 16,
      status: "PENDING",
      date: new Date("2026-03-22T00:00:00.000Z"),
      timeSlot: new Date("1970-01-01T11:00:00.000Z"),
      clientId: 72,
      client: {
        id: 72,
        clientNumber: 1002,
        name: "Ana Lopez",
        alias: null,
        phone: "5511112233",
      },
    });
    appointmentUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    syncAppointmentToCalendarMock.mockResolvedValueOnce({
      status: "SYNC_FAILED",
      reason: "CALENDAR_SYNC_FAILED",
    });

    await expect(confirmPendingAppointment(16)).resolves.toEqual({
      appointmentId: 16,
      status: "SYNC_FAILED",
      syncReason: "CALENDAR_SYNC_FAILED",
    });
  });

  it("rejects a pending appointment", async () => {
    appointmentFindUniqueMock.mockResolvedValueOnce({
      id: 18,
      status: "PENDING",
      date: new Date("2026-03-23T00:00:00.000Z"),
      timeSlot: new Date("1970-01-01T12:00:00.000Z"),
      clientId: 73,
      client: {
        id: 73,
        clientNumber: 1003,
        name: "Sofia Reyes",
        alias: null,
        phone: "5512223344",
      },
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
    expect(syncAppointmentToCalendarMock).not.toHaveBeenCalled();
  });

  it("rejects invalid transitions from non-pending appointments", async () => {
    appointmentFindUniqueMock.mockResolvedValueOnce({
      id: 22,
      status: "CONFIRMED",
      date: new Date("2026-03-21T00:00:00.000Z"),
      timeSlot: new Date("1970-01-01T10:00:00.000Z"),
      clientId: 74,
      client: {
        id: 74,
        clientNumber: 1004,
        name: "Maria Perez",
        alias: null,
        phone: "5512345678",
      },
    });

    await expect(confirmPendingAppointment(22)).rejects.toThrow(
      "APPOINTMENT_STATUS_INVALID_TRANSITION",
    );
    expect(appointmentUpdateManyMock).not.toHaveBeenCalled();
  });
});
