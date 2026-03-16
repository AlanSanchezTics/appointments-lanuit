import { listBookableMonths } from "@/lib/active-months/service";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { findConfirmedFutureAppointmentByIdForUpdate } from "@/lib/db/appointments";
import { deleteCalendarEvent } from "@/lib/calendar/google";
import { prisma } from "@/lib/db/prisma";
import { cancelSchema } from "@/lib/validation/cancel";

export async function cancelAppointment(rawInput: unknown, now = new Date()) {
  const input = cancelSchema.parse(rawInput);
  const currentDate = getCurrentDateKey(now);
  const activeMonths = await listBookableMonths(now);
  const appointment = await prisma.$transaction(async (tx) => {
    let lockedAppointment = null;

    for (const month of activeMonths) {
      const { monthStart, monthEndExclusive } = getMonthRange(month);

      lockedAppointment = await findConfirmedFutureAppointmentByIdForUpdate(
        tx,
        input.appointmentId,
        input.phone,
        currentDate,
        monthStart,
        monthEndExclusive,
      );

      if (lockedAppointment) {
        break;
      }
    }

    if (!lockedAppointment) {
      throw new Error("APPOINTMENT_NOT_FOUND");
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

function getMonthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return {
    monthStart: start.toISOString().slice(0, 10),
    monthEndExclusive: end.toISOString().slice(0, 10),
  };
}
