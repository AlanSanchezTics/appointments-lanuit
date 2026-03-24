import { Prisma } from "@prisma/client";

import type {
  CreateAdminBlockedSlotsPayload,
  CreateAdminBlockedSlotsResponse,
  GetAdminBlockableSlotsResponse,
} from "@/lib/admin/blocked-spaces/types";
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
  listBlockedSlotsByDateForUpdate,
  listMonthBlockedSlots,
} from "@/lib/db/blocked-slots";
import { prisma } from "@/lib/db/prisma";

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

function buildBlockableDays(params: {
  month: string;
  now: Date;
  baseSlots: readonly string[];
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
      const blockedSlots = params.blockedByDate.get(date) ?? [];

      const slots = getAvailableStartSlotsWithManualBlocks(
        params.baseSlots,
        [...occupiedSlots, ...activeLocks],
        blockedSlots,
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

  if (!isWeekdayBookingDate(input.date)) {
    throw new Error("DATE_NOT_OPERATIONAL");
  }

  if (input.date < getCurrentDateKey(now)) {
    throw new Error("DATE_IN_PAST");
  }

  for (const slot of input.slots) {
    if (!baseSlots.includes(slot)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    if (!isFutureDateTime(input.date, slot, now)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }
  }

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

    if (input.slots.some((slot) => activeLockSlots.includes(slot))) {
      throw new Error("SLOT_LOCKED");
    }

    const availableSlots = getAvailableStartSlotsWithManualBlocks(
      baseSlots,
      [...occupiedSlots, ...activeLockSlots],
      blockedTimeSlots,
    ).filter((slot) => isFutureDateTime(input.date, slot, now));

    if (input.slots.some((slot) => !availableSlots.includes(slot))) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    try {
      await createBlockedSlots(tx, {
        date: input.date,
        slots: input.slots,
        reason: input.reason,
        createdByAdminId: input.createdByAdminId,
      });
    } catch (error) {
      normalizeCreateBlockedSlotError(error);
    }
  });

  return {
    month: input.month,
    date: input.date,
    reason: input.reason,
    totalCreated: input.slots.length,
    blockedSlots: input.slots.map((timeSlot) => ({
      date: input.date,
      timeSlot,
      reason: input.reason,
    })),
  };
}
