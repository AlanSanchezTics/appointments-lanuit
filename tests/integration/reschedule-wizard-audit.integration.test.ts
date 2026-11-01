import type { AppointmentStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAppointmentLogs } from "@/lib/admin/appointment-logs/service";
import { parseAdminAppointmentLogsQuery } from "@/lib/admin/appointment-logs/validation";
import { saveAvailability } from "@/lib/admin/months/service";
import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";
import { checkClientAndAcquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

const { createCalendarEventMock, deleteCalendarEventMock } = vi.hoisted(() => ({
  createCalendarEventMock: vi.fn(async () => "evt-new"),
  deleteCalendarEventMock: vi.fn(async () => undefined),
}));

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: createCalendarEventMock,
  deleteCalendarEvent: deleteCalendarEventMock,
  updateCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

const NOW = new Date("2026-10-15T12:00:00.000Z");
const MONTH = "2026-11";
const PHONE = "5512345678";
const OTHER_PHONE = "5512345679";
const OLD_DATE = "2026-11-05";
const NEW_DATE = "2026-11-12";
const NEW_TIME = "13:00";

const RULE = {
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  times: ["09:00", "13:00"],
  minGapMinutes: 0,
  preserveCapacity: false,
  maxPerDay: 6,
};

async function seedClient(phone: string, clientNumber: number, name: string) {
  return prisma.client.upsert({
    where: { phone },
    update: {},
    create: { clientNumber, name, phone },
  });
}

async function seedAppointment(
  phone: string,
  clientNumber: number,
  date: string,
  timeSlot: string,
  status: AppointmentStatus,
  googleEventId: string | null = null,
) {
  const client = await seedClient(phone, clientNumber, "Ana Lopez");

  return prisma.appointment.create({
    data: {
      clientId: client.id,
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${timeSlot}:00.000Z`),
      status,
      googleEventId,
    },
  });
}

async function lockFor(phone: string, now: Date) {
  return checkClientAndAcquireReservationSlotLock(
    { name: "Ana Lopez", phone, date: NEW_DATE, timeSlot: NEW_TIME },
    now,
  );
}

async function confirmReschedule(phone: string, lockToken: string, appointmentId: number, now: Date) {
  return confirmAppointmentWithLock(
    {
      name: "Ana Lopez",
      phone,
      date: NEW_DATE,
      timeSlot: NEW_TIME,
      lockToken,
      appointmentIdToReschedule: appointmentId,
    },
    now,
  );
}

async function appointmentRow(id: number) {
  return prisma.appointment.findUniqueOrThrow({ where: { id } });
}

integrationSuite("reagendar desde el wizard: auditoría, aislamiento y reintentos (N-2, N-3) con MySQL", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetAppointmentsTable();
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    const current = await findMonthAvailability(MONTH);
    await saveAvailability(
      MONTH,
      { expectedVersion: current?.availabilityVersion ?? 0, rules: [RULE], exceptions: [], confirmAffectedAppointments: false },
      NOW,
    );
  });

  afterAll(async () => {
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("una reprogramación PENDING registra MODIFIED y la bitácora admin la lista sin error", async () => {
    const pending = await seedAppointment(PHONE, 990001, OLD_DATE, "09:00", "PENDING");
    const lock = await lockFor(PHONE, NOW);

    await confirmReschedule(PHONE, lock.lockToken, pending.id, NOW);

    const logs = await prisma.appointmentLog.findMany({ where: { appointmentId: pending.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].actionType).toBe("MODIFIED");

    const query = parseAdminAppointmentLogsQuery({});
    const response = await getAdminAppointmentLogs({ ...query, page: 1, pageSize: 50 });
    const item = response.items.find((entry) => entry.id === logs[0].id);

    expect(item).toBeDefined();
    expect(item?.actionType).toBe("MODIFIED");
    expect(item?.appointmentDateTime).toBeTruthy();
    expect(item?.previousAppointmentDateTime).toBeTruthy();
    expect(Number.isNaN(Date.parse(item!.appointmentDateTime))).toBe(false);
    expect(Number.isNaN(Date.parse(item!.previousAppointmentDateTime!))).toBe(false);
  });

  it.each([
    ["CONFIRMED", "evt-old"],
    ["SYNC_FAILED", null],
  ] as const)("una reprogramación de cita %s no escribe bitácora", async (status, googleEventId) => {
    const appointment = await seedAppointment(PHONE, 990001, OLD_DATE, "09:00", status, googleEventId);
    const lock = await lockFor(PHONE, NOW);

    await confirmReschedule(PHONE, lock.lockToken, appointment.id, NOW);

    await expect(prisma.appointmentLog.count({ where: { appointmentId: appointment.id } })).resolves.toBe(0);
  });

  it("una cita de otro teléfono no se reprograma (APPOINTMENT_NOT_FOUND) y queda intacta", async () => {
    const foreign = await seedAppointment(OTHER_PHONE, 990002, OLD_DATE, "09:00", "PENDING");
    const lock = await lockFor(PHONE, NOW);

    await expect(confirmReschedule(PHONE, lock.lockToken, foreign.id, NOW)).rejects.toThrow("APPOINTMENT_NOT_FOUND");

    const row = await appointmentRow(foreign.id);
    expect(row).toMatchObject({ status: "PENDING", googleEventId: null });
    expect(row.date.toISOString().slice(0, 10)).toBe(OLD_DATE);
    await expect(prisma.appointmentLog.count({ where: { appointmentId: foreign.id } })).resolves.toBe(0);
  });

  it("una cita pasada del mismo mes no se reprograma (APPOINTMENT_NOT_FOUND)", async () => {
    // Ahora = 10 nov: la cita del 5 nov ya pasó, pero sigue en el mes.
    const later = new Date("2026-11-10T12:00:00.000Z");
    const past = await seedAppointment(PHONE, 990001, OLD_DATE, "09:00", "PENDING");
    const lock = await lockFor(PHONE, later);

    await expect(confirmReschedule(PHONE, lock.lockToken, past.id, later)).rejects.toThrow("APPOINTMENT_NOT_FOUND");
    await expect(appointmentRow(past.id)).resolves.toMatchObject({ status: "PENDING" });
  });

  it("una cita PENDING de otro mes no se reprograma desde el mes del horario nuevo (APPOINTMENT_NOT_FOUND)", async () => {
    const december = await seedAppointment(PHONE, 990001, "2026-12-05", "09:00", "PENDING");
    const lock = await lockFor(PHONE, NOW);

    await expect(confirmReschedule(PHONE, lock.lockToken, december.id, NOW)).rejects.toThrow("APPOINTMENT_NOT_FOUND");
    await expect(appointmentRow(december.id)).resolves.toMatchObject({ status: "PENDING" });
  });

  it("un doble envío con el mismo lock responde LOCK_EXPIRED_OR_INVALID y deja una sola entrada MODIFIED", async () => {
    const pending = await seedAppointment(PHONE, 990001, OLD_DATE, "09:00", "PENDING");
    const lock = await lockFor(PHONE, NOW);

    await confirmReschedule(PHONE, lock.lockToken, pending.id, NOW);
    await expect(confirmReschedule(PHONE, lock.lockToken, pending.id, NOW)).rejects.toThrow("LOCK_EXPIRED_OR_INVALID");

    const modified = await prisma.appointmentLog.count({
      where: { appointmentId: pending.id, actionType: "MODIFIED" },
    });
    expect(modified).toBe(1);
  });
});
