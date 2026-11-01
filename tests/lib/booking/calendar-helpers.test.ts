import { describe, expect, it } from "vitest";

import { getLeadingBlanks } from "@/lib/booking/calendar-helpers";

// Grid de lunes a domingo: los huecos iniciales son los días antes del día 1 dentro de la semana.
describe("getLeadingBlanks", () => {
  it.each([
    ["2026-06", 0, "1 de junio es lunes"],
    ["2026-12", 1, "1 de diciembre es martes"],
    ["2026-05", 4, "1 de mayo es viernes"],
    ["2026-11", 6, "1 de noviembre es domingo"],
  ])("%s starts with %i leading blanks (%s)", (month, expected) => {
    expect(getLeadingBlanks(month)).toBe(expected);
  });
});
