# Ronda 1D — Developer (T024–T029)

Resumen transcrito por el Orchestrator desde el mensaje de hand-back del Developer (no escribió el archivo).

## Archivos
- Código: `lib/availability/service.ts`, `lib/validation/appointment.ts`, `lib/validation/my-appointments.ts`, `lib/appointments/book-appointment.ts`, `lib/appointments/lock-reservation-slot.ts`, `lib/my-appointments/service.ts`.
- Pruebas: `tests/lib/availability/service.test.ts`, `tests/lib/appointments/{book-appointment,lock-reservation-slot}.test.ts`, `tests/lib/my-appointments.service.test.ts`, `tests/lib/validation/appointment.test.ts`, `tests/integration/availability-concurrency.integration.test.ts` (nuevo), `tests/integration/{book-appointment,reservation-lock}.integration.test.ts` (un caso nuevo cada uno). `tasks.md` T024–T029 marcadas [X].

## Cambios
- Disponibilidad pública con `resolveMonthDays`; reserva, lock y reprogramación pública con `resolveDay` y reglas leídas con `FOR SHARE` dentro de la transacción (en reserva/lock tras `acquireBookingLocks`).
- Quita `WEEKDAY_ONLY` e `isWeekdayInMexicoCity`; `timeSlot` acepta `HH:mm` válido (07:30 ya es válido); día sin horarios u hora no ofrecida → `SLOT_NOT_AVAILABLE` (D46).
- Bloqueos vía `splitBlockedTimeSlots` (N-R3). `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH`: 400 en reserva/lock/confirmación, 409 (`SLOT_NOT_AVAILABLE`) en reprogramación pública (N-R4).
- `lib/availability/rules.ts` legacy sigue exportado (usado por admin; T066 en Fase 4).

## Evidencia (ejecutada por el Developer)
- Unit tocados: availability/service 16, book 15, lock 11, my-appointments 3, validation 6; `tests/lib/availability tests/lib/admin tests/lib/db` 238 pasan + 1 todo.
- Integración en `appointments_test` (`ENABLE_INTEGRATION_DB=1`, wrapper aborta si el destino no coincide): `availability-concurrency` 4/4 (round-trip N5, versión obsoleta, `FOR SHARE` espera al editor ~437 ms, lock sobre hora quitada → `SLOT_NOT_AVAILABLE` D39). Casos nuevos de book y lock pasan en aislamiento. Esta frase sobre los archivos completos es incorrecta: ver "Correcciones" al final (NB-9). `availability-concurrency` borra `appointment_logs` en `beforeEach`/`afterAll` de `appointments_test`.
- eslint 14 archivos exit 0; `tsc` 61 (baseline 62); build en copia de scratchpad sin `.env`/BD exit 0.
- Orchestrator re-ejecutó unit (availability, admin, db, appointments, my-appointments, validation): 36 archivos, 281 pasan, 1 todo.

## Riesgos que declara (para el Reviewer)
1. `bookAppointment` y rutas de crear/reprogramar: `return createAppointmentInTransaction(...)` sin `await` dentro de `try`; el `finally` libera locks antes de terminar. Preexistente, no cambiado.
2. PD-08 en reprogramación pública: no toma locks de reserva; su `FOR SHARE` va tras el `FOR UPDATE` de la cita. Sin ciclo con el editor (solo `FOR UPDATE` sobre `active_months`); revisar en 1E si la auditoría de citas afectadas lee con bloqueo.
3. Fecha inválida (p. ej. 2026-02-30) llega al resolvedor y responde `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH`; sin validación de fecha de calendario (T075/1E).
4. Lock sobre hora quitada y bloqueada por otro teléfono responde `SLOT_LOCKED` (orden de comprobación previo); sin caso dedicado.

## No ejecutado
HEAD baseline de integración, revisión de warnings del build, integración completa, e2e.

## Documentation Impact / Checks
Yes; documentación pendiente a T075 y cierres de fase (flujo de reserva FR-006/015/017/018, reprogramación pública, errores `WEEKDAY_ONLY` → `SLOT_NOT_AVAILABLE`, locks D39). Flow Contract: UI No; API forma igual (cambio de código intencional D46); validación Yes (código); criterios No; specification.md alineado: No. Migration Compatibility: sin esquema ni backfill; legacy Yes (slot_mode en BD); rollback Yes (revertir código); cleanup Fase 4; integridad parcial.

## Correcciones (Ronda 1E-quater, NB-5 y NB-9 del Reviewer)

Corrige el texto de este informe. No cambia el código ni el veredicto de la Ronda 1D.

**NB-5: "falla 5/5 sin el fix" no se reprodujo.** La afirmación aparece citada por el Reviewer (`round-04-booking-reviewer-r1.md`, NB-5) como parte del informe del Developer; el texto de este archivo no la contiene. Con una copia mutada sin `acquireBookingLocks` en `rescheduleMyAppointment`, la prueba de `reschedule-concurrency` pasa 5/5, y el experimento público contra público da 0 dobles reservas en 160 rondas. Esto son datos del Reviewer; en 1E-quater no se volvió a ejecutar el mutante. Por tanto, esa prueba no demuestra que el orden de locks sea necesario. El orden se mantiene por diseño (PD-08, D39). La carrera admin contra pública (NB-1, D63) sigue sin prueba determinista: ver `STATE.md`.

**NB-9: causas de los fallos de integración.** La frase original atribuía todos los fallos completos a `appointment_logs`. Son dos causas distintas:
- `book-appointment.integration.test.ts`: fallaba en `beforeEach` por FK de `appointment_logs` (defecto preexistente del helper). Ya corregido en `tests/integration/helpers/db.ts` (el reset borra `appointment_logs` antes de `appointment`). Re-ejecutado en 1E-quater contra `appointments_test` (wrapper que aborta si el destino no es esa base): 9/9 pasan en el archivo completo, incluido el caso nuevo de días sin horarios (D46).
- `reservation-lock.integration.test.ts`: 2 fallos preexistentes por igualdad sobre la columna `TIME`, con `expected [] to have a length of 1` en las líneas 65 (`activeLocks`) y 145 (`appointments`) del archivo de trabajo. En HEAD el mismo código está en las líneas 64 y 144. El caso nuevo "locks only the times that the rules offer (D46, D55)" pasa en el archivo completo. Re-ejecutado en 1E-quater: 2 fallan y 2 pasan (incluido el caso nuevo). Que la causa sea la igualdad sobre `TIME` se sostiene por inspección del código y por el comentario del Reviewer; no se ejecutó la línea base en HEAD.

Otros resultados de la misma ejecución: `reschedule-concurrency` 1/1 pasa. Total del wrapper: 14 pruebas, 12 pasan, 2 fallan (los dos de `reservation-lock` indicados arriba).
