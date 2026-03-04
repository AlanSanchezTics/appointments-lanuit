import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { findActiveAppointmentByPhone } from "@/lib/db/appointments";
import { deleteCalendarEvent } from "@/lib/calendar/google";
import { prisma } from "@/lib/db/prisma";
import { cancelSchema } from "@/lib/validation/cancel";

export async function cancelAppointment(rawInput: unknown, now = new Date()) {
  const input = cancelSchema.parse(rawInput);
  const currentDate = getCurrentDateKey(now);
  const appointment = await findActiveAppointmentByPhone(input.phone, currentDate);

  if (!appointment) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  if (appointment.date <= currentDate) {
    throw new Error("PAST_APPOINTMENT");
  }

  await prisma.appointment.update({
    where: {
      id: appointment.id,
    },
    data: {
      status: "CANCELLED",
      googleEventId: null,
    },
  });

  if (appointment.googleEventId) {
    await deleteCalendarEvent(appointment.googleEventId);
  }

  return {
    appointmentId: appointment.id,
    status: "CANCELLED" as const,
  };
}
