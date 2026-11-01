import { isDateInMonth, resolveDayRule } from "@/lib/availability/day-rule";
import type { MonthAvailabilityConfig } from "@/lib/availability/types";
import { getCurrentDateKey, getCurrentTimeKey } from "@/lib/datetime/mexico-city";

// FR-024 (D35, D40, A-03, A-04): citas que el cambio deja fuera de la rejilla de horas de reglas y excepciones.

const ACTIVE_STATUSES = new Set(["PENDING", "CONFIRMED", "SYNC_FAILED"]);

export type AppointmentForAvailabilityCheck = {
  id: number;
  date: string;
  timeSlot: string;
  status: string;
};

function isInsideGrid(config: MonthAvailabilityConfig, date: string, timeSlot: string) {
  const dayRule = resolveDayRule(config, date);

  // A-04: solo la rejilla de horas del día, sin ocupación, separación ni capacidad.
  return dayRule !== null && dayRule.times.includes(timeSlot);
}

// A-03: solo cuentan las citas que estaban dentro del horario vigente y quedan fuera del propuesto.
export function findAffectedAppointments<T extends AppointmentForAvailabilityCheck>({
  current,
  proposed,
  appointments,
  now,
}: {
  current: MonthAvailabilityConfig;
  proposed: MonthAvailabilityConfig;
  appointments: readonly T[];
  now: Date;
}): T[] {
  // N-R2 (1B): la comparación solo tiene sentido dentro de un mes; hoy ambos llamadores pasan el mes del path.
  if (current.month !== proposed.month) {
    throw new Error("AFFECTED_MONTH_MISMATCH");
  }

  const today = getCurrentDateKey(now);
  const currentTime = getCurrentTimeKey(now);

  return appointments
    .filter(
      (appointment) =>
        ACTIVE_STATUSES.has(appointment.status) &&
        // F1: solo citas del mes que se edita; antes de la rejilla, que rechaza fechas de otro mes.
        isDateInMonth(appointment.date, current.month) &&
        // Futura: una cita de la hora actual sigue contando como futura (D50, igual que la rejilla).
        (appointment.date > today || (appointment.date === today && appointment.timeSlot >= currentTime)) &&
        isInsideGrid(current, appointment.date, appointment.timeSlot) &&
        !isInsideGrid(proposed, appointment.date, appointment.timeSlot),
    )
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) || first.timeSlot.localeCompare(second.timeSlot),
    );
}
