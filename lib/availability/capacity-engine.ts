import type { DayAvailability, DayContext, DayRule } from "@/lib/availability/types";

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

// FR-009: la separación se mide entre horas de inicio (D25).
function isFarEnough(first: string, second: string, minGapMinutes: number) {
  return Math.abs(toMinutes(first) - toMinutes(second)) >= minGapMinutes;
}

// Máximo de citas que caben con `fixed` ya fijadas, tomando horas de `candidates` con separación y tope `cap`.
// Port del experimento de equivalencia (R-05): búsqueda exhaustiva en orden de índice, con poda al alcanzar el tope.
export function best(fixed: string[], candidates: string[], minGapMinutes: number, cap: number): number {
  let count = fixed.length;

  if (count >= cap) {
    return cap;
  }

  const options = candidates.filter(
    (candidate) =>
      !fixed.includes(candidate) && fixed.every((item) => isFarEnough(item, candidate, minGapMinutes)),
  );

  for (let index = 0; index < options.length; index += 1) {
    const next = options
      .slice(index + 1)
      .filter((candidate) => isFarEnough(candidate, options[index], minGapMinutes));

    count = Math.max(count, best([...fixed, options[index]], next, minGapMinutes, cap));

    if (count >= cap) {
      return cap;
    }
  }

  return count;
}

export function computeDayAvailability(dayRule: DayRule | null, context: DayContext): DayAvailability {
  if (!dayRule || dayRule.times.length === 0 || context.fullDayBlocked) {
    return { slots: [], availableSpaces: 0 };
  }

  const { minGapMinutes, preserveCapacity, maxPerDay } = dayRule;
  const occupied = context.occupiedTimes;

  if (occupied.length >= maxPerDay) {
    return { slots: [], availableSpaces: 0 };
  }

  // Dedupe: con minGapMinutes 0 una hora repetida contaría dos veces en best.
  const blocked = new Set(context.blockedTimes);
  const grid = [...new Set(dayRule.times)]
    .filter((time) => !blocked.has(time) && (context.currentTime === null || time >= context.currentTime))
    .sort();

  const base = best(occupied, grid, minGapMinutes, maxPerDay);

  const slots = grid.filter(
    (candidate) =>
      !occupied.includes(candidate) &&
      occupied.every((item) => isFarEnough(item, candidate, minGapMinutes)) &&
      // Solo importa si se alcanza base: tope = base da la misma decisión y corta la búsqueda antes.
      (!preserveCapacity || best([...occupied, candidate], grid, minGapMinutes, base) >= base),
  );

  return { slots, availableSpaces: base - occupied.length };
}
