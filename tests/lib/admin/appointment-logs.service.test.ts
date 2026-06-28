import { beforeEach, describe, expect, it, vi } from "vitest";

const appointmentLogCreateMock = vi.fn();
const appointmentLogCountMock = vi.fn();
const appointmentLogFindManyMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointmentLog: {
      create: appointmentLogCreateMock,
      count: appointmentLogCountMock,
      findMany: appointmentLogFindManyMock,
    },
  },
}));

describe("admin appointment logs service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps action labels consistently", async () => {
    const { mapAppointmentLogLabel } = await import(
      "@/lib/admin/appointment-logs/service"
    );

    expect(mapAppointmentLogLabel("PENDING")).toBe("Cita solicitada");
    expect(mapAppointmentLogLabel("CONFIRMED")).toBe("Cita confirmada");
    expect(mapAppointmentLogLabel("CANCELLED")).toBe("Cita cancelada");
    expect(mapAppointmentLogLabel("REJECTED")).toBe("Cita rechazada");
  });

  it("creates immutable appointment log rows with Sistema fallback", async () => {
    const { createAppointmentLogEvent } = await import(
      "@/lib/admin/appointment-logs/service"
    );

    await createAppointmentLogEvent(
      {
        appointmentLog: {
          create: appointmentLogCreateMock,
        },
      } as never,
      {
        appointmentId: 10,
        actionType: "REJECTED",
        actor: {
          type: "SYSTEM",
        },
        clientId: 55,
      },
    );

    expect(appointmentLogCreateMock).toHaveBeenCalledWith({
      data: {
        appointmentId: 10,
        actionType: "REJECTED",
        actorType: "SYSTEM",
        clientId: 55,
      },
    });
  });

  it("lists filtered logs with pagination metadata", async () => {
    appointmentLogCountMock.mockResolvedValueOnce(1);
    appointmentLogFindManyMock.mockResolvedValueOnce([
      {
        id: 7,
        appointmentId: 44,
        actionType: "CONFIRMED",
        actorType: "ADMIN",
        createdAt: new Date("2026-06-27T18:30:00.000Z"),
        appointment: {
          date: new Date("2026-06-27T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T10:00:00.000Z"),
        },
        client: {
          name: "Ana Lopez",
          alias: "Mia",
          phone: "5512345678",
          clientNumber: 1200,
        },
      },
    ]);

    const { getAdminAppointmentLogs } = await import(
      "@/lib/admin/appointment-logs/service"
    );

    const response = await getAdminAppointmentLogs({
      page: 2,
      pageSize: 10,
      client: "5512",
      actionType: "CONFIRMED",
      month: "2026-06",
      actionDateFrom: "2026-06-27",
      actionDateTo: "2026-06-27",
    });

    expect(appointmentLogCountMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            client: expect.objectContaining({
              is: expect.objectContaining({
                OR: expect.arrayContaining([
                  {
                    name: {
                      contains: "5512",
                    },
                  },
                  {
                    phone: {
                      contains: "5512",
                    },
                  },
                  {
                    alias: {
                      contains: "5512",
                    },
                  },
                ]),
              }),
            }),
          }),
          expect.objectContaining({
            appointment: expect.objectContaining({
              is: expect.objectContaining({
                date: expect.objectContaining({
                  gte: new Date("2026-06-01T00:00:00.000-06:00"),
                  lt: new Date("2026-07-01T00:00:00.000-06:00"),
                }),
              }),
            }),
          }),
          {
            actionType: "CONFIRMED",
          },
        ]),
      }),
    });
    expect(appointmentLogFindManyMock).toHaveBeenCalledWith({
      where: expect.any(Object),
      skip: 10,
      take: 10,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      include: expect.objectContaining({
        appointment: expect.any(Object),
        client: expect.any(Object),
      }),
    });
    expect(response).toEqual({
      items: [
        {
          id: 7,
          appointmentNumber: 44,
          client: {
            name: "Ana Lopez",
            alias: "Mia",
            phone: "5512345678",
            clientNumber: 1200,
          },
          actionType: "CONFIRMED",
          actionLabel: "Cita confirmada",
          appointmentDateTime: "2026-06-27T10:00:00-06:00",
          actor: {
            type: "ADMIN",
            label: "Admin",
          },
          actionDateTime: "2026-06-27T12:30:00-06:00",
        },
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
      filters: {
        client: "5512",
        actionType: "CONFIRMED",
        month: "2026-06",
        actionDateFrom: "2026-06-27",
        actionDateTo: "2026-06-27",
      },
    });
  });

  it("rejects export requests over the PDF limit", async () => {
    appointmentLogCountMock.mockResolvedValueOnce(1001);

    const { getAdminAppointmentLogsForExport } = await import(
      "@/lib/admin/appointment-logs/service"
    );

    await expect(
      getAdminAppointmentLogsForExport({
        client: "",
        actionType: null,
        month: "",
        actionDateFrom: null,
        actionDateTo: null,
      }),
    ).rejects.toThrow("EXPORT_LIMIT_EXCEEDED");
  });
});
