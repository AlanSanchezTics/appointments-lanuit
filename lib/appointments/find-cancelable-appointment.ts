import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import { findConfirmedFutureAppointmentByPhoneInMonth } from "@/lib/db/appointments";
import { cancelLookupSchema } from "@/lib/validation/cancel";

export async function findCancelableAppointment(rawInput: unknown, now = new Date()) {
  const input = cancelLookupSchema.parse(rawInput);
  const currentDate = getCurrentDateKey(now);
  const activeMonth = getCurrentMonthKey(now);
  const { monthStart, monthEndExclusive } = getMonthRange(activeMonth);

  const appointment = await findConfirmedFutureAppointmentByPhoneInMonth(
    input.phone,
    currentDate,
    monthStart,
    monthEndExclusive,
  );

  if (!appointment) {
    throw new Error("APPOINTMENT_NOT_FOUND");
  }

  return {
    appointmentId: appointment.id,
    name: appointment.name,
    phone: appointment.phone,
    date: appointment.date,
    timeSlot: appointment.timeSlot,
    status: "CONFIRMED" as const,
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
