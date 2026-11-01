import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  acquireBookingLocks,
  BOOKING_TRANSACTION_OPTIONS,
  lockConflictingAppointments,
  releaseBookingLocks,
  ROW_LOCK_WAIT_SECONDS,
} from "@/lib/db/appointments";
import { prisma } from "@/lib/db/prisma";
import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

const hasDatabase = Boolean(process.env.DATABASE_URL) && process.env.ENABLE_INTEGRATION_DB === "1";
const integrationSuite = hasDatabase ? describe : describe.skip;

// F1 (D82): el GET_LOCK de sesión debe liberarse aunque la transacción no llegue a su COMMIT.
// Fechas y teléfonos propios de esta prueba (2030, fuera de los datos de las demás).
const DATE = "2030-08-14";
const HOLDER_PHONE = "5533330001";
const WAITER_PHONE = "5533330002";
const HOLD_MS = 9_000;
const TEST_TIMEOUT_MS = 30_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// IS_USED_LOCK devuelve NULL si nadie tiene el lock; si lo tiene una sesión, devuelve su id de conexión.
async function isLockFree(lockName: string) {
  const rows = await prisma.$queryRaw<Array<{ holder: number | bigint | null }>>`
    SELECT IS_USED_LOCK(${lockName}) AS holder
  `;
  return rows[0]?.holder === null || rows[0]?.holder === undefined;
}

integrationSuite("F1 (D82): named locks de reserva y expiración de transacción", () => {
  beforeAll(async () => {
    await resetAppointmentsTable();
    const client = await prisma.client.create({
      data: { clientNumber: 301, name: "Titular de cita", phone: HOLDER_PHONE },
    });
    // Cita existente en la fecha: FOR UPDATE de lockConflictingAppointments necesita filas que bloquear.
    await prisma.appointment.create({
      data: {
        clientId: client.id,
        date: new Date(`${DATE}T00:00:00.000Z`),
        timeSlot: new Date("1970-01-01T10:00:00.000Z"),
        status: "CONFIRMED",
      },
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it(
    "una espera de fila que vence antes que la transacción libera los named locks",
    async () => {
      let holderLocked!: () => void;
      const locked = new Promise<void>((resolve) => {
        holderLocked = resolve;
      });

      // Otra transacción retiene la cita de la fecha durante HOLD_MS, sin named locks.
      const holder = prisma.$transaction(
        async (tx) => {
          await lockConflictingAppointments(tx, DATE, HOLDER_PHONE);
          holderLocked();
          await sleep(HOLD_MS);
        },
        { timeout: HOLD_MS + 10_000 },
      );
      await locked;

      const startedAt = Date.now();
      const waiterError = await prisma
        .$transaction(
          async (tx) => {
            try {
              await acquireBookingLocks(tx, DATE, WAITER_PHONE);
              await lockConflictingAppointments(tx, DATE, WAITER_PHONE);
            } finally {
              await releaseBookingLocks(tx, DATE, WAITER_PHONE);
            }
          },
          BOOKING_TRANSACTION_OPTIONS,
        )
        .then(
          () => null,
          (error: unknown) => error as Error,
        );
      const elapsedMs = Date.now() - startedAt;

      await holder;

      // Falla por espera de fila de InnoDB (~ROW_LOCK_WAIT_SECONDS), no por la expiración de Prisma ni al final de HOLD.
      expect(waiterError).toBeInstanceOf(Error);
      expect(waiterError?.message).toMatch(/Lock wait timeout/i);
      expect(elapsedMs).toBeGreaterThanOrEqual(ROW_LOCK_WAIT_SECONDS * 1000 - 500);
      expect(elapsedMs).toBeLessThan(HOLD_MS);
      expect(await isLockFree(`booking:date:${DATE}`)).toBe(true);
      expect(await isLockFree(`booking:phone:${WAITER_PHONE}`)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "con el timeout de producción, una operación de 6 s (mayor que el timeout por defecto de 5 s) libera los named locks",
    async () => {
      const date = "2030-08-16";
      const phone = "5533330004";

      await prisma.$transaction(
        async (tx) => {
          try {
            await acquireBookingLocks(tx, date, phone);
            await sleep(6_000);
            await tx.$queryRaw`SELECT 1`;
          } finally {
            await releaseBookingLocks(tx, date, phone);
          }
        },
        BOOKING_TRANSACTION_OPTIONS,
      );

      expect(await isLockFree(`booking:date:${date}`)).toBe(true);
      expect(await isLockFree(`booking:phone:${phone}`)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "un GET_LOCK que vence a los 5 s responde LOCK_TIMEOUT (no expiración de Prisma) y no deja el lock retenido",
    async () => {
      const date = "2030-08-19";
      const phone = "5533330005";
      let holderLocked!: () => void;
      const locked = new Promise<void>((resolve) => {
        holderLocked = resolve;
      });

      // Otra sesión retiene booking:date durante 8 s; la espera de GET_LOCK (5 s) vence antes que la transacción.
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT GET_LOCK(${`booking:date:${date}`}, 0) AS acquired`;
          holderLocked();
          await sleep(8_000);
          await tx.$queryRaw`SELECT RELEASE_LOCK(${`booking:date:${date}`})`;
        },
        { timeout: 15_000 },
      );
      await locked;

      const waiterError = await prisma
        .$transaction(
          async (tx) => {
            try {
              await acquireBookingLocks(tx, date, phone);
            } finally {
              await releaseBookingLocks(tx, date, phone);
            }
          },
          BOOKING_TRANSACTION_OPTIONS,
        )
        .then(
          () => null,
          (error: unknown) => error as Error,
        );

      await holder;

      expect(waiterError?.message).toBe("LOCK_TIMEOUT");
      expect(await isLockFree(`booking:date:${date}`)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  // Va antes de la prueba residual: esa expiración deja su conexión del pool con 5 s y no debe contaminar esta comprobación.
  it(
    "tras releaseBookingLocks, la sesión de la transacción vuelve al innodb_lock_wait_timeout previo",
    async () => {
      const date = "2030-08-21";
      const phone = "5533330006";

      // Valor por defecto del servidor, leído al inicio (no se fija a un número). DEFAULT restaura este valor.
      const globalRows = await prisma.$queryRaw<Array<{ value: number | bigint }>>`
        SELECT @@GLOBAL.innodb_lock_wait_timeout AS value
      `;
      const serverDefault = Number(globalRows[0]?.value);

      await prisma.$transaction(
        async (tx) => {
          const readWaitTimeout = async () => {
            const rows = await tx.$queryRaw<Array<{ value: number | bigint }>>`
              SELECT @@SESSION.innodb_lock_wait_timeout AS value
            `;
            return Number(rows[0]?.value);
          };

          // Valor previo de la sesión. Las pruebas anteriores comparten conexión del pool, así que se compara
          // también con el valor por defecto del servidor: si una liberación no restaura, ambas comparaciones fallan.
          const before = await readWaitTimeout();
          await acquireBookingLocks(tx, date, phone);
          const during = await readWaitTimeout();
          await releaseBookingLocks(tx, date, phone);
          const after = await readWaitTimeout();

          expect(during).toBe(ROW_LOCK_WAIT_SECONDS);
          expect(after).toBe(before);
          expect(after).toBe(serverDefault);
        },
        BOOKING_TRANSACTION_OPTIONS,
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "limitación residual F1: si Prisma expira la transacción antes del finally, el named lock queda retenido",
    async () => {
      // Medición dentro de la prueba: timeout corto para forzar la expiración (la operación dura 1,5 s).
      const retained: boolean[] = [];

      for (const [index, date] of ["2030-08-17", "2030-08-18"].entries()) {
        const phone = `553333010${index}`;
        let finished!: () => void;
        const done = new Promise<void>((resolve) => {
          finished = resolve;
        });

        await prisma
          .$transaction(
            async (tx) => {
              try {
                await acquireBookingLocks(tx, date, phone);
                await sleep(1_500);
                await tx.$queryRaw`SELECT 1`;
              } finally {
                // Tras la expiración la transacción está cerrada: la liberación falla y el lock sigue en la sesión.
                await releaseBookingLocks(tx, date, phone).catch(() => undefined);
                finished();
              }
            },
            { timeout: 500 },
          )
          .catch(() => undefined);

        await done;
        retained.push(!(await isLockFree(`booking:date:${date}`)));
      }

      // Si esta prueba empieza a fallar porque el lock queda libre, la limitación se corrigió: actualizar ADR 0006 y data-model.md.
      expect(retained).toEqual([true, true]);
    },
    TEST_TIMEOUT_MS,
  );
});
