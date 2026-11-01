import { beforeEach, describe, expect, it, vi } from "vitest";

const groupByMock = vi.fn();
const findManyMock = vi.fn();
const listActiveAppointmentsByDateMock = vi.fn();
const getDailyTipSelectionMock = vi.fn();
const findMonthAvailabilityMock = vi.fn();
const listMonthBlockedSlotsMock = vi.fn();

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailability: findMonthAvailabilityMock,
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listMonthBlockedSlots: listMonthBlockedSlotsMock,
}));

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
    // Por defecto ningún mes está registrado: cada día usa D6 (L-V, 3 espacios).
    findMonthAvailabilityMock.mockResolvedValue(null);
    listMonthBlockedSlotsMock.mockResolvedValue([]);
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
  describe("capacity from resolved days (FR-011, D44, D53)", () => {
    const BLOCK_TIMES = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"];
    // Diciembre 2026 (SC-007): días 1-13 L-V con 3 espacios; días 14-23 todos los días con 4.
    const DECEMBER = {
      activeMonthId: 1,
      month: "2026-12",
      slotMode: "BLOCK_MODE",
      availabilityVersion: 1,
      rules: [
        {
          id: 1,
          startDate: "2026-12-01",
          endDate: "2026-12-13",
          weekdays: [1, 2, 3, 4, 5],
          times: BLOCK_TIMES,
          minGapMinutes: 240,
          preserveCapacity: true,
          maxPerDay: 3,
        },
        {
          id: 2,
          startDate: "2026-12-14",
          endDate: "2026-12-23",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times: ["07:30", "11:00", "14:30", "18:00"],
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 4,
        },
      ],
      exceptions: [],
    };
    const JANUARY = {
      activeMonthId: 2,
      month: "2027-01",
      slotMode: "BLOCK_MODE",
      availabilityVersion: 1,
      rules: [
        {
          id: 3,
          startDate: "2027-01-01",
          endDate: "2027-01-31",
          weekdays: [1, 2, 3, 4, 5],
          times: BLOCK_TIMES,
          minGapMinutes: 240,
          preserveCapacity: true,
          maxPerDay: 3,
        },
      ],
      exceptions: [],
    };

    function mockMonths(records: Array<typeof DECEMBER>) {
      findMonthAvailabilityMock.mockImplementation(async (month: string) =>
        records.find((record) => record.month === month) ?? null,
      );
    }

    // Orden de llamadas a groupBy: semana actual, semana previa, fecha de agenda (D61).
    function mockWeekCounts(
      current: Array<[string, number]>,
      previous: Array<[string, number]>,
      agenda: Array<[string, number]> = [],
    ) {
      const toRows = (rows: Array<[string, number]>) =>
        rows.map(([date, count]) => ({
          date: new Date(`${date}T00:00:00.000Z`),
          _count: { _all: count },
        }));

      groupByMock.mockResolvedValueOnce(toRows(current));
      groupByMock.mockResolvedValueOnce(toRows(previous));
      groupByMock.mockResolvedValueOnce(toRows(agenda));
    }

    it("sums maxPerDay of the resolved days for the week and the day (D44, D57)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");
      mockMonths([DECEMBER]);
      // D57: semana 14-20 dic de lunes a domingo; el sábado 19 y domingo 20 abren por la regla B (7 días × 4 = 28).
      // Semana previa 7-13 dic: 5 días hábiles × 3 = 15 (sábado y domingo cerrados por la regla A).
      mockWeekCounts([["2026-12-14", 2], ["2026-12-16", 4]], [["2026-12-07", 3]], [["2026-12-14", 1]]);

      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2026-12-14T12:00:00.000Z"));

      expect(result.days.map((day) => day.capacity)).toEqual([4, 4, 4, 4, 4, 4, 4]);
      expect(result.days.find((day) => day.date === "2026-12-14")?.occupancyPercent).toBe(50);
      expect(result.days.find((day) => day.date === "2026-12-16")?.occupancyPercent).toBe(100);
      // 6 de 28 esta semana = 21 %; 3 de 15 la semana previa = 20 %.
      expect(result.currentWeekOccupancyPercent).toBe(21);
      expect(result.previousWeekOccupancyPercent).toBe(20);
      expect(result.deltaPercentPoints).toBe(1);
      expect(result.dailyOccupancy).toMatchObject({
        date: "2026-12-14",
        capacity: 4,
        occupiedAppointments: 1,
        occupancyPercent: 25,
      });
    });

    it("gives a closed day capacity 0 and occupancy 0 % without dividing by zero (D44, D53)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");
      mockMonths([DECEMBER]);

      // 24 de diciembre (jueves) cae en un día cerrado y la agenda de hoy tiene 1 cita.
      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2026-12-24T12:00:00.000Z"));

      expect(result.days.map((day) => day.capacity)).toEqual([4, 4, 4, 0, 0, 0, 0]);
      expect(result.days[3]).toMatchObject({ date: "2026-12-24", capacity: 0, occupancyPercent: 0 });
      expect(result.dailyOccupancy).toMatchObject({
        date: "2026-12-24",
        capacity: 0,
        occupancyPercent: 0,
      });
    });

    it("resolves each day of a week that crosses two months with its own month (D44)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");
      mockMonths([DECEMBER, JANUARY]);

      // Semana 28 dic 2026 - 3 ene 2027: 28-31 dic cerrados por diciembre; 1 ene abierto por enero (3); 2-3 ene fin de semana cerrado.
      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2026-12-28T12:00:00.000Z"));

      expect(result.days.map((day) => day.date)).toEqual([
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
        "2027-01-03",
      ]);
      expect(result.days.map((day) => day.capacity)).toEqual([0, 0, 0, 0, 3, 0, 0]);
    });

    it("keeps 3 spaces per weekday when the month is not registered (D6)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");

      // Semana 30 mar - 5 abr 2026: ningún mes registrado, así que cada día hábil usa D6 y sábado/domingo cierran.
      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2026-03-30T12:00:00.000Z"));

      expect(result.days.map((day) => day.capacity)).toEqual([3, 3, 3, 3, 3, 0, 0]);
      expect(result.dailyOccupancy.capacity).toBe(3);
    });

    // D57: un día con bloqueo de día completo (centinela 00:00) aporta capacidad 0; el resto de la semana no cambia.
    it("gives a day with a full-day block capacity 0 (D57)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");
      mockMonths([DECEMBER]);
      mockWeekCounts([["2026-12-14", 2], ["2026-12-16", 4]], []);
      listMonthBlockedSlotsMock.mockResolvedValueOnce([
        { id: 1, date: "2026-12-16", timeSlot: "00:00", reason: "DESCANSO" },
      ]);

      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2026-12-14T12:00:00.000Z"));

      expect(result.days.map((day) => day.capacity)).toEqual([4, 4, 0, 4, 4, 4, 4]);
      expect(result.days.find((day) => day.date === "2026-12-16")).toMatchObject({
        capacity: 0,
        occupancyPercent: 0,
      });
      // Capacidad semanal 24 (28 menos el día bloqueado); 6 ocupadas = 25 %.
      expect(result.currentWeekOccupancyPercent).toBe(25);
    });

    // D58: sábado 16 ene 2027; la agenda y la capacidad diaria usan el lunes 18 (regla L-V, 3 espacios).
    it("uses the agenda date capacity when today is a Saturday (D58)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");
      mockMonths([JANUARY]);

      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2027-01-16T12:00:00.000Z"));

      expect(result.todayAgendaTargetDate).toBe("2027-01-18");
      expect(listActiveAppointmentsByDateMock).toHaveBeenCalledWith("2027-01-18");
      expect(result.dailyOccupancy.capacity).toBe(3);
    });

    // D66: la ocupación semanal y diaria cuenta CONFIRMED y SYNC_FAILED; PENDING y REJECTED no cuentan.
    it("does not count PENDING appointments in weekly and daily occupancy (D66)", async () => {
      const { getAdminDashboardWeeklyOccupancy } = await import("@/lib/admin/dashboard/service");
      mockMonths([DECEMBER]);
      const rows = [
        { date: "2026-12-14", status: "PENDING" },
        { date: "2026-12-14", status: "CONFIRMED" },
        { date: "2026-12-14", status: "REJECTED" },
        { date: "2026-12-16", status: "PENDING" },
        { date: "2026-12-07", status: "CONFIRMED" },
      ];
      // Simula groupBy: aplica el filtro de estados y el rango de fechas que recibe la consulta.
      groupByMock.mockImplementation(async ({ where }: {
        where: { status: { in: string[] }; date: { gte: Date; lt: Date } };
      }) => {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const date = new Date(`${row.date}T00:00:00.000Z`);
          if (!where.status.in.includes(row.status) || date < where.date.gte || date >= where.date.lt) {
            continue;
          }
          counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
        }
        return [...counts].map(([date, count]) => ({
          date: new Date(`${date}T00:00:00.000Z`),
          _count: { _all: count },
        }));
      });

      const result = await getAdminDashboardWeeklyOccupancy("es", new Date("2026-12-14T12:00:00.000Z"));

      expect(groupByMock.mock.calls[0][0].where.status.in).toEqual(["CONFIRMED", "SYNC_FAILED"]);
      expect(result.days.find((day) => day.date === "2026-12-14")?.occupiedSlots).toBe(1);
      expect(result.days.find((day) => day.date === "2026-12-16")?.occupiedSlots).toBe(0);
      // 1 de 28 esta semana = 4 %; 1 de 15 la semana previa = 7 %.
      expect(result.currentWeekOccupancyPercent).toBe(4);
      expect(result.previousWeekOccupancyPercent).toBe(7);
      // Diaria del 14 dic: 1 cita ocupada (CONFIRMED); la PENDING del mismo día no cuenta (D66).
      expect(result.dailyOccupancy).toMatchObject({
        date: "2026-12-14",
        occupiedAppointments: 1,
        capacity: 4,
      });
    });
  });
});
