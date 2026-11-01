import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";

import { disconnectPrisma, resetAppointmentsTable } from "./helpers/db";

// El test ejecuta el bloque BACKFILL de la migración real (entre los marcadores), no una copia.
// La migración ya se aplicó con migrate deploy; aquí se simula una base recién creada con datos.
// Desde la migración 0023 la columna active_months.slot_mode ya no existe: el test la recrea como
// columna legada antes de correr el backfill y la elimina al terminar (el backfill la lee).
// Ruta desde la raíz del repo (vitest corre desde ahí); import.meta.url no sirve en jsdom.
const MIGRATION_SQL_PATH = path.resolve(
  process.cwd(),
  "prisma/migrations/0022_availability_rules/migration.sql",
);
const BACKFILL_RUN_NAME = "backfill-availability-rules-v1";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasDatabase = Boolean(databaseUrl) && process.env.ENABLE_INTEGRATION_DB === "1";

// Este test borra y reinserta datos. Se niega a correr contra cualquier base que no sea de pruebas.
if (hasDatabase && !/\/appointments_test(\?|$)/.test(databaseUrl)) {
  throw new Error("availability-backfill integration test only runs against a *_test database");
}

const integrationSuite = hasDatabase ? describe : describe.skip;

const LEGACY_SLOT_MODE_COLUMN_SQL =
  "ALTER TABLE `active_months` ADD COLUMN `slot_mode` ENUM('BLOCK_MODE', 'SECOND_ONLY_MODE') NOT NULL DEFAULT 'BLOCK_MODE' AFTER `status`";
let addedLegacySlotModeColumn = false;

async function ensureLegacySlotModeColumn() {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'active_months' AND COLUMN_NAME = 'slot_mode'",
  );

  if (Number(rows[0]?.total ?? 0) === 0) {
    await prisma.$executeRawUnsafe(LEGACY_SLOT_MODE_COLUMN_SQL);
    addedLegacySlotModeColumn = true;
  }
}

async function dropLegacySlotModeColumn() {
  if (addedLegacySlotModeColumn) {
    await prisma.$executeRawUnsafe("ALTER TABLE `active_months` DROP COLUMN `slot_mode`");
    addedLegacySlotModeColumn = false;
  }
}

function loadBackfillStatements() {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const begin = sql.indexOf("-- BACKFILL:BEGIN");
  const end = sql.indexOf("-- BACKFILL:END");

  if (begin < 0 || end < 0) {
    throw new Error("BACKFILL markers not found in migration 0022");
  }

  return sql
    .slice(begin, end)
    .split("\n")
    .filter((line) => !/^\s*(START TRANSACTION|COMMIT);\s*$/.test(line))
    .join("\n")
    .split(/;\s*\n/)
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

async function runBackfill() {
  const statements = loadBackfillStatements();

  await prisma.$transaction(async (tx) => {
    for (const statement of statements) {
      await tx.$executeRawUnsafe(statement);
    }
  });
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function hhmm(value: Date) {
  return value.toISOString().slice(11, 16);
}

async function seedSampleMonths() {
  await prisma.activeMonth.deleteMany(); // cascada a reglas y excepciones
  await prisma.availabilityMigrationRun.deleteMany();

  await prisma.activeMonth.createMany({
    data: [
      { month: "2026-12", status: "ACTIVE" },
      { month: "2027-01", status: "ACTIVE" },
    ],
  });
  // slot_mode es la columna legada: se fija por SQL porque el cliente Prisma ya no la conoce.
  await prisma.$executeRawUnsafe("UPDATE active_months SET slot_mode = 'SECOND_ONLY_MODE' WHERE month = '2027-01'");
}

async function readRuleSnapshot() {
  const rules = await prisma.availabilityRule.findMany({
    orderBy: [{ activeMonthId: "asc" }, { id: "asc" }],
    include: {
      weekdays: { orderBy: { weekday: "asc" } },
      times: { orderBy: { timeSlot: "asc" } },
    },
  });

  return rules.map((rule) => ({
    id: rule.id,
    activeMonthId: rule.activeMonthId,
    startDate: isoDate(rule.startDate),
    endDate: isoDate(rule.endDate),
    minGapMinutes: rule.minGapMinutes,
    preserveCapacity: rule.preserveCapacity,
    maxPerDay: rule.maxPerDay,
    weekdays: rule.weekdays.map((row) => row.weekday),
    times: rule.times.map((row) => hhmm(row.timeSlot)),
  }));
}

async function readMonthSnapshot() {
  return prisma.$queryRawUnsafe<Array<{ id: number; month: string; slotMode: string; availabilityVersion: number }>>(
    "SELECT id, `month`, slot_mode AS slotMode, availability_version AS availabilityVersion FROM active_months ORDER BY `month` ASC",
  );
}

async function readRunSnapshot() {
  return prisma.availabilityMigrationRun.findMany({
    orderBy: { name: "asc" },
  });
}

async function readAppointmentSnapshot() {
  return prisma.appointment.findMany({
    orderBy: { id: "asc" },
    select: { id: true, date: true, timeSlot: true, status: true, googleEventId: true },
  });
}

integrationSuite("availability backfill integration (migration 0022)", () => {
  beforeAll(async () => {
    await ensureLegacySlotModeColumn();
  });

  beforeEach(async () => {
    // AppointmentLog.appointment es onDelete: Restrict; los logs deben borrarse antes de las citas.
    await prisma.appointmentLog.deleteMany();
    await resetAppointmentsTable();
    await seedSampleMonths();
  });

  afterAll(async () => {
    await resetAppointmentsTable();
    await dropLegacySlotModeColumn();
    await disconnectPrisma();
  });

  it("creates one backfill rule per month according to its slot_mode (D4)", async () => {
    await runBackfill();

    const months = await readMonthSnapshot();
    const rules = await readRuleSnapshot();

    const blockMonth = months.find((month) => month.month === "2026-12");
    const secondOnlyMonth = months.find((month) => month.month === "2027-01");

    expect(blockMonth?.slotMode).toBe("BLOCK_MODE");
    expect(secondOnlyMonth?.slotMode).toBe("SECOND_ONLY_MODE");
    expect(blockMonth?.availabilityVersion).toBe(1);
    expect(secondOnlyMonth?.availabilityVersion).toBe(1);

    const blockRules = rules.filter((rule) => rule.activeMonthId === blockMonth?.id);
    const secondOnlyRules = rules.filter((rule) => rule.activeMonthId === secondOnlyMonth?.id);

    expect(rules).toHaveLength(2);
    expect(blockRules).toEqual([
      expect.objectContaining({
        startDate: "2026-12-01",
        endDate: "2026-12-31",
        minGapMinutes: 240,
        preserveCapacity: true,
        maxPerDay: 3,
        weekdays: [1, 2, 3, 4, 5],
        times: ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
      }),
    ]);
    expect(secondOnlyRules).toEqual([
      expect.objectContaining({
        startDate: "2027-01-01",
        endDate: "2027-01-31",
        minGapMinutes: 0,
        preserveCapacity: false,
        maxPerDay: 3,
        weekdays: [1, 2, 3, 4, 5],
        times: ["10:00", "14:00", "18:00"],
      }),
    ]);

    const runs = await readRunSnapshot();
    expect(runs).toEqual([expect.objectContaining({ name: BACKFILL_RUN_NAME, rowsCreated: 2 })]);
  });

  it("a second run changes no rows and no availability_version (FR-031)", async () => {
    await runBackfill();

    // Simula una edición posterior del editor: la versión ya no es 1 y no debe reiniciarse.
    await prisma.activeMonth.update({
      where: { month: "2026-12" },
      data: { availabilityVersion: 4 },
    });

    const monthsBefore = await readMonthSnapshot();
    const rulesBefore = await readRuleSnapshot();
    const runsBefore = await readRunSnapshot();

    await runBackfill();

    expect(await readMonthSnapshot()).toEqual(monthsBefore);
    expect(await readRuleSnapshot()).toEqual(rulesBefore);
    expect(await readRunSnapshot()).toEqual(runsBefore);
    expect(rulesBefore).toHaveLength(2);
    expect(monthsBefore.find((month) => month.month === "2026-12")?.availabilityVersion).toBe(4);
  });

  it("does not modify appointments (FR-032, SC-004)", async () => {
    const client = await prisma.client.create({
      data: { clientNumber: 9001, name: "Backfill Test", phone: "5500000001" },
    });

    await prisma.appointment.createMany({
      data: [
        {
          clientId: client.id,
          date: new Date("2026-12-09T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T09:00:00.000Z"),
          status: "CONFIRMED",
          googleEventId: "evt-backfill-1",
        },
        {
          clientId: client.id,
          date: new Date("2027-01-12T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T14:00:00.000Z"),
          status: "SYNC_FAILED",
          googleEventId: null,
        },
        {
          clientId: client.id,
          date: new Date("2027-01-13T00:00:00.000Z"),
          timeSlot: new Date("1970-01-01T10:00:00.000Z"),
          status: "CANCELLED",
          googleEventId: "evt-backfill-3",
        },
      ],
    });

    const before = await readAppointmentSnapshot();

    await runBackfill();
    await runBackfill();

    expect(before).toHaveLength(3);
    expect(await readAppointmentSnapshot()).toEqual(before);
  });
});
