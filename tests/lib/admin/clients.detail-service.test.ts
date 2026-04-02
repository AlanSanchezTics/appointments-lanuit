import { beforeEach, describe, expect, it, vi } from "vitest";

const clientFindUniqueMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
    },
  },
}));

describe("admin client detail service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws CLIENT_NOT_FOUND when client does not exist", async () => {
    const { getAdminClientDetail } = await import("@/lib/admin/clients/detail-service");
    clientFindUniqueMock.mockResolvedValueOnce(null);

    await expect(getAdminClientDetail(999)).rejects.toThrow("CLIENT_NOT_FOUND");
  });

  it("returns client summary and appointments", async () => {
    const { getAdminClientDetail } = await import("@/lib/admin/clients/detail-service");

    clientFindUniqueMock.mockResolvedValueOnce({
      id: 12,
      name: "Ana Garcia",
      phone: "5512345678",
      isLoyal: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
      appointments: [
        {
          id: 33,
          date: new Date("2026-03-29T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T14:00:00.000Z"),
          status: "CONFIRMED",
        },
        {
          id: 30,
          date: new Date("2026-03-10T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T09:00:00.000Z"),
          status: "CANCELLED",
        },
      ],
    });

    const result = await getAdminClientDetail(12, new Date("2026-03-21T12:00:00.000Z"));

    expect(result.client).toEqual({
      clientId: 12,
      name: "Ana Garcia",
      phone: "5512345678",
      isLoyal: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    });

    expect(result.summary).toEqual({
      totalAppointments: 2,
      activeAppointments: 1,
      cancelledAppointments: 1,
      futureActiveAppointments: 1,
      lastAppointmentDate: "2026-03-29",
      nextAppointmentDate: "2026-03-29",
      nextAppointmentTimeSlot: "14:00",
    });

    expect(result.appointments).toEqual([
      {
        appointmentId: 33,
        date: "2026-03-29",
        timeSlot: "14:00",
        status: "CONFIRMED",
      },
      {
        appointmentId: 30,
        date: "2026-03-10",
        timeSlot: "09:00",
        status: "CANCELLED",
      },
    ]);
  });
});
