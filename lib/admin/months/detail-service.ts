import { isoWeekdayOf } from "@/lib/availability/day-rule";
import { resolveDay, resolveMonthDays, type ResolvedDay } from "@/lib/availability/resolver";
import type { DayOccupancy, MonthAvailabilityConfig } from "@/lib/availability/types";
import { countBlockedSpaces, splitBlockedTimeSlots } from "@/lib/admin/blocked-spaces/day-block";
import { getCurrentDateKey, getCurrentMonthKey } from "@/lib/datetime/mexico-city";
import { findRegisteredMonth, listAppointmentsByMonth } from "@/lib/db/admin-months";
import { findMonthAvailability } from "@/lib/db/availability-rules";
import { listMonthBlockedSlots } from "@/lib/db/blocked-slots";

import type {
  MonthDetailCalendarDay,
  MonthDetailDayTone,
  MonthDetailResponse,
} from "@/lib/admin/months/types";

function getMonthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEndExclusive = new Date(Date.UTC(year, monthNumber, 1))
    .toISOString()
    .slice(0, 10);

  return { monthStart, monthEndExclusive };
}

function getPreviousMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonthDate = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousYear = previousMonthDate.getUTCFullYear();
  const previousMonth = String(previousMonthDate.getUTCMonth() + 1).padStart(2, "0");

  return `${previousYear}-${previousMonth}`;
}

// Mes sin registro en active_months: sin reglas, así que D6 aplica como en el mes actual sin reglas.
function unregisteredMonthConfig(month: string): MonthAvailabilityConfig {
  return { month, rules: [], exceptions: [], availabilityVersion: 0 };
}

function resolveTone(availableSpaces: number): MonthDetailDayTone {
  if (availableSpaces === 0) {
    return "full";
  }

  if (availableSpaces === 1) {
    return "low";
  }

  return "available";
}

// D34/FR-028: sin horarios resueltos (cerrado, todo bloqueado o todas las horas pasadas) = gris.
// Se consulta sin citas: "lleno" (sin espacios por ocupación) no es lo mismo que "sin horarios".
function hasNoResolvedTimes(
  config: MonthAvailabilityConfig,
  date: string,
  now: Date,
  occupancy: Partial<DayOccupancy>,
) {
  return (
    resolveDay(config, date, {
      now,
      occupancy: {
        blockedTimes: occupancy.blockedTimes,
        fullDayBlocked: occupancy.fullDayBlocked,
      },
    }).slots.length === 0
  );
}

function groupTimesByDate(rows: ReadonlyArray<{ date: string; timeSlot: string }>) {
  const byDate = new Map<string, string[]>();

  for (const row of rows) {
    const dayTimes = byDate.get(row.date) ?? [];
    dayTimes.push(row.timeSlot);
    byDate.set(row.date, dayTimes);
  }

  return byDate;
}

// Las horas bloqueadas llegan crudas; el centinela "00:00" se separa aquí para el motor (N-R3, F8).
function buildOccupancyByDate(
  occupiedByDate: Map<string, string[]>,
  blockedByDate: Map<string, string[]>,
) {
  const dates = new Set([...occupiedByDate.keys(), ...blockedByDate.keys()]);

  return Object.fromEntries(
    [...dates].map((date) => {
      const { hasFullDayBlock, blockedSlots } = splitBlockedTimeSlots(blockedByDate.get(date) ?? []);

      return [
        date,
        {
          occupiedTimes: occupiedByDate.get(date) ?? [],
          blockedTimes: [...blockedSlots],
          fullDayBlocked: hasFullDayBlock,
        },
      ];
    }),
  );
}

function sumAvailableSpaces(days: readonly ResolvedDay[]) {
  return days.reduce((total, day) => total + day.availableSpaces, 0);
}

function sumBlockedSpaces(days: readonly ResolvedDay[], blockedByDate: Map<string, string[]>) {
  return days.reduce(
    (total, day) => total + countBlockedSpaces(day.dayRule, blockedByDate.get(day.date) ?? []),
    0,
  );
}

// A-06/D48: fórmula de saturación sin cambios; solo cambia el dato de disponibles.
function projectedSaturation(occupiedSpaces: number, availableSpaces: number) {
  const modeledSpaces = occupiedSpaces + availableSpaces;

  return modeledSpaces ? Math.round((occupiedSpaces / modeledSpaces) * 100) : 0;
}

export async function getAdminMonthDetail(
  month: string,
  now = new Date(),
): Promise<MonthDetailResponse> {
  const registration = await findRegisteredMonth(month);

  if (!registration) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const { monthStart, monthEndExclusive } = getMonthBounds(month);
  const previousMonth = getPreviousMonthKey(month);
  const { monthStart: previousMonthStart, monthEndExclusive: previousMonthEndExclusive } =
    getMonthBounds(previousMonth);
  const [
    config,
    appointments,
    blockedSlots,
    previousMonthAppointments,
    previousMonthBlockedSlots,
    previousMonthConfig,
  ] = await Promise.all([
    findMonthAvailability(month),
    listAppointmentsByMonth(monthStart, monthEndExclusive),
    listMonthBlockedSlots(monthStart, monthEndExclusive),
    listAppointmentsByMonth(previousMonthStart, previousMonthEndExclusive),
    listMonthBlockedSlots(previousMonthStart, previousMonthEndExclusive),
    findMonthAvailability(previousMonth),
  ]);

  if (!config) {
    throw new Error("MONTH_NOT_REGISTERED");
  }

  const activeAppointments = appointments.filter((appointment) => appointment.status !== "CANCELLED");
  const cancelledAppointments = appointments.length - activeAppointments.length;
  const occupiedByDate = groupTimesByDate(activeAppointments);
  const blockedByDate = groupTimesByDate(blockedSlots);
  const occupancyByDate = buildOccupancyByDate(occupiedByDate, blockedByDate);

  const currentMonth = getCurrentMonthKey(now);
  const currentDate = getCurrentDateKey(now);

  // PD-13: cada día se resuelve con las reglas del propio mes (un día fuera del mes lanza error en el resolvedor).
  // D56: un día anterior a hoy no aporta disponibles ("Disponibles") y se pinta cerrado; hoy sigue la regla D34.
  // D60: la saturación no usa este ajuste; ver projectedSaturationPercent.
  const resolvedDays = resolveMonthDays(config, { now, occupancyByDate });
  const days = resolvedDays.map((day) =>
    day.date < currentDate ? { ...day, availableSpaces: 0 } : day,
  );
  const calendarDays: MonthDetailCalendarDay[] = days.map((day) => {
    const closed =
      day.date < currentDate ||
      hasNoResolvedTimes(config, day.date, now, occupancyByDate[day.date] ?? {});

    return {
      date: day.date,
      day: Number(day.date.slice(8, 10)),
      isWeekend: isoWeekdayOf(day.date) >= 6,
      availableSpaces: day.availableSpaces,
      appointmentsCount: occupiedByDate.get(day.date)?.length ?? 0,
      tone: closed ? "closed" : resolveTone(day.availableSpaces),
    } satisfies MonthDetailCalendarDay;
  });

  // D59: PENDING ocupa su horario; "confirmadas" conserva su significado (no cancelada ni pendiente).
  const confirmedAppointments = activeAppointments.filter(
    (appointment) => appointment.status !== "PENDING",
  ).length;
  const occupiedSpaces = activeAppointments.length;
  const availableSpaces = sumAvailableSpaces(days);
  const blockedSpaces = sumBlockedSpaces(days, blockedByDate);
  // D60/A-06: la saturación usa los espacios sin quitar días pasados, igual que el mes anterior (comparable y sin 100 % por pasado).
  const projectedSaturationPercent = projectedSaturation(
    occupiedSpaces,
    sumAvailableSpaces(resolvedDays),
  );

  // Comparación con el mes anterior: sus propias reglas (A-06, D48); sin reglas o sin registro, D6.
  const previousConfig = previousMonthConfig ?? unregisteredMonthConfig(previousMonth);
  const previousActiveAppointments = previousMonthAppointments.filter(
    (appointment) => appointment.status !== "CANCELLED",
  );
  const previousDays = resolveMonthDays(previousConfig, {
    now,
    occupancyByDate: buildOccupancyByDate(
      groupTimesByDate(previousActiveAppointments),
      groupTimesByDate(previousMonthBlockedSlots),
    ),
  });
  const previousProjectedSaturationPercent = projectedSaturation(
    previousActiveAppointments.length,
    sumAvailableSpaces(previousDays),
  );
  const deltaPercentPoints = projectedSaturationPercent - previousProjectedSaturationPercent;

  return {
    month,
    monthStatus: registration.status,
    slotMode: registration.slotMode,
    rules: config.rules,
    exceptions: config.exceptions,
    availabilityVersion: config.availabilityVersion,
    usesDefaultRule: config.rules.length === 0,
    currentMonth,
    currentDate,
    isPastMonth: month < currentMonth,
    projectedSaturationPercent,
    saturationComparison: {
      previousMonth,
      previousProjectedSaturationPercent,
      deltaPercentPoints,
    },
    metrics: {
      confirmedAppointments,
      cancelledAppointments,
      availableSpaces,
      blockedSpaces,
      occupiedSpaces,
    },
    calendarDays,
  };
}
