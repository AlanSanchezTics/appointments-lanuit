import { beforeEach, describe, expect, it, vi } from "vitest";

const findConfirmedFutureAppointmentByIdForUpdateMock = vi.fn();
const deleteCalendarEventMock = vi.fn(async () => undefined);
const transactionMock = vi.fn();
const appointmentUpdateMock = vi.fn(async () => undefined);
const txAppointmentUpdateMock = vi.fn(async () => undefined);

vi.mock("@/lib/db/appointments", () => ({
  findConfirmedFutureAppointmentByIdForUpdate: findConfirmedFutureAppointmentByIdForUpdateMock,
}));

vi.mock("@/lib/calendar/google", () => ({
  deleteCalendarEvent: deleteCalendarEventMock,
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

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        appointment: {
          update: txAppointmentUpdateMock,
        },
      }),
    );
  });

  it("cancels a confirmed appointment and clears google event id", async () => {
    findConfirmedFutureAppointmentByIdForUpdateMock.mockResolvedValueOnce({
      id: 44,
      name: "Ana Garcia",
      phone: "5512345678",
      date: "2026-03-18",
      timeSlot: "13:00",
      status: "CONFIRMED",
      googleEventId: "google-44",
    });

    const { cancelAppointment } = await import("@/lib/appointments/cancel-appointment");
    const result = await cancelAppointment(
      {
        phone: "5512345678",
        appointmentId: 44,
      },
      new Date("2026-03-12T12:00:00.000Z"),
    );

    expect(findConfirmedFutureAppointmentByIdForUpdateMock).toHaveBeenCalledWith(
      expect.any(Object),
      44,
      "5512345678",
      "2026-03-12",
      "2026-03-01",
      "2026-04-01",
    );
    expect(txAppointmentUpdateMock).toHaveBeenCalledWith({
      where: {
        id: 44,
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
      appointmentId: 44,
      status: "CANCELLED",
    });
  });

  it("throws APPOINTMENT_NOT_FOUND when appointment is not cancelable", async () => {
    findConfirmedFutureAppointmentByIdForUpdateMock.mockResolvedValueOnce(null);

    const { cancelAppointment } = await import("@/lib/appointments/cancel-appointment");

    await expect(
      cancelAppointment(
        {
          phone: "5512345678",
          appointmentId: 55,
        },
        new Date("2026-03-12T12:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_NOT_FOUND");
  });
});
