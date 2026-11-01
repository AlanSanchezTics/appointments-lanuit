import { Prisma } from "@prisma/client";
import { createCalendarEvent, deleteCalendarEvent, GoogleCalendarConfigError } from "@/lib/calendar/google";
import type {
  AdminAppointmentTransitionResponse,
  AdminCancelAppointmentPayload,
  AdminCancelAppointmentResponse,
  AdminCreateAppointmentPayload,
  AdminCreateAppointmentResponse,
  AdminDayAgendaResponse,
  AdminRescheduleAppointmentPayload,
  AdminRescheduleAppointmentResponse,
} from "@/lib/admin/appointments/types";
import { splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";
import { resolveDay } from "@/lib/availability/resolver";
import { findMonthAvailability, findMonthAvailabilityForShare } from "@/lib/db/availability-rules";
import { findRegisteredMonth } from "@/lib/db/admin-months";
import {
  listActiveAppointmentSlotsByDateForUpdate,
  cancelAppointmentById,
  findActiveAppointmentByIdInMonthForUpdate,
  listActiveAppointmentsByDate,
  listBlockingAppointmentsByDate,
  listActiveAppointmentsByDateExcludingForUpdate,
  updateAppointmentScheduleById,
} from "@/lib/db/admin-appointments";
import {
  acquireBookingLocks,
  cleanupExpiredReservationLocks,
  findActiveReservationLockForSlotForUpdate,
  listMonthActiveReservationLocks,
  lockConflictingAppointments,
  releaseBookingLocks,
} from "@/lib/db/appointments";
import {
  listBlockedSlotsByDate,
  listBlockedSlotsByDateForUpdate,
} from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import { validateBookingRules, bookingSchema } from "@/lib/validation/appointment";
import { isFutureDateTime } from "@/lib/datetime/mexico-city";
import { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import { createClientWithUniqueClientNumber } from "@/lib/clients/client-number-service";
import {
  createAppointmentLogEvent,
} from "@/lib/admin/appointment-logs/service";
import type { AppointmentLogActorInput } from "@/lib/admin/appointment-logs/types";
import {
  areEquivalentClientNames,
  normalizeClientAlias,
  resolveClientDisplayName,
} from "@/lib/shared/client-name";

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return {
    monthStart,
    monthEndExclusive,
  };
}

function mapCalendarErrorReason(error: unknown) {
  return error instanceof GoogleCalendarConfigError
    ? "CALENDAR_NOT_CONFIGURED"
    : "CALENDAR_SYNC_FAILED";
}

function dateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeToTimeSlotKey(value: Date) {
  return value.toISOString().slice(11, 16);
}

async function resolveClientForCreate(
  tx: Prisma.TransactionClient,
  input: AdminCreateAppointmentPayload,
) {
  if ("clientId" in input) {
    const client = await tx.client.findUnique({
      where: {
        id: input.clientId,
      },
      select: {
        id: true,
        clientNumber: true,
        name: true,
        alias: true,
        phone: true,
      },
    });

    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    return client;
  }

  const parsed = bookingSchema.parse({
    name: input.client.name,
    phone: input.client.phone,
    date: input.date,
    timeSlot: input.timeSlot,
  });

  const existingClient = await tx.client.findUnique({
    where: {
      phone: parsed.phone,
    },
    select: {
      id: true,
      clientNumber: true,
      name: true,
      alias: true,
      phone: true,
    },
  });

  const client = existingClient
    ?? await createClientWithUniqueClientNumber(tx, {
      phone: parsed.phone,
      name: parsed.name,
      preferredClientNumber: input.client.clientNumber,
      alias: normalizeClientAlias(input.client.alias),
    });

  if (!areEquivalentClientNames(client.name, parsed.name)) {
    throw new Error("CLIENT_NAME_MISMATCH");
  }

  return client;
}

// FR-016: horarios ofrecibles con el resolvedor. "00:00" en bloqueos es día completo (D55), no una hora.
// D46: un día sin horarios deja la lista vacía, así que la hora pedida responde SLOT_NOT_AVAILABLE.
function resolveOfferedSlots(input: {
  config: MonthAvailabilityConfig;
  date: string;
  now: Date;
  occupiedSlots: readonly string[];
  blockedTimeSlots: readonly string[];
  lockedSlots?: readonly string[];
}) {
  const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(input.blockedTimeSlots);

  return resolveDay(input.config, input.date, {
    now: input.now,
    occupancy: {
      occupiedTimes: [...input.occupiedSlots, ...(input.lockedSlots ?? [])],
      blockedTimes: Array.from(blockedSlots),
      fullDayBlocked: hasFullDayBlock,
    },
  }).slots;
}

// Teléfono del dueño de una cita activa del mes, sin bloqueo. Solo para elegir las claves de los locks antes de tomarlos (D63).
async function findAppointmentOwnerPhone(appointmentId: number, monthStart: string, monthEndExclusive: string) {
  const row = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    select: {
      client: {
        select: {
          phone: true,
        },
      },
    },
  });

  return row?.client.phone ?? null;
}

export async function getAdminDayAgenda(input: {
  month: string;
  date: string;
  excludeAppointmentId?: number;
}, now = new Date()): Promise<AdminDayAgendaResponse & { availableSlots: string[] }> {
  const config = await findMonthAvailability(input.month);

  if (!config) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const nextDate = new Date(new Date(`${input.date}T00:00:00.000Z`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [appointments, blockingAppointments, blockedSlots, locks] = await Promise.all([
    listActiveAppointmentsByDate(input.date),
    listBlockingAppointmentsByDate(input.date),
    listBlockedSlotsByDate(input.date),
    listMonthActiveReservationLocks(input.date, nextDate, now),
  ]);

  // PD-09/A-07: horarios para reagendar, sin la cita que se reprograma. Locks cuentan como ocupados (flujo público, A-05).
  // D68: PENDING ocupa horario igual que en el flujo público; la lista visible sigue sin PENDING.
  const availableSlots = resolveOfferedSlots({
    config,
    date: input.date,
    now,
    occupiedSlots: blockingAppointments
      .filter((appointment) => appointment.id !== input.excludeAppointmentId)
      .map((appointment) => appointment.timeSlot),
    blockedTimeSlots: blockedSlots.map((blockedSlot) => blockedSlot.timeSlot),
    lockedSlots: locks.filter((lock) => lock.date === input.date).map((lock) => lock.timeSlot),
  });

  return {
    month: input.month,
    date: input.date,
    availableSlots,
    total: appointments.length,
    appointments: appointments.map((appointment) => ({
      appointmentId: appointment.id,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: appointment.status,
      name: resolveClientDisplayName(appointment),
      alias: appointment.alias,
      phone: appointment.phone,
    })),
    blockedSlots: blockedSlots.map((blockedSlot) => ({
      blockedSlotId: blockedSlot.id,
      date: blockedSlot.date,
      timeSlot: blockedSlot.timeSlot,
      reason: blockedSlot.reason,
    })),
  };
}

export async function createAdminAppointment(
  input: AdminCreateAppointmentPayload,
  now = new Date(),
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminCreateAppointmentResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  // Admins may book in INACTIVE months; only the public flow requires ACTIVE.
  validateBookingRules(
    {
      date: input.date,
      timeSlot: input.timeSlot,
    },
    now,
  );

  const created = await prisma.$transaction(async (tx) => {
    const resolvedClient = await resolveClientForCreate(tx, input);
    const lockPhone = resolvedClient.phone;

    try {
      await acquireBookingLocks(tx, input.date, lockPhone);

      // D63 / PD-08: reglas con FOR SHARE antes de los conflictos y de la fila de horarios.
      const config = await findMonthAvailabilityForShare(tx, input.month);

      if (!config) {
        throw new Error("MONTH_NOT_REGISTERED");
      }

      // D89: conflictos de citas antes de la limpieza de RL.
      await lockConflictingAppointments(tx, input.date, lockPhone);
      await cleanupExpiredReservationLocks(tx, input.date, now);

      const activeLock = await findActiveReservationLockForSlotForUpdate(tx, {
        date: input.date,
        timeSlot: input.timeSlot,
        phone: resolvedClient.phone,
        now,
      });

      // NB-4: el SQL ya excluye los locks del mismo teléfono (phone <>), así que activeLock es siempre ajeno.
      if (activeLock) {
        throw new Error("SLOT_LOCKED");
      }

      // D77: ocupación con lectura bloqueante. resolveClientForCreate ya fijó un snapshot antes de los locks,
      // así que una lectura plana no vería una reserva pública confirmada mientras esta transacción esperaba.
      const [occupiedSlots, blockedSlots] = await Promise.all([
        listActiveAppointmentSlotsByDateForUpdate(tx, input.date),
        listBlockedSlotsByDateForUpdate(tx, input.date),
      ]);
      const blockedTimeSlots = blockedSlots.map((slot) => slot.timeSlot);
      const offeredSlots = resolveOfferedSlots({
        config,
        date: input.date,
        now,
        occupiedSlots,
        blockedTimeSlots,
      });

      if (!offeredSlots.includes(input.timeSlot)) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      const appointment = await tx.appointment.create({
        data: {
          clientId: resolvedClient.id,
          date: new Date(`${input.date}T00:00:00.000Z`),
          timeSlot: new Date(`1970-01-01T${input.timeSlot}:00.000Z`),
          status: "CONFIRMED",
        },
        select: {
          id: true,
        },
      });

      await createAppointmentLogEvent(tx, {
        appointmentId: appointment.id,
        actionType: "CONFIRMED",
        actor,
        clientId: resolvedClient.id,
        payload: {
          appointment: {
            date: input.date,
            timeSlot: input.timeSlot,
          },
        },
      });

      return {
        appointmentId: appointment.id,
        client: resolvedClient,
      };
    } finally {
      await releaseBookingLocks(tx, input.date, lockPhone);
    }
  });

  const syncResult = await syncAppointmentToCalendar({
    appointmentId: created.appointmentId,
    name: created.client.name,
    date: input.date,
    timeSlot: input.timeSlot,
  });
  const syncReason =
    syncResult.status === "SYNC_FAILED"
      ? syncResult.reason
      : undefined;

  return {
    appointmentId: created.appointmentId,
    date: input.date,
    timeSlot: input.timeSlot,
    status: syncResult.status,
    syncReason,
    client: {
      clientId: created.client.id,
      clientNumber: created.client.clientNumber,
      name: created.client.name,
      alias: created.client.alias,
      phone: created.client.phone,
    },
  };
}

async function syncRescheduledAppointment(input: {
  appointmentId: number;
  name: string;
  date: string;
  timeSlot: string;
  previousGoogleEventId: string | null;
}): Promise<AdminRescheduleAppointmentResponse> {
  if (input.previousGoogleEventId) {
    try {
      await deleteCalendarEvent(input.previousGoogleEventId);
    } catch {
      // non-blocking: we still try to recreate the event for the new slot
    }
  }

  try {
    const googleEventId = await createCalendarEvent({
      name: input.name,
      date: input.date,
      timeSlot: input.timeSlot,
    });

    await prisma.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        googleEventId,
        status: "CONFIRMED",
      },
    });

    return {
      appointmentId: input.appointmentId,
      date: input.date,
      timeSlot: input.timeSlot,
      status: "CONFIRMED",
    };
  } catch (error) {
    await prisma.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        googleEventId: null,
        status: "SYNC_FAILED",
      },
    });

    return {
      appointmentId: input.appointmentId,
      date: input.date,
      timeSlot: input.timeSlot,
      status: "SYNC_FAILED",
      syncReason: mapCalendarErrorReason(error),
    };
  }
}

export async function rescheduleAdminAppointment(
  appointmentId: number,
  input: AdminRescheduleAppointmentPayload,
  now = new Date(),
): Promise<AdminRescheduleAppointmentResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  validateBookingRules(
    {
      date: input.date,
      timeSlot: input.timeSlot,
    },
    now,
  );

  const { monthStart, monthEndExclusive } = getMonthRange(input.month);
  const ownerPhone = await findAppointmentOwnerPhone(appointmentId, monthStart, monthEndExclusive);

  if (!ownerPhone) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const updated = await prisma.$transaction(async (tx) => {
    // D63 / PD-08, mismo orden que la creación admin y la reprogramación pública:
    // named locks (fecha, teléfono) → FOR SHARE de reglas → conflictos del día → fila de la cita.
    // NB-2 (D65): los locks van dentro del try para que el finally los libere si fallan a medio tomar.
    try {
      await acquireBookingLocks(tx, input.date, ownerPhone);

      const config = await findMonthAvailabilityForShare(tx, input.month);

      if (!config) {
        throw new Error("MONTH_NOT_REGISTERED");
      }

      // D89: conflictos de citas antes de la limpieza de RL.
      await lockConflictingAppointments(tx, input.date, ownerPhone);
      await cleanupExpiredReservationLocks(tx, input.date, now);

      const current = await findActiveAppointmentByIdInMonthForUpdate(tx, {
        appointmentId,
        monthStart,
        monthEndExclusive,
      });

      // La cita debe seguir siendo la misma persona que bloqueamos; si cambió, no se mueve.
      if (!current || current.phone !== ownerPhone) {
        throw new Error("APPOINTMENT_NOT_FOUND");
      }

      if (!isFutureDateTime(current.date, current.timeSlot, now)) {
        throw new Error("APPOINTMENT_NOT_EDITABLE");
      }

      const activeLock = await findActiveReservationLockForSlotForUpdate(tx, {
        date: input.date,
        timeSlot: input.timeSlot,
        phone: current.phone,
        now,
      });

      // NB-4: el SQL ya excluye los locks del mismo teléfono (phone <>), así que activeLock es siempre ajeno.
      if (activeLock) {
        throw new Error("SLOT_LOCKED");
      }

      const [occupiedSlots, blockedSlots] = await Promise.all([
        listActiveAppointmentsByDateExcludingForUpdate(tx, {
          date: input.date,
          excludeAppointmentId: current.id,
        }),
        listBlockedSlotsByDateForUpdate(tx, input.date),
      ]);

      const offeredSlots = resolveOfferedSlots({
        config,
        date: input.date,
        now,
        occupiedSlots,
        blockedTimeSlots: blockedSlots.map((blockedSlot) => blockedSlot.timeSlot),
      });

      if (!offeredSlots.includes(input.timeSlot)) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      await updateAppointmentScheduleById(tx, {
        appointmentId,
        date: input.date,
        timeSlot: input.timeSlot,
      });

      return {
        appointmentId: current.id,
        name: current.name,
        date: input.date,
        timeSlot: input.timeSlot,
        previousGoogleEventId: current.googleEventId,
      };
    } finally {
      await releaseBookingLocks(tx, input.date, ownerPhone);
    }
  });

  return syncRescheduledAppointment(updated);
}

export async function cancelAdminAppointment(
  appointmentId: number,
  input: AdminCancelAppointmentPayload,
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminCancelAppointmentResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const { monthStart, monthEndExclusive } = getMonthRange(input.month);

  const appointment = await prisma.$transaction(async (tx) => {
    const current = await findActiveAppointmentByIdInMonthForUpdate(tx, {
      appointmentId,
      monthStart,
      monthEndExclusive,
    });

    if (!current) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    await cancelAppointmentById(tx, current.id);

    await createAppointmentLogEvent(tx, {
      appointmentId: current.id,
      actionType: "CANCELLED",
      actor,
      clientId: current.clientId,
      payload: {
        appointment: {
          date: current.date,
          timeSlot: current.timeSlot,
        },
      },
    });

    return current;
  });

  if (appointment.googleEventId) {
    try {
      await deleteCalendarEvent(appointment.googleEventId);

      await prisma.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          googleEventId: null,
        },
      });
    } catch {
      return {
        appointmentId: appointment.id,
        status: "CANCELLED",
        syncReason: "CALENDAR_DELETE_FAILED",
      };
    }
  }

  return {
    appointmentId: appointment.id,
    status: "CANCELLED",
  };
}

async function transitionPendingAppointment(
  tx: Prisma.TransactionClient,
  input: {
    appointmentId: number;
    nextStatus: "CONFIRMED" | "REJECTED";
    actor: AppointmentLogActorInput;
  },
): Promise<
  AdminAppointmentTransitionResponse & {
    syncInput?: {
      name: string;
      date: string;
      timeSlot: string;
    };
  }
> {
  // N-1: bloqueo de la fila antes de leer (la fila de la cita va al final del orden de bloqueos). Una reprogramación
  // pública concurrente espera al commit, y syncInput sale de esta lectura bloqueada, no de una previa sin bloqueo.
  const [locked] = await tx.$queryRaw<
    Array<{
      id: number;
      status: string;
      date: Date;
      time_slot: Date;
      client_id: number;
      client_number: number;
      name: string;
      alias: string | null;
      phone: string;
    }>
  >`
    SELECT a.id, a.status, a.date, a.time_slot, c.id AS client_id, c.client_number, c.name, c.alias, c.phone
    FROM appointments a
    INNER JOIN clients c
      ON c.id = a.client_id
    WHERE a.id = ${input.appointmentId}
    FOR UPDATE
  `;

  const current = locked
    ? {
        id: locked.id,
        status: locked.status,
        date: locked.date,
        timeSlot: locked.time_slot,
        client: {
          id: locked.client_id,
          clientNumber: locked.client_number,
          name: locked.name,
          alias: locked.alias,
          phone: locked.phone,
        },
      }
    : null;

  if (!current) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  if (current.status !== "PENDING") {
    throw new Error("APPOINTMENT_STATUS_INVALID_TRANSITION");
  }

  const updated = await tx.appointment.updateMany({
    where: {
      id: input.appointmentId,
      status: "PENDING",
    },
    data: {
      status: input.nextStatus,
    },
  });

  if (updated.count === 0) {
    throw new Error("APPOINTMENT_STATUS_INVALID_TRANSITION");
  }

  const response: AdminAppointmentTransitionResponse & {
    syncInput?: {
      name: string;
      date: string;
      timeSlot: string;
    };
  } = {
    appointmentId: input.appointmentId,
    status: input.nextStatus,
  };

  if (input.nextStatus === "CONFIRMED") {
    response.syncInput = {
      name: current.client.name,
      date: dateToDateKey(current.date),
      timeSlot: timeToTimeSlotKey(current.timeSlot),
    };
  }

  await createAppointmentLogEvent(tx, {
    appointmentId: current.id,
    actionType: input.nextStatus,
    actor: input.actor,
    clientId: current.client.id,
    payload: {
      appointment: {
        date: dateToDateKey(current.date),
        timeSlot: timeToTimeSlotKey(current.timeSlot),
      },
    },
  });

  return response;
}

export async function confirmPendingAppointment(
  appointmentId: number,
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminAppointmentTransitionResponse> {
  const transitioned = await prisma.$transaction(async (tx) =>
    transitionPendingAppointment(tx, {
      appointmentId,
      nextStatus: "CONFIRMED",
      actor,
    }),
  );

  if (!transitioned.syncInput) {
    return transitioned;
  }

  const syncResult = await syncAppointmentToCalendar({
    appointmentId: transitioned.appointmentId,
    name: transitioned.syncInput.name,
    date: transitioned.syncInput.date,
    timeSlot: transitioned.syncInput.timeSlot,
  });

  if (syncResult.status === "SYNC_FAILED") {
    return {
      appointmentId: transitioned.appointmentId,
      status: "SYNC_FAILED",
      syncReason: syncResult.reason,
    };
  }

  return {
    appointmentId: transitioned.appointmentId,
    status: "CONFIRMED",
  };
}

export async function rejectPendingAppointment(
  appointmentId: number,
  actor: AppointmentLogActorInput = {
    type: "SYSTEM",
  },
): Promise<AdminAppointmentTransitionResponse> {
  return prisma.$transaction(async (tx) =>
    transitionPendingAppointment(tx, {
      appointmentId,
      nextStatus: "REJECTED",
      actor,
    }),
  );
}
