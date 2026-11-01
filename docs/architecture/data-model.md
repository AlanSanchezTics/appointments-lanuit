# Modelo de datos

## Propósito y alcance

Este documento inventaría los modelos de persistencia, sus relaciones, claves y restricciones, y la bitácora de cambios de esquema. Es la fuente permanente del esquema (decisión D7 de la spec 003). Las reglas de negocio viven en `docs/architecture/business-rules.md` y el comportamiento funcional en `docs/specification.md`; aquí solo se describe cómo se guarda.

Fuente de verdad del esquema: `prisma/schema.prisma` y las migraciones en `prisma/migrations/`. Si este documento contradice esos archivos, gana el código.

Estado: la migración `0022_availability_rules` existe en el repositorio y está aplicada en la copia local de la base, pero no se ha desplegado en producción: sale en el mismo release que el resto de la disponibilidad por mes (D45). La migración `0023_drop_active_months_slot_mode` está creada y aplicada solo en la BD de pruebas (`appointments_test`); su despliegue espera la autorización del owner (Gate 4).

---

## Disponibilidad por mes (spec 003)

La disponibilidad de cada mes se describe con reglas por rango de fechas y excepciones por fecha. Las reglas no guardan el mes: pertenecen a `active_months` por clave foránea. Las reglas y excepciones no cruzan meses (FR-019).

### `active_months` (cambios)

| Columna | Tipo en MySQL | Estado | Notas |
|---|---|---|---|
| `id` | INT, PK autoincremental | sin cambio | Referenciada por reglas y excepciones |
| `month` | CHAR(7), UNIQUE | sin cambio | Formato `YYYY-MM` |
| `status` | ENUM `ACTIVE` / `INACTIVE` | sin cambio | Controla si el mes se puede reservar. No lo cambia la disponibilidad |
| `slot_mode` | ENUM `BLOCK_MODE` / `SECOND_ONLY_MODE`, NOT NULL | **Legado** | El código no la lee ni la escribe desde la ronda 4B. Se elimina con `0023` (pendiente de despliegue). Default cambiado a `BLOCK_MODE` en `0022` |
| `availability_version` | INT, NOT NULL, DEFAULT 0 | **Nueva** | Control de concurrencia del editor. Solo crece |
| `created_at`, `updated_at` | DATETIME(3) | sin cambio | — |

`availability_version` se incrementa en cada escritura exitosa de disponibilidad (`replaceMonthAvailability`), incluido el `PATCH slot-mode`, aunque el modo solicitado sea el mismo. La migración la deja en `1` para los meses a los que el backfill les creó una regla, y en `0` para el resto.

### `availability_rules`

| Columna | Tipo | Restricciones en BD | Notas |
|---|---|---|---|
| `id` | INT, PK autoincremental | PK | — |
| `active_month_id` | INT, NOT NULL | FK a `active_months.id` ON DELETE CASCADE ON UPDATE CASCADE; índice | Mes al que pertenece |
| `start_date` | DATE, NOT NULL | — | Inicio inclusivo. Debe estar dentro del mes (aplicación) |
| `end_date` | DATE, NOT NULL | `CHECK (end_date >= start_date)` | Fin inclusivo. Debe estar dentro del mes (aplicación) |
| `min_gap_minutes` | SMALLINT, NOT NULL, DEFAULT 240 | `CHECK BETWEEN 0 AND 1440` | Separación mínima entre horas de inicio, en minutos |
| `preserve_capacity` | BOOLEAN, NOT NULL, DEFAULT TRUE | — | Si el día conserva la capacidad máxima posible |
| `max_per_day` | TINYINT, NOT NULL, DEFAULT 3 | `CHECK BETWEEN 1 AND 6` | Tope de citas por día |
| `created_at`, `updated_at` | DATETIME(3) | — | — |

### `availability_rule_weekdays`

| Columna | Tipo | Restricciones en BD |
|---|---|---|
| `rule_id` | INT, NOT NULL | FK a `availability_rules.id` ON DELETE CASCADE ON UPDATE CASCADE |
| `weekday` | TINYINT, NOT NULL | `CHECK BETWEEN 1 AND 7`; ISO, 1 = lunes, 7 = domingo |

Clave primaria `(rule_id, weekday)`.

### `availability_rule_times`

| Columna | Tipo | Restricciones en BD |
|---|---|---|
| `rule_id` | INT, NOT NULL | FK a `availability_rules.id` ON DELETE CASCADE ON UPDATE CASCADE |
| `time_slot` | TIME(0), NOT NULL | Misma representación que `appointments.time_slot` |

Clave primaria `(rule_id, time_slot)`: no hay horas repetidas dentro de una regla. El límite de 24 horas por regla no está en la BD (aplicación).

### `availability_exceptions`

| Columna | Tipo | Restricciones en BD | Notas |
|---|---|---|---|
| `id` | INT, PK autoincremental | PK | — |
| `active_month_id` | INT, NOT NULL | FK a `active_months.id` ON DELETE CASCADE ON UPDATE CASCADE | — |
| `date` | DATE, NOT NULL | `UNIQUE (active_month_id, date)` | Una excepción por fecha y mes. Debe estar dentro del mes (aplicación) |
| `min_gap_minutes` | SMALLINT, NOT NULL, DEFAULT 240 | `CHECK BETWEEN 0 AND 1440` | Parámetros propios de la excepción |
| `preserve_capacity` | BOOLEAN, NOT NULL, DEFAULT TRUE | — | — |
| `max_per_day` | TINYINT, NOT NULL, DEFAULT 3 | `CHECK BETWEEN 1 AND 6` | — |
| `created_at`, `updated_at` | DATETIME(3) | — | — |

Una excepción sin filas en `availability_exception_times` cierra ese día aunque una regla lo cubra.

### `availability_exception_times`

| Columna | Tipo | Restricciones en BD |
|---|---|---|
| `exception_id` | INT, NOT NULL | FK a `availability_exceptions.id` ON DELETE CASCADE ON UPDATE CASCADE |
| `time_slot` | TIME(0), NOT NULL | — |

Clave primaria `(exception_id, time_slot)`.

### `availability_migration_runs`

| Columna | Tipo | Notas |
|---|---|---|
| `name` | VARCHAR(100), PK | Valor `backfill-availability-rules-v1` |
| `applied_at` | DATETIME(3), NOT NULL | Momento de la ejecución |
| `rows_created` | INT, NOT NULL | Número de reglas que había en `availability_rules` al registrar la ejecución |

Propósito: idempotencia del backfill. La aplicación no consulta esta tabla en tiempo de ejecución.

---

## Relaciones

```text
active_months 1 ─── N availability_rules 1 ─── N availability_rule_weekdays
                                          └── N availability_rule_times
              1 ─── N availability_exceptions 1 ─── N availability_exception_times

availability_migration_runs    (sin FK; registro de backfill)
appointments                   (sin FK nueva; se filtran por fecha y estado)
blocked_slots                  (sin cambio; se filtran por fecha)
reservation_locks              (sin cambio)
```

Todas las tablas hijas caen en cascada con su padre. El editor reemplaza el conjunto completo del mes: borra excepciones y reglas del mes (la cascada borra sus horas) y vuelve a insertarlas dentro de la misma transacción.

---

## Tablas existentes relacionadas (sin cambio de esquema)

| Tabla | Restricción relevante | Qué protege |
|---|---|---|
| `appointments` | Índice `(date, time_slot)`; índice `(date)`; **sin UNIQUE sobre `(date, time_slot)`** | Nada a nivel de BD. Ver "Protecciones de integridad" |
| `blocked_slots` | `UNIQUE (date, time_slot)` | Un bloqueo manual por fecha y hora |
| `reservation_locks` | Índices `(date, time_slot, expires_at)` y `(phone, expires_at)` | Consulta de locks activos; no es unicidad |

---

## Presets de entrada de `PATCH slot-mode` (D4, D16, D33)

Los presets ya no se derivan ni se guardan en la tabla. `slot_mode` no se escribe desde la ronda 4B: se eliminó `deriveSlotMode` y sus pruebas, y no queda ningún llamador de producción. El preset es solo la entrada de `PATCH /api/admin/months/[month]/slot-mode`: `SLOT_MODE_PRESET_VALUES` y `SLOT_MODE_PRESETS` (`lib/availability/defaults.ts`) y `buildSlotModePresetRules` (`lib/availability/slot-mode-derivation.ts`) convierten el valor en una regla de mes completo.

Presets (D4):

| Preset | Horas | `min_gap_minutes` | `preserve_capacity` | `max_per_day` | Valor de entrada |
|---|---|---|---|---|---|
| BLOCK | 09:00, 10:00, 13:00, 14:00, 17:00, 18:00 | 240 | TRUE | 3 | `BLOCK_MODE` |
| SECOND_ONLY | 10:00, 14:00, 18:00 | 0 | FALSE | 3 | `SECOND_ONLY_MODE` |

Las excepciones no entran en la comparación (default técnico A-09). `PATCH slot-mode` reemplaza las reglas del mes por una regla de mes completo con los valores del preset y conserva las excepciones (D16, D33).

El motor de disponibilidad (`lib/availability/`) y los servicios de reserva no leen `slot_mode`. La UI admin (`components/admin/months/MonthDetailView.tsx`) ya no lee `slot_mode`: los horarios de reagendado y de creación vienen de la agenda del día del servidor.

---

## Backfill desde `slot_mode` (D4, FR-030, FR-031)

La migración crea una regla por cada fila de `active_months`. El mapeo es:

| `slot_mode` actual | Rango | Días | Horas | `min_gap_minutes` | `preserve_capacity` | `max_per_day` |
|---|---|---|---|---|---|---|
| `BLOCK_MODE` | primer a último día del mes | 1-5 (lunes a viernes) | 09:00, 10:00, 13:00, 14:00, 17:00, 18:00 | 240 | TRUE | 3 |
| `SECOND_ONLY_MODE` | primer a último día del mes | 1-5 (lunes a viernes) | 10:00, 14:00, 18:00 | 0 | FALSE | 3 |

- `max_per_day = 3` es un default técnico (FR-030), no un valor leído del modo anterior.
- No se crean excepciones en el backfill.
- `slot_mode` no cambia de valor en la migración: ya coincide con el preset.
- Idempotencia: cada sentencia de backfill tiene `WHERE NOT EXISTS` sobre la fila `backfill-availability-rules-v1` de `availability_migration_runs`. La fila se inserta al final, dentro de la misma transacción. Una segunda ejecución no inserta reglas ni cambia `availability_version`.
- Transacción: el DDL no es transaccional en MySQL (cada sentencia hace commit implícito). Solo el bloque de backfill va dentro de `START TRANSACTION ... COMMIT`.
- Verificación prevista (S-02 del quickstart): el resolvedor con las reglas del backfill devuelve los mismos horarios que el legado para estados sin bloqueos (prueba de equivalencia del motor). Esa prueba está en `tests/lib/availability/` y se describe en la spec, no en este documento.

---

## Default de `slot_mode` (D17, D31)

| Versión | Default de `active_months.slot_mode` | Migración |
|---|---|---|
| Histórica | `SECOND_ONLY_MODE` | `0014_active_months_slot_mode_default_second_only` |
| Desde spec 003 | `BLOCK_MODE` | `0022_availability_rules` |

Efectos del cambio de default:

- `createInactiveMonths` (alta de meses en el catálogo, `lib/db/admin-months.ts`) crea `status = INACTIVE` sin escribir la columna legada, y `POST /api/admin/months` no crea reglas (D17). El mes queda sin reglas y se aplica la regla por defecto D6 (lunes a viernes, 09/10/13/14/17/18, 240, TRUE, 3).
- `reconcileActiveMonthsInDatabase` (`lib/db/active-months.ts`) crea meses con `{ month, status: ACTIVE }` y no crea reglas ni escribe la columna legada. Como no tiene reglas, aplica D6. Ver D6 y D84; el comportamiento descrito es el del código actual.

---

## Estado legado de `slot_mode`

- `active_months.slot_mode` sigue existiendo en las bases que no han aplicado `0023`, con el último valor escrito por la versión anterior a la ronda 4B. El código actual no la lee ni la escribe.
- Ninguna respuesta de la API incluye `slotMode` (D49, sin alias): ni `GET .../availability`, ni `GET /api/admin/months/[month]`, ni la respuesta de `PATCH .../slot-mode` (`{ month, availabilityVersion }`). `slotMode` solo aparece como campo de entrada del `PATCH`.
- `lib/availability/month-slot-mode.ts` se eliminó (T073). Los valores de entrada del preset viven en `lib/availability/defaults.ts`.
- La eliminación física de la columna es la migración `0023_drop_active_months_slot_mode`, descrita en la sección siguiente. `availability_migration_runs` se conserva.

---

## Marcador de día completo (D41, D29, D55)

No hay cambio de tabla. Un bloqueo de día completo es una fila de `blocked_slots` con `time_slot = '00:00'` (`FULL_DAY_BLOCK_TIME_SLOT` en `lib/admin/blocked-spaces/day-block.ts`).

- `00:00` es un centinela, no una hora. Es inválido como hora en reglas y excepciones (`AVAILABILITY_TIME_INVALID`, D55).
- El conteo de espacios bloqueados del día usa la rejilla vigente del día (D41).
- El evento espejo en Google Calendar de un día completo va de `06:00` a `23:00` (`lib/calendar/google.ts`).
- Los bloqueos de horario puntual crean eventos de 1 hora (D15, D29). Los eventos ya existentes no cambian (D30).

---

## Concurrencia a nivel de datos

Orden de bloqueo en las escrituras que tocan horarios (D63, D77). Reservas públicas, confirmación pública, bloqueo de horario del wizard, reprogramación pública, creación admin y reprogramación admin siguen el mismo orden (son las seis transacciones que toman `GET_LOCK`; los bloqueos manuales siguen los pasos 2 a 5 sin el paso 1, F2):

1. `GET_LOCK` con nombres `booking:date:<fecha>` y `booking:phone:<teléfono>`, en orden alfabético (`acquireBookingLocks`). Espera máxima de 5 s por nombre; si no se obtiene, `LOCK_TIMEOUT`. La transacción que los toma usa `timeout` de 30 s (`BOOKING_TRANSACTION_OPTIONS`) y `acquireBookingLocks` fija `innodb_lock_wait_timeout` de sesión en 5 s, restaurado a `DEFAULT` en `releaseBookingLocks` (F1, D82; ADR 0006).
2. `SELECT ... FOR SHARE` sobre la fila de `active_months` del mes (`findMonthAvailabilityForShare`). Espera a cualquier escritura del editor.
3. `FOR UPDATE` sobre las citas de la fecha o del teléfono (`lockConflictingAppointments`).
4. Lectura de ocupación. En la creación admin y en la reprogramación admin es bloqueante (`listActiveAppointmentSlotsByDateForUpdate`, `listActiveAppointmentsByDateExcludingForUpdate`, D77): un `findMany` plano puede usar un snapshot de REPEATABLE READ anterior al COMMIT de una reserva pública. En las reservas y reprogramaciones públicas la ocupación se lee con `findMany` después del paso 3.
5. Inserción o actualización de la cita, y después `RELEASE_LOCK` en el `finally` de la transacción (`releaseBookingLocks`).

Los bloqueos con nombre se liberan dentro de la transacción, antes de su COMMIT (riesgo F3, sección de limitaciones).

El editor de disponibilidad (`saveAvailability`, `updateAdminMonthSlotMode`) toma `FOR UPDATE` sobre la fila de `active_months` (`findMonthAvailabilityForUpdate` y `replaceMonthAvailability`). No toma bloqueos de reserva.

La confirmación o el rechazo admin de una cita `PENDING` toma `FOR UPDATE` sobre la fila de la cita y la de su cliente (`transitionPendingAppointment`). No sigue el orden de seis pasos (ADR 0006, riesgo NB-1).

Los bloqueos manuales de horario (`createAdminBlockedSlots`) toman `FOR SHARE` sobre las reglas, después `lockConflictingAppointments` y la lectura de ocupación bloqueante. No toman los bloqueos con nombre de las reservas.

Limitaciones conocidas (ver las decisiones D82 y D83 y ADR 0006):

- Los bloqueos con nombre se liberan dentro de la transacción, antes del COMMIT (F3).
- F1 (D82): un `GET_LOCK` de sesión no se libera con el ROLLBACK. Con los tiempos actuales, una espera normal no hace expirar la transacción. Si una transacción supera 30 s, Prisma la expira, el `finally` no puede liberar el lock y este queda en la conexión del pool hasta que se cierre (medido: 2 de 2 con timeout forzado de 500 ms). Residual aceptado por el owner (ronda 26) con este impacto:
  - Mientras la conexión viva, las reservas de esa fecha o de ese teléfono responden `LOCK_TIMEOUT` (409) tras 5 s. Denegación por fecha o teléfono, no solo fuga de lock. Medido: `IS_USED_LOCK` devuelve la conexión que lo retiene; la respuesta de `GET_LOCK` desde otra sesión se infiere de la semántica de MySQL, no se midió directamente.
  - Si el pool reutiliza la conexión, el lock puede persistir tras `RELEASE_LOCK` (contador re-entrante; no medido). La duración del lock huérfano no se midió.
  - Tras la expiración la conexión conserva `innodb_lock_wait_timeout = 5` (medido); esa conexión afecta a otras consultas, también fuera de reserva, hasta que una transacción de reserva la restaure o se cierre. Revertir el código no limpia esos valores.
  - Caso de una sola espera de cada tipo: 15 s < 30 s. Las cadenas de esperas exitosas casi al límite (10 + 5k s; k >= 4 llega a 30 s) son el riesgo residual.
  - Corrección completa pendiente de decisión del owner: liberar en la misma sesión o sustituir `GET_LOCK` por bloqueos de fila transaccionales (rediseño).
- `listBlockedSlotsByDateForUpdate` (`lib/db/blocked-slots.ts`) es una lectura plana, sin `FOR UPDATE`, pese a su nombre (F2).
- Deadlock raro (1213) entre la confirmación admin de una `PENDING` y el reagendado público de otra `PENDING` del mismo cliente. Es preexistente y riesgo residual aceptado por el owner (NB-1, ADR 0006). El admin recibe error y puede reintentar; no hay pérdida de datos.

---

## Protecciones de integridad

| Regla | Dónde se protege | Mecanismo |
|---|---|---|
| Una excepción por fecha y mes | BD y aplicación | `UNIQUE (active_month_id, date)`; validación previa devuelve `AVAILABILITY_EXCEPTION_DATE_DUPLICATE` |
| Horas sin repetir por regla o excepción | BD y aplicación | PK compuesta; `normalizeTimes` ordena y elimina duplicados (D37) |
| Días ISO 1-7 | BD y aplicación | `CHECK` en `availability_rule_weekdays`; validación `AVAILABILITY_RULE_WEEKDAYS_REQUIRED` |
| `min_gap_minutes` 0-1440 | BD y aplicación | `CHECK` en reglas y excepciones; validación `AVAILABILITY_MIN_GAP_OUT_OF_RANGE` |
| `max_per_day` 1-6 | BD y aplicación | `CHECK` en reglas y excepciones; validación `AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE` |
| `end_date >= start_date` | BD y aplicación | `CHECK`; validación `AVAILABILITY_RULE_RANGE_INVALID` |
| Fechas dentro del mes | Solo aplicación | `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH`, `AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH` |
| Sin traslape de fechas entre reglas del mes | Solo aplicación | Intersección de rangos, bajo `FOR UPDATE` de `active_months`; `AVAILABILITY_RULE_OVERLAP` |
| Al menos un día y una hora por regla | Solo aplicación | `AVAILABILITY_RULE_WEEKDAYS_REQUIRED`, `AVAILABILITY_RULE_TIMES_REQUIRED` |
| Máximo 24 horas por día, después de normalizar | Solo aplicación | `AVAILABILITY_TIMES_LIMIT_EXCEEDED` |
| Versión del editor (sin escrituras perdidas) | Aplicación, con comprobación repetida en la BD | `expectedVersion` frente a `availability_version` bajo `FOR UPDATE`; `AVAILABILITY_VERSION_CONFLICT` |
| Un bloqueo manual por fecha y hora | BD | `UNIQUE (date, time_slot)` en `blocked_slots` |
| Dos citas activas en la misma fecha y hora | **Solo aplicación. No existe restricción de BD.** | `appointments` no tiene UNIQUE sobre `(date, time_slot)`. La protección son los bloqueos de la sección anterior y la lectura bloqueante antes de insertar |

No hay restricción de base de datos que impida dos citas activas en el mismo horario. Esta es una decisión de arquitectura del owner que la spec 003 registra: la protección es únicamente de aplicación. Este documento no propone cambiarla.

Las restricciones `CHECK` existen en la migración `0022`. Su aplicación depende de que el servidor MySQL las haga cumplir (MySQL 8.0.16 o posterior; la versión mínima que el proyecto debe exigir está pendiente de confirmar).

---

## Migración 0022: orden de operaciones

Orden de la migración `prisma/migrations/0022_availability_rules/migration.sql`:

1. DDL aditivo (cada sentencia hace commit implícito): `CREATE TABLE` de las seis tablas nuevas.
2. DDL sobre `active_months`: `ADD COLUMN availability_version INTEGER NOT NULL DEFAULT 0` y `MODIFY COLUMN slot_mode ... NOT NULL DEFAULT 'BLOCK_MODE'`.
3. Backfill en transacción (`START TRANSACTION` ... `COMMIT`): inserta una regla por mes, sus días y sus horas; pone `availability_version = 1` en los meses con regla creada; inserta la fila `backfill-availability-rules-v1`.

Despliegue y limpieza:

1. Aplicar `prisma migrate deploy` (incluye `0022`). Las tablas nuevas quedan con datos del backfill. El código anterior sigue funcionando porque lee `slot_mode`, que se conserva.
2. Verificar `availability_migration_runs` y el conteo de reglas (una por mes con `active_months`; S-02 del quickstart).
3. Desplegar el código nuevo. La disponibilidad por mes sale en un solo release, sin bandera (D45). El código nuevo no debe ejecutarse contra una BD sin el paso 3.
4. Limpieza: retirar la lectura de `slot_mode` del código, las constantes de pares y el campo `slotMode` de las respuestas (D49). Hecho en la ronda 4B. La eliminación de la columna va en `0023_drop_active_months_slot_mode` (sección siguiente).

La migración no modifica `appointments` (`date`, `time_slot`, `status`, `google_event_id`) ni `blocked_slots` (FR-032).

---

## Migración 0023: orden, compatibilidad y rollback

Migración `prisma/migrations/0023_drop_active_months_slot_mode/migration.sql`: `ALTER TABLE active_months DROP COLUMN slot_mode`.

Estado: aplicada solo en la BD de pruebas `appointments_test` (ronda 4B). No aplicada en producción. Pendiente: autorización del owner (Gate 4), respaldo verificado y precondiciones de la lista «Orden en cada entorno» (incluye parar los procesos de la versión anterior). No hay staging accesible desde el entorno de desarrollo.

Migration Compatibility Check:

- Cambio de esquema: sí. Backfill de datos: no. Compatibilidad con legado: sí, sin ventana de convivencia.
- El código anterior a la ronda 4B selecciona `slot_mode` al mapear meses (`findActiveMonth`, `listActiveMonths`, `findRegisteredMonth`), lee la columna en `findMonthAvailability` y la escribe en `replaceMonthAvailability`. Sin la columna, esas consultas fallan, incluidas las de reserva pública. Por eso la migración y el despliegue del código de la ronda 4B deben ser atómicos.
- Legado: `availability_migration_runs` se conserva. Retirarla requiere decisión del owner.
- Rollback definido: parcial, ver abajo. La migración es irreversible sin respaldo.
- Limpieza: el código y la documentación ya no referencian la columna (ronda 4B). Solo falta esta migración.
- Protecciones de integridad: ninguna nueva. La eliminación no toca claves foráneas ni índices (la columna no tenía índice).

Orden en cada entorno. El respaldo es **obligatorio** (decisión del owner, 2026-11-01): ningún entorno ejecuta `prisma migrate deploy` de `0023` sin un respaldo verificado.

1. Confirmar que `0022_availability_rules` está aplicada. `0023` no puede ejecutarse antes que `0022`. Precondición (c): `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = '0022_availability_rules';` debe devolver una fila con `finished_at` no nulo y `rolled_back_at` nulo. Si `0022` figura como fallida o revertida, no continuar. Marcar `0022` como aplicada sin haber ejecutado su backfill permitiría que `0023` borre `slot_mode` sin que existan reglas.
2. Parar todas las instancias de la versión anterior a la ronda 4B y los procesos manuales que usan el modelo `activeMonth`, incluido `npm run months:reconcile` (`scripts/reconcile-active-months.mjs`): con código anterior a la ronda 4B falla tras `0023`, porque ese código selecciona `slot_mode`. No hay ventana de convivencia. El respaldo se toma después de esta parada para que ninguna escritura de `slot_mode` quede fuera de él (decisión del owner, 2026-11-01).
3. Con las instancias ya paradas, tomar respaldo de `active_months.slot_mode`: volcado completo de la base, o tabla auxiliar `CREATE TABLE active_months_slot_mode_backup_0023 AS SELECT id, slot_mode FROM active_months;`. Verificación obligatoria:
   - Conteo: `SELECT COUNT(*) FROM active_months_slot_mode_backup_0023;` debe ser igual a `SELECT COUNT(*) FROM active_months;`. Con volcado completo, comprobar que el fichero existe, no está vacío y es restaurable.
   - Restauración de prueba: restaurar el respaldo en una base desechable creada solo para esta comprobación, nunca en `appointments` ni en producción, y comparar `id` y `slot_mode` con la base de origen.
4. Con las instancias paradas, comprobar las precondiciones de datos. Todas deben cumplirse antes de `migrate deploy`:
   - (a) `SELECT COUNT(*) FROM availability_migration_runs WHERE name = 'backfill-availability-rules-v1';` devuelve `1`. La fila la inserta el backfill de `0022` al final de su transacción.
   - (b) Cobertura de reglas: `SELECT am.id, am.month, am.slot_mode FROM active_months am LEFT JOIN availability_rules ar ON ar.active_month_id = am.id WHERE am.slot_mode <> 'BLOCK_MODE' AND ar.id IS NULL;` devuelve 0 filas. `BLOCK_MODE` es el default de la columna desde `0022`. El backfill creó una regla por cada mes existente; un mes sin regla suele ser un alta posterior a `0022`, que no escribe `slot_mode`. Un mes con `SECOND_ONLY_MODE` sin regla perdería su modo al borrar la columna.
   - Si alguna precondición falla, no ejecutar `migrate deploy` y consultar al owner.
5. `prisma migrate deploy` (aplica `0023`).
6. Desplegar el código de la ronda 4B de inmediato y verificar `GET /api/admin/months/[month]`, `PATCH /api/admin/months/[month]/slot-mode` y una reserva pública.

Fallo de `0023` por columna ya eliminada (N4 de la revisión 4B): `0023` ejecuta `ALTER TABLE active_months DROP COLUMN slot_mode` sin `IF EXISTS`. Si alguien eliminó la columna a mano, MySQL devuelve un error del tipo «Can't DROP ... check that column/key exists», `migrate deploy` falla y Prisma marca `0023` como fallida. No hay daño de datos porque la sentencia no se aplica. Recuperación, con cautela y con el respaldo ya verificado:

1. Comprobar el estado: `SHOW COLUMNS FROM active_months LIKE 'slot_mode';` no debe devolver filas. Averiguar cómo se eliminó la columna: significa que la base cambió fuera de las migraciones.
2. Si el owner acepta el estado final (columna ausente), marcar la migración: `npx prisma migrate resolve --applied 0023_drop_active_months_slot_mode`.
3. Si el fallo tiene otra causa, corregirla, ejecutar `npx prisma migrate resolve --rolled-back 0023_drop_active_months_slot_mode` y repetir `prisma migrate deploy`.

Rollback: no es automático. Revertir el código a `fed5d46` no basta, porque ese código necesita la columna. Pasos: recrear la columna con `ALTER TABLE active_months ADD COLUMN slot_mode ENUM('BLOCK_MODE','SECOND_ONLY_MODE') NOT NULL DEFAULT 'BLOCK_MODE' AFTER status;` y restaurar los valores desde el respaldo (`UPDATE active_months a JOIN <respaldo> b ON b.id = a.id SET a.slot_mode = b.slot_mode;`). Sin respaldo, los valores se pierden y el código anterior mostrará `BLOCK_MODE` en todos los meses como etiqueta de admin. El motor de horarios de `fed5d46` no usa la columna para calcular horarios. Las reglas editadas con el código de la ronda 4B no actualizan la columna, así que el valor restaurado puede no coincidir con las reglas.

---

## Recuperación manual de `0022` (N4)

El DDL de `0022` no es transaccional en MySQL. Si la migración falla a mitad, las tablas o la columna creadas por las primeras sentencias quedan en la BD y Prisma marca la migración como fallida. Volver a ejecutarla falla de nuevo porque las tablas ya existen. La recuperación es manual.

Procedimiento (requiere autorización explícita del owner y se ejecuta solo sobre la base objetivo confirmada):

1. Verificar el estado: qué tablas `availability_*` existen, si `active_months.availability_version` existe y cuántas filas tiene `availability_migration_runs`.
2. Confirmar que no hay reglas o excepciones configuradas que se quieran conservar. Si las hay, exportarlas antes de continuar: el paso siguiente las borra.
3. Borrar las tablas en este orden (hijas primero): `availability_exception_times`, `availability_exceptions`, `availability_rule_times`, `availability_rule_weekdays`, `availability_rules`, `availability_migration_runs`.
4. Quitar la columna: `ALTER TABLE active_months DROP COLUMN availability_version`.
5. Restaurar el default anterior de `slot_mode` si el rollback es completo: `ALTER TABLE active_months MODIFY COLUMN slot_mode ENUM('BLOCK_MODE','SECOND_ONLY_MODE') NOT NULL DEFAULT 'SECOND_ONLY_MODE'` (default de `0014`). Esta parte no está en la nota N4 de la spec; se añade porque la migración `0022` cambió el default.
6. Marcar la migración como revertida: `npx prisma migrate resolve --rolled-back 0022_availability_rules`.
7. Volver a desplegar el código anterior.

Advertencia: los pasos 3 y 4 borran datos. Un rollback de release no requiere borrar tablas (ver "Riesgos de rollback").

---

## Riesgos de rollback del release 0022

- Revertir el release (fases 1 y 2 juntas, D45) deja las tablas nuevas sin uso. No se eliminan.
- Con el código anterior, `PATCH slot-mode` actualiza solo la columna `slot_mode` (`updateRegisteredMonthSlotMode`). Si luego se vuelve a desplegar el código nuevo, las reglas pueden no reflejar los cambios hechos con el modal anterior. El nuevo código lee las reglas, no `slot_mode`.
- Las reglas editadas con el código nuevo no son visibles para el código anterior. Este solo muestra el `slot_mode` derivado: fiel cuando las reglas coinciden con un preset; en otro caso, muestra el último valor (riesgo residual aceptado por D19).
- Las lecturas de reservas con el código anterior ignoran las reglas: los horarios públicos vuelven al comportamiento de `slot_mode`.
- Meses creados con el código nuevo sin reglas (D17) aplican D6 en el código nuevo, pero el código anterior los trata según `slot_mode` (`BLOCK_MODE` por default).

---

## Bitácora de cambios de esquema (D7)

| Migración | Fecha | Cambio | Tablas afectadas | Reversibilidad |
|---|---|---|---|---|
| `0022_availability_rules` | 2026-10-28 (aplicada en copia local de la base, 2026-10-31; pendiente de despliegue en producción con la release combinada) | Seis tablas de reglas y excepciones con PK, UNIQUE, FK CASCADE y CHECK; `availability_version`; default de `slot_mode` a `BLOCK_MODE`; backfill D4 idempotente | `active_months`, `availability_rules`, `availability_rule_weekdays`, `availability_rule_times`, `availability_exceptions`, `availability_exception_times`, `availability_migration_runs` | Sin rollback automático de DDL. Recuperación manual en la sección correspondiente |
| `0023_drop_active_months_slot_mode` | Aplicada solo en `appointments_test` (ronda 4B). Pendiente de despliegue en producción: Gate 4 del owner | Eliminar `active_months.slot_mode`. `availability_migration_runs` se conserva | `active_months` | No sin restaurar desde respaldo (sección "Migración 0023") |

---

## Referencias

- Spec 003: `specs/003-flexible-month-availability/data-model.md` (documento de trabajo, con el detalle de decisiones), `plan.md`, `contracts/`.
- Decisiones de arquitectura: `docs/decisions/` (índice en `docs/decisions/README.md`).
- Contrato de endpoints: `docs/architecture/api.md`.
