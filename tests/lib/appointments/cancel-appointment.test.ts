import { beforeEach, describe, expect, it, vi } from "vitest";

const findCancelableFutureAppointmentsByIdsForUpdateMock = vi.fn();
const deleteCalendarEventMock = vi.fn(async () => undefined);
const listBookableMonthsMock = vi.fn();
const transactionMock = vi.fn();
const appointmentUpdateMock = vi.fn(async () => undefined);
const txAppointmentUpdateManyMock = vi.fn(async () => undefined);

vi.mock("@/lib/db/appointments", () => ({
  findCancelableFutureAppointmentsByIdsForUpdate:
    findCancelableFutureAppointmentsByIdsForUpdateMock,
}));

vi.mock("@/lib/calendar/google", () => ({
  deleteCalendarEvent: deleteCalendarEventMock,
}));

vi.mock("@/lib/active-months/service", () => ({
  listBookableMonths: listBookableMonthsMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    appointment: {
      update: appointmentUpdateMock,
    },
  },
}));

describe("cancelAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBookableMonthsMock.mockResolvedValue(["2026-03"]);

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          updateMany: txAppointmentUpdateManyMock,
        },
      }),
    );
  });

  it("cancels selected confirmed appointments and clears google event ids", async () => {
    findCancelableFutureAppointmentsByIdsForUpdateMock.mockResolvedValueOnce([
      {
        id: 44,
        name: "Ana Garcia",
        phone: "5512345678",
        date: "2026-03-18",
        timeSlot: "13:00",
        status: "CONFIRMED",
        googleEventId: "google-44",
      },
      {
        id: 45,
        name: "Ana Garcia",
        phone: "5512345678",
        date: "2026-03-26",
        timeSlot: "10:00",
        status: "CONFIRMED",
        googleEventId: null,
      },
    ]);

    const { cancelAppointment } = await import("@/lib/appointments/cancel-appointment");
    const result = await cancelAppointment(
      {
        phone: "5512345678",
        appointmentIds: [44, 45],
      },
      new Date("2026-03-12T12:00:00.000Z"),
    );

    expect(findCancelableFutureAppointmentsByIdsForUpdateMock).toHaveBeenCalledWith(
      expect.any(Object),
      [44, 45],
      "5512345678",
      "2026-03-12",
      "2026-03-01",
      "2026-04-01",
    );
    expect(txAppointmentUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: {
          in: [44, 45],
        },
      },
      data: {
        status: "CANCELLED",
      },
    });
    expect(deleteCalendarEventMock).toHaveBeenCalledWith("google-44");
    expect(appointmentUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 44,
      },
      data: {
        googleEventId: null,
      },
    });
    expect(result).toEqual({
      cancelledAppointments: [
        {
          appointmentId: 44,
          status: "CANCELLED",
        },
        {
          appointmentId: 45,
          status: "CANCELLED",
        },
      ],
    });
  });

  it("throws APPOINTMENT_NOT_FOUND when any selected appointment is not cancelable", async () => {
    findCancelableFutureAppointmentsByIdsForUpdateMock.mockResolvedValueOnce([
      {
        id: 44,
        name: "Ana Garcia",
        phone: "5512345678",
        date: "2026-03-18",
        timeSlot: "13:00",
        status: "CONFIRMED",
        googleEventId: "google-44",
      },
    ]);

    const { cancelAppointment } = await import("@/lib/appointments/cancel-appointment");

    await expect(
      cancelAppointment(
        {
          phone: "5512345678",
          appointmentIds: [44, 55],
        },
        new Date("2026-03-12T12:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_NOT_FOUND");
  });

  it("throws APPOINTMENT_IS_COMING_SOON when any selected appointment is inside 24-hour window", async () => {
    findCancelableFutureAppointmentsByIdsForUpdateMock.mockResolvedValueOnce([
      {
        id: 44,
        name: "Ana Garcia",
        phone: "5512345678",
        date: "2026-03-12",
        timeSlot: "13:00",
        status: "CONFIRMED",
        googleEventId: "google-44",
      },
    ]);

    const { cancelAppointment } = await import("@/lib/appointments/cancel-appointment");

    await expect(
      cancelAppointment(
        {
          phone: "5512345678",
          appointmentIds: [44],
        },
        new Date("2026-03-12T12:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_IS_COMING_SOON");

    expect(txAppointmentUpdateManyMock).not.toHaveBeenCalled();
  });

  it("cancels sync-failed appointments too", async () => {
    findCancelableFutureAppointmentsByIdsForUpdateMock.mockResolvedValueOnce([
      {
        id: 46,
        name: "Ana Garcia",
        phone: "5512345678",
        date: "2026-03-20",
        timeSlot: "13:00",
        status: "SYNC_FAILED",
        googleEventId: null,
      },
    ]);

    const { cancelAppointment } = await import("@/lib/appointments/cancel-appointment");
    const result = await cancelAppointment(
      {
        phone: "5512345678",
        appointmentIds: [46],
      },
      new Date("2026-03-12T12:00:00.000Z"),
    );

    expect(result).toEqual({
      cancelledAppointments: [
        {
          appointmentId: 46,
          status: "CANCELLED",
        },
      ],
    });
  });
});
