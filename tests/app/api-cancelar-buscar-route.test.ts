import { beforeEach, describe, expect, it, vi } from "vitest";

const findCancelableAppointmentMock = vi.fn();

vi.mock("@/lib/appointments/find-cancelable-appointment", () => ({
  findCancelableAppointment: findCancelableAppointmentMock,
}));

describe("POST /api/cancelar/buscar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with appointment details", async () => {
    findCancelableAppointmentMock.mockResolvedValueOnce({
      appointments: [
        {
          appointmentId: 10,
          name: "Ana Garcia",
          phone: "5512345678",
          date: "2026-03-18",
          timeSlot: "13:00",
          status: "CONFIRMED",
        },
        {
          appointmentId: 11,
          name: "Ana Garcia",
          phone: "5512345678",
          date: "2026-03-26",
          timeSlot: "10:00",
          status: "CONFIRMED",
        },
      ],
    });

    const { POST } = await import("@/app/api/cancelar/buscar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar/buscar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appointments: [
        {
          appointmentId: 10,
          name: "Ana Garcia",
          phone: "5512345678",
          date: "2026-03-18",
          timeSlot: "13:00",
          status: "CONFIRMED",
        },
        {
          appointmentId: 11,
          name: "Ana Garcia",
          phone: "5512345678",
          date: "2026-03-26",
          timeSlot: "10:00",
          status: "CONFIRMED",
        },
      ],
    });
  });

  it("returns 404 when there is no matching appointment", async () => {
    findCancelableAppointmentMock.mockRejectedValueOnce(new Error("APPOINTMENT_NOT_FOUND"));

    const { POST } = await import("@/app/api/cancelar/buscar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar/buscar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_NOT_FOUND",
      error: "APPOINTMENT_NOT_FOUND",
    });
  });

  it("returns error code for appointment inside 24-hour window", async () => {
    findCancelableAppointmentMock.mockRejectedValueOnce(
      new Error("APPOINTMENT_IS_COMING_SOON"),
    );

    const { POST } = await import("@/app/api/cancelar/buscar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar/buscar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_IS_COMING_SOON",
      error: "APPOINTMENT_IS_COMING_SOON",
    });
  });
});
