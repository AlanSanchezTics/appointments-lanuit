import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

// Solo acceso a datos (AGENTS, ubicación de código). Sin reglas de negocio:
// la normalización y validación viven en lib/availability/rules-validation.ts.

export type AvailabilityRuleInput = {
  startDate: string; // YYYY-MM-DD, inclusivo
  endDate: string; // YYYY-MM-DD, inclusivo
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
  weekdays: number[]; // ISO 1 (lunes) a 7 (domingo)
  times: string[]; // HH:mm
};

export type AvailabilityExceptionInput = {
  date: string; // YYYY-MM-DD
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
  times: string[]; // HH:mm; lista vacía = día cerrado (A2)
};

export type AvailabilityRuleRecord = AvailabilityRuleInput & { id: number };
export type AvailabilityExceptionRecord = AvailabilityExceptionInput & { id: number };

export type MonthAvailabilityRecord = {
  activeMonthId: number;
  month: string;
  availabilityVersion: number;
  rules: AvailabilityRuleRecord[];
  exceptions: AvailabilityExceptionRecord[];
};

type ReadClient = Pick<Prisma.TransactionClient, "$queryRaw">;

type MonthRow = {
  id: number;
  availabilityVersion: number;
};

type RuleRow = {
  id: number;
  startDate: string;
  endDate: string;
  minGapMinutes: number;
  preserveCapacity: number | boolean;
  maxPerDay: number;
};

type ExceptionRow = {
  id: number;
  date: string;
  minGapMinutes: number;
  preserveCapacity: number | boolean;
  maxPerDay: number;
};

type ChildRow = { parentId: number; value: string | number };

function toDateValue(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

// TIME(0) se guarda con fecha 1970-01-01, igual que appointments.time_slot.
function toTimeValue(time: string) {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

function groupBy<T extends ChildRow>(rows: T[]) {
  const map = new Map<number, Array<string | number>>();

  for (const row of rows) {
    const bucket = map.get(row.parentId) ?? [];
    bucket.push(row.value);
    map.set(row.parentId, bucket);
  }

  return map;
}

async function readMonthAvailability(
  db: ReadClient,
  month: string,
  lock: Prisma.Sql,
): Promise<MonthAvailabilityRecord | null> {
  const [monthRow] = await db.$queryRaw<MonthRow[]>`
    SELECT id, availability_version AS availabilityVersion
    FROM active_months
    WHERE \`month\` = ${month}
    ${lock}
  `;

  if (!monthRow) {
    return null;
  }

  const ruleRows = await db.$queryRaw<RuleRow[]>`
    SELECT
      id,
      DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
      DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
      min_gap_minutes AS minGapMinutes,
      preserve_capacity AS preserveCapacity,
      max_per_day AS maxPerDay
    FROM availability_rules
    WHERE active_month_id = ${monthRow.id}
    ORDER BY start_date ASC, id ASC
    ${lock}
  `;

  const ruleWeekdayRows = await db.$queryRaw<ChildRow[]>`
    SELECT w.rule_id AS parentId, w.weekday AS value
    FROM availability_rule_weekdays w
    INNER JOIN availability_rules r ON r.id = w.rule_id
    WHERE r.active_month_id = ${monthRow.id}
    ORDER BY w.rule_id ASC, w.weekday ASC
    ${lock}
  `;

  const ruleTimeRows = await db.$queryRaw<ChildRow[]>`
    SELECT t.rule_id AS parentId, TIME_FORMAT(t.time_slot, '%H:%i') AS value
    FROM availability_rule_times t
    INNER JOIN availability_rules r ON r.id = t.rule_id
    WHERE r.active_month_id = ${monthRow.id}
    ORDER BY t.rule_id ASC, t.time_slot ASC
    ${lock}
  `;

  const exceptionRows = await db.$queryRaw<ExceptionRow[]>`
    SELECT
      id,
      DATE_FORMAT(date, '%Y-%m-%d') AS date,
      min_gap_minutes AS minGapMinutes,
      preserve_capacity AS preserveCapacity,
      max_per_day AS maxPerDay
    FROM availability_exceptions
    WHERE active_month_id = ${monthRow.id}
    ORDER BY date ASC, id ASC
    ${lock}
  `;

  const exceptionTimeRows = await db.$queryRaw<ChildRow[]>`
    SELECT t.exception_id AS parentId, TIME_FORMAT(t.time_slot, '%H:%i') AS value
    FROM availability_exception_times t
    INNER JOIN availability_exceptions e ON e.id = t.exception_id
    WHERE e.active_month_id = ${monthRow.id}
    ORDER BY t.exception_id ASC, t.time_slot ASC
    ${lock}
  `;

  const weekdaysByRule = groupBy(ruleWeekdayRows);
  const timesByRule = groupBy(ruleTimeRows);
  const timesByException = groupBy(exceptionTimeRows);

  return {
    activeMonthId: monthRow.id,
    month,
    availabilityVersion: Number(monthRow.availabilityVersion),
    rules: ruleRows.map((row) => ({
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
      minGapMinutes: Number(row.minGapMinutes),
      preserveCapacity: Boolean(Number(row.preserveCapacity)),
      maxPerDay: Number(row.maxPerDay),
      weekdays: (weekdaysByRule.get(row.id) ?? []).map(Number),
      times: (timesByRule.get(row.id) ?? []).map(String),
    })),
    exceptions: exceptionRows.map((row) => ({
      id: row.id,
      date: row.date,
      minGapMinutes: Number(row.minGapMinutes),
      preserveCapacity: Boolean(Number(row.preserveCapacity)),
      maxPerDay: Number(row.maxPerDay),
      times: (timesByException.get(row.id) ?? []).map(String),
    })),
  };
}

/** Lectura sin bloqueo para pantallas admin. Devuelve null si el mes no está registrado. */
export function findMonthAvailability(month: string) {
  return readMonthAvailability(prisma, month, Prisma.empty);
}

/**
 * Lectura para transacciones de reserva o reprogramación (PD-08). Usa FOR SHARE, así que
 * espera a que termine cualquier escritura de replaceMonthAvailability sobre el mismo mes.
 * Llamar dentro de prisma.$transaction, después de los locks de reserva.
 */
export function findMonthAvailabilityForShare(tx: Prisma.TransactionClient, month: string) {
  return readMonthAvailability(tx, month, Prisma.sql`FOR SHARE`);
}

/**
 * Lectura con FOR UPDATE para el editor (PD-05, PD-08). Llamar dentro de prisma.$transaction y antes de leer
 * citas del mes: el bloqueo de la fila de active_months hace esperar a las reservas (que toman FOR SHARE).
 */
export function findMonthAvailabilityForUpdate(tx: Prisma.TransactionClient, month: string) {
  return readMonthAvailability(tx, month, Prisma.sql`FOR UPDATE`);
}

/**
 * Reemplaza el conjunto completo de reglas y excepciones del mes. Debe ejecutarse dentro de
 * una transacción: bloquea el mes con FOR UPDATE, compara expectedVersion, borra y reinserta
 * el conjunto e incrementa availability_version.
 *
 * Lanza MONTH_NOT_REGISTERED o AVAILABILITY_VERSION_CONFLICT sin escribir nada.
 */
export async function replaceMonthAvailability(
  tx: Prisma.TransactionClient,
  input: {
    month: string;
    expectedVersion: number;
    rules: AvailabilityRuleInput[];
    exceptions: AvailabilityExceptionInput[];
  },
) {
  const [monthRow] = await tx.$queryRaw<Array<{ id: number; availabilityVersion: number }>>`
    SELECT id, availability_version AS availabilityVersion
    FROM active_months
    WHERE \`month\` = ${input.month}
    FOR UPDATE
  `;

  if (!monthRow) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  if (Number(monthRow.availabilityVersion) !== input.expectedVersion) {
    throw new Error("AVAILABILITY_VERSION_CONFLICT");
  }

  // Las horas y los días se borran en cascada (FK ON DELETE CASCADE).
  await tx.availabilityException.deleteMany({ where: { activeMonthId: monthRow.id } });
  await tx.availabilityRule.deleteMany({ where: { activeMonthId: monthRow.id } });

  for (const rule of input.rules) {
    await tx.availabilityRule.create({
      data: {
        activeMonthId: monthRow.id,
        startDate: toDateValue(rule.startDate),
        endDate: toDateValue(rule.endDate),
        minGapMinutes: rule.minGapMinutes,
        preserveCapacity: rule.preserveCapacity,
        maxPerDay: rule.maxPerDay,
        weekdays: { create: rule.weekdays.map((weekday) => ({ weekday })) },
        times: { create: rule.times.map((time) => ({ timeSlot: toTimeValue(time) })) },
      },
    });
  }

  for (const exception of input.exceptions) {
    await tx.availabilityException.create({
      data: {
        activeMonthId: monthRow.id,
        date: toDateValue(exception.date),
        minGapMinutes: exception.minGapMinutes,
        preserveCapacity: exception.preserveCapacity,
        maxPerDay: exception.maxPerDay,
        times: { create: exception.times.map((time) => ({ timeSlot: toTimeValue(time) })) },
      },
    });
  }

  const updated = await tx.activeMonth.update({
    where: { id: monthRow.id },
    data: {
      availabilityVersion: { increment: 1 },
    },
    select: { availabilityVersion: true },
  });

  return { availabilityVersion: updated.availabilityVersion };
}
