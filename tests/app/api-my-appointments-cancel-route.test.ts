import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelMyAppointmentsMock = vi.fn();

vi.mock("@/lib/my-appointments/service", () => ({
  cancelMyAppointments: cancelMyAppointmentsMock,
}));

describe("POST /api/my-appointments/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 for a successful cancellation", async () => {
    cancelMyAppointmentsMock.mockResolvedValueOnce({
      cancelledAppointments: [
        {
          appointmentId: 3,
          status: "CANCELLED",
        },
      ],
    });

    const { POST } = await import("@/app/api/my-appointments/cancel/route");
    const response = await POST(
      new Request("http://localhost/api/my-appointments/cancel", {
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

  it("returns 404 when the appointment cannot be found", async () => {
    cancelMyAppointmentsMock.mockRejectedValueOnce(new Error("APPOINTMENT_NOT_FOUND"));

    const { POST } = await import("@/app/api/my-appointments/cancel/route");
    const response = await POST(
      new Request("http://localhost/api/my-appointments/cancel", {
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
});
