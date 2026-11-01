import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import { saveAvailability } from "@/lib/admin/months/service";
import { acquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import { getMonthAvailability } from "@/lib/availability/service";
import { daysInMonth } from "@/lib/availability/day-rule";
import { resolveDay } from "@/lib/availability/resolver";
import type { DayOccupancy, MonthAvailabilityConfig } from "@/lib/availability/types";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { listMonthActiveReservationLocks, listMonthAppointments } from "@/lib/db/appointments";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

// "now" en octubre de 2026: los meses de prueba son futuros y ninguno es hoy.
const NOW = new Date("2026-10-15T12:00:00.000Z");
const MONTH = "2026-11";
const DEC = "2026-12";
const PHONE = "5512345678";

const SIX_HOURS = ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"];

// Muestra con reglas, excepciones, citas, un bloqueo puntual, un día completo bloqueado y un lock activo.
const SAMPLE_RULES = [
  {
    startDate: "2026-11-02",
    endDate: "2026-11-14",
    weekdays: [1, 2, 3, 4, 5],
    times: SIX_HOURS,
    minGapMinutes: 240,
    preserveCapacity: true,
    maxPerDay: 3,
  },
  {
    startDate: "2026-11-16",
    endDate: "2026-11-30",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    times: ["07:30", "11:00", "14:30", "18:00"],
    minGapMinutes: 0,
    preserveCapacity: false,
    maxPerDay: 4,
  },
];

const SAMPLE_EXCEPTIONS = [
  // Cierra un martes dentro de la regla (A2).
  { date: "2026-11-03", times: [], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
  // Abre un sábado que ninguna regla cubre (US2-4).
  { date: "2026-11-07", times: ["10:00", "14:00"], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
  // Abre un domingo sin regla (D10).
  { date: "2026-11-15", times: ["09:00", "18:00"], minGapMinutes: 240, preserveCapacity: true, maxPerDay: 3 },
];

function monthDates(month: string) {
  return Array.from({ length: daysInMonth(month) }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function monthEndExclusive(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
}

function groupTimes(rows: ReadonlyArray<{ date: string; timeSlot: string }>) {
  const byDate = new Map<string, string[]>();

  for (const row of rows) {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row.timeSlot]);
  }

  return byDate;
}

// Ocupación por día leída de la base: citas activas, locks vigentes y bloqueos (el día completo va aparte).
async function readOccupancyByDate(month: string, now: Date) {
  const monthStart = `${month}-01`;
  const monthEnd = monthEndExclusive(month);
  const [appointments, locks, blocked] = await Promise.all([
    listMonthAppointments(monthStart, monthEnd),
    listMonthActiveReservationLocks(monthStart, monthEnd, now),
    listMonthBlockedSlots(monthStart, monthEnd),
  ]);
  const booked = groupTimes(appointments);
  const locked = groupTimes(locks);
  const blockedByDate = groupTimes(blocked);
  const occupancyByDate: Record<string, Partial<DayOccupancy>> = {};

  for (const date of new Set([...booked.keys(), ...locked.keys(), ...blockedByDate.keys()])) {
    const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(blockedByDate.get(date) ?? []);

    occupancyByDate[date] = {
      occupiedTimes: [...(booked.get(date) ?? []), ...(locked.get(date) ?? [])],
      blockedTimes: Array.from(blockedSlots),
      fullDayBlocked: hasFullDayBlock,
    };
  }

  return occupancyByDate;
}

async function createAppointment(clientNumber: number, phone: string, date: string, timeSlot: string) {
  const client = await prisma.client.create({
    data: { clientNumber, name: "Cliente de consistencia", phone },
  });

  await prisma.appointment.create({
    data: {
      clientId: client.id,
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${timeSlot}:00.000Z`),
    },
  });
}

// Camino del editor (PUT availability -> saveAvailability), no escritura directa a tablas.
async function saveRules(month: string, rules: typeof SAMPLE_RULES, exceptions: typeof SAMPLE_EXCEPTIONS) {
  const current = await findMonthAvailability(month);

  return saveAvailability(
    month,
    { expectedVersion: current?.availabilityVersion ?? 0, rules, exceptions, confirmAffectedAppointments: false },
    NOW,
  );
}

async function clearMonthData() {
  await prisma.blockedSlot.deleteMany({
    where: { date: { gte: new Date("2026-11-01T00:00:00.000Z"), lt: new Date("2027-01-01T00:00:00.000Z") } },
  });
}

integrationSuite("disponibilidad pública frente al motor (SC-002, D32, D42) con MySQL", () => {
  beforeEach(async () => {
    // appointment_logs no lo borra el helper; resetAppointmentsTable no borra blocked_slots.
    await prisma.appointmentLog.deleteMany();
    await clearMonthData();
    await resetAppointmentsTable();
  });

  afterAll(async () => {
    await prisma.appointmentLog.deleteMany();
    await clearMonthData();
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("matches resolveDay day by day on sample data with rules, exceptions, appointments, locks and blocks (SC-002)", async () => {
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    await saveRules(MONTH, SAMPLE_RULES, SAMPLE_EXCEPTIONS);

    await createAppointment(990101, "5500000101", "2026-11-04", "10:00");
    await createAppointment(990102, "5500000102", "2026-11-20", "11:00");
    await prisma.blockedSlot.create({
      data: {
        date: new Date("2026-11-18T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T07:30:00.000Z"),
        reason: "OTRO",
      },
    });
    await prisma.blockedSlot.create({
      data: {
        date: new Date("2026-11-25T00:00:00.000Z"),
        timeSlot: new Date("1970-01-01T00:00:00.000Z"),
        reason: "DESCANSO",
      },
    });
    await acquireReservationSlotLock({ phone: PHONE, date: "2026-11-18", timeSlot: "14:30" }, NOW);

    const record = await findMonthAvailability(MONTH);
    if (!record) {
      throw new Error("setup: el mes de muestra debe estar registrado");
    }

    const config: MonthAvailabilityConfig = {
      month: MONTH,
      availabilityVersion: record.availabilityVersion,
      rules: record.rules,
      exceptions: record.exceptions,
    };
    const occupancyByDate = await readOccupancyByDate(MONTH, NOW);
    const today = getCurrentDateKey(NOW);

    const publicDays = new Map((await getMonthAvailability(MONTH, NOW)).map((day) => [day.date, day.slots]));

    const mismatches = monthDates(MONTH).flatMap((date) => {
      const expected = date >= today ? resolveDay(config, date, { now: NOW, occupancy: occupancyByDate[date] }).slots : [];
      const actual = publicDays.get(date) ?? [];

      return JSON.stringify(expected) === JSON.stringify(actual) ? [] : [{ date, expected, actual }];
    });

    expect(mismatches).toEqual([]);

    // Valores esperados fijados a mano (US3, US2 y bloqueos), no solo la comparación con el motor.
    expect(publicDays.get("2026-11-02")).toEqual(SIX_HOURS);
    expect(publicDays.get("2026-11-04")).toEqual(["14:00", "18:00"]);
    expect(publicDays.get("2026-11-07")).toEqual(["10:00", "14:00"]);
    expect(publicDays.get("2026-11-15")).toEqual(["09:00", "18:00"]);
    expect(publicDays.get("2026-11-18")).toEqual(["11:00", "18:00"]);
    expect(publicDays.get("2026-11-20")).toEqual(["07:30", "14:30", "18:00"]);
    expect(publicDays.has("2026-11-03")).toBe(false);
    expect(publicDays.has("2026-11-25")).toBe(false);
  });

  it("reflects a rule change saved by the editor in the next public read, without publishing (D32)", async () => {
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    await saveRules(
      MONTH,
      [{ ...SAMPLE_RULES[0], endDate: "2026-11-30" }],
      [],
    );

    const before = new Map((await getMonthAvailability(MONTH, NOW)).map((day) => [day.date, day.slots]));
    const versionBefore = (await findMonthAvailability(MONTH))?.availabilityVersion ?? -1;
    expect(before.get("2026-11-02")).toEqual(SIX_HOURS);
    expect(before.has("2026-11-07")).toBe(false);

    // Un solo guardado del editor: sin llamada a publicación ni a borrador.
    await saveRules(
      MONTH,
      [
        {
          startDate: "2026-11-02",
          endDate: "2026-11-30",
          weekdays: [1, 2, 3, 4, 5],
          times: ["10:00", "14:00"],
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 3,
        },
      ],
      [
        { date: "2026-11-03", times: [], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 3 },
        { date: "2026-11-07", times: ["09:00"], minGapMinutes: 0, preserveCapacity: false, maxPerDay: 2 },
      ],
    );

    const after = new Map((await getMonthAvailability(MONTH, NOW)).map((day) => [day.date, day.slots]));
    const month = await prisma.activeMonth.findUnique({ where: { month: MONTH }, select: { status: true, availabilityVersion: true } });

    expect(after.get("2026-11-02")).toEqual(["10:00", "14:00"]);
    expect(after.get("2026-11-04")).toEqual(["10:00", "14:00"]);
    // El sábado solo abre por la excepción, y el martes cerrado desaparece de la lectura pública.
    expect(after.get("2026-11-07")).toEqual(["09:00"]);
    expect(after.has("2026-11-03")).toBe(false);
    // El estado del mes no cambia: el cambio de reglas no lo publica ni lo cierra.
    expect(month?.status).toBe("ACTIVE");
    expect(month?.availabilityVersion).toBe(versionBefore + 1);
  });

  it("closes uncovered days in the public read when the first rule of a month without rules is created (D42)", async () => {
    await prisma.activeMonth.create({ data: { month: DEC, status: "ACTIVE" } });

    // Sin reglas, el mes usa el default de lunes a viernes (D6).
    const beforeRule = new Map((await getMonthAvailability(DEC, NOW)).map((day) => [day.date, day.slots]));
    expect(beforeRule.get("2026-12-14")).toEqual(SIX_HOURS);
    expect(beforeRule.get("2026-12-31")).toEqual(SIX_HOURS);
    expect(beforeRule.has("2026-12-05")).toBe(false);

    await saveRules(
      DEC,
      [
        {
          startDate: "2026-12-01",
          endDate: "2026-12-13",
          weekdays: [1, 2, 3, 4, 5],
          times: SIX_HOURS,
          minGapMinutes: 240,
          preserveCapacity: true,
          maxPerDay: 3,
        },
      ],
      [],
    );

    const afterRule = await getMonthAvailability(DEC, NOW);

    // Solo los hábiles del 1 al 13 quedan abiertos; el 14 a 31 de diciembre quedan cerrados (D23, D28).
    expect(afterRule.map((day) => day.date)).toEqual([
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-07",
      "2026-12-08",
      "2026-12-09",
      "2026-12-10",
      "2026-12-11",
    ]);
    for (const day of afterRule) {
      expect(day.slots, day.date).toEqual(SIX_HOURS);
    }
  });
});
