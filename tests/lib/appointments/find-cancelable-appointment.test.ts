import { beforeEach, describe, expect, it, vi } from "vitest";

const findConfirmedFutureAppointmentByPhoneInMonthMock = vi.fn();
const listBookableMonthsMock = vi.fn();

vi.mock("@/lib/db/appointments", () => ({
  findConfirmedFutureAppointmentByPhoneInMonth: findConfirmedFutureAppointmentByPhoneInMonthMock,
}));

vi.mock("@/lib/active-months/service", () => ({
  listBookableMonths: listBookableMonthsMock,
}));

describe("findCancelableAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the next confirmed appointment in active month", async () => {
    listBookableMonthsMock.mockResolvedValueOnce(["2026-03"]);
    findConfirmedFutureAppointmentByPhoneInMonthMock.mockResolvedValueOnce({
      id: 12,
      name: "Ana Garcia",
      phone: "5512345678",
      date: "2026-03-18",
      timeSlot: "13:00",
      status: "CONFIRMED",
      googleEventId: "google-id",
    });

    const { findCancelableAppointment } = await import("@/lib/appointments/find-cancelable-appointment");
    const result = await findCancelableAppointment(
      {
        phone: "5512345678",
      },
      new Date("2026-03-12T12:00:00.000Z"),
    );

    expect(findConfirmedFutureAppointmentByPhoneInMonthMock).toHaveBeenCalledWith(
      "5512345678",
      "2026-03-12",
      "2026-03-01",
      "2026-04-01",
    );
    expect(result).toEqual({
      appointmentId: 12,
      name: "Ana Garcia",
      phone: "5512345678",
      date: "2026-03-18",
      timeSlot: "13:00",
      status: "CONFIRMED",
    });
  });

  it("throws APPOINTMENT_NOT_FOUND when there is no confirmed appointment", async () => {
    listBookableMonthsMock.mockResolvedValueOnce(["2026-03"]);
    findConfirmedFutureAppointmentByPhoneInMonthMock.mockResolvedValueOnce(null);

    const { findCancelableAppointment } = await import("@/lib/appointments/find-cancelable-appointment");

    await expect(
      findCancelableAppointment(
        {
          phone: "5512345678",
        },
        new Date("2026-03-12T12:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_NOT_FOUND");
  });

  it("throws APPOINTMENT_IS_COMING_SOON when appointment is inside 24-hour window", async () => {
    listBookableMonthsMock.mockResolvedValueOnce(["2026-03"]);
    findConfirmedFutureAppointmentByPhoneInMonthMock.mockResolvedValueOnce({
      id: 12,
      name: "Ana Garcia",
      phone: "5512345678",
      date: "2026-03-12",
      timeSlot: "13:00",
      status: "CONFIRMED",
      googleEventId: "google-id",
    });

    const { findCancelableAppointment } = await import("@/lib/appointments/find-cancelable-appointment");

    await expect(
      findCancelableAppointment(
        {
          phone: "5512345678",
        },
        new Date("2026-03-12T12:00:00.000Z"),
      ),
    ).rejects.toThrow("APPOINTMENT_IS_COMING_SOON");
  });
});
