# ADR 0006: Concurrencia de reservas, orden de locks y riesgos aceptados

- Estado: Accepted
- Fecha: 2026-10-30 (actualizada 2026-10-31, D93)
- Spec: [003 Disponibilidad flexible por mes](../../specs/003-flexible-month-availability/spec.md)
- Decisiones de origen: D39, D63, D65, D77, D78, D81, D82 (F1), D83 (F2), D87, D88, D89, D91 (catch de `getBookableMonthConfig`), D93

## Contexto

Las reservas públicas, las reprogramaciones públicas, la creación admin, la reprogramación admin y los bloqueos manuales pueden pelear por el mismo horario. Con reglas de disponibilidad editables, además, una reserva no debe leer reglas viejas mientras el editor cambia el mes.

Antes de la spec 003 las reglas se leían fuera de la transacción. La creación admin tenía una doble reserva reproducible (B-1, 40 de 40 lotes en HEAD) que la lectura bloqueante de ocupación corrige (D77).

## Decisión

Las escrituras que tocan horarios siguen el mismo orden dentro de una transacción de Prisma. Hay una excepción: el bloqueo de espacios (bloqueos manuales de horario y de día completo) omite el paso 1 (F2, D83).

1. `GET_LOCK` con nombres `booking:date:<fecha>` y `booking:phone:<teléfono>`, en orden alfabético, con espera de 5 s. Si no se obtiene, `LOCK_TIMEOUT`. El bloqueo de espacios no toma estos locks.
2. `SELECT ... FOR SHARE` sobre la fila de `active_months` del mes. Las reglas se leen aquí, dentro de la transacción.
3. `FOR UPDATE` sobre las citas de la fecha o del teléfono (`lockConflictingAppointments`).
4. Locks de reserva (`reservation_locks`, D88 y D89). Después del paso 3 se limpian los expirados de la fecha procesada (`cleanupExpiredReservationLocks(tx, fecha, now)`, `expires_at <= now`); la limpieza nunca toca otras fechas. Después se leen o escriben los locks que la ruta necesita:
   - Reprogramación pública: lee el lock vigente del horario destino con `FOR UPDATE` (`findActiveReservationLockForSlotForUpdate`, con `expires_at > now` y `phone <> teléfono propio`). No limpia locks.
   - Creación admin y reprogramación admin: limpian, leen el lock vigente del destino con `FOR UPDATE` y rechazan con `SLOT_LOCKED` si es de otra clienta.
   - Reserva pública: limpia, elimina el lock vigente del propio teléfono (`deleteActiveReservationLocksByPhone`; no se acota por fecha, usa el índice `(phone, expires_at)`), lee los vigentes de la fecha y crea el lock.
   - Confirmación: limpia y lee el lock por `lock_token` con `FOR UPDATE`.
   - Bloqueo de espacios: limpia y lee los vigentes de la fecha, sin bloqueo de filas.
5. Ocupación. En la creación admin y la reprogramación admin es bloqueante (`FOR UPDATE` crudo, D77). En los bloqueos manuales, la lectura de citas es bloqueante y la de bloqueos de horario es plana (F2).
6. Escritura de la cita o del bloqueo y, en los flujos que tomaron los locks con nombre, `RELEASE_LOCK` en el `finally` de la transacción.

Seis rutas aplican este orden: reserva pública, confirmación, reprogramación pública, creación admin, reprogramación admin y bloqueo de espacios. Ninguna toma un lock de reserva antes que las citas (paso 3 antes que paso 4).

Excepción fuera del orden: la transición admin de una cita `PENDING` (confirmar o rechazar, `transitionPendingAppointment` en `lib/admin/appointments/service.ts`) bloquea solo la fila de la cita y la de su cliente con `FOR UPDATE`. No toma `GET_LOCK`, no toma `FOR SHARE` de reglas y no bloquea los conflictos del día. Su riesgo residual es NB-1 (abajo).

El editor de disponibilidad toma `FOR UPDATE` sobre la misma fila de `active_months`. Así espera a las reservas en curso (que toman `FOR SHARE`) y ninguna reserva mezcla reglas viejas con un cambio en curso (D39).

Propagación de errores (D81, D88, D91):

- Un error de infraestructura o de transacción (deadlock, timeout de espera de InnoDB, pool de conexiones) dentro de la transacción se propaga y la revierte. No se convierte en `SLOT_NOT_AVAILABLE` ni en otro código de dominio: la respuesta es 400 `UNKNOWN_ERROR`.
- En la validación del destino de la reprogramación pública, solo `MONTH_NOT_ALLOWED` (mes no reservable) se traduce a `SLOT_NOT_AVAILABLE` (D91). Un lock vigente de otra clienta sobre el destino también responde `SLOT_NOT_AVAILABLE` (D88).
- `LOCK_TIMEOUT` (espera de `GET_LOCK`) responde 409 en las rutas que lo mapean; por F1 casi no se alcanza hoy.

Riesgos conocidos que esta decisión acepta:

- **F1 (D82).** El `GET_LOCK` de sesión no se libera si la transacción de Prisma expira antes (valor por defecto de 5 s). Medido por el Reviewer: el lock quedó retenido en 7 de 10 expiraciones, en creación admin, reprogramación admin y reserva pública. Es preexistente en HEAD. Hasta corregirlo, `LOCK_TIMEOUT` (409) casi nunca se alcanza: la respuesta suele ser 400 `UNKNOWN_ERROR`. Corrección planificada, opción (a): fijar un `timeout` explícito en `prisma.$transaction` por encima del peor caso de espera, y un `innodb_lock_wait_timeout` de sesión por debajo, antes de la release combinada.
- **F2 (D83).** `listBlockedSlotsByDateForUpdate` (`lib/db/blocked-slots.ts`) es una lectura plana, pese a su nombre. Además, los bloqueos manuales no toman los bloqueos con nombre (paso 1). Medido en carrera simultánea: bloqueo admin frente a creación admin, 17 de 40 lotes con doble ocupación; frente a reserva pública, 10 de 40. Aceptado por el owner. La opción `FOR UPDATE` tocaría los flujos públicos.
- **F3.** Los bloqueos con nombre de la reserva pública se liberan antes del COMMIT. No se midió ningún doble atribuible después de B-1.
- **F4 (corregido, D88 y D91).** Antes, cualquier error dentro de la validación del destino de la reprogramación pública se convertía en `SLOT_NOT_AVAILABLE`. Ahora solo `MONTH_NOT_ALLOWED` se convierte; los errores de infraestructura se propagan (ver "Propagación de errores").
- **NB-1 (C4, aceptado por el owner como riesgo residual).** Puede haber un deadlock InnoDB (1213), raro, entre la confirmación admin de una `PENDING` y el reagendado público de otra `PENDING` del mismo cliente. Causa probable: la transición admin toma cita→cliente, mientras la reserva pública toma cliente→citas en `lockConflictingAppointments`. Es preexistente en HEAD; en estrés sintético se midió cerca de 0,75-0,8 % con desfase de 0-3 ms, y el arreglo de C4 no cambia la tasa. Siempre falla el admin con rollback limpio; el público tiene éxito. El admin recibe error y puede reintentar; no hay pérdida de datos.
- **F5 (cubierta por prueba de integración).** La carrera reprogramación admin frente a pública tiene prueba de integración que pausa la operación dentro de su transacción, justo después de la limpieza de locks real, y espera a que la otra quede en `LOCK WAIT` (`tests/integration/reschedule-reservation-lock.integration.test.ts`, D89, D91).

## Consecuencias

- Positivo: la creación admin dejó de tener doble reserva en la prueba de regresión (la prueba falla 3 de 3 sin la corrección y pasa con ella). La carrera creación admin frente a reserva pública dio 0 de 120 dobles tras la corrección.
- Positivo: los horarios se calculan con las reglas del mismo estado que se escribe. No hay lectura de reglas fuera de la transacción en los flujos de escritura.
- Positivo: la limpieza acotada por fecha no bloquea filas de otras fechas. Con eso desaparece el deadlock entre reserva pública y reprogramación pública que causaba la limpieza global (D88).
- Negativo: la espera de `FOR SHARE` frente al editor puede hacer esperar a una reserva; el editor es poco frecuente.
- Negativo: la protección contra dos citas activas en el mismo horario es solo de aplicación. `appointments` no tiene restricción `UNIQUE (date, time_slot)`. Es una decisión de arquitectura del owner.
- Negativo: el cron de producción `npm run locks:cleanup` (cada minuto, D92) borra por clave primaria, sin fecha. Puede coincidir con la limpieza por fecha de una reserva y producir un `1213` raro: la víctima es el script (termina con error y se reintenta en el siguiente disparo) o la operación (400 `UNKNOWN_ERROR`, rollback completo, sin doble reserva). Ver `docs/runbooks/reservation-lock-cleanup.md`.
- Pendiente: la corrección de F1 es obligatoria antes de publicar la Fase 1 (D82). F2 y F3 quedan aceptadas con el riesgo indicado.
- Referencias: `docs/architecture/data-model.md` (sección "Concurrencia a nivel de datos" y "Protecciones de integridad"), `docs/architecture/api.md` (sección "Disponibilidad mensual y reservas"), `docs/architecture/business-rules.md` (Concurrency Rules), `docs/specification.md` (sección 9), `docs/runbooks/reservation-lock-cleanup.md`.
- Trazabilidad: D87 (la reprogramación pública respeta locks vigentes de otras clientas), D88 (limpieza acotada a la fecha; lectura de locks fuera del catch de conversión), D89 (limpieza de locks después de los conflictos de citas en las seis rutas), D91 (catch que solo convierte `MONTH_NOT_ALLOWED`), D92 (cron de producción), D93 (ronda 1F cerrada en código).
