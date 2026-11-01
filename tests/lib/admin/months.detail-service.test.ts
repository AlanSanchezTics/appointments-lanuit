import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";
import { findRegisteredMonth, listAppointmentsByMonth } from "@/lib/db/admin-months";
import { findMonthAvailability, type MonthAvailabilityRecord } from "@/lib/db/availability-rules";
import { listMonthBlockedSlots, type PersistedBlockedSlot } from "@/lib/db/blocked-slots";

vi.mock("@/lib/db/admin-months", () => ({
  findRegisteredMonth: vi.fn(),
  listAppointmentsByMonth: vi.fn(),
}));

vi.mock("@/lib/db/blocked-slots", () => ({
  listMonthBlockedSlots: vi.fn(),
}));

vi.mock("@/lib/db/availability-rules", () => ({
  findMonthAvailability: vi.fn(),
}));

const findRegisteredMonthMock = vi.mocked(findRegisteredMonth);
const listAppointmentsByMonthMock = vi.mocked(listAppointmentsByMonth);
const listMonthBlockedSlotsMock = vi.mocked(listMonthBlockedSlots);
const findMonthAvailabilityMock = vi.mocked(findMonthAvailability);

const BLOCK_TIMES = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"];
const SECOND_ONLY_TIMES = ["10:00", "14:00", "18:00"];

// Diciembre 2026 (SC-007): regla A días 1-13 L-V; regla B días 14-23 todos los días.
const DECEMBER_RULE_A = {
  id: 1,
  startDate: "2026-12-01",
  endDate: "2026-12-13",
  weekdays: [1, 2, 3, 4, 5],
  times: BLOCK_TIMES,
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};
const DECEMBER_RULE_B = {
  id: 2,
  startDate: "2026-12-14",
  endDate: "2026-12-23",
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  times: ["07:30", "11:00", "14:30", "18:00"],
  minGapMinutes: 0,
  preserveCapacity: false,
  maxPerDay: 4,
};

// Enero 2027 (US4, escenario 2): L-V todo el mes, sábados 16 y 23 abiertos, lunes 18 y 25 cerrados.
const JANUARY_RULE = {
  id: 3,
  startDate: "2027-01-01",
  endDate: "2027-01-31",
  weekdays: [1, 2, 3, 4, 5],
  times: BLOCK_TIMES,
  minGapMinutes: 240,
  preserveCapacity: true,
  maxPerDay: 3,
};
const JANUARY_EXCEPTIONS = [
  { id: 1, date: "2027-01-16", times: BLOCK_TIMES, minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
  { id: 2, date: "2027-01-23", times: BLOCK_TIMES, minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
  { id: 3, date: "2027-01-18", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
  { id: 4, date: "2027-01-25", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
];

function blockedSlot(id: number, date: string, timeSlot: string, reason: PersistedBlockedSlot["reason"]): PersistedBlockedSlot {
  return {
    id,
    date,
    timeSlot,
    reason,
    googleEventId: null,
    calendarSyncStatus: "CONFIRMED",
    calendarSyncReason: null,
    createdByAdminId: 10,
  };
}

function monthRecord(
  month: string,
  rules: MonthAvailabilityRecord["rules"],
  exceptions: MonthAvailabilityRecord["exceptions"] = [],
): MonthAvailabilityRecord {
  return { activeMonthId: 1, month, slotMode: "BLOCK_MODE", availabilityVersion: 1, rules, exceptions };
}

// Meses sin entrada devuelven null: el mes no está registrado y el servicio aplica D6 en el mes anterior.
function mockAvailabilityByMonth(records: MonthAvailabilityRecord[]) {
  findMonthAvailabilityMock.mockImplementation(async (month: string) =>
    records.find((record) => record.month === month) ?? null,
  );
}

function mockRegisteredMonth(month: string, slotMode: "BLOCK_MODE" | "SECOND_ONLY_MODE" = "BLOCK_MODE") {
  findRegisteredMonthMock.mockResolvedValueOnce({ month, status: "ACTIVE", slotMode });
}

describe("admin month detail service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listAppointmentsByMonthMock.mockResolvedValue([]);
    listMonthBlockedSlotsMock.mockResolvedValue([]);
    mockAvailabilityByMonth([]);
  });

  it("throws MONTH_NOT_REGISTERED when month does not exist in catalog", async () => {
    findRegisteredMonthMock.mockResolvedValueOnce(null);

    await expect(
      getAdminMonthDetail("2026-03", new Date("2026-03-21T12:00:00.000Z")),
    ).rejects.toThrow("MONTH_NOT_REGISTERED");
  });

  it("returns month metrics and calendar availability for a month without rules (D6)", async () => {
    mockRegisteredMonth("2026-03");
    mockAvailabilityByMonth([monthRecord("2026-03", [])]);
    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-02", timeSlot: "09:00", status: "CONFIRMED" },
      { date: "2026-03-02", timeSlot: "10:00", status: "CANCELLED" },
      { date: "2026-03-20", timeSlot: "09:00", status: "CONFIRMED" },
      { date: "2026-03-20", timeSlot: "13:00", status: "CONFIRMED" },
      { date: "2026-03-20", timeSlot: "17:00", status: "SYNC_FAILED" },
    ]);

    const result = await getAdminMonthDetail(
      "2026-03",
      new Date("2026-03-21T12:00:00.000Z"),
    );

    expect(result.month).toBe("2026-03");
    expect(result.monthStatus).toBe("ACTIVE");
    expect(result.slotMode).toBe("BLOCK_MODE");
    expect(result.usesDefaultRule).toBe(true);
    expect(result.rules).toEqual([]);
    expect(result.exceptions).toEqual([]);
    expect(result.availabilityVersion).toBe(1);
    expect(result.currentMonth).toBe("2026-03");
    expect(result.currentDate).toBe("2026-03-21");
    expect(result.isPastMonth).toBe(false);
    expect(result.metrics.confirmedAppointments).toBe(4);
    expect(result.metrics.cancelledAppointments).toBe(1);
    expect(result.metrics.occupiedSpaces).toBe(4);
    expect(result.metrics.blockedSpaces).toBe(0);
    // D56: hoy es 21 de marzo; los días 1-20 (anteriores a hoy) no aportan. Quedan 23-27 y 30-31 hábiles: 7 días × 3.
    expect(result.metrics.availableSpaces).toBe(21);

    const weekendDay = result.calendarDays.find((day) => day.date === "2026-03-01");
    expect(weekendDay).toEqual({
      date: "2026-03-01",
      day: 1,
      isWeekend: true,
      availableSpaces: 0,
      appointmentsCount: 0,
      tone: "closed",
    });

    const pastDay = result.calendarDays.find((day) => day.date === "2026-03-03");
    expect(pastDay).toMatchObject({ availableSpaces: 0, appointmentsCount: 0, tone: "closed" });

    const availableDay = result.calendarDays.find((day) => day.date === "2026-03-24");
    expect(availableDay?.availableSpaces).toBe(3);
    expect(availableDay?.appointmentsCount).toBe(0);
    expect(availableDay?.tone).toBe("available");

    const fullDay = result.calendarDays.find((day) => day.date === "2026-03-20");
    expect(fullDay?.availableSpaces).toBe(0);
    expect(fullDay?.appointmentsCount).toBe(3);
    expect(fullDay?.tone).toBe("closed");

    // D60: la saturación usa 62 espacios (sin quitar días pasados), no los 21 "Disponibles": 4/(4+62) = 6 %.
    expect(result.projectedSaturationPercent).toBe(6);
    expect(result.saturationComparison).toEqual({
      previousMonth: "2026-02",
      previousProjectedSaturationPercent: 0,
      deltaPercentPoints: result.projectedSaturationPercent,
    });
  });

  // D60: un mes totalmente pasado con citas no llega a 100 % porque la saturación conserva sus espacios.
  it("keeps a fully past month with appointments below 100 % saturation (D60)", async () => {
    mockRegisteredMonth("2026-03");
    mockAvailabilityByMonth([monthRecord("2026-03", [])]);
    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-02", timeSlot: "09:00", status: "CONFIRMED" },
      { date: "2026-03-03", timeSlot: "09:00", status: "CONFIRMED" },
    ]);

    const result = await getAdminMonthDetail("2026-03", new Date("2026-11-15T12:00:00.000Z"));

    expect(result.isPastMonth).toBe(true);
    expect(result.metrics.availableSpaces).toBe(0);
    // 22 días hábiles × 3 = 66, menos 2 ocupadas = 64 espacios sin quitar días pasados: 2/(2+64) = 3 %.
    expect(result.projectedSaturationPercent).toBe(3);
    expect(result.projectedSaturationPercent).toBeLessThan(100);
  });

  it("counts each manually blocked grid hour as one blocked space (D14)", async () => {
    mockRegisteredMonth("2026-03");
    mockAvailabilityByMonth([monthRecord("2026-03", [])]);
    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-02", timeSlot: "09:00", status: "CONFIRMED" },
    ]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      blockedSlot(1, "2026-03-03", "13:00", "DESCANSO"),
      blockedSlot(2, "2026-03-03", "17:00", "PERSONAL"),
    ]);

    const result = await getAdminMonthDetail(
      "2026-03",
      new Date("2026-03-01T12:00:00.000Z"),
    );

    expect(result.metrics.blockedSpaces).toBe(2);
    const day = result.calendarDays.find((entry) => entry.date === "2026-03-03");
    expect(day?.availableSpaces).toBe(3);
    expect(day?.appointmentsCount).toBe(0);
    expect(day?.tone).toBe("available");
  });

  // N-R3/F8/D41: el centinela 00:00 deja el día con 0 disponibles y cuenta una vez por hora de la rejilla.
  it("full-day block leaves the day with 0 available spaces and counts the grid (D41, N-R3)", async () => {
    mockRegisteredMonth("2026-03");
    mockAvailabilityByMonth([monthRecord("2026-03", [])]);
    listAppointmentsByMonthMock.mockResolvedValueOnce([]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      blockedSlot(1, "2026-03-03", "00:00", "DESCANSO"),
    ]);

    const result = await getAdminMonthDetail(
      "2026-03",
      new Date("2026-03-01T12:00:00.000Z"),
    );

    expect(result.metrics.blockedSpaces).toBe(6);
    // 22 días hábiles con 3 espacios, menos el día bloqueado completo.
    expect(result.metrics.availableSpaces).toBe(63);
    const day = result.calendarDays.find((entry) => entry.date === "2026-03-03");
    expect(day?.availableSpaces).toBe(0);
    expect(day?.tone).toBe("closed");
  });

  it("shows one available space in SECOND_ONLY_MODE when 18:00 is occupied and 14:00 is manually blocked", async () => {
    mockRegisteredMonth("2026-03", "SECOND_ONLY_MODE");
    mockAvailabilityByMonth([
      monthRecord("2026-03", [
        {
          id: 1,
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          weekdays: [1, 2, 3, 4, 5],
          times: SECOND_ONLY_TIMES,
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 3,
        },
      ]),
    ]);
    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-03", timeSlot: "18:00", status: "CONFIRMED" },
    ]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      blockedSlot(2, "2026-03-03", "14:00", "PERSONAL"),
    ]);

    const result = await getAdminMonthDetail(
      "2026-03",
      new Date("2026-03-01T12:00:00.000Z"),
    );

    const day = result.calendarDays.find((entry) => entry.date === "2026-03-03");
    expect(day?.availableSpaces).toBe(1);
    expect(day?.tone).toBe("low");
    expect(result.usesDefaultRule).toBe(false);
  });

  // SC-007 / US4 escenario 1: diciembre 2026 vacío = 9 días × 3 + 10 días × 4 = 67.
  it("reports 67 available spaces for empty December 2026 (SC-007)", async () => {
    mockRegisteredMonth("2026-12");
    mockAvailabilityByMonth([monthRecord("2026-12", [DECEMBER_RULE_A, DECEMBER_RULE_B])]);

    const result = await getAdminMonthDetail("2026-12", new Date("2026-11-15T12:00:00.000Z"));

    expect(result.metrics.availableSpaces).toBe(67);
    expect(result.metrics.blockedSpaces).toBe(0);
    expect(result.usesDefaultRule).toBe(false);

    const day = (date: string) => result.calendarDays.find((entry) => entry.date === date);
    expect(day("2026-12-01")).toMatchObject({ availableSpaces: 3, tone: "available" });
    expect(day("2026-12-11")).toMatchObject({ availableSpaces: 3, tone: "available" });
    expect(day("2026-12-14")).toMatchObject({ availableSpaces: 4, tone: "available" });
    expect(day("2026-12-19")).toMatchObject({ availableSpaces: 4, tone: "available" });
    for (const closedDate of ["2026-12-05", "2026-12-06", "2026-12-12", "2026-12-13", "2026-12-24", "2026-12-31"]) {
      expect(day(closedDate)).toMatchObject({ availableSpaces: 0, tone: "closed" });
    }
  });

  it("grays a day whose grid is all past hours on the current day (D34)", async () => {
    // 2026-12-14 18:30 en America/Mexico_City: la última hora de la regla B (18:00) ya pasó.
    mockRegisteredMonth("2026-12");
    mockAvailabilityByMonth([monthRecord("2026-12", [DECEMBER_RULE_A, DECEMBER_RULE_B])]);

    const result = await getAdminMonthDetail("2026-12", new Date("2026-12-15T00:30:00.000Z"));

    expect(result.currentDate).toBe("2026-12-14");
    expect(result.calendarDays.find((entry) => entry.date === "2026-12-14")).toMatchObject({
      availableSpaces: 0,
      tone: "closed",
    });
    expect(result.calendarDays.find((entry) => entry.date === "2026-12-15")).toMatchObject({
      availableSpaces: 4,
      tone: "available",
    });
  });

  it("counts a full-day block as the grid of the day in force (D41, December rule B)", async () => {
    mockRegisteredMonth("2026-12");
    mockAvailabilityByMonth([monthRecord("2026-12", [DECEMBER_RULE_A, DECEMBER_RULE_B])]);
    listMonthBlockedSlotsMock.mockResolvedValueOnce([
      blockedSlot(5, "2026-12-15", "00:00", "DESCANSO"),
    ]);

    const result = await getAdminMonthDetail("2026-12", new Date("2026-11-15T12:00:00.000Z"));

    expect(result.metrics.blockedSpaces).toBe(4);
    expect(result.metrics.availableSpaces).toBe(63);
    expect(result.calendarDays.find((entry) => entry.date === "2026-12-15")).toMatchObject({
      availableSpaces: 0,
      tone: "closed",
    });
  });

  // US4 escenario 2: enero 2027 = 21 días abiertos × 3 = 63.
  it("reports 63 available spaces for January 2027 with Saturday exceptions and closed Mondays", async () => {
    mockRegisteredMonth("2027-01");
    mockAvailabilityByMonth([monthRecord("2027-01", [JANUARY_RULE], JANUARY_EXCEPTIONS)]);

    const result = await getAdminMonthDetail("2027-01", new Date("2026-12-15T12:00:00.000Z"));

    expect(result.metrics.availableSpaces).toBe(63);
    expect(result.calendarDays.find((entry) => entry.date === "2027-01-16")).toMatchObject({
      availableSpaces: 3,
      tone: "available",
    });
    expect(result.calendarDays.find((entry) => entry.date === "2027-01-23")).toMatchObject({
      availableSpaces: 3,
      tone: "available",
    });
    expect(result.calendarDays.find((entry) => entry.date === "2027-01-18")).toMatchObject({
      availableSpaces: 0,
      tone: "closed",
    });
    expect(result.calendarDays.find((entry) => entry.date === "2027-01-02")).toMatchObject({
      availableSpaces: 0,
      tone: "closed",
    });
    expect(result.calendarDays.find((entry) => entry.date === "2027-01-04")).toMatchObject({
      availableSpaces: 3,
      tone: "available",
    });
  });

  it("compares saturation with the previous month using that month's own rules (A-06, D48)", async () => {
    mockRegisteredMonth("2027-01");
    mockAvailabilityByMonth([
      monthRecord("2027-01", [JANUARY_RULE], JANUARY_EXCEPTIONS),
      // Diciembre sin ninguna cita: sus reglas dan 67 espacios y su saturación es 0.
      monthRecord("2026-12", [DECEMBER_RULE_A, DECEMBER_RULE_B]),
    ]);
    listAppointmentsByMonthMock
      .mockResolvedValueOnce([{ date: "2027-01-04", timeSlot: "09:00", status: "CONFIRMED" }])
      .mockResolvedValueOnce([]);

    const result = await getAdminMonthDetail("2027-01", new Date("2026-12-15T12:00:00.000Z"));

    expect(result.saturationComparison).toEqual({
      previousMonth: "2026-12",
      previousProjectedSaturationPercent: 0,
      deltaPercentPoints: result.projectedSaturationPercent,
    });
    expect(result.projectedSaturationPercent).toBe(Math.round((1 / (1 + 62)) * 100));
  });

  // D56: mes actual con hoy a mitad de mes (16 de marzo 2026, lunes).
  it("grays every day before today and gives it 0 available spaces (D56)", async () => {
    mockRegisteredMonth("2026-03");
    mockAvailabilityByMonth([monthRecord("2026-03", [])]);
    listAppointmentsByMonthMock
      .mockResolvedValueOnce([{ date: "2026-03-02", timeSlot: "09:00", status: "CONFIRMED" }])
      // Febrero 2026 (sin registro, D6): una cita el 2 de febrero; sus días no se quitan por ser pasados (A-06).
      .mockResolvedValueOnce([{ date: "2026-02-02", timeSlot: "09:00", status: "CONFIRMED" }]);

    const result = await getAdminMonthDetail("2026-03", new Date("2026-03-16T12:00:00.000Z"));

    expect(result.currentDate).toBe("2026-03-16");
    expect(result.calendarDays.find((day) => day.date === "2026-03-02")).toMatchObject({
      availableSpaces: 0,
      appointmentsCount: 1,
      tone: "closed",
    });
    expect(result.calendarDays.find((day) => day.date === "2026-03-15")).toMatchObject({
      availableSpaces: 0,
      tone: "closed",
    });
    // Hoy sigue la regla D34: lunes 16 con horas futuras disponibles.
    expect(result.calendarDays.find((day) => day.date === "2026-03-16")).toMatchObject({
      availableSpaces: 3,
      tone: "available",
    });
    // Días hábiles desde hoy: 16-20 (5), 23-27 (5) y 30-31 (2) = 12 días × 3.
    expect(result.metrics.availableSpaces).toBe(36);
    // D60: la saturación usa 65 espacios sin quitar días pasados (22 días × 3 menos la cita del 2 de marzo), no los 36 de "Disponibles".
    expect(result.projectedSaturationPercent).toBe(Math.round((1 / (1 + 65)) * 100));

    // La comparación usa el mes anterior tal como es: febrero conserva sus 59 espacios (no se aplica D56).
    expect(result.saturationComparison).toEqual({
      previousMonth: "2026-02",
      previousProjectedSaturationPercent: Math.round((1 / (1 + 59)) * 100),
      deltaPercentPoints:
        Math.round((1 / 66) * 100) - Math.round((1 / 60) * 100),
    });
  });

  // D59: una cita PENDING ocupa su horario en el detalle sin contar como confirmada.
  it("counts a PENDING appointment as occupied but not as confirmed (D59)", async () => {
    mockRegisteredMonth("2026-03");
    mockAvailabilityByMonth([monthRecord("2026-03", [])]);
    listAppointmentsByMonthMock.mockResolvedValueOnce([
      { date: "2026-03-24", timeSlot: "09:00", status: "PENDING" },
    ]);

    const result = await getAdminMonthDetail("2026-03", new Date("2026-03-01T12:00:00.000Z"));

    expect(result.metrics.occupiedSpaces).toBe(1);
    expect(result.metrics.confirmedAppointments).toBe(0);
    expect(result.metrics.availableSpaces).toBe(65);
    expect(result.calendarDays.find((day) => day.date === "2026-03-24")).toMatchObject({
      availableSpaces: 2,
      appointmentsCount: 1,
      tone: "available",
    });
  });
});
