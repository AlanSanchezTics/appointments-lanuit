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

    findManyMock
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: 92,
          date: new Date("2026-03-31T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T10:00:00.000Z"),
          appointmentReminders: [],
          client: {
            clientNumber: 2233,
            name: "Brenda Ruiz",
            phone: "5511112222",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 93,
          date: new Date("2026-04-06T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T13:00:00.000Z"),
          appointmentReminders: [{ id: 1001 }],
          client: {
            clientNumber: 3344,
            name: "Carla Perez",
            phone: "5599988877",
          },
        },
      ]);

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
          reminderSent: false,
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
          reminderSent: true,
        },
      ],
    });
  });
});
