import { findAffectedAppointments } from "@/lib/availability/affected-appointments";
import type { AvailabilityPresetMode } from "@/lib/availability/defaults";
import { normalizeAvailabilityConfig, type AvailabilityExceptionDraft, type AvailabilityRuleDraft } from "@/lib/availability/rules-validation";
import { buildSlotModePresetRules, deriveSlotMode } from "@/lib/availability/slot-mode-derivation";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";
import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import {
  createInactiveMonths,
  countActiveMonthsByYear,
  countFutureAppointmentsByYear,
  countFutureMonthsByYear,
  countInactiveMonthsByYear,
  countPastAppointmentsByYear,
  countPastMonthsByYear,
  listExistingMonths,
  findRegisteredMonth,
  listMonthActiveAppointmentsForAvailability,
  listMonthsByYear,
  updateRegisteredMonthStatus,
  type AppointmentReader,
} from "@/lib/db/admin-months";
import {
  findMonthAvailability,
  findMonthAvailabilityForUpdate,
  replaceMonthAvailability,
  type MonthAvailabilityRecord,
} from "@/lib/db/availability-rules";
import { prisma } from "@/lib/db/prisma";

import type {
  AffectedAppointmentItem,
  CreateAdminMonthsPayload,
  CreateAdminMonthsResponse,
  ActiveMonthStatus,
  MonthAvailabilityResponse,
  MonthsCatalogResponse,
  MonthsCatalogStatus,
  PreviewAvailabilityPayload,
  PreviewAvailabilityResponse,
  SaveAvailabilityPayload,
  UpdateAdminMonthSlotModePayload,
  UpdateAdminMonthSlotModeResponse,
} from "@/lib/admin/months/types";

type GetMonthsCatalogInput = {
  year: number;
  status: MonthsCatalogStatus;
  availableYears: number[];
};

// Lanza cuando hay citas afectadas y el cliente no confirmó (FR-023, D18). Lleva la lista para el cuerpo 409.
export class AffectedAppointmentsConfirmationError extends Error {
  readonly affectedAppointments: AffectedAppointmentItem[];

  constructor(affectedAppointments: AffectedAppointmentItem[]) {
    super("AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED");
    this.name = "AffectedAppointmentsConfirmationError";
    this.affectedAppointments = affectedAppointments;
  }
}

function mapStatusFilter(status: MonthsCatalogStatus) {
  if (status === "ALL") {
    return "ALL" as const;
  }

  return status;
}

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    monthStart: `${month}-01`,
    monthEndExclusive: new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10),
  };
}

function toMonthConfig(record: MonthAvailabilityRecord): MonthAvailabilityConfig {
  return {
    month: record.month,
    rules: record.rules,
    exceptions: record.exceptions,
    availabilityVersion: record.availabilityVersion,
  };
}

function toMonthAvailabilityResponse(record: MonthAvailabilityRecord): MonthAvailabilityResponse {
  return {
    month: record.month,
    availabilityVersion: record.availabilityVersion,
    slotMode: record.slotMode,
    rules: record.rules,
    exceptions: record.exceptions,
    usesDefaultRule: record.rules.length === 0,
  };
}

// Config propuesta con los valores ya normalizados; id no se usa en el cálculo.
function buildProposedConfig(
  month: string,
  input: { rules: AvailabilityRuleDraft[]; exceptions: AvailabilityExceptionDraft[] },
  availabilityVersion: number,
): MonthAvailabilityConfig {
  return {
    month,
    availabilityVersion,
    rules: input.rules.map((rule) => ({ ...rule, id: rule.id ?? 0 })),
    exceptions: input.exceptions.map((exception) => ({ ...exception, id: exception.id ?? 0 })),
  };
}

async function findAffectedAppointmentItems(
  db: AppointmentReader,
  current: MonthAvailabilityConfig,
  proposed: MonthAvailabilityConfig,
  now: Date,
): Promise<AffectedAppointmentItem[]> {
  const { monthStart, monthEndExclusive } = getMonthBounds(current.month);
  const appointments = await listMonthActiveAppointmentsForAvailability(db, monthStart, monthEndExclusive);

  return findAffectedAppointments({ current, proposed, appointments, now }).map((appointment) => ({
    appointmentId: appointment.id,
    date: appointment.date,
    timeSlot: appointment.timeSlot,
    status: appointment.status,
    clientName: appointment.clientName,
  }));
}

export async function getMonthsCatalog(
  input: GetMonthsCatalogInput,
  now = new Date(),
): Promise<MonthsCatalogResponse> {
  const currentMonth = getCurrentMonthKey(now);
  const currentDate = getCurrentDateKey(now);
  const persistenceStatus = mapStatusFilter(input.status);

  const [
    activeMonths,
    inactiveMonths,
    futureMonths,
    pastMonths,
    pastAppointments,
    futureAppointments,
    months,
  ] = await Promise.all([
    countActiveMonthsByYear(input.year),
    countInactiveMonthsByYear(input.year),
    countFutureMonthsByYear(input.year, currentMonth),
    countPastMonthsByYear(input.year, currentMonth),
    countPastAppointmentsByYear(input.year, currentDate),
    countFutureAppointmentsByYear(input.year, currentDate),
    listMonthsByYear(input.year, persistenceStatus),
  ]);

  return {
    filters: {
      year: input.year,
      status: input.status,
      availableYears: input.availableYears,
    },
    metrics: {
      activeMonths,
      inactiveMonths,
      futureMonths,
      pastMonths,
      pastAppointments,
      futureAppointments,
    },
    months,
    total: months.length,
    currentMonth,
    currentDate,
  };
}

// D17: el mes nuevo no crea reglas; sin reglas aplica D6 y slot_mode queda en BLOCK_MODE (default de createInactiveMonths).
export async function createAdminMonths(
  input: CreateAdminMonthsPayload,
): Promise<CreateAdminMonthsResponse> {
  const existingMonths = await listExistingMonths(input.months);
  const existingSet = new Set(existingMonths);
  const monthsToCreate = input.months.filter((month) => !existingSet.has(month));

  await createInactiveMonths(monthsToCreate);

  return {
    createdMonths: monthsToCreate,
    skippedMonths: existingMonths,
    totalCreated: monthsToCreate.length,
    totalSkipped: existingMonths.length,
  };
}

export async function getAvailabilityForMonth(month: string): Promise<MonthAvailabilityResponse> {
  const record = await findMonthAvailability(month);

  if (!record) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  return toMonthAvailabilityResponse(record);
}

// Vista previa sin escritura (FR-023): citas que quedarían fuera del horario propuesto (D35, A-03, A-04).
export async function previewAvailability(
  month: string,
  input: PreviewAvailabilityPayload,
  now = new Date(),
): Promise<PreviewAvailabilityResponse> {
  const record = await findMonthAvailability(month);

  if (!record) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const normalized = normalizeAvailabilityConfig({ month, rules: input.rules, exceptions: input.exceptions });
  const proposed = buildProposedConfig(month, normalized, record.availabilityVersion);
  const affectedAppointments = await findAffectedAppointmentItems(prisma, toMonthConfig(record), proposed, now);

  return {
    affectedCount: affectedAppointments.length,
    affectedAppointments,
  };
}

// PUT availability (PD-05, PD-07, PD-08). Orden: mes (FOR UPDATE) → citas → escritura. Sin appointment_logs (D24).
export async function saveAvailability(
  month: string,
  input: SaveAvailabilityPayload,
  now = new Date(),
): Promise<MonthAvailabilityResponse> {
  const currentMonth = getCurrentMonthKey(now);

  return prisma.$transaction(async (tx) => {
    const current = await findMonthAvailabilityForUpdate(tx, month);

    if (!current) {
      throw new Error("MONTH_NOT_REGISTERED");
    }

    if (month < currentMonth) {
      throw new Error("MONTH_IN_PAST");
    }

    if (current.availabilityVersion !== input.expectedVersion) {
      throw new Error("AVAILABILITY_VERSION_CONFLICT");
    }

    const normalized = normalizeAvailabilityConfig({ month, rules: input.rules, exceptions: input.exceptions });
    const proposed = buildProposedConfig(month, normalized, current.availabilityVersion);
    const affectedAppointments = await findAffectedAppointmentItems(tx, toMonthConfig(current), proposed, now);

    if (affectedAppointments.length > 0 && !input.confirmAffectedAppointments) {
      throw new AffectedAppointmentsConfirmationError(affectedAppointments);
    }

    await replaceMonthAvailability(tx, {
      month,
      expectedVersion: current.availabilityVersion,
      slotMode: deriveSlotMode(proposed.rules, current.slotMode),
      rules: normalized.rules,
      exceptions: normalized.exceptions,
    });

    const updated = await findMonthAvailabilityForUpdate(tx, month);

    if (!updated) {
      throw new Error("MONTH_NOT_REGISTERED");
    }

    return toMonthAvailabilityResponse(updated);
  });
}

// PATCH slot-mode (D16, D33): el preset reemplaza las reglas del mes y conserva las excepciones.
export async function updateAdminMonthSlotMode(
  month: string,
  input: UpdateAdminMonthSlotModePayload,
  now = new Date(),
): Promise<UpdateAdminMonthSlotModeResponse> {
  const currentMonth = getCurrentMonthKey(now);

  return prisma.$transaction(async (tx) => {
    const current = await findMonthAvailabilityForUpdate(tx, month);

    if (!current) {
      throw new Error("MONTH_NOT_REGISTERED");
    }

    if (month < currentMonth) {
      throw new Error("MONTH_IN_PAST");
    }

    if (input.expectedVersion !== undefined && input.expectedVersion !== current.availabilityVersion) {
      throw new Error("AVAILABILITY_VERSION_CONFLICT");
    }

    const presetRules = buildSlotModePresetRules(month, input.slotMode as AvailabilityPresetMode);
    const proposed = buildProposedConfig(
      month,
      { rules: presetRules, exceptions: current.exceptions },
      current.availabilityVersion,
    );
    const affectedAppointments = await findAffectedAppointmentItems(tx, toMonthConfig(current), proposed, now);

    if (affectedAppointments.length > 0 && !input.confirmAffectedAppointments) {
      throw new AffectedAppointmentsConfirmationError(affectedAppointments);
    }

    await replaceMonthAvailability(tx, {
      month,
      expectedVersion: current.availabilityVersion,
      slotMode: deriveSlotMode(presetRules, input.slotMode),
      rules: presetRules,
      exceptions: current.exceptions,
    });

    const updated = await findMonthAvailabilityForUpdate(tx, month);

    if (!updated) {
      throw new Error("MONTH_NOT_REGISTERED");
    }

    return {
      month: updated.month,
      slotMode: updated.slotMode,
      availabilityVersion: updated.availabilityVersion,
    };
  });
}

export async function updateAdminMonthStatus(
  month: string,
  status: ActiveMonthStatus,
  now = new Date(),
) {
  const registration = await findRegisteredMonth(month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const currentMonth = getCurrentMonthKey(now);

  if (month < currentMonth) {
    throw new Error("MONTH_IN_PAST");
  }

  if (registration.status === status) {
    return {
      month: registration.month,
      status: registration.status,
    };
  }

  return updateRegisteredMonthStatus(month, status);
}
