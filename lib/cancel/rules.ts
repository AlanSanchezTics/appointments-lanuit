const HOURS_TO_ALLOW_WEB_CANCELLATION = 24;
const MS_PER_HOUR = 1000 * 60 * 60;

export function getHoursUntilAppointment(
  appointment: { date: string; timeSlot: string },
  now: Date,
) {
  const appointmentDateTime = new Date(
    `${appointment.date}T${appointment.timeSlot}:00.000Z`,
  );
  return (appointmentDateTime.getTime() - now.getTime()) / MS_PER_HOUR;
}

export function isWebCancellationWindowAllowed(
  appointment: { date: string; timeSlot: string },
  now: Date,
) {
  return getHoursUntilAppointment(appointment, now) >= HOURS_TO_ALLOW_WEB_CANCELLATION;
}

