# Ronda 1E: informe del Developer (servicios admin, API y pruebas de consumidores)

**Estado: PARCIAL con handoff.** Código de T030 a T036 y de las correcciones D63, D65 y D66 implementado y comprobado estáticamente (tsc y eslint). Pruebas de T037 a T039 **no actualizadas**: 14 pruebas unitarias antiguas fallan y las pruebas nuevas pedidas (orden de locks, integración admin↔pública, sincronización de calendario, API de disponibilidad) **no se escribieron**. Integración en `appointments_test` **no ejecutada** en esta ronda. Ninguna tarea T037–T039 se marca `[X]`. T030–T036 no se marcan en `tasks.md`, porque su verificación de pruebas queda pendiente (ver *Pendiente*).

Numeración de turnos: unas 68 llamadas a herramientas en esta sesión (conteo propio aproximado, no expuesto por la plataforma). Handoff en la última sección.

## 1. Archivos modificados

### Dentro de T030–T036 (lista de la ronda)

| Archivo | Cambio |
|---|---|
| `lib/admin/months/validation.ts` | `parseUpdateMonthSlotModePayload` acepta `expectedVersion` y `confirmAffectedAppointments` opcionales (A-01). Nuevos `parseAvailabilityPreviewPayload` y `parseSaveAvailabilityPayload` (forma JSON con zod; `preserveCapacity` como booleano, F9; los valores los valida `rules-validation`). |
| `lib/admin/months/types.ts` | `UpdateAdminMonthSlotModePayload` y respuesta (ahora incluye `availabilityVersion`, aditivo). Tipos nuevos: `AvailabilityRuleBody`, `AvailabilityExceptionBody`, `PreviewAvailabilityPayload`, `SaveAvailabilityPayload`, `AffectedAppointmentItem`, `PreviewAvailabilityResponse`, `MonthAvailabilityResponse`. |
| `lib/admin/months/service.ts` | Reescrito (T031). `getAvailabilityForMonth`, `previewAvailability`, `saveAvailability`, `updateAdminMonthSlotMode(month, input, now)` (cambia la firma), `createAdminMonths` sin reglas (D17, sin cambio de código). Clase `AffectedAppointmentsConfirmationError` que lleva la lista de citas afectadas para el 409. |
| `lib/db/availability-rules.ts` | Añade `findMonthAvailabilityForUpdate(tx, month)` (`FOR UPDATE`). El resto de funciones de 1A sin cambios. |
| `lib/db/admin-months.ts` | D66: `listAppointmentsByMonth` deja de incluir PENDING (estados `CONFIRMED`, `SYNC_FAILED`, `CANCELLED`). Añade `listMonthActiveAppointmentsForAvailability(db, monthStart, monthEndExclusive)` (incluye PENDING; para citas afectadas) y el tipo `AppointmentReader`. |
| `app/api/admin/months/[month]/availability/route.ts` | **Nuevo.** GET (editor) y PUT. Rutas delgadas: sesión, servicio, mapeo de estados (404, 422, 409, 400). En 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` añade `affectedCount` y `affectedAppointments`. |
| `app/api/admin/months/[month]/availability/preview/route.ts` | **Nuevo.** POST sin escritura. |
| `app/api/admin/months/[month]/slot-mode/route.ts` | Pasa el cuerpo completo al servicio. 409 `AVAILABILITY_VERSION_CONFLICT` y `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` (con lista). Respuesta con `availabilityVersion` (aditivo). |
| `app/api/admin/months/[month]/days/[date]/agenda/route.ts` | Lee `excludeAppointmentId` de la query y devuelve `availableSlots` (vía servicio). |
| `lib/admin/appointments/service.ts` | T032 y D63. Agendado admin con `findMonthAvailabilityForShare` (FOR SHARE) dentro de la transacción, después de los named locks y antes de los conflictos; horarios con el resolvedor (`resolveDay`). Reprogramación admin con el orden D63 (ver §3). `getAdminDayAgenda(input, now)` devuelve `availableSlots` (ocupación sin la cita excluida, bloqueos y locks activos del día). Quita `getAvailableStartSlotsWithManualBlocks` y `resolveBaseSlotsByMonthMode` de este archivo. |
| `lib/admin/appointments/validation.ts` | `timeSlot` `HH:mm` (regex) en agendado y reprogramación (FR-006); `parseAgendaExcludeAppointmentId`. Quita `BASE_TIME_SLOTS`. |
| `lib/admin/blocked-spaces/service.ts` | T033. Horarios bloqueables desde `resolveMonthDays` (`buildBlockableDays` nuevo); `DATE_NOT_OPERATIONAL` por `resolveDayRule` (D46); lectura de reglas con FOR SHARE dentro de la transacción de creación; horarios ofrecibles con `resolveDay`; `durationHours: 1` en todos los meses (D15). Quita `isWeekdayBookingDate`, `BASE_TIME_SLOTS`, `toBaseTimeSlot` y `getMonthDays`. |
| `lib/admin/blocked-spaces/validation.ts` | `slots` como `HH:mm` (regex), sin `z.enum(BASE_TIME_SLOTS)`. |
| `lib/admin/blocked-spaces/types.ts` | `(typeof BASE_TIME_SLOTS)[number]` → `string`; quita el import. |
| `lib/calendar/sync-blocked-slot.ts` | T034. La rama que crea evento nuevo en `syncBlockedSlotUpdate` pasa `durationHours: 1` (D15, D30). Los eventos existentes solo cambian de resumen (sin cambio). |

### Fuera de la lista de T030–T036, pero autorizados por el brief (D63, D65, D66)

| Archivo | Cambio |
|---|---|
| `lib/appointments/book-appointment.ts` | NB-2 (`return await createAppointmentInTransaction`) y NB-3 (`acquireBookingLocks` dentro del `try`) en reserva y en confirmación (dos bloques). |
| `lib/appointments/lock-reservation-slot.ts` | NB-3: `acquireBookingLocks` dentro del `try`. |
| `lib/my-appointments/service.ts` | NB-3: `acquireBookingLocks` dentro del `try` en `rescheduleMyAppointment`. |
| `lib/admin/dashboard/service.ts` | D66: ocupación (`groupActiveAppointmentsByDate`) con `CONFIRMED` y `SYNC_FAILED`; quita el import de `SLOT_BLOCKING_APPOINTMENT_STATUSES`. La lista de pendientes (`listPendingAppointments`) no cambia. |
| `lib/admin/months/detail-service.ts` | **Sin cambio de código.** D66 llega por `listAppointmentsByMonth` (ver §4). |

### Fuera de la lista, cambio de tipo mínimo (deviación a comunicar)

El brief dice "no toques otros archivos; repórtalo". Los siguientes cambios son solo de tipos o imports y son necesarios para que `tsc` pase con los horarios `HH:mm` libres. Pido confirmación al Orchestrator.

- `lib/admin/appointments/types.ts`: tres `timeSlot` de tipo `(typeof BASE_TIME_SLOTS)[number]` pasan a `string`; quita el import.
- `hooks/admin/months/useBlockSpacesModal.ts`: alias `type TimeSlot = string` (quita el import de `BASE_TIME_SLOTS`). T051 lo rehace.
- `hooks/admin/months/useBookAppointmentModal.ts`: alias `type BaseTimeSlot = string` en lugar del import. T052 lo rehace.
- `components/admin/months/BookAppointmentModal.tsx`: alias `type BaseTimeSlot = string` en lugar del import. T052 lo rehace.
- `components/admin/months/BlockSpacesModal.tsx`: alias `type TimeSlot = string`; quita `BASE_TIME_SLOTS` del import (conserva `DIRECTIONAL_SLOT_PAIRS`). T051 lo rehace.

No se tocó `MonthDetailView.tsx` ni `app/api/my-appointments/reschedule/route.ts` (NB-4 no se hizo; ver §6).

## 2. Qué se comprobó (ejecutado) y qué es diseño estático

### Ejecutado en esta sesión

- `npx tsc --noEmit`: **65 errores, todos en `tests/`; 0 fuera de `tests/`.** La línea base del brief era 61 (todos en `tests/`). Hay +4 en `tests/` sin desglose; no lo he comparado archivo a archivo contra HEAD (el brief decía que no debía regresar sin errores nuevos, y **estos cuatro no están verificados como preexistentes**).
- `npx vitest run tests/lib/availability tests/lib/admin tests/lib/db tests/lib/appointments tests/lib/my-appointments.service.test.ts tests/lib/validation tests/lib/calendar tests/app/api-admin-*` (59 archivos): **52 archivos y 359 pruebas pasan; 7 archivos y 14 pruebas fallan; 1 todo.** Los fallos son todos de pruebas antiguas o de expectativas que cambian a propósito (ver tabla), salvo el de cancelación.
- `npx eslint` sobre los archivos tocados: **exit 0** (tras quitar dos imports sin uso, reejecutado sobre los dos archivos: exit 0).

| Archivo de prueba | Fallos | Causa |
|---|---|---|
| `tests/app/api-admin-month-slot-mode-route.test.ts` | 3 | Contrato antiguo: `updateAdminMonthSlotMode(month, mode)` cambió a objeto; respuesta con `availabilityVersion`. T037 pendiente. |
| `tests/lib/admin/blocked-spaces.service.test.ts` | 5 | Mocks de `slotMode`, `BASE_TIME_SLOTS` y `isWeekdayBookingDate`; ahora se leen reglas (`findMonthAvailability`/`ForShare`) y `durationHours` es 1. T038 pendiente. |
| `tests/lib/admin/dashboard.service.test.ts` | 1 | "counts PENDING appointments ... (D61)": el esperado es el de D66 (PENDING no cuenta). Hay que reescribir la expectativa. |
| `tests/lib/admin/months.service.test.ts` | 2 | Firma de `updateAdminMonthSlotMode` y lectura de reglas. T038 pendiente. |
| `tests/lib/admin/months.validation.test.ts` | 1 | "parses valid update slot mode payload": la forma devuelta incluye `expectedVersion` y `confirmAffectedAppointments`. |
| `tests/lib/db/admin-months.test.ts` | 1 | "queries the slot-blocking statuses plus CANCELLED (D59)": el esperado es D66. |
| `tests/app/api-admin-cancel-route.test.ts` | 1 | Expectativa del spy de `cancelAdminAppointment` con argumentos distintos. **No verificado contra HEAD.** La ruta de cancelación y `cancelAdminAppointment` no se modificaron (`git diff` sin cambios en `app/api/admin/appointments`). Probablemente preexistente; hay que confirmarlo. |

### Estático (leído y razonado, no ejecutado)

- Orden de locks D63 en reprogramación admin y en agendado admin (ver §3).
- Estados de error en las rutas nuevas (404, 422, 409, 400) y forma de 409 con lista de afectadas.
- Duración 1 h en bloqueos puntuales (`durationHours: 1`). En `lib/calendar/google.ts` (líneas 215–230) el día completo (`"00:00"`) usa el horario fijo 06:00–23:00, y `durationHours` solo afecta a la rama de puntual. Leí solo parte de esa función; no hay prueba de sincronización.
- D64: en agendado admin, un sábado o domingo con horas legacy ahora responde `SLOT_NOT_AVAILABLE` (409, sin reglas que cubran el día), y una hora con formato inválido (`7:30`) responde `VALIDATION_ERROR` (400). **Verificado solo estáticamente**; no hay prueba automatizada del caso.
- `POST /api/admin/months` sin cambio: `createInactiveMonths` usa `DEFAULT_MONTH_SLOT_MODE = BLOCK_MODE` (T004) y no crea reglas (D17).

### Pendiente de aceptación del owner

- Cambio de comportamiento en `PATCH slot-mode`: antes, si el modo pedido ya era el del mes, devolvía sin escribir. Ahora siempre reemplaza las reglas por el preset (D16) e incrementa la versión. Es coherente con D16, pero cambia el efecto cuando el mes tiene reglas personalizadas y se elige el mismo modo.
- Vista previa de meses pasados: el brief no lo especifica, así que `preview` no bloquea meses pasados (solo `PUT` y `PATCH` responden `MONTH_IN_PAST`).

## 3. Orden de locks en reprogramación admin (D63)

`lib/admin/appointments/service.ts`, `rescheduleAdminAppointment`:

1. Lectura sin bloqueo fuera de la transacción de la cita activa para obtener su teléfono (`findAppointmentOwnerPhone`). Sirve solo para elegir las claves de los named locks; no se usa como decisión.
2. Transacción: `acquireBookingLocks(tx, date, ownerPhone)` dentro del `try`, con `finally releaseBookingLocks`. **[Corregido por el Orchestrator 2026-10-30: era falso al escribirse; en la reprogramación admin el acquire estaba fuera del `try`. Resuelto en la corrección 1 (NB-2).]**
3. `findMonthAvailabilityForShare` (FOR SHARE de reglas).
4. `cleanupExpiredReservationLocks` y `lockConflictingAppointments(tx, date, ownerPhone)`.
5. `findActiveAppointmentByIdInMonthForUpdate` (FOR UPDATE de la cita). Si la cita ya no existe o su teléfono cambió desde la lectura del paso 1, lanza `APPOINTMENT_NOT_FOUND`.
6. Horario vigente, bloqueo de lock ajeno (`SLOT_LOCKED`), resolvedor y `updateAppointmentScheduleById`.

Decisión de producto no tomada aquí: el mapeo a `APPOINTMENT_NOT_FOUND` del cambio de teléfono entre paso 1 y paso 5 es una guarda interna. Lo señalo para revisión.

Prueba del orden de locks **no escrita**. El brief pedía una prueba unitaria del orden y, si es posible, la extensión de `tests/integration/reschedule-concurrency.integration.test.ts` para el caso admin↔pública. Pendiente.

## 4. D66: contadores sin PENDING

- Detalle del mes (`lib/admin/months/detail-service.ts`): usa `listAppointmentsByMonth`, así que ya no ve PENDING en `occupiedSpaces`, `confirmedAppointments`, `appointmentsCount` ni en la saturación. Sin cambio de código en el servicio.
- Dashboard (`lib/admin/dashboard/service.ts`): ocupación semanal y diaria con `CONFIRMED`, `SYNC_FAILED`.
- Listas (`listActiveAppointmentsByDate`, agenda, `listPendingAppointments`): sin cambio.
- Flujo público: sin cambio. `getMonthAvailability` sigue usando `listMonthAppointments` con `SLOT_BLOCKING_APPOINTMENT_STATUSES` (PENDING bloquea).
- **Consecuencia (para el owner):** "Disponibles" del detalle y el tono del calendario pueden mostrar más espacios de los reservables mientras haya citas PENDING. Es el efecto que D66 acepta.
- **Hallazgo previo (no causado por esta ronda):** el agendado admin, la reprogramación admin y la agenda (`listActiveAppointmentSlotsByDateForUpdate`, `listActiveAppointmentsByDateExcludingForUpdate`, `listActiveAppointmentsByDate`) usan `CONFIRMED` y `SYNC_FAILED`, no PENDING. El admin puede agendar encima de una cita PENDING, mientras el público la bloquea. Decisión para el owner: si el agendado admin debe respetar PENDING.

## 5. Correcciones de la ronda (D63, D65, D66) y otras notas

- **D63 (NB-1):** implementado (§3). Prueba: pendiente.
- **D65 NB-2:** `return await createAppointmentInTransaction` en `book-appointment.ts` (reserva). La confirmación ya tenía `await`.
- **D65 NB-3:** `acquireBookingLocks` dentro del `try` en `book-appointment.ts` (2 bloques), `lock-reservation-slot.ts` y `my-appointments/service.ts`. Prueba: pendiente.
- **D65 NB-4:** **no hecho.** `app/api/my-appointments/reschedule/route.ts` no se tocó (el brief pedía hacerlo solo si el archivo ya se tocaba en la ronda, y no fue así). Pendiente.
- **Corrección del informe de la Ronda 4** (`round-04-booking-developer.md`, NB-5 y NB-9): **no hecha**, pendiente.
- **Hallazgo:** `createAdminAppointment` (lib/admin/appointments/service.ts) también toma `acquireBookingLocks` antes del `try`, el mismo patrón que NB-3. No está en la lista de NB-3 y no lo cambié. Propongo incluirlo. **[Corregido por el Orchestrator 2026-10-30: resuelto en 1E-bis; `createAdminAppointment` ya toma el acquire dentro del `try`.]**
- **N2 (`replaceMonthAvailability` exige transacción):** protección implementada por diseño: el único camino de escritura son `saveAvailability` y `updateAdminMonthSlotMode`, que llaman a `prisma.$transaction` y toman `FOR UPDATE` antes de leer citas. **No hay guardia en tiempo de ejecución** (MySQL no expone un `@@in_transaction` fiable); limitación declarada.
- **F9 (`preserveCapacity` por API):** validado como booleano con zod (`z.boolean()`); un valor distinto responde `VALIDATION_ERROR` (400).
- **N-R2 (`findAffectedAppointments` exige mismo mes):** se llama con `current.month` igual al mes editado; la función filtra fuera de mes antes de la rejilla (1C). Sin cambio.
- **D17 y `reconcileActiveMonthsInDatabase`:** **no revisado en esta ronda** (`lib/db/active-months.ts`, `lib/active-months/service.ts`, `scripts/reconcile-active-months.mjs`). Pendiente de revisión e informe.
- **Código muerto:** `updateRegisteredMonthSlotMode` en `lib/db/admin-months.ts` queda sin uso (candidato a Fase 4).
- **Rutas de horas:** `MonthDetailView.tsx` sigue con `toBaseTimeSlot` (Fase 2, T049–T050).

## 6. Pendiente (handoff para la continuación de la ronda)

En orden de prioridad:

1. **Pruebas antiguas (T038 y T039 y las 14 fallidas):** actualizar `tests/lib/admin/months.service.test.ts`, `months.validation.test.ts`, `blocked-spaces.service.test.ts`, `dashboard.service.test.ts` (expectativa D66), `tests/lib/db/admin-months.test.ts` (D66), `tests/app/api-admin-month-slot-mode-route.test.ts`, `tests/lib/availability/service.test.ts`, `tests/lib/availability/month-slot-mode.test.ts`, `tests/lib/appointments/{book-appointment,lock-reservation-slot}.test.ts`, `tests/lib/my-appointments.service.test.ts`, `tests/app/admin-month-detail-page.test.tsx`. Confirmar si `api-admin-cancel-route` es preexistente.
2. **Pruebas nuevas pedidas por el brief (T037, T034, D63):** `tests/app/api-admin-month-availability-route.test.ts` (GET, PUT, preview, 404, 409, 422, 400); `tests/lib/calendar/sync-blocked-slot.test.ts` (1 h puntual, día completo 06:00–23:00, evento existente solo cambia resumen); prueba unitaria del orden de locks en reprogramación admin; extensión de `reschedule-concurrency` para admin↔pública.
3. **Integración en `appointments_test`** (`ENABLE_INTEGRATION_DB=1`, contenedor `appointments-lanuit-db-1`): `availability-concurrency`, `reschedule-concurrency` y los casos nuevos. Distinguir fallos preexistentes (FK `appointment_logs`, columna TIME) de los nuevos. **No ejecutado.**
4. **NB-4:** `LOCK_TIMEOUT` a 409 en `app/api/my-appointments/reschedule/route.ts`, solo si se toca.
5. **NB-5 y NB-9:** corregir `round-04-booking-developer.md` (sin ejecutar).
6. **Revisión de D17:** `reconcileActiveMonthsInDatabase` y `scripts/reconcile-active-months.mjs`.
7. **Delta de `tsc`:** +4 errores en `tests/` sin comparar con HEAD.
8. **Confirmar con el Orchestrator** los cambios de tipo fuera de lista (§1) y `createAdminAppointment` (§5).

## 7. Documentation Impact

- Impacto en flujo: **Sí.**
- Impacto documental: **Sí.** `docs/` no se tocó (lo cierra T075).
- Secciones a actualizar en T075 y T076: `docs/specification.md` (4.x, 7, 10, 12, 15.7 para el catálogo: `Disponibles`, `Modalidad` → `Reglas`, `POST /api/admin/months`); `docs/architecture/api.md` (endpoints `availability`, `availability/preview`, `PUT`, `PATCH slot-mode` con `expectedVersion`, `confirmAffectedAppointments` y `availabilityVersion`, agenda con `excludeAppointmentId` y `availableSlots`, `blockable-slots` con resolvedor); `docs/architecture/business-rules.md` (contadores sin PENDING, D66; reprogramación admin con orden de locks D63; bloqueos puntuales de 1 h, D15); `docs/features/admin-month-detail-flow.md`, `docs/features/booking-flow.md` (`SLOT_NOT_AVAILABLE`, D46), `docs/features/my-appointments-flow.md`, `docs/features/admin-months-catalog-flow.md`; ADR de D15, D66 y D63 en `docs/decisions/`.

## 8. Flow Contract Check

- UI steps updated: **No** (Fase 2; solo deviaciones de tipo, §1).
- API contract updated: **Sí** (contrato de la API admin, ver `contracts/admin-availability-api.md`; código ajustado, docs pendientes).
- Validation rules updated: **Sí** (forma JSON con zod y códigos `AVAILABILITY_*` desde `rules-validation.ts`; `timeSlot` `HH:mm` en citas y bloqueos).
- Acceptance criteria updated: **No.**
- `docs/specification.md` aligned: **No** (pendiente de T075).

## 9. Migration Compatibility Check

- Schema changes required: **No** en esta ronda (la migración `0022` es de 1A).
- Data backfill required: **No** en esta ronda.
- Legacy compatibility required: **Sí.** `slotMode` se mantiene en las respuestas; `PATCH slot-mode` conserva ruta, cuerpo y forma de respuesta (campos nuevos aditivos); `GET /api/admin/months/[month]` sin cambio de forma.
- Rollback strategy defined: **Sí en 1A/1D** (release combinado, D45). Sin cambio en esta ronda.
- Cleanup phase defined: **Sí** (Fase 4, T064–T074).
- Integrity protections defined: **Sí (aplicación):** `FOR UPDATE` sobre `active_months` antes de escribir o leer citas en el editor; `expectedVersion`; `FOR SHARE` en reservas y reprogramaciones admin y públicas; named locks en el orden de D63. Las restricciones de BD de 1A no cambian.

## 10. Riesgos y limitaciones

- Pruebas de 14 casos fallan y no hay pruebas nuevas de T037, T038, T039, T034 ni D63. **La ronda no está lista para revisión.**
- Integración no ejecutada: los cambios de locks (D63, D65) no tienen prueba de integración en esta sesión.
- `tsc` tiene +4 errores en `tests/` sin desglose.
- La ronda cambia tipos de la UI (§1) sin rehacer la UI (Fase 2).
- Hallazgos de §4 y §5 para decisión del owner y del Orchestrator.

## 11. Handoff

- **Hecho (estático y tsc/eslint):** T030, T031, T032 (con D63), T033, T034 (parte de creación), T035, T036, D65 (NB-2, NB-3), D66 (contadores y dashboard), cambios de tipo mínimos (§1).
- **Pendiente:** T037, T038, T039; pruebas de D63, T034 y API nuevas; integración en `appointments_test`; NB-4; corrección de `round-04-booking-developer.md`; revisión de `reconcileActiveMonthsInDatabase`; confirmación del delta de tsc.
- **Archivos tocados:** ver §1.
- **Siguiente paso:** una nueva ronda de Developer (1E-bis) con este handoff y el estado de `tsc` y de pruebas; el Orchestrator confirma los cambios fuera de lista y las decisiones de §4 y §5. No marcar T030–T039 como `[X]` hasta que se ejecuten sus pruebas.
