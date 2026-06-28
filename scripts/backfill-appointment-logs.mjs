import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const ALLOWED_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "SYNC_FAILED",
  "CANCELLED",
  "REJECTED",
]);

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

function parseInteger(value, name) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new Error(`INVALID_${name.toUpperCase()}`);
  }

  return parsed;
}

function parseCutoff(value) {
  if (!value) {
    throw new Error("MISSING_CUTOFF");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_CUTOFF");
  }

  return parsed;
}

function actionDateForAppointment(appointment) {
  if (normalizeStatus(appointment.status) === "PENDING") {
    return appointment.createdAt;
  }

  return appointment.updatedAt;
}

function mapStatusToActionType(status) {
  switch (normalizeStatus(status)) {
    case "PENDING":
      return "PENDING";
    case "CONFIRMED":
      return "CONFIRMED";
    case "SYNC_FAILED":
      return "CONFIRMED";
    case "CANCELLED":
      return "CANCELLED";
    case "REJECTED":
      return "REJECTED";
    default:
      throw new Error(`UNSUPPORTED_STATUS_${String(status)}`);
  }
}

function normalizeStatus(status) {
  return String(status).trim().toUpperCase();
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node --env-file-if-exists=.env scripts/backfill-appointment-logs.mjs [options]",
      "",
      "Options:",
      "  --cutoff=2026-06-28T12:00:00-06:00   Only backfill appointments created before this timestamp.",
      "  --batch=500                           Batch size for reads/writes.",
      "  --apply                               Insert rows (default is dry-run).",
      "",
      "Notes:",
      "  - Actor defaults to SYSTEM.",
      "  - Appointments that already have at least one log row are skipped.",
      "  - PENDING uses createdAt as action timestamp; other statuses use updatedAt.",
    ].join("\n"),
  );
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printUsage();
    return;
  }

  const cutoff = parseCutoff(getArg("cutoff", process.env.APPOINTMENT_LOGS_BACKFILL_CUTOFF));
  const batchSize = parseInteger(getArg("batch", "500"), "batch");
  const applyFlag = hasFlag("apply");
  const dryRun = !applyFlag;

  const prisma = new PrismaClient();

  try {
    let lastId = 0;
    let scanned = 0;
    let skippedAlreadyLogged = 0;
    let prepared = 0;
    let inserted = 0;
    const byStatus = {
      PENDING: 0,
      CONFIRMED: 0,
      SYNC_FAILED: 0,
      CANCELLED: 0,
      REJECTED: 0,
    };

    while (true) {
      const appointments = await prisma.appointment.findMany({
        where: {
          id: {
            gt: lastId,
          },
          createdAt: {
            lt: cutoff,
          },
          status: {
            in: [...ALLOWED_STATUSES],
          },
        },
        orderBy: {
          id: "asc",
        },
        take: batchSize,
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          clientId: true,
        },
      });

      if (appointments.length === 0) {
        break;
      }

      scanned += appointments.length;
      lastId = appointments[appointments.length - 1].id;

      const existingRows = await prisma.appointmentLog.findMany({
        where: {
          appointmentId: {
            in: appointments.map((appointment) => appointment.id),
          },
        },
        select: {
          appointmentId: true,
        },
      });

      const existingAppointmentIds = new Set(existingRows.map((row) => row.appointmentId));
      const payload = appointments
        .filter((appointment) => !existingAppointmentIds.has(appointment.id))
        .map((appointment) => {
          const normalizedStatus = normalizeStatus(appointment.status);
          const actionType = mapStatusToActionType(normalizedStatus);
          const createdAt = actionDateForAppointment(appointment);

          byStatus[normalizedStatus] += 1;
          prepared += 1;

          return {
            appointmentId: appointment.id,
            actionType,
            actorType: "SYSTEM",
            clientId: appointment.clientId,
            createdAt,
          };
        });

      skippedAlreadyLogged += appointments.length - payload.length;

      if (dryRun) {
        continue;
      }

      if (payload.length > 0) {
        const result = await prisma.appointmentLog.createMany({
          data: payload,
        });

        inserted += result.count;
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? "dry-run" : "apply",
          cutoff: cutoff.toISOString(),
          batchSize,
          scanned,
          prepared,
          inserted,
          skippedAlreadyLogged,
          byStatus,
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

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { actionDateForAppointment, mapStatusToActionType, normalizeStatus };
