import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

import { getBookableMonthConfig } from "@/lib/active-months/service";
import { getAvailableStartSlots } from "@/lib/availability/rules";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
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
import { isFutureDateTime } from "@/lib/datetime/mexico-city";
import { lockReservationSchema, validateBookingRules } from "@/lib/validation/appointment";
import { getWhatsappPhone } from "@/lib/whatsapp/message";

const RESERVATION_LOCK_WINDOW_MINUTES = 10;
const MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS = 15;

type FutureAppointmentInMonth = {
  appointmentId: number;
  date: string;
  timeSlot: string;
};

function computeLockExpiration(now: Date) {
  return new Date(now.getTime() + RESERVATION_LOCK_WINDOW_MINUTES * 60 * 1000);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return {
    monthStart,
    monthEndExclusive,
  };
}

function getNaturalDayDifference(dateA: string, dateB: string) {
  const [yearA, monthA, dayA] = dateA.split("-").map(Number);
  const [yearB, monthB, dayB] = dateB.split("-").map(Number);
  const utcA = Date.UTC(yearA, monthA - 1, dayA);
  const utcB = Date.UTC(yearB, monthB - 1, dayB);
  return Math.abs(Math.floor((utcB - utcA) / (24 * 60 * 60 * 1000)));
}

function hasInsufficientDayGap(
  candidateDate: string,
  futureAppointmentsInMonth: FutureAppointmentInMonth[],
) {
  return futureAppointmentsInMonth.some(
    (appointment) =>
      getNaturalDayDifference(candidateDate, appointment.date)
      < MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS,
  );
}

async function listActiveFutureAppointmentsInMonth(
  tx: Prisma.TransactionClient,
  input: { phone: string; month: string },
  now: Date,
) {
  const { monthStart, monthEndExclusive } = getMonthRange(input.month);
  const appointments = await tx.appointment.findMany({
    where: {
      client: {
        phone: input.phone,
      },
      status: {
        in: ["CONFIRMED", "SYNC_FAILED"],
      },
      date: {
        gte: new Date(`${monthStart}T00:00:00.000Z`),
        lt: new Date(`${monthEndExclusive}T00:00:00.000Z`),
      },
    },
    select: {
      id: true,
      date: true,
      timeSlot: true,
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
  });

  return appointments
    .map((appointment) => ({
      appointmentId: appointment.id,
      date: appointment.date.toISOString().slice(0, 10),
      timeSlot: appointment.timeSlot.toISOString().slice(11, 16),
    }))
    .filter((appointment) =>
      isFutureDateTime(appointment.date, appointment.timeSlot, now),
    ) satisfies FutureAppointmentInMonth[];
}

async function acquireReservationSlotLockCore(rawInput: unknown, now = new Date()) {
  const input = validateBookingRules(lockReservationSchema.parse(rawInput), now);
  const monthConfig = await getBookableMonthConfig(input.date.slice(0, 7), now);
  const baseSlots = resolveBaseSlotsByMonthMode(monthConfig.slotMode);
  const expiresAt = computeLockExpiration(now);

  const result = await prisma.$transaction(async (tx) => {
    await acquireBookingLocks(tx, input.date, input.phone);

    try {
      await cleanupExpiredReservationLocks(tx, now);
      await lockConflictingAppointments(tx, input.date, input.phone);

      const existingClient = await tx.client.findUnique({
        where: {
          phone: input.phone,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const futureAppointmentsInMonth = await listActiveFutureAppointmentsInMonth(
        tx,
        {
          phone: input.phone,
          month: input.date.slice(0, 7),
        },
        now,
      );
      const hasInsufficientGap = hasInsufficientDayGap(
        input.date,
        futureAppointmentsInMonth,
      );

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
      const availableSlots = getAvailableStartSlots(baseSlots, allOccupiedSlots);

      if (!availableSlots.includes(input.timeSlot)) {
        if (lockedSlots.includes(input.timeSlot)) {
          throw new Error("SLOT_LOCKED");
        }

        throw new Error("SLOT_NOT_AVAILABLE");
      }

      const lock = await createReservationLock(tx, {
        date: input.date,
        timeSlot: input.timeSlot,
        phone: input.phone,
        lockToken: randomUUID(),
        expiresAt,
      });

      return {
        lock,
        clientExists: Boolean(existingClient),
        clientName: existingClient?.name,
        futureAppointmentsInMonth,
        canBookAsNewAppointment:
          futureAppointmentsInMonth.length > 0 ? !hasInsufficientGap : false,
        whatsappPhone: getWhatsappPhone(),
      };
    } finally {
      await releaseBookingLocks(tx, input.date, input.phone);
    }
  });

  return {
    lockToken: result.lock.lockToken,
    expiresAt: result.lock.expiresAt,
    clientExists: result.clientExists,
    clientName: result.clientName,
    futureAppointmentsInMonth: result.futureAppointmentsInMonth,
    canBookAsNewAppointment: result.canBookAsNewAppointment,
    whatsappPhone: result.whatsappPhone,
  };
}

export async function acquireReservationSlotLock(rawInput: unknown, now = new Date()) {
  const result = await acquireReservationSlotLockCore(rawInput, now);

  return {
    lockToken: result.lockToken,
    expiresAt: result.expiresAt,
  };
}

export async function checkClientAndAcquireReservationSlotLock(rawInput: unknown, now = new Date()) {
  return acquireReservationSlotLockCore(rawInput, now);
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
