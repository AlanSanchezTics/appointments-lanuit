import { Prisma } from "@prisma/client";

import type {
  BlockedSlotSyncWarning,
  CreateAdminBlockedSlotsPayload,
  CreateAdminBlockedSlotsResponse,
  DeleteAdminBlockedSlotPayload,
  DeleteAdminBlockedSlotResponse,
  GetAdminBlockableSlotsResponse,
  UpdateAdminBlockedSlotPayload,
  UpdateAdminBlockedSlotResponse,
} from "@/lib/admin/blocked-spaces/types";
import {
  syncBlockedSlotCreate,
  syncBlockedSlotDelete,
  syncBlockedSlotUpdate,
} from "@/lib/calendar/sync-blocked-slot";
import {
  FULL_DAY_BLOCK_TIME_SLOT,
  isFullDayBlockTimeSlot,
  splitBlockedTimeSlots,
} from "@/lib/admin/blocked-spaces/day-block";
import {
  getAvailableStartSlotsWithManualBlocks,
  isWeekdayBookingDate,
} from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import { getCurrentDateKey, getCurrentTimeKey, isFutureDateTime } from "@/lib/datetime/mexico-city";
import { listActiveAppointmentSlotsByDateForUpdate } from "@/lib/db/admin-appointments";
import { findRegisteredMonth } from "@/lib/db/admin-months";
import {
  cleanupExpiredReservationLocks,
  listActiveReservationLocksForDate,
  listMonthActiveReservationLocks,
  listMonthAppointments,
  lockConflictingAppointments,
} from "@/lib/db/appointments";
import {
  createBlockedSlots,
  countBlockedSlotsByGoogleEventId,
  deleteBlockedSlotsByDate,
  deleteBlockedSlotById,
  findBlockedSlotByIdForUpdate,
  listBlockedSlotsByDateForUpdate,
  listMonthBlockedSlots,
  updateBlockedSlotReasonById,
} from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";

type BaseTimeSlot = (typeof BASE_TIME_SLOTS)[number];

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return {
    monthStart,
    monthEndExclusive,
  };
}

function getMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

function buildBlockableDays<T extends string>(params: {
  month: string;
  now: Date;
  baseSlots: readonly T[];
  occupiedByDate: Map<string, string[]>;
  lockByDate: Map<string, string[]>;
  blockedByDate: Map<string, string[]>;
}) {
  const currentDate = getCurrentDateKey(params.now);
  const currentTime = getCurrentTimeKey(params.now);

  return getMonthDays(params.month)
    .filter((date) => date >= currentDate)
    .filter((date) => isWeekdayBookingDate(date))
    .map((date) => {
      const occupiedSlots = params.occupiedByDate.get(date) ?? [];
      const activeLocks = params.lockByDate.get(date) ?? [];
      const blockedTimeSlots = params.blockedByDate.get(date) ?? [];
      const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(blockedTimeSlots);

      if (hasFullDayBlock) {
        return {
          date,
          slots: [] as T[],
        };
      }

      const slots = getAvailableStartSlotsWithManualBlocks(
        params.baseSlots,
        [...occupiedSlots, ...activeLocks],
        Array.from(blockedSlots),
      ).filter((slot) => {
        if (date !== currentDate) {
          return true;
        }

        return slot >= currentTime;
      });

      return {
        date,
        slots,
      };
    })
    .filter((day) => day.slots.length > 0);
}

function normalizeCreateBlockedSlotError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new Error("BLOCKED_SLOT_ALREADY_EXISTS");
  }

  throw error;
}

function assertBlockedSlotBelongsToMonth(date: string, month: string) {
  if (!date.startsWith(`${month}-`)) {
    throw new Error("BLOCKED_SLOT_NOT_FOUND");
  }
}

function assertBlockedSlotIsEditable(date: string, timeSlot: string, now: Date) {
  if (isFullDayBlockTimeSlot(timeSlot)) {
    throw new Error("BLOCKED_SLOT_NOT_EDITABLE");
  }

  if (!isFutureDateTime(date, timeSlot, now)) {
    throw new Error("BLOCKED_SLOT_NOT_EDITABLE");
  }
}

function toBaseTimeSlot(timeSlot: string): BaseTimeSlot {
  if (BASE_TIME_SLOTS.includes(timeSlot as BaseTimeSlot)) {
    return timeSlot as BaseTimeSlot;
  }

  throw new Error("SLOT_NOT_AVAILABLE");
}

function buildSyncSummary(input: {
  total: number;
  warnings: BlockedSlotSyncWarning[];
}) {
  return {
    total: input.total,
    failed: input.warnings.length,
    synced: Math.max(0, input.total - input.warnings.length),
  };
}

export async function getAdminBlockableSlots(
  input: { month: string; date?: string | null },
  now = new Date(),
): Promise<GetAdminBlockableSlotsResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const baseSlots = resolveBaseSlotsByMonthMode(registration.slotMode);
  const { monthStart, monthEndExclusive } = getMonthBounds(input.month);
  const [appointments, locks, blockedSlots] = await Promise.all([
    listMonthAppointments(monthStart, monthEndExclusive),
    listMonthActiveReservationLocks(monthStart, monthEndExclusive, now),
    listMonthBlockedSlots(monthStart, monthEndExclusive),
  ]);

  const occupiedByDate = new Map<string, string[]>();
  const lockByDate = new Map<string, string[]>();
  const blockedByDate = new Map<string, string[]>();

  for (const appointment of appointments) {
    const dayAppointments = occupiedByDate.get(appointment.date) ?? [];
    dayAppointments.push(appointment.timeSlot);
    occupiedByDate.set(appointment.date, dayAppointments);
  }

  for (const lock of locks) {
    const dayLocks = lockByDate.get(lock.date) ?? [];
    dayLocks.push(lock.timeSlot);
    lockByDate.set(lock.date, dayLocks);
  }

  for (const blockedSlot of blockedSlots) {
    const dayBlockedSlots = blockedByDate.get(blockedSlot.date) ?? [];
    dayBlockedSlots.push(blockedSlot.timeSlot);
    blockedByDate.set(blockedSlot.date, dayBlockedSlots);
  }

  const allBlockableDays = buildBlockableDays({
    month: input.month,
    now,
    baseSlots,
    occupiedByDate,
    lockByDate,
    blockedByDate,
  });

  const days = input.date
    ? allBlockableDays.filter((day) => day.date === input.date)
    : allBlockableDays;

  return {
    month: input.month,
    currentDate: getCurrentDateKey(now),
    days,
  };
}

export async function createAdminBlockedSlots(
  input: CreateAdminBlockedSlotsPayload & { createdByAdminId: number | null },
  now = new Date(),
): Promise<CreateAdminBlockedSlotsResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const baseSlots = resolveBaseSlotsByMonthMode(registration.slotMode);
  const baseSlotsSet = new Set<string>(baseSlots);

  if (!isWeekdayBookingDate(input.date)) {
    throw new Error("DATE_NOT_OPERATIONAL");
  }

  if (input.date < getCurrentDateKey(now)) {
    throw new Error("DATE_IN_PAST");
  }

  if (!input.fullDay) {
    for (const slot of input.slots) {
      if (!baseSlotsSet.has(slot)) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      if (!isFutureDateTime(input.date, slot, now)) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }
    }
  }

  let createdBlockedSlots: Awaited<ReturnType<typeof createBlockedSlots>> = [];
  let removedSlotsForFullDay: Array<{ id: number; googleEventId: string | null }> = [];

  await prisma.$transaction(async (tx) => {
    await cleanupExpiredReservationLocks(tx, now);
    await lockConflictingAppointments(tx, input.date, "");

    const [occupiedSlots, activeLocks, blockedSlots] = await Promise.all([
      listActiveAppointmentSlotsByDateForUpdate(tx, input.date),
      listActiveReservationLocksForDate(tx, input.date, now),
      listBlockedSlotsByDateForUpdate(tx, input.date),
    ]);

    const activeLockSlots = activeLocks.map((lock) => lock.timeSlot);
    const blockedTimeSlots = blockedSlots.map((blockedSlot) => blockedSlot.timeSlot);
    const { hasFullDayBlock, blockedSlots: blockedSlotsSet } = splitBlockedTimeSlots(blockedTimeSlots);

    if (input.fullDay) {
      const hasActiveLockInBaseSlot = activeLockSlots.some((slot) =>
        baseSlotsSet.has(slot),
      );

      if (hasActiveLockInBaseSlot) {
        throw new Error("SLOT_LOCKED");
      }

      if (hasFullDayBlock) {
        throw new Error("DAY_ALREADY_BLOCKED");
      }

      const availableSlots = getAvailableStartSlotsWithManualBlocks(
        baseSlots,
        [...occupiedSlots, ...activeLockSlots],
        Array.from(blockedSlotsSet),
      ).filter((slot) => isFutureDateTime(input.date, slot, now));

      if (availableSlots.length === 0) {
        throw new Error("SLOT_NOT_AVAILABLE");
      }

      removedSlotsForFullDay = blockedSlots.map((slot) => ({
        id: slot.id,
        googleEventId: slot.googleEventId,
      }));

      await deleteBlockedSlotsByDate(tx, input.date);

      try {
        createdBlockedSlots = await createBlockedSlots(tx, {
          date: input.date,
          slots: [FULL_DAY_BLOCK_TIME_SLOT],
          reason: input.reason,
          createdByAdminId: input.createdByAdminId,
        });
      } catch (error) {
        normalizeCreateBlockedSlotError(error);
      }

      return;
    }

    if (input.slots.some((slot) => activeLockSlots.includes(slot))) {
      throw new Error("SLOT_LOCKED");
    }

    if (hasFullDayBlock) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    const availableSlots = getAvailableStartSlotsWithManualBlocks(
      baseSlots,
      [...occupiedSlots, ...activeLockSlots],
      Array.from(blockedSlotsSet),
    ).filter((slot) => isFutureDateTime(input.date, slot, now));

    if (input.slots.some((slot) => !availableSlots.includes(slot))) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    try {
      createdBlockedSlots = await createBlockedSlots(tx, {
        date: input.date,
        slots: input.slots,
        reason: input.reason,
        createdByAdminId: input.createdByAdminId,
      });
    } catch (error) {
      normalizeCreateBlockedSlotError(error);
    }
  });

  const syncWarnings: BlockedSlotSyncWarning[] = [];

  for (const removedSlot of removedSlotsForFullDay) {
    const syncResult = await syncBlockedSlotDelete({
      googleEventId: removedSlot.googleEventId,
    });

    if (syncResult.status === "SYNC_FAILED") {
      syncWarnings.push({
        blockedSlotId: removedSlot.id,
        reason: syncResult.reason,
      });
    }
  }

  for (const blockedSlot of createdBlockedSlots) {
    const durationHours = registration.slotMode === "SECOND_ONLY_MODE"
      ? undefined
      : 1;

    const syncResult = await syncBlockedSlotCreate({
      blockedSlotId: blockedSlot.id,
      date: blockedSlot.date,
      timeSlot: blockedSlot.timeSlot,
      reason: blockedSlot.reason,
      durationHours,
    });

    if (syncResult.status === "SYNC_FAILED") {
      syncWarnings.push({
        blockedSlotId: blockedSlot.id,
        reason: syncResult.reason,
      });
    }
  }

  if (input.fullDay) {
    return {
      month: input.month,
      date: input.date,
      fullDay: true,
      reason: input.reason,
      totalCreated: 1,
      blockedSlots: [],
      syncSummary: buildSyncSummary({
        total: removedSlotsForFullDay.length + 1,
        warnings: syncWarnings,
      }),
      syncWarnings,
    };
  }

  return {
    month: input.month,
    date: input.date,
    fullDay: false,
    reason: input.reason,
    totalCreated: input.slots.length,
    blockedSlots: input.slots.map((timeSlot) => ({
      date: input.date,
      timeSlot,
      reason: input.reason,
    })),
    syncSummary: buildSyncSummary({
      total: input.slots.length,
      warnings: syncWarnings,
    }),
    syncWarnings,
  };
}

export async function updateAdminBlockedSlot(
  input: UpdateAdminBlockedSlotPayload,
  now = new Date(),
): Promise<UpdateAdminBlockedSlotResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const result = await prisma.$transaction(async (tx) => {
    const blockedSlot = await findBlockedSlotByIdForUpdate(tx, input.blockedSlotId);

    if (!blockedSlot) {
      throw new Error("BLOCKED_SLOT_NOT_FOUND");
    }

    assertBlockedSlotBelongsToMonth(blockedSlot.date, input.month);
    assertBlockedSlotIsEditable(blockedSlot.date, blockedSlot.timeSlot, now);

    await updateBlockedSlotReasonById(tx, {
      blockedSlotId: input.blockedSlotId,
      reason: input.reason,
    });

    return blockedSlot;
  });

  const syncResult = await syncBlockedSlotUpdate({
    blockedSlotId: input.blockedSlotId,
    date: result.date,
    timeSlot: result.timeSlot,
    reason: input.reason,
    googleEventId: result.googleEventId,
  });
  const syncWarnings: BlockedSlotSyncWarning[] = syncResult.status === "SYNC_FAILED"
    ? [{ blockedSlotId: input.blockedSlotId, reason: syncResult.reason }]
    : [];

  return {
    month: input.month,
    blockedSlotId: input.blockedSlotId,
    date: result.date,
    timeSlot: toBaseTimeSlot(result.timeSlot),
    reason: input.reason,
    syncSummary: buildSyncSummary({
      total: 1,
      warnings: syncWarnings,
    }),
    syncWarnings,
  };
}

export async function deleteAdminBlockedSlot(
  input: DeleteAdminBlockedSlotPayload,
): Promise<DeleteAdminBlockedSlotResponse> {
  const registration = await findRegisteredMonth(input.month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const removedBlockedSlot = await prisma.$transaction(async (tx) => {
    const blockedSlot = await findBlockedSlotByIdForUpdate(tx, input.blockedSlotId);

    if (!blockedSlot) {
      throw new Error("BLOCKED_SLOT_NOT_FOUND");
    }

    assertBlockedSlotBelongsToMonth(blockedSlot.date, input.month);
    await deleteBlockedSlotById(tx, input.blockedSlotId);

    return blockedSlot;
  });

  const shouldDeleteCalendarEvent = removedBlockedSlot.googleEventId
    ? (await countBlockedSlotsByGoogleEventId(removedBlockedSlot.googleEventId)) === 0
    : false;
  const syncResult = await syncBlockedSlotDelete({
    googleEventId: shouldDeleteCalendarEvent ? removedBlockedSlot.googleEventId : null,
  });
  const syncWarnings: BlockedSlotSyncWarning[] = syncResult.status === "SYNC_FAILED"
    ? [{ blockedSlotId: input.blockedSlotId, reason: syncResult.reason }]
    : [];

  return {
    month: input.month,
    blockedSlotId: input.blockedSlotId,
    status: "DELETED",
    syncSummary: buildSyncSummary({
      total: 1,
      warnings: syncWarnings,
    }),
    syncWarnings,
  };
}
