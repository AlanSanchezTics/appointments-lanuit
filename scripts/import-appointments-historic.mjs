import fs from "node:fs/promises";

import { PrismaClient } from "@prisma/client";

const ALLOWED_STATUSES = new Set(["CONFIRMED", "CANCELLED", "SYNC_FAILED", "PENDING", "REJECTED"]);

function getArg(name, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));

  if (!arg) {
    return fallback;
  }

  return arg.slice(name.length + 3);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throw new Error(`INVALID_BOOLEAN_FLAG_${value}`);
}

function parseInteger(value, name) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new Error(`INVALID_${name.toUpperCase()}`);
  }

  return parsed;
}

function toDateKey(value) {
  return String(value).slice(0, 10);
}

function toTimeKey(value) {
  return String(value).slice(0, 5);
}

function parseDate(value) {
  return new Date(`${toDateKey(value)}T00:00:00.000Z`);
}

function parseTime(value) {
  return new Date(`1970-01-01T${toTimeKey(value)}:00.000Z`);
}

function parseDateTime(value) {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

function normalizeGoogleEventId(value) {
  if (value === null || value === undefined || value === "NULL" || value === "") {
    return null;
  }

  return String(value);
}

function buildKey(input) {
  return [
    input.clientId,
    input.date.toISOString().slice(0, 10),
    input.timeSlot.toISOString().slice(11, 16),
    input.status,
    input.googleEventId ?? "",
    input.createdAt.toISOString(),
    input.updatedAt.toISOString(),
  ].join("|");
}

function parseRow(row, index) {
  const parsed = {
    clientId: Number(row.client_id),
    date: parseDate(row.date),
    timeSlot: parseTime(row.time_slot),
    status: row.status,
    googleEventId: normalizeGoogleEventId(row.google_event_id),
    createdAt: parseDateTime(row.created_at),
    updatedAt: parseDateTime(row.updated_at),
  };

  const errors = [];

  if (!Number.isInteger(parsed.clientId) || parsed.clientId < 1) {
    errors.push("client_id");
  }

  if (Number.isNaN(parsed.date.getTime())) {
    errors.push("date");
  }

  if (Number.isNaN(parsed.timeSlot.getTime())) {
    errors.push("time_slot");
  }

  if (!ALLOWED_STATUSES.has(String(parsed.status))) {
    errors.push("status");
  }

  if (Number.isNaN(parsed.createdAt.getTime())) {
    errors.push("created_at");
  }

  if (Number.isNaN(parsed.updatedAt.getTime())) {
    errors.push("updated_at");
  }

  return {
    parsed,
    errors,
    index,
    source: row,
  };
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node --env-file-if-exists=.env scripts/import-appointments-historic.mjs [options]",
      "",
      "Options:",
      "  --file=appointments_historic.json",
      "  --batch=200",
      "  --apply                  Insert records (default is dry-run).",
      "  --dry-run=true|false     Explicit dry-run toggle (default true unless --apply).",
      "  --skip-existing=true|false  Skip exact duplicate records already in DB (default true).",
    ].join("\n"),
  );
}

async function getExistingKeys(prisma) {
  const rows = await prisma.appointment.findMany({
    select: {
      clientId: true,
      date: true,
      timeSlot: true,
      status: true,
      googleEventId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return new Set(
    rows.map((row) =>
      buildKey({
        clientId: row.clientId,
        date: row.date,
        timeSlot: row.timeSlot,
        status: row.status,
        googleEventId: row.googleEventId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    ),
  );
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printUsage();
    return;
  }

  const filePath = getArg("file", "appointments_historic.json");
  const batchSize = parseInteger(getArg("batch", "200"), "batch");
  const explicitDryRun = getArg("dry-run", undefined);
  const applyFlag = hasFlag("apply");
  const dryRun = explicitDryRun === undefined ? !applyFlag : parseBoolean(explicitDryRun, true);
  const skipExisting = parseBoolean(getArg("skip-existing", undefined), true);

  if (applyFlag && dryRun) {
    throw new Error("INVALID_FLAGS_APPLY_AND_DRY_RUN");
  }

  const prisma = new PrismaClient();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw);
    const sourceRows = payload.appointments ?? [];

    if (!Array.isArray(sourceRows)) {
      throw new Error("INVALID_SOURCE_FORMAT");
    }

    const parsedRows = sourceRows.map(parseRow);
    const invalidRows = parsedRows.filter((item) => item.errors.length > 0);
    const validRows = parsedRows.filter((item) => item.errors.length === 0).map((item) => item.parsed);

    const uniqueClientIds = [...new Set(validRows.map((row) => row.clientId))];
    const existingClientRows = await prisma.client.findMany({
      where: {
        id: {
          in: uniqueClientIds,
        },
      },
      select: {
        id: true,
      },
    });
    const existingClients = new Set(existingClientRows.map((row) => row.id));
    const missingClientIds = uniqueClientIds.filter((id) => !existingClients.has(id));

    if (missingClientIds.length > 0) {
      throw new Error(`MISSING_CLIENT_IDS_${missingClientIds.slice(0, 20).join(",")}`);
    }

    const existingKeys = skipExisting ? await getExistingKeys(prisma) : new Set();
    const rowsToInsert = [];
    let skippedExisting = 0;

    for (const row of validRows) {
      const key = buildKey(row);

      if (existingKeys.has(key)) {
        skippedExisting += 1;
        continue;
      }

      rowsToInsert.push(row);
      existingKeys.add(key);
    }

    let inserted = 0;

    if (!dryRun && rowsToInsert.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < rowsToInsert.length; index += batchSize) {
          const chunk = rowsToInsert.slice(index, index + batchSize);
          await tx.appointment.createMany({
            data: chunk,
          });
          inserted += chunk.length;
        }
      });
    }

    const totalAfter = await prisma.appointment.count();

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? "dry-run" : "apply",
          filePath,
          batchSize,
          skipExisting,
          sourceRows: sourceRows.length,
          validRows: validRows.length,
          invalidRows: invalidRows.length,
          missingClientIds: missingClientIds.length,
          skippedExisting,
          rowsToInsert: rowsToInsert.length,
          inserted,
          totalAfter,
          invalidSample: invalidRows.slice(0, 5).map((item) => ({
            index: item.index,
            errors: item.errors,
            row: item.source,
          })),
          executedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
