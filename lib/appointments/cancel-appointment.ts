import { deleteCalendarEvent } from "@/lib/calendar/google";
import { listBookableMonths } from "@/lib/active-months/service";
import { APPOINTMENT_IS_COMING_SOON } from "@/lib/cancel/error-codes";
import { isWebCancellationWindowAllowed } from "@/lib/cancel/rules";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import { findCancelableFutureAppointmentsByIdsForUpdate } from "@/lib/db/appointments";
import type { PersistedAppointment } from "@/lib/db/appointments";
import { prisma } from "@/lib/db/prisma";
import { cancelSchema } from "@/lib/validation/cancel";

export async function cancelAppointment(rawInput: unknown, now = new Date()) {
  const input = cancelSchema.parse(rawInput);
  const currentDate = getCurrentDateKey(now);
  const activeMonths = await listBookableMonths(now);
  const selectedIds = Array.from(new Set(input.appointmentIds));

  const appointments = await prisma.$transaction(async (tx) => {
    const lockedAppointments: PersistedAppointment[] = [];

    for (const month of activeMonths) {
      const { monthStart, monthEndExclusive } = getMonthRange(month);
      const monthAppointments = await findCancelableFutureAppointmentsByIdsForUpdate(
        tx,
        selectedIds,
        input.phone,
        currentDate,
        monthStart,
        monthEndExclusive,
      );
      lockedAppointments.push(...monthAppointments);
    }

    const appointmentById = new Map(
      lockedAppointments.map((appointment) => [appointment.id, appointment]),
    );
    const resolvedAppointments = selectedIds.map((id) => appointmentById.get(id));

    if (resolvedAppointments.some((appointment) => !appointment)) {
      throw new Error("APPOINTMENT_NOT_FOUND");
    }

    const eligibleAppointments = resolvedAppointments as typeof lockedAppointments;
    if (
      eligibleAppointments.some(
        (appointment) => !isWebCancellationWindowAllowed(appointment, now),
      )
    ) {
      throw new Error(APPOINTMENT_IS_COMING_SOON);
    }

    await tx.appointment.updateMany({
      where: {
        id: {
          in: eligibleAppointments.map((appointment) => appointment.id),
        },
      },
      data: {
        status: "CANCELLED",
      },
    });

    return eligibleAppointments;
  });

  const cancelledAppointments: Array<{
    appointmentId: number;
    status: "CANCELLED";
    syncReason?: "CALENDAR_DELETE_FAILED";
  }> = [];
  for (const appointment of appointments) {
    if (!appointment.googleEventId) {
      cancelledAppointments.push({
        appointmentId: appointment.id,
        status: "CANCELLED" as const,
      });
      continue;
    }

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
      cancelledAppointments.push({
        appointmentId: appointment.id,
        status: "CANCELLED" as const,
      });
    } catch {
      cancelledAppointments.push({
        appointmentId: appointment.id,
        status: "CANCELLED" as const,
        syncReason: "CALENDAR_DELETE_FAILED" as const,
      });
    }
  }

  return {
    cancelledAppointments,
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
