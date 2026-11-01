# Ronda 1E-quater — Developer (cierre final de 1E: T038/T039, T033 y correcciones NB-5/NB-9)

Estado: **cerrada por el Developer**, pendiente de revisión del Orchestrator. Solo pruebas, un ajuste de tipos en pruebas y correcciones de informe. No se tocó código de producción, `docs/`, git (sin commit, sin cambio de rama) ni `next build`.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `tests/lib/availability/service.test.ts` | Completa los fixtures a la forma real del mapeo: 7 citas con `alias: null` y `clientNumber`; 6 bloqueos con `googleEventId`, `calendarSyncStatus: "CONFIRMED" as const`, `calendarSyncReason: null`. Sin cambio en aserciones. |
| `tests/lib/appointments/book-appointment.test.ts` | (a) `findReservationLockByTokenForUpdateMock` tipado como `PersistedReservationLock \| null` (antes se inferia `null`). (b) `syncAppointmentToCalendarMock` tipado con `Awaited<ReturnType<typeof syncAppointmentToCalendar>>` (la unión no está exportada). (c) `reason`/`syncReason` `"GOOGLE_UNAVAILABLE"` → `"CALENDAR_SYNC_FAILED"` (2 ocurrencias): `GOOGLE_UNAVAILABLE` no existe en el tipo de producción (`"CALENDAR_NOT_CONFIGURED" \| "CALENDAR_SYNC_FAILED"`, `lib/calendar/sync-appointment.ts`). La aserción sigue comprobando que el motivo se propaga al resultado; solo cambia el valor literal. |
| `tests/lib/appointments/lock-reservation-slot.test.ts` | `listActiveReservationLocksForDateMock` tipado como `PersistedReservationLock[]`; `listBlockedSlotsByDateForUpdateMock` tipado como `Array<{ id, date, timeSlot, reason: string, createdByAdminId }>` (mismo patrón que `book-appointment.test.ts`). Antes se inferían `never[]`. |
| `tests/lib/admin/blocked-spaces.service.test.ts` | **T033**: 2 pruebas nuevas de `DATE_NOT_OPERATIONAL` en `createAdminBlockedSlots`: (1) sábado 2026-04-25 sin horarios en BLOCK_MODE; (2) miércoles 2026-04-22 cerrado por una excepción vacía. Ambas esperan el rechazo y que no se llame a `createBlockedSlots` ni a la sincronización. |
| `specs/003-flexible-month-availability/tasks.md` | Marcadas `[X]` T033, T038, T039 (criterios abajo). |
| `specs/003-flexible-month-availability/agent-reports/round-04-booking-developer.md` | Corrección NB-5/NB-9: frase incorrecta de la línea 17 sustituida y bloque "Correcciones" al final. |
| `specs/003-flexible-month-availability/agent-reports/round-05-admin-api-developer-quater.md` | Este informe. |

Fuera de la lista del round, sin cambios: `tests/lib/availability/month-slot-mode.test.ts`, `tests/lib/admin/months.service.test.ts`, `tests/lib/admin/months.validation.test.ts`, `tests/lib/admin/appointments.service.test.ts`, `tests/lib/my-appointments.service.test.ts`, `tests/app/admin-month-detail-page.test.tsx` (no tenían errores de `tsc` ni patrones prohibidos; ver "Estático").

Nota: `tsc --noEmit` puede reescribir `tsconfig.tsbuildinfo`; ese archivo ya aparecía modificado antes de la ronda.

## Tipos de error `tsc` antes y después

- Línea base (antes de editar): **56** errores, todos en `tests/`.
- Después: **32** errores, **0** fuera de `tests/`. Los 24 cerrados son: `service.test.ts` 13 → 0; `book-appointment.test.ts` 6 → 0; `lock-reservation-slot.test.ts` 5 → 0.
- Restantes (fuera de alcance de esta ronda): `admin-middleware.test.ts` 6, `month-detail-view.test.tsx` 4 (NB-R3-1, preexistentes), `cancel-appointment.integration.test.ts` 3, `backfill-appointment-logs.test.ts` 3, `admin-client-detail-page`, `api-cancelar-buscar`, `api-cancelar`, `api-reservar`, `cancel-wizard`, `home-page`, `appointment-logs-view`, `admin-clients-catalog.spec.ts` 2, `admin-month-detail.spec.ts` 1, `appointments.api-client.test.ts` 2, `booking/api-client.test.ts` 2, `reject-pending-appointments.test.ts` 2 (1 cada uno salvo los indicados).

## Criterios T033 / T038 / T039

- **T033**: prueba(s) de `DATE_NOT_OPERATIONAL` pasan (2/2). Producción ya tenía la guarda (`lib/admin/blocked-spaces/service.ts`, `resolveDayRule(...)?.times.length` antes de la transacción). Verificado: `BASE_TIME_SLOTS` e `isWeekdayBookingDate` no aparecen en `lib/admin/blocked-spaces/`, `lib/admin/months/`, `lib/admin/appointments/` ni en `tests/lib/admin/blocked-spaces.service.test.ts`.
- **T038**: `tsc` limpio en los 6 archivos de su lista (0 errores cada uno) y pruebas dirigidas pasando. **Caveat abierto**: `tests/lib/availability/month-slot-mode.test.ts` sigue afirmando las constantes de los modos (BLOCK 6 horas, SECOND_ONLY 10/14/18) a través de `resolveBaseSlotsByMonthMode`. Esa función sigue viva en producción (`components/admin/months/MonthDetailView.tsx:38`, `lib/admin/months/types.ts`, `lib/db/admin-months.ts`), así que no la quité. Es decisión del Orchestrator: marcar T038 como cumplido con este caveat, o dejarlo abierto hasta retirar el módulo (T068/T078, Fase 4).
- **T039**: `tsc` limpio en sus 4 archivos y pruebas pasando. Cobertura de día sin horarios: `book-appointment.test.ts` L634 ("returns SLOT_NOT_AVAILABLE when the day has no offered times (D46)") y el caso de integración de `book` (ver abajo).

## Comandos ejecutados y resultados

1. `npx tsc --noEmit` (antes): 56 errores, todos en `tests/`.
2. `npx tsc --noEmit` (después): 32 errores, todos en `tests/`.
3. `npx vitest run tests/lib/availability tests/lib/admin tests/lib/db tests/lib/appointments tests/lib/my-appointments tests/lib/validation tests/lib/calendar tests/lib/active-months tests/app/api-admin- tests/app/api-my-appointments admin-month-detail-page tests/components/admin/months`
   - Resultado: **71 archivos: 69 pasan, 2 fallan; 479 pruebas pasan, 1 todo, 2 fallan** (482 total). Los 2 fallos son los preexistentes del criterio de salida: `tests/app/api-admin-cancel-route.test.ts` "returns 200 when cancellation succeeds" y `tests/components/admin/months/month-detail-view.test.tsx` "disables schedule CTA when month is inactive". Antes de la ronda: 477 pasan; las +2 son las pruebas de T033.
4. `npx vitest run tests/lib/admin/blocked-spaces.service.test.ts tests/lib/availability/service.test.ts tests/lib/appointments/book-appointment.test.ts tests/lib/appointments/lock-reservation-slot.test.ts tests/lib/availability/month-slot-mode.test.ts --reporter=verbose`: 5 archivos, 55 pruebas pasan. Las 2 nuevas aparecen como ✓.
5. `npx eslint` sobre los 5 archivos de prueba tocados: **exit 0**.
6. Integración, wrapper `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/7999bae6-f9f5-4f85-9340-e8d79f1c00ee/scratchpad/run-integration-test-db.sh` (fuerza `DATABASE_URL` a `appointments_test`, aborta si el destino no coincide, quita `DATABASE_URL_PROD`, exporta `ENABLE_INTEGRATION_DB=1`; no está en el repo). Archivos: `book-appointment`, `reservation-lock`, `reschedule-concurrency`:
   - Destino verificado: `appointments_test`. Total: 14 pruebas, **12 pasan, 2 fallan**.
   - `book-appointment` 9/9 (archivo completo, incluido el caso nuevo de días sin horarios D46).
   - `reschedule-concurrency` 1/1.
   - `reservation-lock` 2/4: fallan "allows only one active lock for the same slot" (línea 65) y "allows only one successful confirmation for the same lock token" (línea 145), ambas con `expected [] to have a length of 1`. Pasan "rejects confirmation when the lock has already expired" y el caso nuevo "locks only the times that the rules offer (D46, D55)".

## Estático vs ejecutado

- **Ejecutado**: los comandos 1–6 de arriba.
- **Estático (lectura de código y grep)**: ausencia de `isWeekdayBookingDate`/`BASE_TIME_SLOTS`/`slot_mode`/`WEEKDAY_ONLY` en las pruebas de la lista; origen de `DATE_NOT_OPERATIONAL` (`service.ts`, línea ~212); mapeo de estados de la ruta de bloqueos (`app/api/admin/months/[month]/blocked-slots/route.ts`: 409 para `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED`, `DAY_ALREADY_BLOCKED`, `BLOCKED_SLOT_ALREADY_EXISTS`; 422 para `DATE_IN_PAST`; 400 por defecto); líneas de `toHaveLength(1)` en `reservation-lock` (65 y 145 en el archivo de trabajo; 64 y 144 en HEAD, mismo contenido).
- **Pendiente de Reviewer / owner**: ninguna prueba nueva se ha validado con mutación (ver limitaciones).

## Correcciones de informe (NB-5 / NB-9)

- **NB-5** ("falla 5/5 sin el fix"): la frase está citada por el Reviewer como parte del informe del Developer, pero no aparece en el texto de `round-04-booking-developer.md`. Corregido en ese archivo: no se reprodujo; el mutante sin `acquireBookingLocks` pasa 5/5 y 0/160 dobles (datos del Reviewer, **no re-ejecutados** en 1E-quater). El orden de locks se mantiene por diseño (PD-08, D39).
- **NB-9** (causas de fallo): `book` fallaba por FK de `appointment_logs` en `beforeEach` (ya corregido en `tests/integration/helpers/db.ts`; **re-ejecutado: 9/9**). `reservation-lock` falla por igualdad sobre `TIME` (2 fallos preexistentes, líneas 65 y 145; **re-ejecutado**), no por FK. La causa `TIME` se sostiene por inspección; **no se ejecutó la línea base en HEAD**.

## Limitaciones y riesgos

1. **Mutación no ejecutada** para las 2 pruebas nuevas de T033. Por lectura: sin la guarda, `createAdminBlockedSlots` llegaría a `prisma.$transaction` y `createBlockedSlots` se llamaría, así que ambas aserciones fallarían. No está comprobado con un mutante.
2. **`DATE_NOT_OPERATIONAL` sin mapeo explícito de estado HTTP**: la ruta de bloqueos lo responde con **400** (valor por defecto de `resolveStatusCode`). R-13 dice "sin cambio de contrato", así que no lo toqué. No hay prueba de ruta para este código. Decisión para el Orchestrator/owner si debe ser 409 o 422.
3. **`month-slot-mode.test.ts`**: ver caveat de T038 (constantes de modo todavía vivas en producción).
4. **Mapeo de `reason` en book**: el valor `GOOGLE_UNAVAILABLE` era un literal inexistente en el tipo; el cambio es de tipo de prueba, no de comportamiento de producción. Se señala para que el Reviewer lo valide.
5. **Integración**: solo `book`, `reservation-lock` y `reschedule-concurrency`. No se ejecutó `availability-concurrency`, `availability-backfill`, `cancel` ni la suite completa; no hay baseline de integración en HEAD.
6. **Mocks de ruta**: las pruebas de ruta mockean el servicio (prueban el mapeo, no la lógica). Esto no cambió en la ronda.
7. **Fuera de alcance, no tocado**: D63 (extensión de integración admin↔pública) y N2 (carry-forward, D74); D66, D68, D71, D72 y D73 sin cambios. D73 se verifica solo por lectura: `SLOT_NOT_AVAILABLE` → 409 en la ruta de bloqueos, pero ninguna prueba de esta ronda cubre la creación admin fuera de rejilla.
8. **Turnos**: unas 48 llamadas de herramienta (conteo propio, no medido por la plataforma). Por debajo del umbral de handoff (~65).

## Documentation Impact

- No hubo cambio de flujo ni de comportamiento de producción; `docs/` no se tocó.
- `specs/003-flexible-month-availability/tasks.md`: T033, T038 y T039 marcados `[X]` con el caveat de T038 indicado arriba.
- Pendiente de T075 (fuera de esta ronda): redactar el comportamiento de `DATE_NOT_OPERATIONAL` (estado HTTP) si el owner lo fija.

## Handoff

- Hecho: T033, T038 y T039 (con caveat), correcciones NB-5/NB-9, `tsc` 56 → 32, batería dirigida sin fallos nuevos, integración de 3 archivos en `appointments_test`.
- Pendiente: decisión del Orchestrator sobre el caveat de T038 (`month-slot-mode.test.ts`) y sobre el estado HTTP de `DATE_NOT_OPERATIONAL`; revisión del Reviewer (cambio de literal en book-appointment).
- Próximo paso sugerido: Reviewer de la ronda (alto riesgo por `AppointmentLog`/reservas, según el perfil; el tipo de cambio es solo de pruebas).
