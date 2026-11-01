# Ronda 07 (1F) corrección 1: informe del Developer (r1)

Transcrito por el Orchestrator desde el hand-back del Developer. Estado: B1, B2 y N2–N5 completados y verificados con ejecución; documentación no tocada.

## Cambios
- `lib/db/appointments.ts`: `cleanupExpiredReservationLocks(tx, date, now)` filtra `date = fecha AND expiresAt <= now` (B1/D88). `findActiveReservationLockForSlotForUpdate` recibe `phone` y añade `AND phone <> ${phone}` (N4).
- `lib/my-appointments/service.ts` (B2/D88): la lectura de locks sale de `validateRescheduleDestination` y vive en `rescheduleMyAppointment` (tras conflictos, fila de la cita y comprobaciones futuro/3 h, antes de la validación del destino). Lock ajeno => `SLOT_NOT_AVAILABLE`; errores de transacción (deadlock/timeout) se propagan sin mapear.
- Llamadores de cleanup con fecha: `lib/appointments/lock-reservation-slot.ts:122`, `lib/appointments/book-appointment.ts:482`, `lib/admin/appointments/service.ts:280` y `:471`, `lib/admin/blocked-spaces/service.ts:238`. `lib/admin/appointments/service.ts` pasa `phone` a los dos `findActiveReservationLockForSlotForUpdate`.
- Tests: `tests/lib/my-appointments.service.test.ts` (phone, FOR UPDATE, caso deadlock propaga), `tests/app/api-my-appointments-reschedule-route.test.ts` (409), `tests/integration/admin-create-concurrency.integration.test.ts` (DATE), `tests/integration/reschedule-reservation-lock.integration.test.ts` (N5 + describe nuevo "public reservation vs public reschedule without deadlock (D88/B1)", 3 rondas).

## Revisión de llamadores
Los 5 llamadores de producción tienen la fecha. La limpieza global solo existe en `scripts/cleanup-reservation-locks.mjs` y `lib/maintenance/cleanup-reservation-locks.ts` (manuales, no usan el helper). Todos los lectores de `reservation_locks` filtran `expires_at > now`: dejar filas expiradas de otras fechas no cambia el comportamiento.

## `deleteActiveReservationLocksByPhone`
No modificado. Solo se usa en `lock-reservation-slot.ts:167` tras `lockConflictingAppointments`; índice `(phone, expires_at)`. Sondeo temporal (3 rondas) sin deadlock; archivo del sondeo borrado. Recomendación: no tocarlo.

## Ejecución
- Unitarios dirigidos: 7 archivos, 56/56.
- Integración contra `appointments_test` (`--no-file-parallelism`): 31 tests, 26 pasan, 5 fallan = línea base (cancel-appointment 3/3, reservation-lock L65/L145). `reschedule-reservation-lock` 5/5 en 3 repeticiones.
- eslint de `lib/`: exit 0 (la config no cubre `tests/`). tsc: 32 errores preexistentes en tests no tocados.
- Mutación B1 (quitar filtro `date`): el describe D88 falla con `Deadlock found` (1213) en la reserva pública; fix restaurado y verificado con `diff`.
- No comprobado: caso B2 unitario contra el código anterior (solo razonamiento); lint de tests.

## Limitaciones
Réplica de `lock-reservation-slot` en la prueba de concurrencia (actualizar si cambia el orden); pausas de 800 ms; filas expiradas de otras fechas permanecen hasta el script manual o hasta procesar esa fecha.

## Documentación pendiente (no tocada)
- `docs/specification.md`: L202 y L435 ("limpia locks expirados" => de la fecha procesada, D88); L417 ("cleanup lazy ... de la fecha pedida"); 8.2 (error de transacción en lectura de locks => 400 `UNKNOWN_ERROR`, D81; error por lock ajeno `SLOT_NOT_AVAILABLE`).
- `docs/features/booking-flow.md` L132 y L227.
- `docs/architecture/business-rules.md` Concurrency Rules (~L196) y ~L288.
- `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`: registrar D88.
- `docs/runbooks/reservation-lock-cleanup.md` L10.
- `docs/architecture/api.md`: causa "lock vigente de otra clienta" en `SLOT_NOT_AVAILABLE` y 400 `UNKNOWN_ERROR` por error de transacción.

## Migration Compatibility Check
Sin esquema ni backfill; índice `(date, time_slot, expires_at)` ya existe; rollback = revertir código; sin restricciones nuevas de BD.
