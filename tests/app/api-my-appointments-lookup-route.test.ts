import { beforeEach, describe, expect, it, vi } from "vitest";

const findMyAppointmentsMock = vi.fn();

vi.mock("@/lib/my-appointments/service", () => ({
  findMyAppointments: findMyAppointmentsMock,
}));

describe("POST /api/my-appointments/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns appointment lookup data", async () => {
    findMyAppointmentsMock.mockResolvedValueOnce({
      appointments: [
        {
          appointmentId: 10,
          name: "Ana Garcia",
          phone: "5512345678",
          date: "2026-06-28",
          timeSlot: "10:00",
          status: "CONFIRMED",
          canCancel: true,
          canModify: true,
          isBlocked: false,
        },
      ],
    });

    const { POST } = await import("@/app/api/my-appointments/lookup/route");
    const response = await POST(
      new Request("http://localhost/api/my-appointments/lookup", {
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
          date: "2026-06-28",
          timeSlot: "10:00",
          status: "CONFIRMED",
          canCancel: true,
          canModify: true,
          isBlocked: false,
        },
      ],
    });
  });

  it("returns 404 when no future appointments exist", async () => {
    findMyAppointmentsMock.mockRejectedValueOnce(new Error("APPOINTMENT_NOT_FOUND"));

    const { POST } = await import("@/app/api/my-appointments/lookup/route");
    const response = await POST(
      new Request("http://localhost/api/my-appointments/lookup", {
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
});
