import { beforeEach, describe, expect, it, vi } from "vitest";

const clientCountMock = vi.fn();
const clientFindManyMock = vi.fn();
const appointmentFindManyMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: {
      count: clientCountMock,
      findMany: clientFindManyMock,
    },
    appointment: {
      findMany: appointmentFindManyMock,
    },
  },
}));

describe("admin clients catalog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated catalog rows and metrics", async () => {
    const { getAdminClientsCatalog } = await import("@/lib/admin/clients/catalog-service");

    clientCountMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);

    clientFindManyMock.mockResolvedValueOnce([
      {
        id: 1,
        name: "Ana Garcia",
        phone: "5512345678",
        isLoyal: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        _count: {
          appointments: 3,
        },
        appointments: [{ date: new Date("2026-03-05T00:00:00.000Z") }],
      },
      {
        id: 2,
        name: "Maria Ruiz",
        phone: "5599887766",
        isLoyal: false,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-03-18T00:00:00.000Z"),
        _count: {
          appointments: 1,
        },
        appointments: [],
      },
    ]);

    appointmentFindManyMock.mockResolvedValueOnce([
      {
        clientId: 1,
        date: new Date("2026-03-25T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T10:00:00.000Z"),
      },
    ]);

    const result = await getAdminClientsCatalog(
      {
        query: "",
        status: "ALL",
        sort: "RECENT",
        page: 1,
        pageSize: 20,
      },
      new Date("2026-03-21T12:00:00.000Z"),
    );

    expect(result.metrics).toEqual({
      totalClients: 10,
      withFutureAppointments: 4,
      withoutFutureAppointments: 6,
      loyalClients: 0,
      loyalClientsPercentage: 0,
    });

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    expect(result.clients).toEqual([
      {
        clientId: 1,
        name: "Ana Garcia",
        phone: "5512345678",
        isLoyal: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        totalAppointments: 3,
        hasFutureActiveAppointments: true,
        lastAppointmentDate: "2026-03-05",
        nextAppointmentDate: "2026-03-25",
        nextAppointmentTimeSlot: "10:00",
      },
      {
        clientId: 2,
        name: "Maria Ruiz",
        phone: "5599887766",
        isLoyal: false,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
        totalAppointments: 1,
        hasFutureActiveAppointments: false,
        lastAppointmentDate: null,
        nextAppointmentDate: null,
        nextAppointmentTimeSlot: null,
      },
    ]);

    expect(clientFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
  });

  it("applies LOYAL filter in catalog query and computes loyalty metrics", async () => {
    const { getAdminClientsCatalog } = await import("@/lib/admin/clients/catalog-service");

    clientCountMock
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    clientFindManyMock.mockResolvedValueOnce([
      {
        id: 7,
        name: "Ana Garcia",
        phone: "5512345678",
        isLoyal: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        _count: {
          appointments: 3,
        },
        appointments: [],
      },
    ]);
    appointmentFindManyMock.mockResolvedValueOnce([]);

    const result = await getAdminClientsCatalog(
      {
        query: "",
        status: "LOYAL",
        sort: "RECENT",
        page: 1,
        pageSize: 20,
      },
      new Date("2026-03-21T12:00:00.000Z"),
    );

    expect(clientFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isLoyal: true,
        }),
      }),
    );

    expect(result.metrics).toEqual({
      totalClients: 4,
      withFutureAppointments: 4,
      withoutFutureAppointments: 0,
      loyalClients: 2,
      loyalClientsPercentage: 50,
    });
  });

  it("applies WITH_FUTURE_APPOINTMENTS filter in catalog query", async () => {
    const { getAdminClientsCatalog } = await import("@/lib/admin/clients/catalog-service");

    clientCountMock
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    clientFindManyMock.mockResolvedValueOnce([]);
    appointmentFindManyMock.mockResolvedValueOnce([]);

    await getAdminClientsCatalog(
      {
        query: "ana",
        status: "WITH_FUTURE_APPOINTMENTS",
        sort: "NAME_ASC",
        page: 2,
        pageSize: 10,
      },
      new Date("2026-03-21T12:00:00.000Z"),
    );

    expect(clientFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointments: {
            some: expect.any(Object),
          },
        }),
        skip: 10,
        take: 10,
        orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
      }),
    );
  });

  it("applies APPOINTMENTS_DESC order in catalog query", async () => {
    const { getAdminClientsCatalog } = await import("@/lib/admin/clients/catalog-service");

    clientCountMock
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    clientFindManyMock.mockResolvedValueOnce([]);
    appointmentFindManyMock.mockResolvedValueOnce([]);

    await getAdminClientsCatalog(
      {
        query: "",
        status: "ALL",
        sort: "APPOINTMENTS_DESC",
        page: 1,
        pageSize: 10,
      },
      new Date("2026-03-21T12:00:00.000Z"),
    );

    expect(clientFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ appointments: { _count: "desc" } }, { updatedAt: "desc" }],
      }),
    );
  });
});
