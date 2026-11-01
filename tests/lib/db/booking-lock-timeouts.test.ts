import { describe, expect, it, vi } from "vitest";

import {
  acquireBookingLocks,
  BOOKING_TRANSACTION_OPTIONS,
  BOOKING_TRANSACTION_TIMEOUT_MS,
  NAMED_LOCK_WAIT_SECONDS,
  releaseBookingLocks,
  ROW_LOCK_WAIT_SECONDS,
} from "@/lib/db/appointments";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

// F1 (D82): tiempos del timeout de transacción y de la espera de fila frente a los GET_LOCK.
type RecordedCall = { sql: string; values: unknown[] };

function fakeTx() {
  const calls: RecordedCall[] = [];
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      calls.push({ sql, values });
      return sql.includes("GET_LOCK") ? [{ acquired: 1 }] : [];
    }),
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      calls.push({ sql, values: [] });
      return 0;
    }),
  };
  return { tx, calls };
}

describe("F1 (D82): tiempos de la transacción de reserva y de los named locks", () => {
  it("el timeout de la transacción supera el caso de una sola espera de cada tipo (2 GET_LOCK más una espera de fila); las cadenas de esperas exitosas son el riesgo residual H1", () => {
    const worstCaseWaitMs = 2 * NAMED_LOCK_WAIT_SECONDS * 1000 + ROW_LOCK_WAIT_SECONDS * 1000;

    expect(BOOKING_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(worstCaseWaitMs);
  });

  it("la espera de fila de la sesión termina antes que la transacción", () => {
    expect(ROW_LOCK_WAIT_SECONDS * 1000).toBeLessThan(BOOKING_TRANSACTION_TIMEOUT_MS);
  });

  it("las opciones de prisma.$transaction fijan solo el timeout", () => {
    expect(BOOKING_TRANSACTION_OPTIONS).toEqual({ timeout: 30_000 });
  });

  it("acquireBookingLocks fija la espera de fila antes de los GET_LOCK, en orden alfabético", async () => {
    const { tx, calls } = fakeTx();

    await acquireBookingLocks(tx as never, "2030-01-02", "5511112222");

    expect(calls[0]).toEqual({ sql: "SET SESSION innodb_lock_wait_timeout = 5", values: [] });
    expect(calls.slice(1).map((call) => call.values)).toEqual([
      ["booking:date:2030-01-02", NAMED_LOCK_WAIT_SECONDS],
      ["booking:phone:5511112222", NAMED_LOCK_WAIT_SECONDS],
    ]);
  });

  it("releaseBookingLocks libera en orden inverso y restaura la espera de fila por defecto al final", async () => {
    const { tx, calls } = fakeTx();

    await releaseBookingLocks(tx as never, "2030-01-02", "5511112222");

    const releases = calls.filter((call) => call.sql.includes("RELEASE_LOCK")).map((call) => call.values);
    expect(releases).toEqual([["booking:phone:5511112222"], ["booking:date:2030-01-02"]]);
    expect(calls.at(-1)).toEqual({ sql: "SET SESSION innodb_lock_wait_timeout = DEFAULT", values: [] });
  });
});
