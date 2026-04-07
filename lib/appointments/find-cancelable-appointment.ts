import { listBookableMonths } from "@/lib/active-months/service";
import { APPOINTMENT_IS_COMING_SOON } from "@/lib/cancel/error-codes";
import { isWebCancellationWindowAllowed } from "@/lib/cancel/rules";
import { getCurrentDateKey } from "@/lib/datetime/mexico-city";
import {
  listCancelableFutureAppointmentsByPhoneInMonth,
  type PersistedAppointment,
} from "@/lib/db/appointments";
import { cancelLookupSchema } from "@/lib/validation/cancel";

export async function findCancelableAppointment(rawInput: unknown, now = new Date()) {
  const input = cancelLookupSchema.parse(rawInput);
  const currentDate = getCurrentDateKey(now);
  const activeMonths = await listBookableMonths(now);
  const appointments: PersistedAppointment[] = [];

  for (const month of activeMonths) {
    const { monthStart, monthEndExclusive } = getMonthRange(month);

    const monthAppointments = await listCancelableFutureAppointmentsByPhoneInMonth(
      input.phone,
      currentDate,
      monthStart,
      monthEndExclusive,
    );
    appointments.push(...monthAppointments);
  }

  if (appointments.length === 0) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  const cancelableAppointments = appointments.filter((appointment) =>
    isWebCancellationWindowAllowed(appointment, now),
  );

  if (cancelableAppointments.length === 0) {
    throw new Error(APPOINTMENT_IS_COMING_SOON);
  }

  return {
    appointments: cancelableAppointments.map((appointment) => ({
      appointmentId: appointment.id,
      name: appointment.name,
      phone: appointment.phone,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: appointment.status,
    })),
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
