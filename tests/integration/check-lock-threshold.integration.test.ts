import type { AppointmentStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { saveAvailability } from "@/lib/admin/months/service";
import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";
import { checkClientAndAcquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

// Ahora fijo en octubre de 2026: las citas de prueba son de noviembre (futuras y del mismo mes).
const NOW = new Date("2026-10-15T12:00:00.000Z");
const MONTH = "2026-11";
const PHONE = "5512345678";
const CANDIDATE_TIME = "13:00";

const RULE = {
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  times: ["09:00", "13:00"],
  minGapMinutes: 0,
  preserveCapacity: false,
  maxPerDay: 6,
};

// Cita de la clienta con el estado indicado (la clienta se crea la primera vez).
async function seedAppointment(date: string, timeSlot: string, status: AppointmentStatus) {
  const client = await prisma.client.upsert({
    where: { phone: PHONE },
    update: {},
    create: { clientNumber: 990001, name: "Ana Lopez", phone: PHONE },
  });

  return prisma.appointment.create({
    data: {
      clientId: client.id,
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${timeSlot}:00.000Z`),
      status,
    },
  });
}

// Consulta del paso de identidad del flujo público: devuelve la lista de sugerencia del umbral de 15 días.
function checkLock(date: string) {
  return checkClientAndAcquireReservationSlotLock(
    { name: "Ana Lopez", phone: PHONE, date, timeSlot: CANDIDATE_TIME },
    NOW,
  );
}

integrationSuite("umbral de 15 días del chequeo de cliente (D95) con MySQL", () => {
  beforeEach(async () => {
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

  it("una cita PENDING a menos de 15 días dispara la sugerencia (5 nov vs 12 nov)", async () => {
    const pending = await seedAppointment("2026-11-05", "09:00", "PENDING");

    const result = await checkLock("2026-11-12");

    expect(result.futureAppointmentsInMonth).toEqual([
      { appointmentId: pending.id, date: "2026-11-05", timeSlot: "09:00" },
    ]);
    expect(result.canBookAsNewAppointment).toBe(true);
  });

  it("una cita PENDING a 14 días dispara la sugerencia y a 15 días no", async () => {
    const pending = await seedAppointment("2026-11-05", "09:00", "PENDING");

    await expect(checkLock("2026-11-19")).resolves.toMatchObject({
      futureAppointmentsInMonth: [{ appointmentId: pending.id, date: "2026-11-05", timeSlot: "09:00" }],
      canBookAsNewAppointment: true,
    });
    await expect(checkLock("2026-11-20")).resolves.toMatchObject({
      futureAppointmentsInMonth: [],
      canBookAsNewAppointment: false,
    });
  });

  it("CANCELLED y REJECTED nunca disparan la sugerencia", async () => {
    await seedAppointment("2026-11-05", "09:00", "CANCELLED");
    await seedAppointment("2026-11-06", "09:00", "REJECTED");

    await expect(checkLock("2026-11-12")).resolves.toMatchObject({
      futureAppointmentsInMonth: [],
      canBookAsNewAppointment: false,
    });
  });

  it("CONFIRMED y SYNC_FAILED siguen disparando la sugerencia", async () => {
    const appointment = await seedAppointment("2026-11-05", "09:00", "CONFIRMED");

    await expect(checkLock("2026-11-12")).resolves.toMatchObject({
      futureAppointmentsInMonth: [{ appointmentId: appointment.id, date: "2026-11-05", timeSlot: "09:00" }],
    });

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "SYNC_FAILED" } });

    await expect(checkLock("2026-11-12")).resolves.toMatchObject({
      futureAppointmentsInMonth: [{ appointmentId: appointment.id, date: "2026-11-05", timeSlot: "09:00" }],
      canBookAsNewAppointment: true,
    });
  });

  it("una clienta nueva con PENDING creada por el flujo público anterior dispara la sugerencia", async () => {
    // Flujo público real: lock + confirmación. Una clienta no leal (nueva) queda en PENDING.
    const lock = await checkClientAndAcquireReservationSlotLock(
      { name: "Ana Lopez", phone: PHONE, date: "2026-11-05", timeSlot: "09:00" },
      NOW,
    );
    const confirmed = await confirmAppointmentWithLock(
      { name: "Ana Lopez", phone: PHONE, date: "2026-11-05", timeSlot: "09:00", lockToken: lock.lockToken },
      NOW,
    );
    expect(confirmed.status).toBe("PENDING");

    await expect(checkLock("2026-11-12")).resolves.toMatchObject({
      futureAppointmentsInMonth: [{ appointmentId: confirmed.appointmentId, date: "2026-11-05", timeSlot: "09:00" }],
      canBookAsNewAppointment: true,
    });
  });
});
