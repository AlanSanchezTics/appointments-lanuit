/* eslint-disable @typescript-eslint/no-explicit-any -- prueba: envoltura de $transaction de Prisma para interponer la pausa */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmPendingAppointment } from "@/lib/admin/appointments/service";
import { saveAvailability } from "@/lib/admin/months/service";
import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";
import { checkClientAndAcquireReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

const { createCalendarEventMock, deleteCalendarEventMock, syncMock } = vi.hoisted(() => ({
  createCalendarEventMock: vi.fn(async () => "evt-new"),
  deleteCalendarEventMock: vi.fn(async () => undefined),
  syncMock: vi.fn(async () => ({ status: "CONFIRMED" as const })),
}));

vi.mock("@/lib/calendar/google", () => ({
  createCalendarEvent: createCalendarEventMock,
  deleteCalendarEvent: deleteCalendarEventMock,
  updateCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/calendar/sync-appointment", () => ({
  syncAppointmentToCalendar: syncMock,
}));

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

const NOW = new Date("2026-10-15T12:00:00.000Z");
const MONTH = "2026-11";
const PHONE = "5512345678";
const OLD_DATE = "2026-11-05";
const OLD_TIME = "09:00";
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

// Interposición determinista: se activa solo en el cambio de estado de la confirmación admin.
let armed = false;
let onBeforeStatusChange: ((tx: unknown) => Promise<void>) | null = null;

function hookedTransactionClient(tx: any) {
  return new Proxy(tx, {
    get(target, prop) {
      if (prop === "appointment") {
        return new Proxy(target.appointment, {
          get(delegate, method) {
            if (method === "updateMany" && armed) {
              return async (args: unknown) => {
                armed = false;
                await onBeforeStatusChange?.(target);
                return delegate.updateMany(args as any);
              };
            }
            const value = Reflect.get(delegate, method);
            return typeof value === "function" ? value.bind(delegate) : value;
          },
        });
      }
      const value = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

async function waitForCommittedNewDate(appointmentId: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });

    if (dateKey(row.date) === NEW_DATE) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

integrationSuite("confirmación admin de PENDING frente a reprogramación pública (N-1) con MySQL", () => {
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

    const originalTransaction = prisma.$transaction.bind(prisma);
    vi.spyOn(prisma, "$transaction").mockImplementation(((arg: unknown, options?: unknown) => {
      if (typeof arg !== "function") {
        return (originalTransaction as any)(arg, options);
      }
      return originalTransaction(
        (tx: any) => (arg as any)(armed ? hookedTransactionClient(tx) : tx),
        options as any,
      );
    }) as any);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    armed = false;
    onBeforeStatusChange = null;
    await prisma.blockedSlot.deleteMany({
      where: { date: { gte: new Date("2026-11-01T00:00:00.000Z"), lt: new Date("2026-12-01T00:00:00.000Z") } },
    });
    await resetAppointmentsTable();
    await disconnectPrisma();
  });

  it("la sincronización de calendario usa la fecha/hora de la fila bloqueada aunque una reprogramación pública corra durante la transición", async () => {
    const client = await prisma.client.create({ data: { clientNumber: 990001, name: "Ana Lopez", phone: PHONE } });
    const pending = await prisma.appointment.create({
      data: {
        clientId: client.id,
        date: new Date(`${OLD_DATE}T00:00:00.000Z`),
        timeSlot: new Date(`1970-01-01T${OLD_TIME}:00.000Z`),
        status: "PENDING",
      },
    });
    const lock = await checkClientAndAcquireReservationSlotLock(
      { name: "Ana Lopez", phone: PHONE, date: NEW_DATE, timeSlot: NEW_TIME },
      NOW,
    );

    let capturedAtTransition: { date: string; timeSlot: string } | null = null;
    let racePromise: Promise<unknown> | null = null;

    onBeforeStatusChange = async (tx) => {
      // La reprogramación pública arranca justo antes del cambio de estado del admin.
      racePromise = confirmAppointmentWithLock(
        {
          name: "Ana Lopez",
          phone: PHONE,
          date: NEW_DATE,
          timeSlot: NEW_TIME,
          lockToken: lock.lockToken,
          appointmentIdToReschedule: pending.id,
        },
        NOW,
      ).catch((error: unknown) => error);

      // Sin bloqueo del admin, la reprogramación se confirma durante la pausa; con bloqueo, espera al commit.
      await waitForCommittedNewDate(pending.id, 2000);

      // Lectura bloqueada dentro de la transacción del admin: la fila tal como está en el momento del cambio.
      const [seen] = await (tx as any).$queryRaw`
        SELECT date, time_slot FROM appointments WHERE id = ${pending.id} FOR UPDATE
      `;
      capturedAtTransition = { date: dateKey(seen.date), timeSlot: timeKey(seen.time_slot) };
    };
    armed = true;

    const result = await confirmPendingAppointment(pending.id);
    await racePromise;

    expect(capturedAtTransition).not.toBeNull();
    expect(result.status).toBe("CONFIRMED");
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: pending.id,
        date: capturedAtTransition!.date,
        timeSlot: capturedAtTransition!.timeSlot,
      }),
    );
  });
});
