# Ronda 1E-bis: informe del Developer (cierre de pruebas de 1E)

**Estado: PARCIAL con handoff.** Se corrigieron las 13 pruebas de 1E que fallaban por contrato antiguo; las otras 2 fallas de la suite dirigida ya existían en HEAD. Se implementó D68 y se añadieron pruebas de D63 (orden de locks) y D68 (PENDING ocupa horario). **No se hicieron**: T037 (API de disponibilidad), T034 (sincronización de calendario), la extensión admin↔pública de `reschedule-concurrency`, NB-4, NB-5/NB-9, la revisión de D17, la prueba de N2 y la limpieza de `appointment_logs` para la integración. Ninguna tarea T030–T039 se marca `[X]` en `tasks.md`: T037 a T039 siguen sin hacer y T030–T036 no tienen pruebas de ruta (T035/T036) ni de consumidores completas (T038 incluye `tests/lib/availability/service.test.ts`, que aún tiene errores de tipos).

Turnos: unas 75 llamadas a herramientas (conteo propio, no expuesto por la plataforma). Handoff en la sección 9.

Nada se commiteó, no se cambió de rama, no se tocó `docs/`, no se ejecutó `next build` en el repo.

## 1. Archivos modificados en esta ronda

| Archivo | Cambio |
|---|---|
| `lib/db/admin-appointments.ts` | D68: `listActiveAppointmentSlotsByDateForUpdate` y `listActiveAppointmentsByDateExcludingForUpdate` usan `SLOT_BLOCKING_APPOINTMENT_STATUSES` (PENDING, CONFIRMED, SYNC_FAILED). Nueva `listBlockingAppointmentsByDate(date)` (id y horario, mismos estados) para la ocupación de la agenda. La lista visible (`listActiveAppointmentsByDate`) no cambia. |
| `lib/admin/appointments/service.ts` | D68: `getAdminDayAgenda` calcula `availableSlots` con `listBlockingAppointmentsByDate` (PENDING ocupa; la cita excluida no). NB-3 en `createAdminAppointment`: `acquireBookingLocks` pasa dentro del `try` (el `finally` libera). |
| `tests/lib/admin/months.service.test.ts` | Reescritas las pruebas de `updateAdminMonthSlotMode` para el contrato actual (transacción, `FOR UPDATE`, preset que reemplaza reglas). Añadidas: versión obsoleta → `AVAILABILITY_VERSION_CONFLICT` sin escritura; D69 (mismo modo reemplaza reglas); mes pasado sin escritura. |
| `tests/app/api-admin-month-slot-mode-route.test.ts` | La fábrica del mock incluye `AffectedAppointmentsConfirmationError`; la llamada se verifica con objeto; respuesta con `availabilityVersion`; nuevas pruebas 409 con lista de citas afectadas y 409 por versión obsoleta. |
| `tests/lib/admin/months.validation.test.ts` | Forma de `parseUpdateMonthSlotModePayload` (`confirmAffectedAppointments: false` por defecto, A-01); nueva prueba con `expectedVersion` y confirmación. |
| `tests/lib/admin/blocked-spaces.service.test.ts` | Mock de `@/lib/db/availability-rules` con reglas reales del preset (`buildSlotModePresetRules`). Caso de SECOND_ONLY renombrado: duración 1 h (D15) en vez de `undefined`. |
| `tests/lib/admin/dashboard.service.test.ts` | D61 → D66: PENDING no cuenta en ocupación semanal ni diaria (14 dic: 1 de 28 = 4 %; diaria 1). |
| `tests/lib/db/admin-months.test.ts` | D59 → D66: estados `CONFIRMED`, `SYNC_FAILED`, `CANCELLED`; sin PENDING. |
| `tests/lib/admin/appointments.lock-order.test.ts` | **Nuevo.** 4 pruebas: orden D63 de la reprogramación admin (lectura de teléfono → `acquireBookingLocks` → `FOR SHARE` → `cleanupExpiredReservationLocks` → `lockConflictingAppointments` → `FOR UPDATE` → escritura → `releaseBookingLocks`); cambio de teléfono antes de los locks → `APPOINTMENT_NOT_FOUND` sin escritura; D68 PENDING ocupa `availableSlots`; D68 la cita excluida libera su horario. |

Archivos de 1E no tocados en esta ronda y con errores de tipos pendientes: `tests/lib/availability/service.test.ts` (13 errores `tsc`), `tests/lib/active-months/service.test.ts` (5 errores `tsc`, fuera de la lista de 1E).

## 2. Cambios de comportamiento (decisiones aplicadas)

- **D68 (agendado, reprogramación y agenda):** los horarios ofrecidos y la ocupación del agendado admin, de la reprogramación admin y de `availableSlots` cuentan PENDING, con los mismos estados que `SLOT_BLOCKING_APPOINTMENT_STATUSES` en el flujo público. Los contadores del detalle de mes y del dashboard siguen sin PENDING (D66).
- **Efecto colateral de D68 (para el Orchestrator):** `listActiveAppointmentSlotsByDateForUpdate` también la usa `createAdminBlockedSlots` (`lib/admin/blocked-spaces/service.ts`). Con D68, una cita PENDING también impide crear un bloqueo admin sobre ese horario (`SLOT_NOT_AVAILABLE`). Es coherente con el resolvedor, pero no estaba listado en D68 como flujo afectado; el owner debe confirmarlo.
- **Límite no tocado:** `findAppointmentOwnerPhone` (reprogramación admin) sigue buscando solo `CONFIRMED` y `SYNC_FAILED`, así que una cita PENDING no puede reprogramarse desde admin (`APPOINTMENT_NOT_FOUND`). No es parte de D68; queda para decisión.
- **NB-3 (`createAdminAppointment`):** los named locks se toman dentro del `try`, como en `book-appointment`, `lock-reservation-slot` y `my-appointments`.

## 3. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npx vitest run` dirigido (availability, admin, db, appointments, my-appointments, validation, calendar, `api-admin-*`, `admin-month-detail-page`, `components/admin/months`) **antes** de las correcciones | 15 fallos, 397 pasan, 1 todo (413). 8 archivos fallan. |
| Mismo comando **después** de las correcciones (última ejecución) | **2 fallos, 419 pasan, 1 todo (422)**; 64 de 66 archivos pasan. Los 2 fallos son preexistentes (ver sección 4). |
| Suites editadas (6 archivos) | 46 pasan. |
| `tests/lib/admin/appointments.lock-order.test.ts` | 4 pasan. |
| `tests/lib/admin/appointments.service.test.ts` | 6 pasan (sin cambios). |
| Copia de HEAD (`git archive HEAD` en el scratchpad, sin tocar el árbol) con `api-admin-cancel-route` y `month-detail-view` | Los dos fallan en HEAD: son preexistentes. |
| `npx tsc --noEmit` | **62 errores, todos en `tests/`; 0 fuera de `tests/`.** La línea base de 1D era 61. Hay +1 sin identificar (no comparé archivo a archivo con HEAD). Ninguno en los archivos que edité en esta ronda. |
| `npx eslint` sobre los 9 archivos tocados en esta ronda | Exit 0. |
| Integración en `appointments_test` (`scratchpad/integ.sh`, `ENABLE_INTEGRATION_DB=1`, aborta si el destino no es `appointments_test`) sobre `availability-concurrency`, `reschedule-concurrency`, `book-appointment`, `reservation-lock` | 18 pruebas: **6 pasan, 12 fallan**. Ver sección 4. |

El wrapper de integración está en `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/7999bae6-f9f5-4f85-9340-e8d79f1c00ee/scratchpad/integ.sh`; no está en el repo.

**Corrección (Ronda 1E-r1, NB-2 del Reviewer).** El Reviewer atribuyó a este informe (§3, punto 2) la afirmación de que `acquireBookingLocks` en `rescheduleAdminAppointment` estaba dentro del `try`. Este archivo no contiene esa frase sobre la reprogramación. Sí contiene, en las líneas 14 y 30, la afirmación sobre `createAdminAppointment`: que `acquireBookingLocks` va dentro del `try`. Esa parte es correcta, pero incompleta: no cubría la lectura de ocupación, que era la causa de B-1 (corregida en 1E-r1 en `lib/db/admin-appointments.ts`, con lecturas `FOR UPDATE`). La reprogramación admin sí tenía el `acquire` fuera del `try`; quedó corregido en 1E-r1 (`lib/admin/appointments/service.ts`), con prueba en `tests/lib/admin/appointments.lock-order.test.ts` ("releases the named locks when acquiring them fails (NB-2)"). La afirmación errónea sobre la reprogramación está en `round-05-admin-api-developer.md`, línea 87 (fuera del alcance de esta corrección).

## 4. Fallos y su estado

**Preexistentes (verificados en HEAD):**
- `tests/app/api-admin-cancel-route.test.ts` "returns 200 when cancellation succeeds": el spy espera `(15, { month: "2026-03" })` y la ruta pasa un tercer argumento. La ruta y `cancelAdminAppointment` no se modificaron en 1E. Fuera de alcance; no lo corregí.
- `tests/components/admin/months/month-detail-view.test.tsx` "disables schedule CTA when month is inactive": falla en HEAD (ya conocido). Sin investigar; fuera de alcance.

**Integración (`appointments_test`), 12 fallos:**
- `book-appointment.integration.test.ts`: 1 pasa ("persists a confirmed appointment") y 8 fallan. El log muestra `Foreign key constraint violated on the fields: (appointment_id)` en `prisma.appointment.deleteMany()` del `beforeEach` (16 ocurrencias entre ambos archivos). Es el problema preexistente de `appointment_logs` (el helper no vacía esa tabla). No diagnostiqué cada fallo por separado.
- `reservation-lock.integration.test.ts`: 4 fallan, con la misma FK en la limpieza. En 1D se reportaron también 2 fallos por igualdad sobre la columna TIME (~L65 y ~L145); no lo reverifiqué en esta ejecución.
- `availability-concurrency` 4/4 pasan. `reschedule-concurrency` 1/1 pasa.
- No vacié `appointment_logs` en `appointments_test`: el brief lo permitía, pero me quedé sin presupuesto. Es el primer paso del handoff.

## 5. Verificado (ejecutado) frente a diseño estático y pendiente del owner

**Ejecutado:** los comandos de la sección 3, con los resultados indicados.

**Estático (leído y razonado, no ejecutado):**
- D63 en la reprogramación admin: el orden de llamadas lo prueba el test unitario; la carrera admin↔pública **no** se reprodujo. No afirmo que el test falle sin el fix.
- D68: el cambio de filtros de estado se prueba con un mock de Prisma en el test de `getAdminDayAgenda`; la consulta real a MySQL no se ejecutó.
- N2 (`replaceMonthAvailability` solo dentro de `$transaction` + `FOR UPDATE`): protección por diseño, sin prueba ni guardia en tiempo de ejecución.
- D64 (hora fuera de rejilla en creación admin): no verificado. Solo hay validación de formato `HH:mm`; el rechazo por rejilla llega por `SLOT_NOT_AVAILABLE`. Pendiente.

**Pendiente de aceptación del owner:**
- D68: efecto sobre la creación de bloqueos admin (sección 2).
- D69: el PATCH con el mismo modo reemplaza reglas por el preset e incrementa la versión (ya en 1E).
- Vista previa de meses pasados: no bloquea; el guardado sí (`MONTH_IN_PAST`, D70).
- Límite de reprogramación admin de citas PENDING (sección 2).

## 6. Revisión de D17 (`reconcileActiveMonthsInDatabase`)

**No revisada en esta ronda** (pendiente, sin cambios). Mi lectura previa: `createInactiveMonths` usa `DEFAULT_MONTH_SLOT_MODE = BLOCK_MODE` y no crea reglas (D17), lo que coincide con D6. El script `scripts/reconcile-active-months.mjs` no se leyó.

## 7. Documentation Impact

- Impacto en flujo: **Sí** (D68 cambia la ocupación para agendado admin, reprogramación admin y horarios de la agenda; el efecto sobre bloqueos admin es nuevo).
- Impacto documental: **Sí.** `docs/` no se tocó (lo cierra T075).
- Secciones a actualizar en T075: `docs/specification.md` (sección de agendado y reprogramación admin, reglas de ocupación); `docs/architecture/business-rules.md` (ocupación con PENDING para horarios, D68; orden de locks D63; contadores sin PENDING, D66); `docs/architecture/api.md` (agenda `availableSlots` cuenta PENDING); decisión en `docs/decisions/` para D68.

## 8. Flow Contract Check

- UI steps updated: **No** (Fase 2).
- API contract updated: **Sí en código** (`agenda` devuelve `availableSlots` con PENDING ocupando; el contrato de `contracts/admin-availability-api.md` ya lo describe como ocupación). Documentación de `api.md` pendiente (T075).
- Validation rules updated: **No** en esta ronda.
- Acceptance criteria updated: **No.**
- `docs/specification.md` aligned: **No** (pendiente de T075).

## 9. Migration Compatibility Check

- Schema changes required: **No** en esta ronda.
- Data backfill required: **No.**
- Legacy compatibility required: **Sí.** Sin cambios de forma de respuesta en esta ronda; la lista de la agenda no cambia.
- Rollback strategy defined: **Sin cambios en esta ronda** (la estrategia de 1A y del release combinado sigue vigente, D45).
- Cleanup phase defined: **Sí** (Fase 4).
- Integrity protections defined: **Sí (aplicación)**: `FOR UPDATE` sobre `active_months` en el editor; `expectedVersion`; `FOR SHARE` de reglas en reservas y reprogramaciones; named locks en el orden de D63. D68 solo cambia filtros de lectura. No se añadieron restricciones de BD.

## 10. Handoff (pendiente, en orden de prioridad)

1. **Integración:** vaciar `appointment_logs` solo en `appointments_test` (o en el helper de tests, con el mismo límite) y volver a ejecutar `book-appointment` y `reservation-lock`; separar fallos nuevos de los preexistentes.
2. **T037:** `tests/app/api-admin-month-availability-route.test.ts` (GET, PUT, preview; 404, 409, 422, 400 con códigos estables), más las actualizaciones de `api-admin-month-detail-route`, `api-admin-day-agenda-route`, `api-admin-blockable-slots-route` y `api-admin-months-route`.
3. **T034:** `tests/lib/calendar/sync-blocked-slot.test.ts` (1 h puntual, día completo 06:00–23:00, evento existente solo cambia resumen).
4. **T038/T039:** revisar `tests/lib/availability/service.test.ts` (13 errores `tsc`) y `tests/lib/availability/month-slot-mode.test.ts`, y la parte B de consumidores.
5. **Reschedule admin↔pública:** extender `tests/integration/reschedule-concurrency.integration.test.ts`. No afirmar que falla sin el fix hasta reproducirlo.
6. **NB-4:** `app/api/my-appointments/reschedule/route.ts` mapea `LOCK_TIMEOUT` a 409 (no hecho). Revisar `tests/lib/my-appointments.service.test.ts` si cambia.
7. **NB-5/NB-9:** corregir `round-04-booking-developer.md` (no hecho).
8. **D17:** revisar `scripts/reconcile-active-months.mjs` y `lib/db/active-months.ts` (no hecho).
9. **N2:** prueba que documente que `replaceMonthAvailability` exige transacción (no hecha).
10. **tsc:** identificar el +1 respecto a 61 y llevar el total a ≤61 cuando se actualicen las pruebas pendientes.
11. **Marcas en `tasks.md`:** ninguna marcada. Marcar T030–T039 solo cuando se ejecuten sus pruebas.

## 11. Limitaciones y riesgos

- Suite de integración con 12 fallos; no está cerrada la verificación de D63 y D68 contra MySQL.
- `tsc` 62 (+1 sin identificar), con errores en `tests/` de archivos de 1E no actualizados.
- D68 cambia también la creación de bloqueos admin (sección 2); el owner debe confirmarlo.
- No hay prueba de la carrera admin↔pública; el hallazgo de ~2 % del Reviewer sigue sin reproducirse en repo.
- Pruebas de `api-admin-cancel-route` y `month-detail-view`: preexistentes, sin tocar.
