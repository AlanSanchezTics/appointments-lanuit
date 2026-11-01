# Re-revisión ciclo 2 de T075 (documentación): reviewer-docs

Transcrito (resumido) por el Orchestrator. Verificación estática (lectura y grep de código y docs); sin tests, sin `.env`, sin bases de datos. `python3 scripts/check-workflow-profile.py`: "OK: 9 keys, all defined, used, and resolvable" (aviso de Spec Kit 0.11.9 vs 1.0.5 es de entorno).

**Veredicto: Approved.** Sin bloqueantes. T075 [X] se sostiene.

## B1 y B2 del ciclo 1: cerrados
- B1 (locks en reprogramación pública): `lib/my-appointments/service.ts:414-444` (acquireBookingLocks, findMonthAvailabilityForShare, lockConflictingAppointments, cita de origen, `findActiveReservationLockForSlotForUpdate`, `validateRescheduleDestination`); lock ajeno => `SLOT_NOT_AVAILABLE`; consulta con `expires_at > now AND phone <> propio FOR UPDATE` (`lib/db/appointments.ts:~500-520`); solo `MONTH_NOT_ALLOWED` se convierte (`service.ts:352-362`). Spec 8.2 punto 4 (L371) y business-rules ~L288-290 coinciden.
- B2 (bloqueos manuales sin named lock): `lib/admin/blocked-spaces/service.ts:228-244`. Alineados spec 9 (excepción y paso 1), business-rules (Concurrency Rules pasos 1, 4, 5, 6), ADR 0006 (Decisión, F2) y `data-model.md`.

## Consistencia cruzada verificada contra código
Orden named -> FOR SHARE -> conflictos -> limpieza/lectura/escritura de RL coincide en spec 7 paso 8, 8.2, 9, business-rules, booking-flow (L133, L228), ADR 0006 y runbook, contra las 6 rutas. Limpieza por fecha (`lib/db/appointments.ts:~449-461`); excepción del bloqueo de espacios; error de infraestructura = 400 `UNKNOWN_ERROR` (ruta `app/api/my-appointments/reschedule/route.ts`; `api.md` L273/L439-440/L489/L491); `SLOT_NOT_AVAILABLE` por lock ajeno/mes no reservable (`api.md` L483); `LOCK_TIMEOUT` 409; cron cada minuto D92 (runbook sin "ventana de bajo tráfico"); en creación admin la lectura de RL precede a la ocupación (`admin/appointments/service.ts:283-296`). Sin `MONTH_NOT_ACTIVE` indebido. D87-D93 cubiertas sin contradicciones.

## Decisiones del Developer de T075-F
1. RL antes de ocupación en creación admin: correcta. 2. F4 corregido, F5 cubierta: correcto. 3. ADR 0002 riesgo de cobertura: correcta; el riesgo sigue vigente (`tests/lib/availability/equivalence-legacy.test.ts:102-114` solo recorre `BLOCK_MODE` con 432 combinaciones; `SECOND_ONLY_MODE` sin bloqueos L91-95). 4. `data-model.md` L241: quitar la afirmación fue correcto; la migración 0022 sí tiene `CHECK (max_per_day BETWEEN 1 AND 6)` (L23 y L63), reinstaurable sin cita (NB-1). 5. y 6.: correctos (ver NB-2).

## No bloqueantes
- NB-1 `data-model.md:241` (opcional): reinstaurar sin cita que el CHECK rechaza `max_per_day` fuera de 1-6, fundado en la migración 0022.
- NB-2 spec 9 paso 4: añadir que la reserva pública elimina los locks vigentes del propio teléfono sin acotar por fecha (`deleteActiveReservationLocksByPhone`); el ADR 0006 ya lo dice.
- NB-3 `docs/features/booking-flow.md:179-181`, `:217`, `:238`: aún afirman la "regla direccional por pares" (previo a 003); reemplazar por `minGapMinutes` y capacidad en T076/T078.
- NB-4 el runbook no documenta los otros crons de D92.
- NB-5 siguen vigentes los carry-forward D85/D86 y NB-R3-1..12 (comentarios D59/D61 obsoletos, `isWeekdayInMexicoCity` sin usos, `tests/lib/admin/appointments.lock-order.test.ts` sin trackear: debe entrar en el commit).

## Pendientes fuera de alcance
- `README.md:108` (`--older-than-days=7`; el script solo acepta `--batch`, `scripts/cleanup-reservation-locks.mjs:13`; `package.json:17`): carry-forward, corrección trivial recomendada junto al cierre de T075.
- `data-model.md:9`/`:296` ("ronda 1A"), ADR 0001 L26, ADR 0005 L23, `api.md:384-385` (NB-6, NB-7): carry-forward (citas históricas, no falsas); reemplazar por D-IDs en T076/T078.

## T075 [X]
Se sostiene: `data-model.md`, `api.md`, spec 4.1/4.2/4.3/7/10/12/15.7 y "Mismo día", business-rules, ADR 0001-0006 existen y están alineados; `specs/README.md:16` tiene la fila 003 (Draft). `booking-flow` es de T076.
