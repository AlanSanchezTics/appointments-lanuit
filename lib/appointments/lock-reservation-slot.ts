import { randomUUID } from "node:crypto";

import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { getAvailableStartSlots } from "@/lib/availability/rules";
import { prisma } from "@/lib/db/prisma";
import {
  acquireBookingLocks,
  cleanupExpiredReservationLocks,
  createReservationLock,
  deleteActiveReservationLocksByPhone,
  listActiveReservationLocksForDate,
  lockConflictingAppointments,
  releaseBookingLocks,
} from "@/lib/db/appointments";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { bookingSchema, validateBookingRules } from "@/lib/validation/appointment";

const RESERVATION_LOCK_WINDOW_MINUTES = 10;

function computeLockExpiration(now: Date) {
  return new Date(now.getTime() + RESERVATION_LOCK_WINDOW_MINUTES * 60 * 1000);
}

export async function acquireReservationSlotLock(rawInput: unknown, now = new Date()) {
  const input = validateBookingRules(bookingSchema.parse(rawInput), now);
  const currentDate = getCurrentDateKey(now);
  const expiresAt = computeLockExpiration(now);

  const lock = await prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, input.date, input.phone);

    try {
      await cleanupExpiredReservationLocks(tx, now);
      await lockConflictingAppointments(tx, input.date, input.phone);

      const activeAppointment = await tx.appointment.findFirst({
        where: {
          phone: input.phone,
          status: {
            in: ["CONFIRMED", "SYNC_FAILED"],
          },
          date: {
            gt: new Date(`${currentDate}T00:00:00.000Z`),
          },
        },
        select: {
          id: true,
        },
      });

      if (activeAppointment) {
        throw new Error("PHONE_ALREADY_BOOKED");
      }

      const occupied = await tx.appointment.findMany({
        where: {
          date: new Date(`${input.date}T00:00:00.000Z`),
          status: {
            in: ["CONFIRMED", "SYNC_FAILED"],
          },
        },
        select: {
          timeSlot: true,
        },
      });

      await deleteActiveReservationLocksByPhone(tx, input.phone, now);
      const activeLocks = await listActiveReservationLocksForDate(tx, input.date, now);
      const occupiedSlots = occupied.map((item) => item.timeSlot.toISOString().slice(11, 16));
      const lockedSlots = activeLocks.map((item) => item.timeSlot);
      const allOccupiedSlots = [...occupiedSlots, ...lockedSlots];
      const availableSlots = getAvailableStartSlots(BASE_TIME_SLOTS, allOccupiedSlots);

      if (!availableSlots.includes(input.timeSlot)) {
        if (lockedSlots.includes(input.timeSlot)) {
          throw new Error("SLOT_LOCKED");
        }

        throw new Error("SLOT_NOT_AVAILABLE");
      }

      return createReservationLock(tx, {
        date: input.date,
        timeSlot: input.timeSlot,
        phone: input.phone,
        lockToken: randomUUID(),
        expiresAt,
      });
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return {
    lockToken: lock.lockToken,
    expiresAt: lock.expiresAt,
  };
}

export async function releaseReservationSlotLock(rawInput: unknown) {
  const payload =
    typeof rawInput === "object" && rawInput !== null && "lockToken" in rawInput
      ? (rawInput as { lockToken?: unknown })
      : { lockToken: undefined };

  const lockToken = typeof payload.lockToken === "string" ? payload.lockToken.trim() : "";

  if (!lockToken) {
    throw new Error("LOCK_TOKEN_REQUIRED");
  }

  const deleted = await prisma.reservationLock.deleteMany({
    where: {
      lockToken,
    },
  });

  return {
    released: deleted.count > 0,
  };
}
