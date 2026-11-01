import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminBlockedSlots } from "@/lib/admin/blocked-spaces/service";
import { createAdminAppointment, rescheduleAdminAppointment } from "@/lib/admin/appointments/service";
import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";
import { acquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import {
  findMonthAvailability,
  replaceMonthAvailability,
} from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";
import { rescheduleMyAppointment } from "@/lib/my-appointments/service";
import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

// Punto de pausa de test (solo en este archivo; producción no cambia). Armado, detiene la primera llamada a
// cleanupExpiredReservationLocks DESPUÉS de ejecutar la limpieza real, dentro de la transacción de la operación.
const rlPause = vi.hoisted(() => ({
  armed: false,
  reached: () => {},
  gate: Promise.resolve(),
}));

vi.mock("@/lib/db/appointments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/appointments")>();

  return {
    ...actual,
    cleanupExpiredReservationLocks: async (
      ...args: Parameters<typeof actual.cleanupExpiredReservationLocks>
    ) => {
      await actual.cleanupExpiredReservationLocks(...args);

      if (rlPause.armed) {
        rlPause.armed = false;
        rlPause.reached();
        await rlPause.gate;
      }
    },
  };
});

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: vi.fn(async () => "gcal-test"),
  updateCalendarEvent: vi.fn(async () => undefined),
  deleteCalendarEvent: vi.fn(async () => undefined),
  GoogleCalendarConfigError: class GoogleCalendarConfigError extends Error {},
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

// D87: la reprogramación pública respeta los reservation_locks vigentes de otras clientas.
// Mes futuro: la reprogramación pública valida el mes con la fecha real del servidor.
const MONTH = "2030-06";
const NOW = new Date("2030-05-20T12:00:00.000Z");
const TEN_MINUTES = 10 * 60 * 1000;
const TARGET_TIME = "10:00";
const PHONE_A = "5511111111"; // dueña del lock
const PHONE_B = "5522222222"; // reprograma su cita al horario retenido
const PHONE_C = "5544444444"; // tercera clienta: solo retiene un lock en la fecha compartida

async function writeRules(times = ["10:00", "14:00"], maxPerDay = 3) {
  const current = await findMonthAvailability(MONTH);

  await prisma.$transaction((tx) =>
    replaceMonthAvailability(tx, {
      month: MONTH,
      expectedVersion: current?.availabilityVersion ?? 1,
      rules: [
        {
          startDate: `${MONTH}-01`,
          endDate: `${MONTH}-30`,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          times,
          minGapMinutes: 0,
          preserveCapacity: false,
          maxPerDay,
        },
      ],
      exceptions: [],
    }),
  );
}

async function createPendingAppointment(clientId: number, date: string, timeSlot: string) {
  return prisma.appointment.create({
    data: {
      clientId,
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${timeSlot}:00.000Z`),
      status: "PENDING",
    },
  });
}

async function holdReservationLock(phone: string, date: string, expiresAt: Date) {
  await prisma.reservationLock.create({
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${TARGET_TIME}:00.000Z`),
      phone,
      lockToken: `lock-${phone}-${date}`,
      expiresAt,
    },
  });
}

async function createActiveLock(phone: string, date: string, timeSlot: string) {
  await prisma.reservationLock.create({
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot: new Date(`1970-01-01T${timeSlot}:00.000Z`),
      phone,
      lockToken: `lock-${phone}-${date}-${timeSlot}`,
      expiresAt: new Date(NOW.getTime() + TEN_MINUTES),
    },
  });
}

type Settled<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  );
}

function outcome(result: Settled<unknown>) {
  return result.status === "fulfilled" ? "fulfilled" : `rejected: ${String((result.reason as Error).message)}`;
}

// Sondea performance_schema.data_lock_waits (estado vivo). No se usa SHOW ENGINE INNODB STATUS: su texto conserva el
// deadlock previo y daría un falso "en espera". Devuelve el objeto de cada espera (NB-4: la espera debe ser sobre citas).
async function waitForLockWait() {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const rows = await prisma.$queryRawUnsafe<Array<{ object: string }>>(
      "SELECT l.OBJECT_NAME AS object FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID",
    );

    if (rows.length > 0) {
      return rows.map((row) => row.object);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("La operación bloqueada nunca llegó a LOCK WAIT");
}

function armCleanupPause() {
  let reached!: () => void;
  const reachedPromise = new Promise<void>((resolve) => (reached = resolve));
  let release!: () => void;
  rlPause.gate = new Promise<void>((resolve) => (release = resolve));
  rlPause.reached = reached;
  rlPause.armed = true;

  return { reachedPromise, release };
}

// Ejecuta `paused` hasta que llega a su limpieza de RL (detenida dentro de su transacción), lanza `contender`, espera a
// que quede en LOCK WAIT y libera la pausa. Si `paused` falla antes de limpiar, el test falla con su resultado.
async function runPausedAgainstReschedule(paused: () => Promise<unknown>, contender: () => Promise<unknown>) {
  const pause = armCleanupPause();
  const first = settle(paused());
  const early = await Promise.race([pause.reachedPromise.then(() => "paused"), first]);
  expect(early, "la operación pausada debe llegar a su limpieza de RL").toBe("paused");

  const second = settle(contender());

  let waitingOn: string[];

  try {
    waitingOn = await waitForLockWait();
  } finally {
    pause.release();
  }

  // NB-4 (D89): la operación que espera debe esperar citas (appointments), nunca reservation_locks.
  expect(waitingOn, "la espera debe ser sobre appointments").toContain("appointments");
  expect(waitingOn, "ninguna espera debe ser sobre reservation_locks").not.toContain("reservation_locks");

  return { first: await first, second: await second };
}

integrationSuite("public reschedule respects active reservation locks (D87)", () => {
  beforeEach(async () => {
    // appointment_logs no lo borra el helper (fallo preexistente); se limpia aquí antes de resetear.
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    await writeRules();
    await prisma.client.create({ data: { clientNumber: 101, name: "Ana Lopez", phone: PHONE_A } });
    await prisma.client.create({ data: { clientNumber: 102, name: "Luis Ruiz", phone: PHONE_B } });
  });

  afterAll(async () => {
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("rejects a destination held by another client's active lock and leaves the appointment in place", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, `${MONTH}-01`, "14:00");
    await holdReservationLock(PHONE_A, `${MONTH}-10`, new Date(NOW.getTime() + TEN_MINUTES));

    await expect(
      rescheduleMyAppointment(
        {
          phone: PHONE_B,
          appointmentId: appointment.id,
          month: MONTH,
          date: `${MONTH}-10`,
          timeSlot: TARGET_TIME,
        },
        NOW,
      ),
    ).rejects.toThrow("SLOT_NOT_AVAILABLE");

    const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(unchanged.date.toISOString().slice(0, 10)).toBe(`${MONTH}-01`);
    expect(unchanged.timeSlot.toISOString().slice(11, 16)).toBe("14:00");
    // N5: el lock ajeno sigue vigente y el rechazo no escribe evento MODIFIED.
    expect(await prisma.reservationLock.count({ where: { lockToken: `lock-${PHONE_A}-${MONTH}-10` } })).toBe(1);
    expect(await prisma.appointmentLog.count({ where: { appointmentId: appointment.id, actionType: "MODIFIED" } })).toBe(0);
  });

  it("accepts the same destination once the other client's lock has expired", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, `${MONTH}-01`, "14:00");
    await holdReservationLock(PHONE_A, `${MONTH}-11`, new Date(NOW.getTime() - 60 * 1000));

    const result = await rescheduleMyAppointment(
      {
        phone: PHONE_B,
        appointmentId: appointment.id,
        month: MONTH,
        date: `${MONTH}-11`,
        timeSlot: TARGET_TIME,
      },
      NOW,
    );

    expect(result).toEqual({ appointmentId: appointment.id, status: "PENDING", googleEventId: null });
    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(moved.date.toISOString().slice(0, 10)).toBe(`${MONTH}-11`);
  });

  it("does not block on a lock held by the same client", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, `${MONTH}-01`, "14:00");
    await holdReservationLock(PHONE_B, `${MONTH}-12`, new Date(NOW.getTime() + TEN_MINUTES));

    const result = await rescheduleMyAppointment(
      {
        phone: PHONE_B,
        appointmentId: appointment.id,
        month: MONTH,
        date: `${MONTH}-12`,
        timeSlot: TARGET_TIME,
      },
      NOW,
    );

    expect(result.status).toBe("PENDING");
    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(moved.date.toISOString().slice(0, 10)).toBe(`${MONTH}-12`);
  });

  it("reschedules normally when there are no locks on the destination", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, `${MONTH}-01`, "14:00");

    const result = await rescheduleMyAppointment(
      {
        phone: PHONE_B,
        appointmentId: appointment.id,
        month: MONTH,
        date: `${MONTH}-13`,
        timeSlot: TARGET_TIME,
      },
      NOW,
    );

    expect(result.status).toBe("PENDING");
  });
});

// D89/BLK-1: ninguna operación que limpia RL puede tener RL bloqueado mientras espera citas.
// Escenario común: una operación sobre SHARED_DATE toma primero las citas de SHARED_DATE, ejecuta la limpieza real de RL
// y se detiene dentro de su transacción (pausa en cleanupExpiredReservationLocks). Luis reprograma su cita de
// SHARED_DATE 14:00 a DEST 10:00. Con el orden antiguo (limpieza antes que citas), la limpieza bloquea la fila de RL de
// una tercera clienta en SHARED_DATE 10:00; la lectura de RL de DEST la necesita por el gap lock del índice
// (date, time_slot, expires_at), y la operación pausada, al seguir, pide las citas de Luis: ciclo, 1213.
// Con el orden actual la operación ya tiene las citas bloqueadas cuando Luis llega: Luis espera citas, sin ciclo.
const DEST = `${MONTH}-10`;
const SHARED_DATE = `${MONTH}-20`;

integrationSuite("reservation or admin write vs public reschedule without deadlock (D89/BLK-1)", () => {
  beforeEach(async () => {
    await prisma.appointmentLog.deleteMany();
    await prisma.blockedSlot.deleteMany();
    await resetAppointmentsTable();
    await prisma.activeMonth.create({ data: { month: MONTH, status: "ACTIVE" } });
    await writeRules(["10:00", "14:00", "16:00", "18:00"], 6);
    await prisma.client.create({ data: { clientNumber: 101, name: "Ana Lopez", phone: PHONE_A } });
    await prisma.client.create({ data: { clientNumber: 102, name: "Luis Ruiz", phone: PHONE_B } });
    await createActiveLock(PHONE_C, SHARED_DATE, "10:00");
  });

  afterAll(async () => {
    await prisma.appointmentLog.deleteMany();
    await prisma.blockedSlot.deleteMany();
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  function rescheduleLuis(appointmentId: number) {
    return rescheduleMyAppointment(
      { phone: PHONE_B, appointmentId, month: MONTH, date: DEST, timeSlot: TARGET_TIME },
      NOW,
    );
  }

  it("public reservation waits on the appointments instead of holding the lock row the reschedule reads", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, SHARED_DATE, "14:00");

    const { first, second } = await runPausedAgainstReschedule(
      () => acquireReservationSlotLock({ phone: PHONE_A, date: SHARED_DATE, timeSlot: "18:00" }, NOW),
      () => rescheduleLuis(appointment.id),
    );
    expect(outcome(first)).toBe("fulfilled");
    expect(outcome(second)).toBe("fulfilled");

    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(moved.date.toISOString().slice(0, 10)).toBe(DEST);
    expect(await prisma.reservationLock.count({ where: { phone: PHONE_A } })).toBe(1);
    expect(await prisma.reservationLock.count({ where: { phone: PHONE_C } })).toBe(1);
  });

  it("admin create waits on the appointments instead of holding the lock row the reschedule reads", async () => {
    const clientA = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_A } });
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, SHARED_DATE, "14:00");

    const { first, second } = await runPausedAgainstReschedule(
      () =>
        createAdminAppointment({ month: MONTH, date: SHARED_DATE, timeSlot: "18:00", clientId: clientA.id }, NOW),
      () => rescheduleLuis(appointment.id),
    );
    expect(outcome(first)).toBe("fulfilled");
    expect(outcome(second)).toBe("fulfilled");

    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(moved.date.toISOString().slice(0, 10)).toBe(DEST);
    expect(await prisma.appointment.count({ where: { clientId: clientA.id, status: "CONFIRMED" } })).toBe(1);
  });

  it("admin reschedule waits on the appointments instead of holding the lock row the reschedule reads", async () => {
    const clientA = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_A } });
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    // La reprogramación admin solo toma citas CONFIRMED o SYNC_FAILED.
    const adminMoved = await prisma.appointment.create({
      data: {
        clientId: clientA.id,
        date: new Date(`${SHARED_DATE}T00:00:00.000Z`),
        timeSlot: new Date("1970-01-01T16:00:00.000Z"),
        status: "CONFIRMED",
      },
    });
    const appointment = await createPendingAppointment(clientB.id, SHARED_DATE, "14:00");

    const { first, second } = await runPausedAgainstReschedule(
      () =>
        rescheduleAdminAppointment(adminMoved.id, { month: MONTH, date: SHARED_DATE, timeSlot: "18:00" }, NOW),
      () => rescheduleLuis(appointment.id),
    );
    expect(outcome(first)).toBe("fulfilled");
    expect(outcome(second)).toBe("fulfilled");

    const movedByAdmin = await prisma.appointment.findUniqueOrThrow({ where: { id: adminMoved.id } });
    expect(movedByAdmin.timeSlot.toISOString().slice(11, 16)).toBe("18:00");
    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(moved.date.toISOString().slice(0, 10)).toBe(DEST);
  });

  it("admin blocking waits on the appointments instead of holding the lock row the reschedule reads", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, SHARED_DATE, "14:00");

    const { first, second } = await runPausedAgainstReschedule(
      () =>
        createAdminBlockedSlots(
          { month: MONTH, date: SHARED_DATE, slots: ["18:00"], reason: "OTRO", createdByAdminId: null },
          NOW,
        ),
      () => rescheduleLuis(appointment.id),
    );
    expect(outcome(first)).toBe("fulfilled");
    expect(outcome(second)).toBe("fulfilled");

    expect(await prisma.blockedSlot.count()).toBe(1);
    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(moved.date.toISOString().slice(0, 10)).toBe(DEST);
  });

  it("confirmation waits on the appointments instead of holding the lock row the reschedule reads", async () => {
    const clientB = await prisma.client.findUniqueOrThrow({ where: { phone: PHONE_B } });
    const appointment = await createPendingAppointment(clientB.id, SHARED_DATE, "14:00");
    const lock = await acquireReservationSlotLock({ phone: PHONE_A, date: SHARED_DATE, timeSlot: "18:00" }, NOW);

    const { first, second } = await runPausedAgainstReschedule(
      () =>
        confirmAppointmentWithLock(
          { lockToken: lock.lockToken, name: "Ana Lopez", phone: PHONE_A, date: SHARED_DATE, timeSlot: "18:00" },
          NOW,
        ),
      () => rescheduleLuis(appointment.id),
    );
    expect(outcome(first)).toBe("fulfilled");
    expect(outcome(second)).toBe("fulfilled");

    expect(
      await prisma.appointment.count({
        where: { client: { phone: PHONE_A }, timeSlot: new Date("1970-01-01T18:00:00.000Z") },
      }),
    ).toBe(1);
  });
});
