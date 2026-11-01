# Ronda 07 (1F) corrección 1, re-revisión ciclo 2: reviewer-high-risk

Transcrito por el Orchestrator desde el hand-back del Reviewer. Sondas y mutaciones en copia del scratchpad; el repo no se modificó.

**Veredicto: Rejected** (2 bloqueantes).

## Estado de hallazgos previos
- B1: parcial. Caso original resuelto (M1 sin fecha reproduce 1213 3/3; con fix D88 5/5); residual demostrado (BLK-1).
- B2 lectura de locks: resuelto (`lib/my-appointments/service.ts:441-446`; mutación M2 hace fallar el unitario). B2 resto del servicio: no resuelto (BLK-2).
- N2, N3, N4, N5 resueltos. N1 cubierto por integración (`reschedule-reservation-lock.integration.test.ts:126-145`). N6 pendiente (NB-3). N8 sin cambio (NB-6).

## Bloqueantes
**BLK-1. Deadlock reserva pública vs reprogramación pública entre fechas distintas.**
`lib/db/appointments.ts:449-462` (el DELETE por fecha bloquea, bajo REPEATABLE READ, también filas activas de esa fecha); `:497-521` (lectura FOR UPDATE de la reprogramación); `lib/appointments/lock-reservation-slot.ts:122-123` (limpieza y luego conflictos). Escenario: Luis reprograma de D2 a D 10:00; Ana reserva en D2 a otra hora; D2 tiene una fila activa de `reservation_locks` de una tercera clienta y D no tiene filas posteriores a 10:00. La reserva limpia D2 y retiene la fila; la reprogramación bloquea sus citas y espera la fila de D2; la reserva espera las citas. => `Deadlock found` (1213). Evidencia en `appointments_test`: función real `acquireReservationSlotLock` con pausa (solo en copia): 1213 en 2/3 con fila en D2; control sin fila 3/3. Réplica D88: mismo patrón.
Causa: la limpieza de RL (y en algunas rutas la lectura de RL) ocurre antes de los conflictos de citas mientras la reprogramación toma citas y luego RL; acotar por fecha reduce filas pero no elimina la inversión. Sin doble reserva ni pérdida de datos (la víctima se revierte; la reserva ve 400 `UNKNOWN_ERROR`).
Sin ejecutar, por análisis: `confirmAppointmentWithLock` (`book-appointment.ts:482/484/524/147`), creación admin (`admin/appointments/service.ts:280-283`, `:490`), reprogramación admin (`:472-473`, `:490`), bloqueo de espacios (`blocked-spaces/service.ts:238-239`; no toma `booking:date`).
Corrección requerida: eliminar la inversión RL -> citas en todas las rutas que limpian locks (limpieza después de `lockConflictingAppointments` o cambio estructural justificado); actualizar ADR 0006 y D88; test con la función real y espera determinista que falle con la configuración actual. Si el owner acepta el residual, debe constar como riesgo aceptado, no como resuelto.

**BLK-2. Errores de transacción en lecturas FOR UPDATE de la reprogramación se convierten en `SLOT_NOT_AVAILABLE`.**
`lib/my-appointments/service.ts:396-402`: el `catch` de `validateRescheduleDestination` envuelve `tx.appointment.findMany` (`:359-373`) y `listBlockedSlotsByDateForUpdate` (`:374`). Sonda con deadlock inyectado => `SLOT_NOT_AVAILABLE`. Contradice D81/D88. Corrección: conservar solo errores de dominio y relanzar el resto; test unitario.

## No bloqueantes
- NB-1: `reschedule-reservation-lock.integration.test.ts:260` usa `setTimeout(800)`; con M1 + sleep 0 el test pasa 2/2 (falso verde). Usar espera determinista (sondear `information_schema.INNODB_TRX` hasta `LOCK WAIT`).
- NB-2: la réplica (`:194-207`) omite `deleteActiveReservationLocksByPhone`, `listActiveReservationLocksForDate` e INSERT; usar la función real.
- NB-3: documentación pendiente: spec L202/417/435; `booking-flow.md` L132/L227; `business-rules.md` ~L196/~L288; ADR 0006 (sin D88 ni limpieza de RL en el orden); `runbooks/reservation-lock-cleanup.md:10`; `api.md` (causa "lock vigente de otra clienta").
- NB-4: chequeos JS `activeLock.phone !==` en admin (`:290`, `:497`) redundantes pero coherentes.
- NB-6: F1/D82 sin cambio.

## Verificación ejecutada
- Unitarios dirigidos 9 archivos 66/66; eslint exit 0; `prisma migrate status` en `appointments_test` al día (22).
- Integración dirigida: `reschedule-reservation-lock` 5/5, `admin-create-concurrency` 2/2, `reschedule-concurrency` 1/1. Completa (`--no-file-parallelism`): 31 tests, 26 pasan, 5 fallan = línea base (cancel-appointment 3/3, reservation-lock L65/L145).
- Mutaciones: M1 falla el test D88 3/3; M1 + sleep 0 pasa (falso verde); M2 falla el unitario "propagates a transaction error".
- Limitaciones: sin `EXPLAIN`; rutas admin/confirmación no ejecutadas; sonda con fila expirada no ejecutada.
