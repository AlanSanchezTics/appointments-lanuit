import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelAppointmentMock = vi.fn();

vi.mock("@/lib/appointments/cancel-appointment", () => ({
  cancelAppointment: cancelAppointmentMock,
}));

describe("POST /api/cancelar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 for a successful cancellation", async () => {
    cancelAppointmentMock.mockResolvedValueOnce({
      cancelledAppointments: [
        {
          appointmentId: 3,
          status: "CANCELLED",
        },
      ],
    });

    const { POST } = await import("@/app/api/cancelar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentIds: [3],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cancelledAppointments: [
        {
          appointmentId: 3,
          status: "CANCELLED",
        },
      ],
    });
  });

  it("returns 200 and surfaces sync warnings when Google deletion fails", async () => {
    cancelAppointmentMock.mockResolvedValueOnce({
      cancelledAppointments: [
        {
          appointmentId: 3,
          status: "CANCELLED",
          syncReason: "CALENDAR_DELETE_FAILED",
        },
      ],
    });

    const { POST } = await import("@/app/api/cancelar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentIds: [3],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cancelledAppointments: [
        {
          appointmentId: 3,
          status: "CANCELLED",
          syncReason: "CALENDAR_DELETE_FAILED",
        },
      ],
    });
  });

  it("returns 404 when there is no active appointment", async () => {
    cancelAppointmentMock.mockRejectedValueOnce(new Error("APPOINTMENT_NOT_FOUND"));

    const { POST } = await import("@/app/api/cancelar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentIds: [3],
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errorCode: "APPOINTMENT_NOT_FOUND",
      error: "APPOINTMENT_NOT_FOUND",
    });
  });

  it("returns 400 for malformed cancellation payloads", async () => {
    cancelAppointmentMock.mockRejectedValueOnce(new Error("INVALID_PAYLOAD"));

    const { POST } = await import("@/app/api/cancelar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentIds: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errorCode: "INVALID_PAYLOAD",
      error: "INVALID_PAYLOAD",
    });
  });

  it("returns error code for appointment inside 24-hour window", async () => {
    cancelAppointmentMock.mockRejectedValueOnce(new Error("APPOINTMENT_IS_COMING_SOON"));

    const { POST } = await import("@/app/api/cancelar/route");
    const response = await POST(
      new Request("http://localhost/api/cancelar", {
        method: "POST",
        body: JSON.stringify({
          phone: "5512345678",
          appointmentIds: [3],
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
