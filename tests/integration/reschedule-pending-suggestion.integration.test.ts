import type { AppointmentStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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

// Ahora fijo en octubre de 2026; citas de noviembre (mismo mes, futuras).
const NOW = new Date("2026-10-15T12:00:00.000Z");
const MONTH = "2026-11";
const PHONE = "5512345678";
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

async function seedAppointment(status: AppointmentStatus, googleEventId: string | null = null) {
  const client = await prisma.client.upsert({
    where: { phone: PHONE },
    update: {},
    create: { clientNumber: 990001, name: "Ana Lopez", phone: PHONE },
  });

  return prisma.appointment.create({
    data: {
      clientId: client.id,
      date: new Date(`${OLD_DATE}T00:00:00.000Z`),
      timeSlot: new Date("1970-01-01T09:00:00.000Z"),
      status,
      googleEventId,
    },
  });
}

// Flujo de sugerencia: bloqueo del horario nuevo y confirmación con appointmentIdToReschedule.
async function rescheduleFromSuggestion(appointmentId: number) {
  const lock = await checkClientAndAcquireReservationSlotLock(
    { name: "Ana Lopez", phone: PHONE, date: NEW_DATE, timeSlot: NEW_TIME },
    NOW,
  );

  return confirmAppointmentWithLock(
    {
      name: "Ana Lopez",
      phone: PHONE,
      date: NEW_DATE,
      timeSlot: NEW_TIME,
      lockToken: lock.lockToken,
      appointmentIdToReschedule: appointmentId,
    },
    NOW,
  );
}

async function readAppointment(id: number) {
  const row = await prisma.appointment.findUniqueOrThrow({ where: { id } });

  return {
    status: row.status,
    googleEventId: row.googleEventId,
    date: row.date.toISOString().slice(0, 10),
    timeSlot: row.timeSlot.toISOString().slice(11, 16),
  };
}

integrationSuite("reprogramación desde la sugerencia del umbral (D95) con MySQL", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.blockedSlot.deleteMany({
      where: { date: { gte: new Date("2026-11-01T00:00:00.000Z"), lt: new Date("2026-12-01T00:00:00.000Z") } },
    });
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
    await prisma.blockedSlot.deleteMany({
      where: { date: { gte: new Date("2026-11-01T00:00:00.000Z"), lt: new Date("2026-12-01T00:00:00.000Z") } },
    });
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("reprograma una cita PENDING desde la sugerencia: sigue PENDING, sin calendario, con bitácora MODIFIED", async () => {
    const pending = await seedAppointment("PENDING");

    const result = await rescheduleFromSuggestion(pending.id);

    expect(result).toMatchObject({ appointmentId: pending.id, status: "PENDING" });
    await expect(readAppointment(pending.id)).resolves.toEqual({
      status: "PENDING",
      googleEventId: null,
      date: NEW_DATE,
      timeSlot: NEW_TIME,
    });
    expect(createCalendarEventMock).not.toHaveBeenCalled();
    expect(deleteCalendarEventMock).not.toHaveBeenCalled();
    // El horario anterior queda libre y el lock se consume.
    await expect(prisma.appointment.count({ where: { date: new Date(`${OLD_DATE}T00:00:00.000Z`) } })).resolves.toBe(0);
    await expect(prisma.reservationLock.count()).resolves.toBe(0);
    const logs = await prisma.appointmentLog.findMany({ where: { appointmentId: pending.id } });
    expect(logs.map((log) => log.actionType)).toEqual(["MODIFIED"]);
    expect(logs[0].payload).toEqual({
      appointment: { date: NEW_DATE, timeSlot: NEW_TIME },
      previous: { date: OLD_DATE, timeSlot: "09:00" },
      next: { date: NEW_DATE, timeSlot: NEW_TIME },
    });
  });

  it.each(["CANCELLED", "REJECTED"] as const)("rechaza reprogramar una cita %s (APPOINTMENT_NOT_FOUND)", async (status) => {
    const appointment = await seedAppointment(status);

    await expect(rescheduleFromSuggestion(appointment.id)).rejects.toThrow("APPOINTMENT_NOT_FOUND");
    await expect(readAppointment(appointment.id)).resolves.toMatchObject({ status, date: OLD_DATE, timeSlot: "09:00" });
    expect(createCalendarEventMock).not.toHaveBeenCalled();
  });

  it("reprograma una cita CONFIRMED como antes: borra el evento anterior y crea uno nuevo", async () => {
    const confirmed = await seedAppointment("CONFIRMED", "evt-old");

    const result = await rescheduleFromSuggestion(confirmed.id);

    expect(result).toMatchObject({ appointmentId: confirmed.id, status: "CONFIRMED" });
    expect(deleteCalendarEventMock).toHaveBeenCalledWith("evt-old");
    expect(createCalendarEventMock).toHaveBeenCalledTimes(1);
    await expect(readAppointment(confirmed.id)).resolves.toEqual({
      status: "CONFIRMED",
      googleEventId: "evt-new",
      date: NEW_DATE,
      timeSlot: NEW_TIME,
    });
  });

  it("reprograma una cita SYNC_FAILED como antes: queda CONFIRMED si el calendario responde", async () => {
    const syncFailed = await seedAppointment("SYNC_FAILED");

    await expect(rescheduleFromSuggestion(syncFailed.id)).resolves.toMatchObject({
      appointmentId: syncFailed.id,
      status: "CONFIRMED",
    });
    await expect(readAppointment(syncFailed.id)).resolves.toMatchObject({ status: "CONFIRMED", googleEventId: "evt-new" });
  });

  it("una cita PENDING no se reprograma si el horario nuevo queda bloqueado (SLOT_NOT_AVAILABLE)", async () => {
    const pending = await seedAppointment("PENDING");
    const lock = await checkClientAndAcquireReservationSlotLock(
      { name: "Ana Lopez", phone: PHONE, date: NEW_DATE, timeSlot: NEW_TIME },
      NOW,
    );
    // Bloqueo manual creado después del lock: la confirmación revalida el horario.
    await prisma.blockedSlot.create({
      data: {
        date: new Date(`${NEW_DATE}T00:00:00.000Z`),
        timeSlot: new Date(`1970-01-01T${NEW_TIME}:00.000Z`),
        reason: "OTRO",
      },
    });

    await expect(
      confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: PHONE,
          date: NEW_DATE,
          timeSlot: NEW_TIME,
          lockToken: lock.lockToken,
          appointmentIdToReschedule: pending.id,
        },
        NOW,
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");
    await expect(readAppointment(pending.id)).resolves.toEqual({
      status: "PENDING",
      googleEventId: null,
      date: OLD_DATE,
      timeSlot: "09:00",
    });
    expect(createCalendarEventMock).not.toHaveBeenCalled();
  });

  it("una cita PENDING no se reprograma con un lock inválido (LOCK_EXPIRED_OR_INVALID)", async () => {
    const pending = await seedAppointment("PENDING");

    await expect(
      confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: PHONE,
          date: NEW_DATE,
          timeSlot: NEW_TIME,
          lockToken: "lock-inexistente",
          appointmentIdToReschedule: pending.id,
        },
        NOW,
      ),
    ).rejects.toThrow("LOCK_EXPIRED_OR_INVALID");
    await expect(readAppointment(pending.id)).resolves.toMatchObject({ status: "PENDING", date: OLD_DATE });
  });
});
