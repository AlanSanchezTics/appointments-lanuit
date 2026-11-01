# Ronda 07 (1F) corrección 4: informe del Developer (r4)

Transcrito (resumido) por el Orchestrator desde el hand-back. Sin handoff; ~50 llamadas de herramienta. No se tocó documentación, scripts ni el orden de locks de producción. Sin acceso a `appointments`/`DATABASE_URL_PROD`; sin `prisma db execute`.

## Cambios
1. `lib/my-appointments/service.ts` (~L352-362), B-1: el catch de `getBookableMonthConfig` convierte en `SLOT_NOT_AVAILABLE` solo `error instanceof Error && error.message === "MONTH_NOT_ALLOWED"`; relanza el resto.
2. `tests/lib/my-appointments.service.test.ts`: caso nuevo "propagates an infrastructure error from the month check…" (Timed out fetching a new connection from the connection pool); se mantiene MONTH_NOT_ALLOWED.
3. `tests/integration/admin-create-concurrency.integration.test.ts` (NB-1/NB-2): sin `setTimeout(800)`; `waitForAdminBlockedOnBookingDate()`; réplica pública con orden D89; comentario L59-61 actualizado.
4. `tests/lib/appointments/lock-reservation-slot.test.ts`, `book-appointment.test.ts`, `tests/lib/admin/blocked-spaces.service.test.ts` (NB-3): aserciones `invocationCallOrder`.
5. `tests/integration/reschedule-reservation-lock.integration.test.ts` (NB-4): `waitForLockWait()` devuelve objetos en espera (join `data_lock_waits` -> `data_locks`); exige `toContain("appointments")` y `not.toContain("reservation_locks")`.
6. `lib/admin/appointments/service.ts` (NB-8): dos comentarios de una línea antes de cada `if (activeLock)` (creación ~L291, reprogramación ~L500).
`tsconfig.tsbuildinfo` modificado por `tsc --noEmit` (caché; ya estaba modificado).

## Resultados
- B-1: `my-appointments.service.test.ts` 17/17; con el catch genérico (mutación en copia) falla solo el caso nuevo.
- NB-1/NB-2: `admin-create-concurrency` 2/2 x3.
- NB-3: 35/35; invertir el orden en cada una de las tres rutas falla solo su test nuevo.
- NB-4: `reschedule-reservation-lock` 9/9 x3; con M1 la sonda devuelve `['reservation_locks']` y falla (8/9).
- Unitarios `tests/lib` + rutas reprogramación: 382 pasan, 1 todo, 2 fallan (línea base whatsapp `Intl`). eslint `lib/` exit 0. tsc 32 errores todos en `tests/`.
- Integración completa en `appointments_test`: 30/35, 5 fallos = línea base (cancel-appointment 3, reservation-lock L65/L145). Wrapper en scratchpad (`run-integration.mjs`), imprime solo el nombre de la base.

## Desviaciones
1. NB-8: `scratchpad/bak-admin-service.ts` no existe; los dos comentarios se escribieron desde el SQL real (`lib/db/appointments.ts` L517): "NB-4: el SQL ya excluye los locks del mismo teléfono (phone <>), así que activeLock es siempre ajeno." No verificado contra el original.
2. NB-1: `data_lock_waits` no sirve para la espera de la creación admin (queda en `GET_LOCK('booking:date:<fecha>')`, un named lock); se usa `performance_schema.metadata_locks` (`USER LEVEL LOCK ... PENDING` del objeto concreto).
3. NB-3: la confirmación llama `lockConflictingAppointments` dos veces (L483 y L147 vía helper); la aserción exige que la primera preceda a la limpieza.
4. NB-2: no se usó la función real en `admin-create-concurrency` (sin punto de pausa sencillo sin mocks); la réplica quedó con el orden D89.
5. Incidente de copia: `rsync` copió `.env` a la copia de mutación en el scratchpad; se eliminó y las copias posteriores lo excluyen. El repo no tiene copias de `.env`.

## Documentation Impact
Sí, sin tocar docs: B-1 cambia la respuesta de la reprogramación pública ante fallo de infraestructura (antes 409 `SLOT_NOT_AVAILABLE`, ahora el error se propaga, D81/D91). Afecta spec 8.2, `api.md`, `business-rules.md`. Pendiente micro-ronda NB-5 (ADR 0006, runbook, spec 7/8.2/9, `booking-flow.md`, `business-rules.md`, `api.md`).

## Migration Compatibility Check
Sin esquema, backfill ni compatibilidad legacy; rollback = revertir `lib/my-appointments/service.ts`; sin cambios en locks, citas ni BD.

## No verificado
Suite unitaria completa; `api-admin-cancel-route` y `month-detail-view` (línea base conocida); línea base de integración contra HEAD; e2e y `next build`; NB-8 contra el original.
