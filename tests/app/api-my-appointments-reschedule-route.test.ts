import { beforeEach, describe, expect, it, vi } from "vitest";

const rescheduleMyAppointmentMock = vi.fn();

vi.mock("@/lib/my-appointments/service", () => ({
  rescheduleMyAppointment: rescheduleMyAppointmentMock,
}));

describe("POST /api/my-appointments/reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 for a successful reschedule", async () => {
    rescheduleMyAppointmentMock.mockResolvedValueOnce({
      appointmentId: 12,
      status: "CONFIRMED",
      googleEventId: "event-12",
    });

    const { POST } = await import("@/app/api/my-appointments/reschedule/route");
    const response = await POST(
      new Request("http://localhost/api/my-appointments/reschedule", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentId: 12,
          month: "2026-07",
          date: "2026-07-10",
          timeSlot: "14:00",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appointmentId: 12,
      status: "CONFIRMED",
      googleEventId: "event-12",
    });
  });

  it("returns 409 when the appointment is not modifiable", async () => {
    rescheduleMyAppointmentMock.mockRejectedValueOnce(new Error("APPOINTMENT_NOT_MODIFIABLE"));

    const { POST } = await import("@/app/api/my-appointments/reschedule/route");
    const response = await POST(
      new Request("http://localhost/api/my-appointments/reschedule", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentId: 12,
          month: "2026-07",
          date: "2026-07-10",
          timeSlot: "14:00",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_NOT_MODIFIABLE",
      error: "APPOINTMENT_NOT_MODIFIABLE",
    });
  });
});
