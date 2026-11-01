# Data Model: Disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability` | **Date**: 2026-10-28 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Este documento es de trabajo (`specs/`). El documento permanente será `docs/architecture/data-model.md` (D7), que se crea en la fase 1 junto con la migración. El perfil `{{data_model_doc}}` sigue en `none` hasta entonces.

## Resumen de entidades

| Entidad | Tabla | Estado | Pertenece a |
|---|---|---|---|
| Mes registrado | `active_months` (existente, con cambios) | Existente | — |
| Regla de disponibilidad | `availability_rules` | **Nueva** | Mes |
| Días de la regla | `availability_rule_weekdays` | **Nueva** | Regla |
| Horas de la regla | `availability_rule_times` | **Nueva** | Regla |
| Excepción por fecha | `availability_exceptions` | **Nueva** | Mes |
| Horas de la excepción | `availability_exception_times` | **Nueva** | Excepción |
| Registro de backfill | `availability_migration_runs` | **Nueva** | — |
| Bloqueo manual | `blocked_slots` | Existente, sin cambio de tabla | Fecha, hora |
| Cita activa | `appointments` | Existente, sin cambio | Cliente |
| Bloqueo de reserva | `reservation_locks` | Existente, sin cambio | — |

## `active_months` (cambios)

| Columna | Tipo MySQL | Cambio | Notas |
|---|---|---|---|
| `id` | INT PK | sin cambio | Referenciada por las reglas y excepciones |
| `month` | CHAR(7) UNIQUE | sin cambio | Formato `YYYY-MM` |
| `status` | ENUM ACTIVE/INACTIVE | sin cambio | Controla si se puede reservar (D32) |
| `slot_mode` | ENUM BLOCK_MODE/SECOND_ONLY_MODE | **Legado**; default cambia a `BLOCK_MODE` | Derivado de las reglas (D19, D31); se elimina en fase 4 |
| `availability_version` | INT NOT NULL DEFAULT 0 | **Nueva** | Control de concurrencia (FR-041, D24). Solo crece. Se incrementa en cada escritura de disponibilidad |
| `created_at`, `updated_at` | DATETIME | sin cambio | — |

**Cambio de default de `slot_mode`** (D17, D31): la columna hoy tiene default `SECOND_ONLY_MODE` (migración `0014`). La migración `0022` lo cambia a `BLOCK_MODE`. Afecta a `createInactiveMonths` (que hoy usa `DEFAULT_MONTH_SLOT_MODE = SECOND_ONLY_MODE`) y al `upsert` de `reconcileActiveMonthsInDatabase`, que crea filas sin `slotMode`.

## `availability_rules` (nueva)

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT PK | — | — |
| `active_month_id` | INT NOT NULL | FK → `active_months.id` ON DELETE CASCADE; índice | Mes al que pertenece (FR-019: no cruza meses) |
| `start_date` | DATE NOT NULL | Debe estar dentro del mes (validación de aplicación) | Inicio inclusivo |
| `end_date` | DATE NOT NULL | `end_date >= start_date`; dentro del mes (validación) | Fin inclusivo |
| `min_gap_minutes` | SMALLINT NOT NULL DEFAULT 240 | `CHECK` 0-1440 si la versión lo soporta (Q-T2); validación de aplicación siempre | D3, D20 |
| `preserve_capacity` | BOOLEAN NOT NULL DEFAULT TRUE | — | D3 |
| `max_per_day` | TINYINT NOT NULL DEFAULT 3 | `CHECK` 1-6 si la versión lo soporta; validación de aplicación siempre | D3, D20 |
| `created_at`, `updated_at` | DATETIME | — | — |

Reglas de negocio que no caben en la fila (validación de aplicación bajo `FOR UPDATE` sobre `active_months`):
- Dos reglas del mismo mes no comparten fechas (FR-003, A1). Se valida por intersección de rangos, sin mirar días de la semana.
- Al menos un día de la semana y al menos una hora por regla (D38).

## `availability_rule_weekdays` (nueva)

| Columna | Tipo | Restricciones |
|---|---|---|
| `rule_id` | INT NOT NULL | FK → `availability_rules.id` ON DELETE CASCADE |
| `weekday` | TINYINT NOT NULL | 1 (lunes) a 7 (domingo), ISO (A-10); `CHECK` si la versión lo soporta |

Clave primaria: `(rule_id, weekday)`.

## `availability_rule_times` (nueva)

| Columna | Tipo | Restricciones |
|---|---|---|
| `rule_id` | INT NOT NULL | FK → `availability_rules.id` ON DELETE CASCADE |
| `time_slot` | TIME(0) NOT NULL | Hora de inicio `HH:mm` (cualquier minuto, A3); persistida como en `appointments.time_slot` |

Clave primaria: `(rule_id, time_slot)` (sin horas repetidas, D37). Máximo 24 filas por regla (validación de aplicación, D21).

## `availability_exceptions` (nueva)

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT PK | — | — |
| `active_month_id` | INT NOT NULL | FK → `active_months.id` ON DELETE CASCADE | — |
| `date` | DATE NOT NULL | Dentro del mes (validación) | Fecha concreta |
| `min_gap_minutes` | SMALLINT NOT NULL DEFAULT 240 | 0-1440 | D10 |
| `preserve_capacity` | BOOLEAN NOT NULL DEFAULT TRUE | — | D10 |
| `max_per_day` | TINYINT NOT NULL DEFAULT 3 | 1-6 | D10 |
| `created_at`, `updated_at` | DATETIME | — | — |

Restricción única: `(active_month_id, date)` (una excepción por fecha).

Una excepción sin horas (`availability_exception_times` vacía) **cierra** ese día, aunque una regla lo cubra (A2, FR-005).

## `availability_exception_times` (nueva)

| Columna | Tipo | Restricciones |
|---|---|---|
| `exception_id` | INT NOT NULL | FK → `availability_exceptions.id` ON DELETE CASCADE |
| `time_slot` | TIME(0) NOT NULL | `HH:mm` |

Clave primaria: `(exception_id, time_slot)`.

## `availability_migration_runs` (nueva)

| Columna | Tipo | Notas |
|---|---|---|
| `name` | VARCHAR(100) PK | `backfill-availability-rules-v1` |
| `applied_at` | DATETIME NOT NULL | Momento de ejecución |
| `rows_created` | INT NOT NULL | Reglas creadas (para verificación, S-02) |

Propósito: idempotencia del backfill (FR-031, R-09). No se consulta en tiempo de ejecución de la aplicación.

## Relaciones

```text
active_months 1 ─── N availability_rules 1 ─── N availability_rule_weekdays
                                         └── N availability_rule_times
              1 ─── N availability_exceptions 1 ─── N availability_exception_times
appointments (sin FK nueva; se filtran por fecha y estado)
blocked_slots (sin cambio; se filtran por fecha)
```

## Derivación de `slot_mode` (D19, D31, FR-033)

Función de dominio `deriveSlotMode(config, currentSlotMode)`:

1. Sin reglas (`availability_rules` vacío para el mes) → `BLOCK_MODE` (D31).
2. Exactamente una regla con `start_date` = primer día del mes, `end_date` = último día, días `{1,2,3,4,5}`, y horas, gap, `preserve_capacity` y `max_per_day` coincidentes con un preset → valor del preset:

| Preset | Horas | `min_gap_minutes` | `preserve_capacity` | `max_per_day` | `slot_mode` |
|---|---|---|---|---|---|
| BLOCK (D4) | 09:00, 10:00, 13:00, 14:00, 17:00, 18:00 | 240 | TRUE | 3 | `BLOCK_MODE` |
| SECOND_ONLY (D4) | 10:00, 14:00, 18:00 | 0 | FALSE | 3 | `SECOND_ONLY_MODE` |

3. En otro caso → se conserva `currentSlotMode` (D19).

Las excepciones no entran en la coincidencia (default técnico FR-033, A-09).

## Mapeo del backfill (D4, FR-030)

Para cada fila de `active_months` (una regla por mes):

| `slot_mode` actual | `start_date` | `end_date` | Días | Horas | `min_gap_minutes` | `preserve_capacity` | `max_per_day` |
|---|---|---|---|---|---|---|---|
| `BLOCK_MODE` | primer día del mes | último día del mes | 1-5 | 09:00, 10:00, 13:00, 14:00, 17:00, 18:00 | 240 | TRUE | 3 (default técnico FR-030) |
| `SECOND_ONLY_MODE` | primer día del mes | último día del mes | 1-5 | 10:00, 14:00, 18:00 | 0 | FALSE | 3 (default técnico FR-030) |

Sin excepciones en el backfill. `slot_mode` no cambia en la migración (ya es correcto y coincide con el preset, lo que deja `deriveSlotMode` consistente).

Verificación posterior: para cada mes, el resolvedor con las reglas del backfill devuelve los mismos horarios que `getAvailableStartSlotsWithManualBlocks` del legado para estados sin bloqueos (prueba S-02 / equivalencia).

## Marcador de día completo (D41, FR-029)

Sin cambio de tabla. Un bloqueo de día completo es una fila en `blocked_slots` con `time_slot = '00:00'` (`FULL_DAY_BLOCK_TIME_SLOT`). El conteo de espacios bloqueados del día completo usa la rejilla vigente del día (D41). Eventos de Google Calendar: `06:00-23:00` (D29).

## Validaciones de aplicación (resumen)

| Regla | Dónde | Código |
|---|---|---|
| Fechas dentro del mes; inicio ≤ fin | `rules-validation.ts` | `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH`, `AVAILABILITY_RULE_RANGE_INVALID` |
| Sin traslape de reglas | `rules-validation.ts`, bajo `FOR UPDATE` | `AVAILABILITY_RULE_OVERLAP` |
| Días ISO 1-7 y al menos uno por regla | `rules-validation.ts` | `AVAILABILITY_RULE_WEEKDAYS_REQUIRED` |
| Horas `HH:mm`, normalizadas, únicas | `rules-validation.ts` | `AVAILABILITY_TIME_INVALID` |
| Al menos una hora por regla | `rules-validation.ts` | `AVAILABILITY_RULE_TIMES_REQUIRED` |
| Máximo 24 horas por día después de normalizar | `rules-validation.ts` | `AVAILABILITY_TIMES_LIMIT_EXCEEDED` |
| `min_gap_minutes` 0-1440 | `rules-validation.ts` + `CHECK` si aplica | `AVAILABILITY_MIN_GAP_OUT_OF_RANGE` |
| `max_per_day` 1-6 | `rules-validation.ts` + `CHECK` si aplica | `AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE` |
| Una excepción por fecha | `UNIQUE (active_month_id, date)` + validación previa | `AVAILABILITY_EXCEPTION_DATE_DUPLICATE` |
| Excepción dentro del mes | `rules-validation.ts` | `AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH` |
| Versión vigente | `lib/db/availability-rules.ts`, bajo `FOR UPDATE` | `AVAILABILITY_VERSION_CONFLICT` |

## Transiciones de estado

No hay máquina de estados nueva. `active_months.status` (ACTIVE/INACTIVE) no cambia por esta feature (D32). `availability_version` solo crece.

## Migración: orden de operaciones (fase 1)

1. `CREATE TABLE` de las seis tablas nuevas (aditivo, sin efecto en código actual).
2. `ALTER TABLE active_months ADD COLUMN availability_version INT NOT NULL DEFAULT 0`.
3. `ALTER TABLE active_months ALTER COLUMN slot_mode SET DEFAULT 'BLOCK_MODE'` (D31).
4. Backfill en la misma migración: insertar una regla por mes según la tabla de mapeo, solo si no existe `availability_migration_runs.name = 'backfill-availability-rules-v1'`; después insertar la fila de registro. Ambos pasos en una transacción.
5. Actualizar `availability_version` a 1 para los meses con regla creada por el backfill (indica que el mes tiene reglas; no cambia el comportamiento).

Restricción de orden: el código nuevo no debe desplegarse antes del paso 4. El código anterior ignora las tablas nuevas.

## Registro de cambios de esquema (bitácora, D7)

| Migración | Fecha | Cambio | Tablas afectadas | Reversible |
|---|---|---|---|---|
| `0022_availability_rules` | fase 1 (pendiente) | Tablas de reglas y excepciones; `availability_version`; default de `slot_mode`; backfill D4 | `active_months`, `availability_*` | Sí en esquema (tablas sin usar); los datos del backfill se conservan |
| (fase 4) `0023_drop_active_months_slot_mode` | pendiente de autorización | Eliminar `slot_mode` y `availability_migration_runs` si el owner lo decide | `active_months`, `availability_migration_runs` | No sin restaurar desde respaldo |

## Integridad referencial y datos que no se tocan (FR-032)

La migración y el backfill no modifican `appointments.date`, `appointments.time_slot`, `appointments.status`, `appointments.google_event_id`, ni `blocked_slots`. Verificación: S-03 (SC-004).
