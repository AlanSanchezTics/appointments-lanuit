# Research: Disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability` | **Date**: 2026-10-28 | **Plan**: [plan.md](./plan.md)

Cada decisión sigue el formato Decision / Rationale / Alternatives considered. Las decisiones de producto no se toman aquí: las que dependen del owner aparecen como pregunta en `plan.md` (sección *Open Questions*).

## R-01. Motor puro nuevo frente a reutilizar `lib/availability/rules.ts`

- **Decision**: crear `lib/availability/capacity-engine.ts` y `resolver.ts` como módulos puros nuevos. `rules.ts` y `month-slot-mode.ts` quedan como legado hasta la fase 4.
- **Rationale**: el motor actual es específico de pares direccionales (`DIRECTIONAL_SLOT_PAIRS`, `canCoexistByDirectionalRule`, `canCoexistWithManualBlockedSlotRule`), que D1 elimina. Un módulo puro permite probarlo sin base de datos, usarlo desde servidor y cliente si hiciera falta, y conservar el oráculo legado en tests durante la transición.
- **Alternatives considered**:
  - Modificar `rules.ts` en su lugar: mezcla lógica nueva con pares legados y complica la prueba de equivalencia (no habría oráculo estable).
  - Mantener el legado y añadir un modo nuevo: contradice FR-016 ("el resolvedor reemplaza...") y deja dos motores.

## R-02. Semántica de bloqueos manuales (decidido por D43)

- **Decision**: el motor aplica FR-013 literalmente (la rejilla del día menos los horarios bloqueados, antes de calcular capacidad). La cifra aceptada de diferencias con bloqueos es **48 de 432** (D43; corrige el 27 de D2, que salió de una variante con pares).
- **Rationale**: FR-010 y FR-013 describen la rejilla sin bloqueos. D1 elimina los pares. La cifra de 27/432 solo se reproduce con la semántica del experimento, que contiene un tratamiento de "grupos muertos" de pares legados y una intersección por bloqueo.
- **Evidencia** (port verificado en `scratchpad`, `engine-variants.mjs`, sobre los 20 estados ocupados alcanzables y las 432 combinaciones de `legacy BLOCK_MODE`):

| Variante del motor nuevo | Diferencias sin bloqueos | Diferencias con bloqueos |
|---|---|---|
| Experimento completo (grupos de pares + intersección por bloqueo) | 0 | **27** (variante con pares; cifra original de D2, corregida por D43) |
| Grid menos bloqueos (texto de FR-013, sin pares) | 0 | **48** |
| Solo intersección por bloqueo, sin grupos de pares | 0 | 58 |
| Solo grupos de pares, sin intersección | 0 | 48 |

- **Consecuencia**: con cualquier variante pair-free, la cifra no es 27. Para llegar a 27 hay que conservar la lógica de pares legados dentro del motor nuevo, lo cual contradice D1.
- **Alternatives considered**:
  - (A) Aceptar la semántica literal de FR-013 y actualizar SC-003 y D2 a 48. Elegida por D43.
  - (B) Reproducir el grupo de pares como regla adicional del motor nuevo (27). Contradice el espíritu de D1; descartada por D43.
  - (C) Otra semántica que apruebe el owner.
- **Plan impact**: la prueba `equivalence-legacy` tiene dos grupos: sin bloqueos (gate estricto: 0) y con bloqueos (48 de 432, D43). T057 queda desbloqueada.

## R-03. Escritura de reglas: reemplazo del conjunto frente a CRUD por elemento

- **Decision**: `PUT /api/admin/months/[month]/availability` reemplaza en una transacción el conjunto completo de reglas y excepciones, con `expectedVersion`. El cliente guarda el borrador completo.
- **Rationale**: el editor muestra un borrador completo y necesita validar traslapes, horas y citas afectadas sobre el resultado final. Un CRUD por elemento obliga a estados intermedios y a múltiples versiones; con FR-041 (versión) habría que incrementar y comprobar en cada llamada. El reemplazo también hace que "crear, editar o eliminar" (FR-020, FR-023) se cumpla con una sola escritura.
- **Alternatives considered**:
  - CRUD por elemento (`POST/PUT/DELETE .../rules/{id}`, `.../exceptions/{id}`): más llamadas, cada una con su versión y su diálogo de afectadas; más trabajo de compensación si una falla.
  - Operaciones por lote con `PATCH` de diferencias: complejidad sin beneficio claro para pocas reglas por mes.
- **Assumption**: A-02 en `plan.md`.

## R-04. Confirmación de citas afectadas (FR-023, D18, D33)

- **Decision**: dos pasos. `POST .../availability/preview` calcula la diferencia sin escribir; el `PUT` sin `confirmAffectedAppointments` devuelve `409 AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` con la lista si hay citas afectadas. `PATCH slot-mode` se comporta igual.
- **Rationale**: no hay estado de servidor entre pasos (sin borradores persistidos, D32); la confirmación se revalida bajo bloqueo de fila; el cliente muestra el listado antes de guardar (D18). El 409 con lista evita un segundo cálculo cuando el cliente salta el preview.
- **Alternatives considered**:
  - Solo 409 sin preview: el cliente no puede mostrar el listado antes de enviar la escritura salvo que haga un intento fallido primero. Menos claro.
  - Token de confirmación con TTL: añade estado de servidor sin necesidad, porque la versión ya protege la coincidencia.

## R-05. `best` exhaustivo frente a greedy

- **Decision**: implementar `best` como búsqueda exhaustiva con poda por tope (`maxPerDay` ≤ 6), igual al experimento verificado. Solo se acepta una versión greedy si la prueba de equivalencia la confirma en los estados alcanzables y en un barrido de estados aleatorios, y la prueba de presupuesto de rendimiento la necesita.
- **Rationale**: el experimento ya está validado (0 diferencias sin bloqueos). Un greedy por la izquierda es óptimo para separación mínima constante en una recta, pero su corrección con horas fijas, bloqueos y recorte por hora actual debe probarse, no asumirse.
- **Alternatives considered**: greedy desde el inicio (rápido, requiere prueba formal); cache por combinación (sobra con 24 horas y tope 6).
- **Performance budget**: un mes completo < 200 ms en CI (prueba de presupuesto).

## R-06. Concurrencia entre reservas y cambios de reglas

- **Decision**: las transacciones de reserva, bloqueo, confirmación y reprogramación leen reglas dentro de la transacción después de `acquireBookingLocks`, con `SELECT ... FOR SHARE` sobre la fila de `active_months`. Las escrituras del editor usan `SELECT ... FOR UPDATE` sobre la misma fila y no toman bloqueos de reserva.
- **Rationale**: hoy la configuración se lee fuera de la transacción (`getBookableMonthConfig` antes de `prisma.$transaction`). Con reglas, una reserva confirmada con reglas viejas y un cambio de reglas concurrente pueden producir una cita que el resolvedor vigente no ofrece. D39 exige validar contra reglas vigentes. El bloqueo de fila hace que la escritura y la lectura se serialicen.
- **Deadlock review**: orden de adquisición en reservas: bloqueos de reserva por fecha/teléfono → `FOR SHARE` en `active_months`. Orden en el editor: `FOR UPDATE` en `active_months` → escrituras de reglas y excepciones. El editor no toma bloqueos de reserva; por tanto no hay ciclo. Revisión obligatoria por `reviewer-high-risk`.
- **Alternatives considered**:
  - Lectura sin bloqueo dentro de la transacción (snapshot): más simple, pero permite la carrera descrita.
  - Bloqueo exclusivo en reservas: contención innecesaria con el flujo público.
  - Columna de versión comprobada en la reserva: obliga a cambiar el contrato público; no justificado.

## R-07. Horarios de reagendado en el cliente admin

- **Decision**: la agenda diaria (`GET .../days/[date]/agenda`) devuelve `availableSlots` calculados en servidor, con `excludeAppointmentId` opcional. `MonthDetailView` deja de calcular horarios en el navegador.
- **Rationale**: FR-016 pide un único resolvedor por día con las mismas lecturas. El cliente hoy calcula con `getAvailableStartSlotsWithManualBlocks` y con `monthBaseSlots` (`resolveBaseSlotsByMonthMode`): con reglas necesitaría todas las reglas y excepciones del mes, lo que duplica la lógica en dos sitios.
- **Alternatives considered**:
  - Importar el motor en cliente y enviar reglas y excepciones con el detalle: el motor es puro, así que técnicamente es posible, pero el cliente tendría que recibir y mantener todo el estado del mes y podría divergir del servidor.
  - Endpoint de horarios separado: más contrato sin ventaja.
- **Assumption**: A-07 en `plan.md` (campo aditivo nuevo).

## R-08. Representación de reglas: tablas normalizadas frente a JSON

- **Decision**: tablas normalizadas. `availability_rules` y `availability_exceptions` con tablas hijas para días (`availability_rule_weekdays`) y horas (`availability_rule_times`, `availability_exception_times`).
- **Rationale**: `UNIQUE (active_month_id, date)` para excepciones, clave compuesta para horas sin duplicados, validación por fila, consultas por día en SQL si hicieran falta, y auditoría de cambios de esquema más clara. MySQL soporta JSON, pero entonces las restricciones (horas únicas, fecha única por mes, rango de días) quedan solo en aplicación.
- **Alternatives considered**: JSON en una columna por regla (menos tablas, menos integridad); una sola tabla de horas con tipo de fila (mezcla reglas y excepciones).

## R-09. Idempotencia del backfill (FR-031)

- **Decision**: tabla `availability_migration_runs` con clave primaria `name` (`backfill-availability-rules-v1`). La migración inserta reglas solo si no existe la fila de registro, y registra la ejecución en la misma transacción.
- **Rationale**: un guard del tipo "no hay reglas en el mes" resucitaría meses creados después de la migración si se volviera a ejecutar, y un contador de versión no distingue un mes nuevo de uno editado. El registro explícito es la forma más simple de demostrar idempotencia.
- **Alternatives considered**:
  - `NOT EXISTS` por mes: falla con meses nuevos sin reglas en una re-ejecución manual.
  - `availability_version = 0`: los meses nuevos también tienen versión 0.
  - Script aparte `scripts/backfill-availability-rules.mjs`: útil para reintentos, pero la migración debe poder ejecutarse sola. Se puede añadir si el owner lo pide.

## R-10. Derivación de `slot_mode` y coincidencia con preset (D19, D31, FR-033)

- **Decision**: sin reglas → `BLOCK_MODE`. Una sola regla de rango de mes completo con los atributos de un preset D4 (ignorando excepciones) → valor del preset. En otro caso se conserva el último valor. `PATCH slot-mode` escribe el preset con rango de mes completo y conserva excepciones.
- **Rationale**: D31 prevalece sobre D19 para meses sin reglas. El rango completo evita que un preset "casi igual" se confunda con uno exacto. Las excepciones no cuentan porque D33 las conserva en `PATCH slot-mode`.
- **Alternatives considered**: coincidencia por horas sin mirar rango (acepta reglas parciales como si fueran preset); no sincronizar `slot_mode` (rompe rollback, D19).
- **Assumption**: A-09 en `plan.md` (default técnico FR-033).

## R-11. Códigos de error y estados HTTP

- **Decision**: códigos estables en mayúsculas (compatibles con `normalizeErrorCode`), validados con funciones explícitas. Mapeo de estados en el route handler, como hoy.

| Código | HTTP | Cuándo |
|---|---|---|
| `MONTH_NOT_REGISTERED` | 404 | Mes sin registro (existente) |
| `MONTH_IN_PAST` | 422 | Editar un mes pasado (FR-021, existente) |
| `AVAILABILITY_VERSION_CONFLICT` | 409 | `expectedVersion` distinto del vigente (FR-041) |
| `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` | 409 | Hay citas afectadas y no se confirmó (FR-023) |
| `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH` | 400 | Regla o excepción fuera del mes |
| `AVAILABILITY_RULE_RANGE_INVALID` | 400 | Inicio posterior al fin |
| `AVAILABILITY_RULE_OVERLAP` | 400 | Traslape de fechas entre reglas (FR-003) |
| `AVAILABILITY_RULE_WEEKDAYS_REQUIRED` | 400 | Regla sin días (D38) |
| `AVAILABILITY_RULE_TIMES_REQUIRED` | 400 | Regla sin horas (D38) |
| `AVAILABILITY_TIME_INVALID` | 400 | Hora que no es `HH:mm` (FR-025) |
| `AVAILABILITY_MIN_GAP_OUT_OF_RANGE` | 400 | `minGapMinutes` fuera de 0-1440 (D20) |
| `AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE` | 400 | `maxPerDay` fuera de 1-6 (D20) |
| `AVAILABILITY_TIMES_LIMIT_EXCEEDED` | 400 | Más de 24 horas por día (D21, después de normalizar) |
| `AVAILABILITY_EXCEPTION_DATE_DUPLICATE` | 400 | Dos excepciones para la misma fecha |
| `AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH` | 400 | Excepción fuera del mes |

- **Rationale**: FR-025 pide códigos estables. `normalizeErrorCode` solo conserva mensajes en mayúsculas; los errores de zod se convierten en `VALIDATION_ERROR` genérico, por eso no se usan para estas reglas.
- **Alternatives considered**: usar zod con `errorMap` por campo (más código, mismo resultado); un único `VALIDATION_ERROR` con detalle (no cumple FR-025).

## R-12. Métricas: saturación y comparación con el mes anterior

- **Decision**: `projectedSaturationPercent` conserva la fórmula de ocupación sobre `ocupadas + disponibles`, con el nuevo `availableSpaces`. La comparación usa las reglas del mes anterior sin quitar horas pasadas (como hoy).
- **Rationale**: la especificación redefine `Disponibles`, pero no la saturación ni la comparación. Mantener la fórmula evita cambiar dos métricas sin pedirlo.
- **Alternatives considered**: calcular saturación sobre `maxPerDay` sumado (cambiaría el significado); eliminar la comparación (fuera de alcance).
- **Resuelto**: D48 (A-06 confirmado).

## R-13. Reemplazo de `WEEKDAY_ONLY` y de `DATE_NOT_OPERATIONAL`

- **Decision (confirmada por D46)**: en reservas y reprogramaciones, un día sin horarios produce `SLOT_NOT_AVAILABLE`. En bloqueos se mantiene `DATE_NOT_OPERATIONAL` (sin cambio de contrato).
- **Rationale**: FR-017 elimina la regla de lunes a viernes, así que `WEEKDAY_ONLY` deja de describir la causa. `SLOT_NOT_AVAILABLE` ya existe y el cliente lo trata como horario no disponible.
- **Alternatives considered**: mantener `WEEKDAY_ONLY` (nombre engañoso); crear `DAY_NOT_AVAILABLE` (nuevo contrato, textos i18n nuevos).
- **Resuelto**: D46.

## R-14. Dashboard y capacidad fija

- **Decision (D44)**: la capacidad del dashboard (semanal y diaria) es la suma de `maxPerDay` de los días resueltos. Se retira `MAX_APPOINTMENTS_PER_DAY` de `lib/admin/dashboard/service.ts`.
- **Rationale**: FR-011 prohíbe la constante 3 en capacidades y métricas. El dashboard no estaba en FR-016; D44 lo incorpora al mismo cálculo de capacidad.
- **Alternatives considered**: (A) suma de `maxPerDay` (elegida); (B) mantener 3 con excepción documentada (descartada por D44).
- **Resuelto**: D44. El cambio del dashboard pasa a la Fase 1 (D53; T022 y T023); el borrado de constantes queda en la Fase 4 (T066).

## R-15. Duración de eventos espejo y ruta de recreación

- **Decision**: bloqueos de horario puntual creados desde el despliegue tienen evento de 1 h, en cualquier mes. Día completo sin cambio (`06:00-23:00`). En `syncBlockedSlotUpdate`, la rama que crea un evento nuevo (cuando no hay `googleEventId`) también usa 1 h.
- **Rationale**: D15 y D30. Hoy `blocked-spaces/service.ts` usa 1 h solo en BLOCK_MODE; la rama de actualización no pasa `durationHours` (verificar en la tarea correspondiente). La rama de actualización con evento existente solo cambia el resumen, así que no altera la duración.
- **Alternatives considered**: recrear eventos antiguos (contradice D30); dejar 3 h en la rama de recreación (incumple D15).
- **Verification task**: prueba unitaria sobre `syncBlockedSlotUpdate` y `createBlockedSlotCalendarEvent` con mock.

## R-16. Escritura de versión y registro de cambios

- **Decision**: `availability_version` se incrementa en cada escritura exitosa. No se escribe en `appointment_logs` (D24, FR-035).
- **Rationale**: la auditoría de citas registra eventos de cita; mezclar cambios de configuración la contaminaría. La versión es la única señal de concurrencia que necesita el editor.
- **Alternatives considered**: bitácora propia de configuración (fuera de alcance, requeriría decisión producto); `updated_at` como versión (resolución de un segundo, insuficiente).

## Sources reviewed

- `specs/003-flexible-month-availability/spec.md` (Gate 2), `agent-reports/00-decisions.md` (D1-D53), `agent-reports/03-clarify-r2.md`.
- Código: `lib/availability/{rules,month-slot-mode,service}.ts`, `lib/constants/slots.ts`, `lib/appointments/{book-appointment,lock-reservation-slot}.ts`, `lib/my-appointments/service.ts`, `lib/admin/months/{service,detail-service,validation}.ts`, `lib/admin/blocked-spaces/{service,day-block}.ts`, `lib/admin/appointments/service.ts`, `lib/admin/dashboard/service.ts`, `lib/calendar/{google,sync-blocked-slot}.ts`, `lib/validation/appointment.ts`, `lib/db/{admin-months,active-months}.ts`, `lib/datetime/mexico-city.ts`, `prisma/schema.prisma`, `components/admin/months/MonthDetailView.tsx`, `app/api/admin/months/**`.
- Experimento de equivalencia: `scratchpad/equiv.ts` y `scratchpad/engine-variants.mjs` (variantes del plan; fuera del repositorio).
