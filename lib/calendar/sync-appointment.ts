import { GoogleCalendarConfigError, createCalendarEvent } from "@/lib/calendar/google";
import { prisma } from "@/lib/db/prisma";

type SyncAppointmentToCalendarResult =
  | { status: "CONFIRMED" }
  | {
      status: "SYNC_FAILED";
      reason: "CALENDAR_NOT_CONFIGURED" | "CALENDAR_SYNC_FAILED";
    };

export async function syncAppointmentToCalendar(input: {
  appointmentId: number;
  name: string;
  date: string;
  timeSlot: string;
}): Promise<SyncAppointmentToCalendarResult> {
  try {
    const googleEventId = await createCalendarEvent(input);

    await prisma.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        googleEventId,
      },
    });

    return { status: "CONFIRMED" as const };
  } catch (error) {
    await prisma.appointment.update({
      where: {
        id: input.appointmentId,
      },
      data: {
        status: "SYNC_FAILED",
      },
    });

    return {
      status: "SYNC_FAILED" as const,
      reason: error instanceof GoogleCalendarConfigError ? "CALENDAR_NOT_CONFIGURED" : "CALENDAR_SYNC_FAILED",
    };
  }
}
