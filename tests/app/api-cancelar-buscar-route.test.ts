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
      appointmentId: 10,
      name: "Ana Garcia",
      phone: "5512345678",
      date: "2026-03-18",
      timeSlot: "13:00",
      status: "CONFIRMED",
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
      appointmentId: 10,
      name: "Ana Garcia",
      phone: "5512345678",
      date: "2026-03-18",
      timeSlot: "13:00",
      status: "CONFIRMED",
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
});
