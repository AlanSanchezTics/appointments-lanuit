# Contrato interno: motor y resolvedor de disponibilidad

**Feature**: `003-flexible-month-availability` | **Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Research**: [../research.md](../research.md)

Contrato de módulos puros en `lib/availability/`. No depende de Prisma, `next/*` ni React. Lo usan el servidor (público, reservas, admin) y las pruebas. Las firmas son de referencia para `speckit-tasks`; la implementación sigue el estilo del repositorio.

## Tipos de entrada

```text
AvailabilityRule {
  id: number
  startDate: "YYYY-MM-DD"        inclusivo, dentro del mes
  endDate: "YYYY-MM-DD"          inclusivo, dentro del mes, >= startDate
  weekdays: number[]             ISO 1..7, al menos uno
  times: "HH:mm"[]               al menos uno, sin repetidos, ordenadas, <= 24
  minGapMinutes: 0..1440
  preserveCapacity: boolean
  maxPerDay: 1..6
}

AvailabilityException {
  id: number
  date: "YYYY-MM-DD"            dentro del mes, única por mes
  times: "HH:mm"[]               puede estar vacía (cierra el día)
  minGapMinutes: 0..1440
  preserveCapacity: boolean
  maxPerDay: 1..6
}

MonthAvailabilityConfig {
  month: "YYYY-MM"
  rules: AvailabilityRule[]
  exceptions: AvailabilityException[]
  availabilityVersion: number
}

DayContext {
  date: "YYYY-MM-DD"
  occupiedTimes: "HH:mm"[]       citas activas del día (+ locks activos en el flujo público)
  blockedTimes: "HH:mm"[]        bloqueos manuales de horario puntual del día (no incluye "00:00")
  fullDayBlocked: boolean        bloqueo de día completo ("00:00"), ver nota
  currentTime: "HH:mm" | null    solo si date es hoy en America/Mexico_City; null en otro caso
}
```

Nota sobre `fullDayBlocked`: un día completo bloqueado produce cero horarios ofrecibles (FR-016 y regla actual). Para el conteo de espacios bloqueados (D41) se usa la rejilla vigente aunque el día esté bloqueado completo.

## `resolveDayRule(config, date) -> DayRule | null`

```text
DayRule {
  source: "EXCEPTION" | "RULE" | "DEFAULT"
  times: "HH:mm"[]               puede ser []
  minGapMinutes: number
  preserveCapacity: boolean
  maxPerDay: number
}
```

Orden de resolución (PD-02):

1. Existe excepción para `date` → `source = EXCEPTION` con sus horas y parámetros. Lista vacía = día cerrado (A2).
2. Existe al menos una regla en `config.rules` → buscar la regla con `startDate <= date <= endDate` y `date.isoWeekday ∈ weekdays`. Si hay, `source = RULE`. Si no, devolver `null` (día cerrado, D23).
3. No hay reglas → si `date` es lunes a viernes, `source = DEFAULT` con (09:00, 10:00, 13:00, 14:00, 17:00, 18:00, 240, true, 3) (D6, D28). Fin de semana → `null`.

Invariantes: a lo sumo una regla cubre una fecha (validado al guardar, FR-003). Si la invariante se rompe en datos, la función lanza `AVAILABILITY_RULE_OVERLAP`.

## `computeDayAvailability(dayRule, dayContext) -> DayAvailability`

```text
DayAvailability {
  slots: "HH:mm"[]               horarios ofrecibles, ordenados
  availableSpaces: number        citas adicionales alcanzables, acotadas por maxPerDay
}
```

Pasos (PD-01, PD-03 de `research.md` R-02, R-05):

1. Si `dayRule` es `null`, o `dayRule.times` está vacío, o `fullDayBlocked` → `{ slots: [], availableSpaces: 0 }`. Nota: si `fullDayBlocked` es cierto, `availableSpaces = 0` y el día es gris (D34, FR-029 conteo aparte).
2. `grid` = `dayRule.times` sin `blockedTimes` (FR-013) y, si `currentTime != null`, sin horas `< currentTime` (FR-014, D22; comparación del legado: se conservan horas `>= currentTime`, D50).
3. Si `occupiedTimes.length >= maxPerDay` → `{ slots: [], availableSpaces: 0 }` (FR-011).
4. `base = best(occupiedTimes, grid, minGap, maxPerDay)` (función de capacidad, abajo).
5. `slots` = horas `c` de `grid` tales que:
   - `c` no está en `occupiedTimes`;
   - para toda `o` en `occupiedTimes`, `|c - o| >= minGap` (FR-009, medido entre horas de inicio, D25);
   - si `preserveCapacity`, `best(occupiedTimes + [c], grid, minGap, maxPerDay) >= base` (FR-010, FR-012).
6. `availableSpaces = base - occupiedTimes.length`.

### `best(fixed, candidates, minGap, cap) -> number`

Máximo tamaño de un conjunto de horas que contiene `fixed` y se toma de `candidates` (sin repetir), con separación `>= minGap` entre cualquier par, y con tope `cap`. Si `fixed` ya viola la separación, la función devuelve un valor que no se usa (las horas candidatas se filtran antes por separación con `fixed`).

Implementación de referencia: búsqueda con poda por tope (port de `best` en el experimento). Una versión greedy solo se acepta tras la prueba de equivalencia (R-05).

## Ejemplos verificados (casos de aceptación)

Estos casos son la fuente de las pruebas de `tests/lib/availability/`. Los valores de US3 se verificaron a mano y los de D9 con el calendario antes de escribir el plan; la prueba automatizada se escribe en la fase 1 (T014, T021, T052).

| Caso | Entrada | Salida esperada | Referencia |
|---|---|---|---|
| Día sin citas | regla BLOCK (09, 10, 13, 14, 17, 18; 240/true/3); ocupadas: ninguna | 6 horarios; `availableSpaces = 3` | US3-1 |
| Cita a las 09:00 | ocupadas: 09:00 | `slots = [13:00, 14:00, 17:00, 18:00]`; `10:00` excluida (60 min < 240) | US3-2 |
| Cita a las 10:00 | ocupadas: 10:00 | `slots = [14:00, 18:00]`; `17:00` excluida (deja el día con 2 en lugar de 3, preserveCapacity) | US3-3 |
| Sin preservar capacidad | regla con `preserveCapacity=false`, ocupadas: 10:00 | `17:00` se ofrece si cumple la separación | US3-4 |
| Excepción vacía | excepción `times=[]` sobre día de regla | `slots = []`, `availableSpaces = 0`, gris | US2-2, A2 |
| Excepción sobre regla | excepción 10:00, 14:00 sobre sábado sin regla | `slots = [10:00, 14:00]` con parámetros de la excepción | US2-1, US2-4 |
| Mes sin reglas | sin reglas ni excepciones; lunes | D6: 6 horarios, `availableSpaces = 3`; sábado: cerrado | D6, D28 |
| Mes con regla y día no cubierto | regla 1-13 L-V; día 14 | cerrado (sin horarios) | D23, US4-1 |
| Dic. 2026 (1-13) | regla A (240/true/3) | cada día hábil: 3 espacios | US4-1 |
| Dic. 2026 (14-23) | regla B (`07:30, 11:00, 14:30, 18:00`; 0/false/4) | cada día: 4 espacios | D11, US4-1 |
| Dic. 2026 total | días 1-13 hábiles (9) + 14-23 (10) | 9×3 + 10×4 = **67** (SC-007) | US4-1, SC-007 |
| Ene. 2027 total | L-V con excepciones (lunes 18 y 25 cerrados; sábados 16 y 23 abiertos) | 21 días × 3 = **63** | US4-2 (derivado) |
| Hora actual | hoy 12:00, horas 09:00, 13:00 | solo `13:00` en la grilla | D22 |
| Hora repetida | `times = [10:00, 09:00, 10:00]` | normalizada `[09:00, 10:00]` | D37 |

## Equivalencia con el legado (regresión)

- Oráculo: copia congelada de `getAvailableStartSlotsWithManualBlocks` (rama `BLOCK_MODE` y rama `SECOND_ONLY_MODE`) en `tests/lib/availability/fixtures/legacy-block-oracle.ts`.
- Estados de prueba: ocupadas alcanzables con las reglas legadas sin bloqueos (20 estados en el experimento) y todas las combinaciones de bloqueos disjuntos de ocupadas (432 casos).
- Gate sin bloqueos: **0 diferencias** en BLOCK y SECOND_ONLY (SC-002).
- Gate con bloqueos: 48 de 432 combinaciones con bloqueos manuales difieren del legado (semántica literal de FR-013, D43). La prueba fija la constante 48; el 27 de D2 salió de una variante con pares y solo es nota histórica.

## Presupuesto de rendimiento

- `resolveMonthDays(config, now)` para un mes de 31 días, 24 horas por día y `maxPerDay` 6 en el peor caso: menos de 200 ms en CI.

## Errores

Las funciones puras lanzan `Error` con código en mayúsculas (`AVAILABILITY_*`). Las rutas los convierten con `normalizeErrorCode`. No devuelven `null` para errores de datos; `null` solo significa día cerrado.
