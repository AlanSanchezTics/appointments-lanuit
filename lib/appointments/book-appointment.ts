import { Prisma } from "@prisma/client";

import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { acquireBookingLocks, lockConflictingAppointments, releaseBookingLocks } from "@/lib/db/appointments";
import { prisma } from "@/lib/db/prisma";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { getAvailableStartSlots } from "@/lib/availability/rules";
import { syncAppointmentToCalendar } from "@/lib/calendar/sync-appointment";
import { buildWhatsappUrl } from "@/lib/whatsapp/message";
import { bookingSchema, validateBookingRules } from "@/lib/validation/appointment";

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function timeSlotToDate(timeSlot: string) {
  return new Date(`1970-01-01T${timeSlot}:00.000Z`);
}

export async function bookAppointment(rawInput: unknown, now = new Date()) {
  const input = validateBookingRules(bookingSchema.parse(rawInput), now);
  const currentDate = getCurrentDateKey(now);

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      await acquireBookingLocks(tx, input.date, input.phone);

      try {
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

        const occupiedSlots = occupied.map((item) => item.timeSlot.toISOString().slice(11, 16));
        const availableSlots = getAvailableStartSlots(BASE_TIME_SLOTS, occupiedSlots);

        if (!availableSlots.includes(input.timeSlot)) {
          throw new Error("SLOT_NOT_AVAILABLE");
        }

        return tx.appointment.create({
          data: {
            name: input.name,
            phone: input.phone,
            date: new Date(`${input.date}T00:00:00.000Z`),
            timeSlot: timeSlotToDate(input.timeSlot),
            status: "CONFIRMED",
          },
        });
      } finally {
        await releaseBookingLocks(tx, input.date, input.phone);
      }
    });

    const syncResult = await syncAppointmentToCalendar({
      appointmentId: appointment.id,
      date: input.date,
      name: input.name,
      timeSlot: input.timeSlot,
    });

    return {
      appointmentId: appointment.id,
      status: syncResult.status,
      syncReason: "reason" in syncResult ? syncResult.reason : undefined,
      whatsappUrl: buildWhatsappUrl({
        name: input.name,
        date: input.date,
        timeSlot: input.timeSlot,
      }),
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("SLOT_NOT_AVAILABLE");
    }

    throw error;
  }
}
