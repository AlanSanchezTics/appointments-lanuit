import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { findActiveAppointmentByPhoneForUpdate } from "@/lib/db/appointments";
import { deleteCalendarEvent } from "@/lib/calendar/google";
import { prisma } from "@/lib/db/prisma";
import { cancelSchema } from "@/lib/validation/cancel";

export async function cancelAppointment(rawInput: unknown, now = new Date()) {
  const input = cancelSchema.parse(rawInput);
  const currentDate = getCurrentDateKey(now);
  const appointment = await prisma.$transaction(async (tx) => {
    const lockedAppointment = await findActiveAppointmentByPhoneForUpdate(tx, input.phone, currentDate);

    if (!lockedAppointment) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    if (lockedAppointment.date <= currentDate) {
      throw new Error("PAST_APPOINTMENT");
    }

    await tx.appointment.update({
      where: {
        id: lockedAppointment.id,
      },
      data: {
        status: "CANCELLED",
      },
    });

    return lockedAppointment;
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
        status: "CANCELLED" as const,
        syncReason: "CALENDAR_DELETE_FAILED" as const,
      };
    }
  }

  return {
    appointmentId: appointment.id,
    status: "CANCELLED" as const,
  };
}
