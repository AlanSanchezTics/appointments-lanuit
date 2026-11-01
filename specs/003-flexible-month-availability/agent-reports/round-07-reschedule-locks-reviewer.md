# Ronda 07 (1F): auditoría reviewer-high-risk (D87)

Transcrito por el Orchestrator desde el hand-back del Reviewer (el agente no puede escribir `.md`).

**Veredicto: Rejected** (2 bloqueantes).

## Bloqueantes

**B1. Deadlock entre reserva pública y reprogramación pública.**
`lib/my-appointments/service.ts:379` (lectura de locks FOR UPDATE) ocurre después de `lockConflictingAppointments` (L431) y de la fila de la cita FOR UPDATE (L433). La reserva pública ejecuta antes `cleanupExpiredReservationLocks` (`lib/appointments/lock-reservation-slot.ts:122`; `lib/db/appointments.ts:447-455`), un `deleteMany` por `expiresAt <= now` sin condición de fecha. Ciclo: la reserva (fecha D2) limpia locks de todas las fechas y espera las citas que la reprogramación ya bloqueó; la reprogramación espera la lectura de locks bloqueada por la limpieza. Sondeo en `appointments_test`: control sin deadlock; orden actual => la reserva falla con `Deadlock found`; variantes (a) y (b) sin deadlock. Sin pérdida de datos (la víctima se revierte). La creación admin usa la misma secuencia (`lib/admin/appointments/service.ts:280-283`, `:471-489`): riesgo preexistente.
Correcciones: (a) acotar la limpieza a la fecha procesada (`DELETE ... WHERE date = ? AND expires_at <= ?`); (b) leer locks antes de los conflictos en la reprogramación (cambia el orden de D77, requiere justificarlo). Requiere un test de concurrencia que falle sin la corrección; re-probar con `deleteActiveReservationLocksByPhone`.

**B2. Error de la lectura de locks se reporta como `SLOT_NOT_AVAILABLE`.**
La lectura (L379) está dentro del `try` de L344; el `catch` de L408-414 lo convierte en `SLOT_NOT_AVAILABLE` (409). Contradice D81 (NB-5). Corrección: sacar la lectura del `try` o relanzar errores distintos de `SLOT_NOT_AVAILABLE`.

## No bloqueantes
- N1 `tests/lib/my-appointments.service.test.ts:439-451`: "filters expired" solo afirma texto SQL; la caducidad real se valida en integración.
- N2 mismo caso: añadir `expect(lockSql).toContain("FOR UPDATE")`.
- N3 `tests/app/api-my-appointments-reschedule-route.test.ts`: falta caso 409 `SLOT_NOT_AVAILABLE`.
- N4 `lib/db/appointments.ts:508-511`: `LIMIT 1` depende del invariante un lock vigente por (fecha, hora); filtrar `AND phone <> ${phone}` en SQL.
- N5 integración "rechaza" (L90): no verifica ausencia de evento `MODIFIED` ni que el lock ajeno siga vigente.
- N6 Documentación pendiente: spec 8.2 (nota de error), `api.md` (causa "lock vigente de otra clienta"), `business-rules.md`, D87.
- N7 Perfil: `{{test_commands}}` apunta a una sección inexistente de `CLAUDE.md`.
- N8 F1/D82 también afecta a la nueva espera.

## Verificación
- Orden de locks en código correcto; deadlock no cumple (B1). Predicado `expires_at`, zona horaria y teléfono correctos (integración real). Cita propia excluida por id. Mapeo HTTP intacto.
- Unitarios dirigidos 35/35; regresión 39/39; eslint exit 0.
- `appointments_test` con 22 migraciones; no se tocó `appointments`. `reschedule-reservation-lock.integration` 4/4. Suite integración completa: 25 pasan, 5 fallan = línea base (cancel-appointment 3/3, reservation-lock L65/L145).
- Mutaciones: sin el bloque D87 fallan 2 unitarios y 1 integración; sin exclusión de teléfono propio falla el unitario.
