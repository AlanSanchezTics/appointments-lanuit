import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminAppointment } from "@/lib/admin/appointments/service";
import {
  acquireBookingLocks,
  cleanupExpiredReservationLocks,
  lockConflictingAppointments,
  releaseBookingLocks,
} from "@/lib/db/appointments";
import {
  findMonthAvailability,
  findMonthAvailabilityForShare,
  replaceMonthAvailability,
} from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";
import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: vi.fn(async () => "gcal-test"),
  updateCalendarEvent: vi.fn(async () => undefined),
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

// D77: la creación admin no puede doble reservar frente a una reserva pública concurrente.
const MONTH = "2030-06";
const DATE = "2030-06-03";
const TIME = "10:00";
const NOW = new Date("2030-05-20T12:00:00.000Z");
const PUBLIC_PHONE = "5511110001";
const ADMIN_PHONE = "5522220002";

async function writeRules() {
  const current = await findMonthAvailability(MONTH);

  await prisma.$transaction((tx) =>
    replaceMonthAvailability(tx, {
      month: MONTH,
      expectedVersion: current?.availabilityVersion ?? 1,
      slotMode: "SECOND_ONLY_MODE",
      rules: [
        {
          startDate: `${MONTH}-01`,
          endDate: `${MONTH}-30`,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times: ["10:00", "14:00"],
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay: 3,
        },
      ],
      exceptions: [],
    }),
  );
}

// Reserva pública con la misma secuencia que lib/appointments/book-appointment.ts: named locks, FOR SHARE de reglas,
// conflictos FOR UPDATE, limpieza de RL (D89: después de las citas), INSERT y liberación de named locks dentro de la
// transacción (antes del COMMIT). Replica la estructura, no el código: si book-appointment cambia de orden, esta prueba
// debe actualizarse.
function publicBookingHeldUntil(gate: Promise<void>, onLocked: () => void) {
  return prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, DATE, PUBLIC_PHONE);
    try {
      await findMonthAvailabilityForShare(tx, MONTH);
      await lockConflictingAppointments(tx, DATE, PUBLIC_PHONE);
      await cleanupExpiredReservationLocks(tx, DATE, NOW);
      onLocked();
      await gate;

      const client = await tx.client.findUniqueOrThrow({ where: { phone: PUBLIC_PHONE } });
      await tx.appointment.create({
        data: {
          clientId: client.id,
          date: new Date(`${DATE}T00:00:00.000Z`),
          timeSlot: new Date(`1970-01-01T${TIME}:00.000Z`),
          status: "PENDING",
        },
      });
    } finally {
      await releaseBookingLocks(tx, DATE, PUBLIC_PHONE);
    }
  });
}

async function countAppointmentsAtSlot() {
  const rows = await prisma.appointment.findMany({
    where: { date: new Date(`${DATE}T00:00:00.000Z`) },
    select: { timeSlot: true },
  });

  return rows.filter((row) => row.timeSlot.toISOString().slice(11, 16) === TIME).length;
}

// La creación admin espera el named lock booking:date que retiene la reserva pública. GET_LOCK no aparece en
// data_lock_waits: la espera se observa en metadata_locks (USER LEVEL LOCK, PENDING). No se abre la compuerta hasta
// verificar que el admin espera ese lock concreto.
async function waitForAdminBlockedOnBookingDate() {
  const waitingOn = `booking:date:${DATE}`;

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT OBJECT_NAME AS name FROM performance_schema.metadata_locks WHERE OBJECT_TYPE = 'USER LEVEL LOCK' AND LOCK_STATUS = 'PENDING'",
    );

    if (rows.some((row) => row.name === waitingOn)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`La creación admin nunca quedó en espera de ${waitingOn}`);
}

function adminCreate(clientId: number) {
  return createAdminAppointment(
    { month: MONTH, date: DATE, timeSlot: TIME, clientId },
    NOW,
    { type: "ADMIN" },
  );
}

integrationSuite("admin create vs public booking concurrency integration (D77)", () => {
  beforeEach(async () => {
    // appointment_logs no lo borra el helper (fallo preexistente); se limpia aquí antes de resetear.
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    await writeRules();
    await prisma.client.create({ data: { clientNumber: 201, name: "Publico Lopez", phone: PUBLIC_PHONE } });
    await prisma.client.create({ data: { clientNumber: 202, name: "Admin Ruiz", phone: ADMIN_PHONE } });
  });

  afterAll(async () => {
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("rejects the admin create with SLOT_NOT_AVAILABLE when a public booking commits the same hour meanwhile", async () => {
    const adminClient = await prisma.client.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });

    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => (openGate = resolve));
    let lockedSignal!: () => void;
    const locked = new Promise<void>((resolve) => (lockedSignal = resolve));

    // La pública retiene booking:date y el horario sin COMMIT.
    const publicPromise = publicBookingHeldUntil(gate, () => lockedSignal());
    await locked;

    // El admin arranca mientras tanto: su primera lectura consistente (snapshot) queda antes del COMMIT público.
    const adminPromise = adminCreate(adminClient.id).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
    await waitForAdminBlockedOnBookingDate();
    openGate();

    await publicPromise;
    const admin = await adminPromise;

    expect(admin.status, "admin create must not succeed on a slot taken by the public flow").toBe("rejected");
    expect((admin as { reason: Error }).reason.message).toBe("SLOT_NOT_AVAILABLE");
    expect(await countAppointmentsAtSlot()).toBe(1);
  });

  it("rejects the admin create when the public booking already committed (control)", async () => {
    const adminClient = await prisma.client.findUniqueOrThrow({ where: { phone: ADMIN_PHONE } });

    await publicBookingHeldUntil(Promise.resolve(), () => undefined);

    await expect(adminCreate(adminClient.id)).rejects.toThrow("SLOT_NOT_AVAILABLE");
    expect(await countAppointmentsAtSlot()).toBe(1);
  });
});
