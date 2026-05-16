import { beforeEach, describe, expect, it, vi } from "vitest";

const groupByMock = vi.fn();
const findManyMock = vi.fn();
const listActiveAppointmentsByDateMock = vi.fn();
const getDailyTipSelectionMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    appointment: {
      groupBy: groupByMock,
      findMany: findManyMock,
    },
  },
}));

vi.mock("@/lib/db/admin-appointments", () => ({
  listActiveAppointmentsByDate: listActiveAppointmentsByDateMock,
}));

vi.mock("@/lib/admin/dashboard/daily-tip", () => ({
  getDailyTipSelection: getDailyTipSelectionMock,
}));

describe("admin dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    groupByMock.mockResolvedValue([
      {
        date: new Date("2026-03-30T00:00:00.000Z"),
        _count: {
          _all: 1,
        },
      },
      {
        date: new Date("2026-03-31T00:00:00.000Z"),
        _count: {
          _all: 0,
        },
      },
    ]);

    findManyMock.mockImplementation((input: {
      where?: {
        status?: { in?: string[] };
        date?: { gte?: Date; lt?: Date; gt?: Date; lte?: Date };
        clientId?: { in?: number[] };
      };
    }) => {
      const statusIn = input.where?.status?.in ?? [];
      const dateFilter = input.where?.date;
      const isPendingQuery = statusIn.length === 0 && !input.where?.clientId;
      const isReminderTomorrowQuery =
        statusIn.includes("CONFIRMED") &&
        statusIn.includes("SYNC_FAILED") &&
        dateFilter?.gte?.toISOString().slice(0, 10) === "2026-03-31";
      const isReminderNextWeekQuery =
        statusIn.includes("CONFIRMED") &&
        statusIn.includes("SYNC_FAILED") &&
        dateFilter?.gte?.toISOString().slice(0, 10) === "2026-04-06";
      const isRetouchBaseQuery =
        statusIn.includes("CONFIRMED") &&
        statusIn.includes("SYNC_FAILED") &&
        dateFilter?.gte?.toISOString().slice(0, 10) === "2026-03-09";
      const isRetouchWindowsQuery = Array.isArray(input.where?.clientId?.in);

      if (isPendingQuery) {
        return Promise.resolve([
          {
            id: 91,
            date: new Date("2026-03-31T00:00:00.000Z"),
            timeSlot: new Date("1970-01-01T09:00:00.000Z"),
            client: {
              clientNumber: 1234,
              name: "Ana Garcia",
              phone: "5512345678",
            },
          },
        ]);
      }

      if (isReminderTomorrowQuery) {
        return Promise.resolve([
          {
            id: 92,
            date: new Date("2026-03-31T00:00:00.000Z"),
            timeSlot: new Date("1970-01-01T10:00:00.000Z"),
            client: {
              clientNumber: 2233,
              name: "Brenda Ruiz",
              phone: "5511112222",
            },
          },
        ]);
      }

      if (isReminderNextWeekQuery) {
        return Promise.resolve([
          {
            id: 93,
            date: new Date("2026-04-06T00:00:00.000Z"),
            timeSlot: new Date("1970-01-01T13:00:00.000Z"),
            client: {
              clientNumber: 3344,
              name: "Carla Perez",
              phone: "5599988877",
            },
          },
        ]);
      }

      if (isRetouchBaseQuery) {
        return Promise.resolve([
          {
            clientId: 10,
            client: {
              clientNumber: 1200,
              name: "Julia Confirmed",
              phone: "5512000001",
            },
          },
          {
            clientId: 11,
            client: {
              clientNumber: 1201,
              name: "Lina No Future",
              phone: "5512000002",
            },
          },
          {
            clientId: 12,
            client: {
              clientNumber: 1202,
              name: "Mara Pending",
              phone: "5512000003",
            },
          },
          {
            clientId: 12,
            client: {
              clientNumber: 1202,
              name: "Mara Pending",
              phone: "5512000003",
            },
          },
          {
            clientId: 13,
            client: {
              clientNumber: 1203,
              name: "Nora Future Confirmed",
              phone: "5512000004",
            },
          },
        ]);
      }

      if (isRetouchWindowsQuery) {
        return Promise.resolve([
          {
            clientId: 10,
            date: new Date("2026-03-12T00:00:00.000Z"),
            status: "CONFIRMED",
          },
          {
            clientId: 12,
            date: new Date("2026-04-05T00:00:00.000Z"),
            status: "PENDING",
          },
          {
            clientId: 13,
            date: new Date("2026-04-04T00:00:00.000Z"),
            status: "CONFIRMED",
          },
        ]);
      }

      return Promise.resolve([]);
    });

    listActiveAppointmentsByDateMock.mockResolvedValue([
      {
        id: 80,
        date: "2026-03-30",
        timeSlot: "10:00",
        name: "Maria Lopez",
        phone: "5510001111",
        status: "CONFIRMED",
      },
    ]);

    getDailyTipSelectionMock.mockResolvedValue({
      title: "Tip",
      content: "Tip content",
      index: 1,
      total: 1,
    });
  });

  it("includes pending appointments in the weekly summary", async () => {
    const { getAdminDashboardWeeklyOccupancy } = await import(
      "@/lib/admin/dashboard/service"
    );

    const result = await getAdminDashboardWeeklyOccupancy(
      "es",
      new Date("2026-03-30T12:00:00.000Z"),
    );

    expect(result.pendingAppointments).toEqual([
      {
        appointmentId: 91,
        clientNumber: 1234,
        date: "2026-03-31",
        timeSlot: "09:00",
        name: "Ana Garcia",
        phone: "5512345678",
      },
    ]);
    expect(result.todayAgenda).toMatchObject([
      {
        appointmentId: 80,
        timeSlot: "10:00",
        name: "Maria Lopez",
        phone: "5510001111",
      },
    ]);
    expect(result.reminders).toEqual({
      nextDay: [
        {
          appointmentId: 92,
          clientNumber: 2233,
          date: "2026-03-31",
          timeSlot: "10:00",
          name: "Brenda Ruiz",
          phone: "5511112222",
          reminderType: "NEXT_DAY",
        },
      ],
      nextWeek: [
        {
          appointmentId: 93,
          clientNumber: 3344,
          date: "2026-04-06",
          timeSlot: "13:00",
          name: "Carla Perez",
          phone: "5599988877",
          reminderType: "NEXT_WEEK",
        },
      ],
    });
    expect(result.retouchReminders).toEqual([
      {
        clientId: 11,
        clientNumber: 1201,
        name: "Lina No Future",
        phone: "5512000002",
        lastAppointmentDate: "2026-03-09",
        candidateReason: "NO_CONFIRMED_IN_31_DAYS",
      },
      {
        clientId: 12,
        clientNumber: 1202,
        name: "Mara Pending",
        phone: "5512000003",
        lastAppointmentDate: "2026-03-09",
        candidateReason: "ONLY_NON_CONFIRMED_APPOINTMENTS",
      },
    ]);
  });
});
