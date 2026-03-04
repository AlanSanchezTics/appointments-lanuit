import { beforeEach, describe, expect, it, vi } from "vitest";

const bookAppointmentMock = vi.fn();

vi.mock("@/lib/appointments/book-appointment", () => ({
  bookAppointment: bookAppointmentMock,
}));

describe("POST /api/reservar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 for a successful booking", async () => {
    bookAppointmentMock.mockResolvedValueOnce({
      appointmentId: 1,
      status: "CONFIRMED",
      whatsappUrl: "https://wa.me/5215512345678?text=ok",
    });

    const { POST } = await import("@/app/api/reservar/route");
    const response = await POST(
      new Request("http://localhost/api/reservar", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      appointmentId: 1,
      status: "CONFIRMED",
      whatsappUrl: "https://wa.me/5215512345678?text=ok",
    });
  });

  it("returns 409 when the slot is no longer available", async () => {
    bookAppointmentMock.mockRejectedValueOnce(new Error("SLOT_NOT_AVAILABLE"));

    const { POST } = await import("@/app/api/reservar/route");
    const response = await POST(
      new Request("http://localhost/api/reservar", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "SLOT_NOT_AVAILABLE",
    });
  });

  it("returns 400 for validation errors", async () => {
    bookAppointmentMock.mockRejectedValueOnce(new Error("MONTH_NOT_ALLOWED"));

    const { POST } = await import("@/app/api/reservar/route");
    const response = await POST(
      new Request("http://localhost/api/reservar", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana",
          phone: "5512345678",
          date: "2026-04-04",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "MONTH_NOT_ALLOWED",
    });
  });

  it("returns 409 when the booking lock times out", async () => {
    bookAppointmentMock.mockRejectedValueOnce(new Error("LOCK_TIMEOUT"));

    const { POST } = await import("@/app/api/reservar/route");
    const response = await POST(
      new Request("http://localhost/api/reservar", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Lopez",
          phone: "5512345678",
          date: "2026-03-04",
          timeSlot: "09:00",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "LOCK_TIMEOUT",
    });
  });
});
