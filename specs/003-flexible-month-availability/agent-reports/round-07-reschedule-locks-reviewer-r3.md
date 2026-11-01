# Ronda 07 (1F) corrección 4, re-revisión ciclo 4: reviewer-high-risk (r3)

Transcrito (resumido) por el Orchestrator desde el hand-back. Solo `appointments_test` (MySQL 8.4.8); mutaciones en copia del scratchpad sin `.env`; repo sin cambios; no se accedió a `appointments`.

**Veredicto: Approved.** Bloqueantes: ninguno. Condición de cierre de la ronda (D91): completar la micro-ronda documental NB-5.

## Verificado
- B-1 (`lib/my-appointments/service.ts` L353-361): solo `MONTH_NOT_ALLOWED` (único error de dominio de `getBookableMonthConfig`, L46/L52/L58 de `lib/active-months/service.ts`) -> `SLOT_NOT_AVAILABLE`; el resto se relanza. Mutación con catch genérico falla solo el test nuevo. Sonda HTTP real: mes inactivo/sin registro/fecha pasada -> 409 `SLOT_NOT_AVAILABLE`; mes activo -> 200 PENDING. Error de infraestructura -> rollback completo, sin evento `MODIFIED`, `releaseBookingLocks` en `finally`. Cambia el contrato: infraestructura 409 -> 400 `UNKNOWN_ERROR` (D81); `api.md` L273/L489 ya lo describe.
- NB-3: invertir el orden en reserva pública (`lock-reservation-slot.ts` L123-124), confirmación (`book-appointment.ts` L483-484), reprogramación admin (`admin/appointments/service.ts` L475-476) y bloqueo de espacios (`blocked-spaces/service.ts` L239-240) hace fallar su unitario y su sonda de integración.
- NB-4: la sonda exige `appointments` y prohíbe `reservation_locks`; con M1 falla (8/9); orden actual 9/9.
- NB-8: comentarios L291 y L500 correctos respecto a `lib/db/appointments.ts` L517 (`AND phone <> ...`).
- Regresiones: eslint `lib` exit 0; unitarios dirigidos 12 archivos 97/97; `reschedule-reservation-lock` + `admin-create-concurrency` 11/11 x3; integración completa 30/35 (5 preexistentes: cancel-appointment 3/3 por `clientNumber`; reservation-lock L65/L145 por filtro Prisma sobre TIME). `tests/lib` + `tests/app`: 548 pasan, 16 fallan igual en HEAD (dependientes de fecha de marzo 2026: api-admin-cancel-route 1, whatsapp appointment-labels 2, booking-confirm-step 4, booking-success-step 3, booking-wizard 4, cancel-wizard 2; month-detail-view también falla en HEAD).
- Orden de locks de producción (6 rutas incluida la reprogramación pública): named -> FOR SHARE -> conflictos -> limpieza/lectura/escritura de RL; ninguna toma RL antes que citas. El bloqueo de espacios no toma named lock (preexistente, F2/D83).

## No bloqueantes (carry-forward)
- NB-R3-1: `admin-create-concurrency` no discrimina el orden admin (M-A y réplica invertida: 2/2 verde); ningún unitario afirma el orden de `createAdminAppointment`; solo lo cubre `reschedule-reservation-lock` ("admin create waits…"). Añadir unitario de orden o aceptar el residual; corregir comentario L59-62.
- NB-R3-2: en `admin-create-concurrency` `openGate()` no está en `finally`; si la espera no se observa falla en rojo a los ~5,8 s, sin cuelgue. Recomendado `try/finally` y timeout explícito.
- NB-R3-3: la espera requiere `performance_schema` con `wait/lock/metadata/sql/mdl` activo; documentarlo.
- NB-R3-4: `reservation-lock.integration.test.ts` L65/L145 no pueden pasar en este entorno (filtro Prisma sobre TIME); preexistente.
- NB-R3-5: `cancel-appointment.integration.test.ts` sin `clientNumber`; preexistente.
- NB-R3-6: línea base incompleta: añadir los 16 fallos de `tests/lib` + `tests/app` dependientes de fecha.
- NB-R3-7: `getBookableMonthConfig` dentro de la transacción usa el cliente global (segunda conexión; probable origen del P2024); preexistente; `lock-reservation-slot.ts` L107 lo llama antes de la transacción. No medido bajo carga.
- NB-R3-8: `getBookableMonthConfig(input.month)` no recibe el `now` inyectado; sin efecto en producción.
- NB-R3-9: `isWeekdayInMexicoCity` (`lib/datetime/mexico-city.ts` L78) quedó sin usos; eliminar o justificar.
- NB-R3-10: comentario `book-appointment.test.ts` L321-323 imprecisa (rama de reprogramación usa `rescheduleAppointmentInTransaction`, L232).
- NB-R3-11: el texto de NB-5 no debe afirmar que todas las rutas toman named lock.
- NB-R3-12: `tests/lib/admin/appointments.lock-order.test.ts` está sin trackear (`??`) y debe entrar en el commit.

## No verificado
`tsc`; suite unitaria completa; línea base de integración contra HEAD en ejecución; respaldo de las 22:24; comportamiento bajo carga.
