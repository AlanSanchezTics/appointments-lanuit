# ADR 0006: Concurrencia de reservas, orden de locks y riesgos aceptados

- Estado: Accepted
- Fecha: 2026-10-30 (actualizada 2026-10-31, D93; 2026-11-01, F1 de la ronda 24, D82; 2026-11-01, correcciones F1-b de la ronda 26)
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

Seis transacciones toman `GET_LOCK` y aplican este orden completo: reserva pública, confirmación, bloqueo de horario del wizard, creación admin, reprogramación admin y reprogramación pública. El bloqueo de espacios aplica los pasos 2 a 6 sin el paso 1 (F2, D83). Ninguna de estas transacciones toma un lock de reserva antes que las citas (paso 3 antes que paso 4). La transición admin de una cita `PENDING` queda fuera de este orden (párrafo de excepción más abajo).

Tiempos de las transacciones con named locks (F1, D82; `lib/db/appointments.ts`). Las seis transacciones que toman `GET_LOCK` (reserva pública, confirmación, bloqueo de horario del wizard (`POST /api/reservar/lock`), creación admin, reprogramación admin y reprogramación pública) pasan `BOOKING_TRANSACTION_OPTIONS` a `prisma.$transaction`:

- `timeout` de transacción: 30 s (`BOOKING_TRANSACTION_TIMEOUT_MS`).
- `GET_LOCK`: 5 s por cada uno de los dos nombres (`NAMED_LOCK_WAIT_SECONDS`, sin cambio).
- `innodb_lock_wait_timeout` de sesión: 5 s (`ROW_LOCK_WAIT_SECONDS`). `acquireBookingLocks` lo fija antes del primer `GET_LOCK` y `releaseBookingLocks` lo restaura a `DEFAULT` al final.
- Caso de una sola espera de cada tipo: 2 x 5 s de `GET_LOCK` + 1 espera de fila de 5 s = 15 s < 30 s. El timeout de 30 s protege frente a esperas aisladas. Las cadenas de esperas exitosas casi al límite (10 + 5k s, con k esperas de fila sucesivas; k >= 4 llega a 30 s) no están cubiertas y son parte del riesgo residual H1. Una espera de fila fallida termina la transacción dentro de su tiempo (el callback lanza el error y el `finally` libera con la transacción viva).
- `maxWait` no se fija: es la espera de una conexión del pool, que ocurre antes de empezar la transacción y antes de tomar cualquier lock. El `timeout` de `$transaction` cuenta desde el inicio de la transacción, no desde que se obtiene la conexión: el mensaje de Prisma dice «since the start of the transaction», y la mutación A del Reviewer (ronda 25, `timeout` de 5000 ms con 5005 ms transcurridos) lo confirma. Con esa evidencia queda cerrada la duda sobre el origen del temporizador. No se inspeccionó el motor Rust de Prisma; la evidencia viene del mensaje, de la prueba y del runtime JS (driver adapter).
- Las sentencias anteriores a `acquireBookingLocks` (por ejemplo, `resolveClientForCreate` en la creación admin) pueden esperar hasta el valor por defecto de InnoDB (50 s), pero no tienen named lock tomado: una expiración ahí no deja lock.

Excepción fuera del orden: la transición admin de una cita `PENDING` (confirmar o rechazar, `transitionPendingAppointment` en `lib/admin/appointments/service.ts`) bloquea solo la fila de la cita y la de su cliente con `FOR UPDATE`. No toma `GET_LOCK`, no toma `FOR SHARE` de reglas y no bloquea los conflictos del día. Su riesgo residual es NB-1 (abajo).

El editor de disponibilidad toma `FOR UPDATE` sobre la misma fila de `active_months`. Así espera a las reservas en curso (que toman `FOR SHARE`) y ninguna reserva mezcla reglas viejas con un cambio en curso (D39).

Propagación de errores (D81, D88, D91):

- Un error de infraestructura o de transacción (deadlock, timeout de espera de InnoDB, pool de conexiones) dentro de la transacción se propaga y la revierte. No se convierte en `SLOT_NOT_AVAILABLE` ni en otro código de dominio: la respuesta es 400 `UNKNOWN_ERROR`.
- En la validación del destino de la reprogramación pública, solo `MONTH_NOT_ALLOWED` (mes no reservable) se traduce a `SLOT_NOT_AVAILABLE` (D91). Un lock vigente de otra clienta sobre el destino también responde `SLOT_NOT_AVAILABLE` (D88).
- `LOCK_TIMEOUT` (espera de `GET_LOCK`) responde 409 en las rutas que lo mapean. Antes de F1 casi no se alcanzaba (la transacción expiraba antes); con el timeout de 30 s llega como `LOCK_TIMEOUT` (prueba de integración `tests/integration/booking-lock-expiry.integration.test.ts`).

Riesgos conocidos que esta decisión acepta:

- **F1 (D82) y riesgo residual H1: corrección (a) aplicada en la ronda 24; el residual H1 lo acepta el owner (ronda 26), sin rediseño.** El `GET_LOCK` de sesión no se libera si la transacción de Prisma expira antes (valor por defecto de 5 s). Es preexistente en HEAD. Medido por el Reviewer: el lock quedó retenido en 7 de 10 expiraciones, en creación admin, reprogramación admin y reserva pública. En la ronda 24, con la sonda sobre los helpers reales y `timeout` por defecto, 4 de 4 expiraciones dejaron el lock retenido; con `BOOKING_TRANSACTION_OPTIONS` y una operación de 6 s, 0 de 3 (sonda medida antes de añadir la espera de fila de sesión; después, la prueba de integración da 0 de 1). Con los tiempos de la sección anterior:
  - Una espera de fila o de `GET_LOCK` que vence dentro de la transacción responde su error de dominio (`LOCK_TIMEOUT`) o de infraestructura (400 `UNKNOWN_ERROR`), y el `finally` libera los locks. Verificado en la prueba de integración (sin la cota de InnoDB, la espera termina cuando libera el titular; sin el timeout explícito, la respuesta es la expiración de Prisma).
  - Residual, no corregido: si una transacción supera 30 s (cadena de esperas de fila que se conceden justo a tiempo o una base bloqueada), Prisma la expira, el `finally` no puede liberar y el `GET_LOCK` queda en la conexión del pool hasta que esa conexión se cierre. Medido con un timeout forzado de 500 ms: 2 de 2 expiraciones con lock retenido (prueba de limitación residual; no es el caso de producción). NB-2 y NB-3 no cubren este caso: protegen errores de JavaScript dentro de la transacción, no la expiración.
  - Impacto real del residual (F-01, ronda 25): mientras esa conexión viva, otra reserva que pida `GET_LOCK` de la misma fecha (`booking:date:<fecha>`) o del mismo teléfono (`booking:phone:<teléfono>`) no obtiene el lock tras 5 s y responde `LOCK_TIMEOUT` (409). Es denegación de reservas por esa fecha o ese teléfono, no solo una fuga de lock. Si el pool reutiliza esa conexión para otra transacción, `GET_LOCK` es re-entrante según la documentación de MySQL (contador de adquisiciones), y el lock puede seguir retenido tras el `RELEASE_LOCK` (no medido).
  - Medido: `IS_USED_LOCK` devuelve el id de la conexión que retiene el lock tras la expiración. No medido: la duración del lock huérfano (el ciclo de vida de las conexiones del pool de Prisma no se verificó), la respuesta de `GET_LOCK` desde otra sesión (solo se midió `IS_USED_LOCK`), la reutilización real de esa conexión y el efecto bajo carga.
  - Sigue sin ser alcanzable por debajo de 30 s en uso normal. El owner acepta H1 como riesgo residual con este impacto (ronda 26); no es una corrección completa.
  - La restauración de `innodb_lock_wait_timeout` tampoco se ejecuta tras una expiración; esa conexión del pool conserva la espera de 5 s (medido en la ronda 25 con una sonda sobre los helpers reales: misma conexión, valor 5 tras la expiración).
  - Corrección completa: liberar en la misma sesión que tomó el lock, o sustituir `GET_LOCK` por bloqueos de fila transaccionales (se liberan con el ROLLBACK). Requiere rediseño y no se improvisó en F1 (a).
- **F2 (D83).** `listBlockedSlotsByDateForUpdate` (`lib/db/blocked-slots.ts`) es una lectura plana, pese a su nombre. Además, los bloqueos manuales no toman los bloqueos con nombre (paso 1). Medido en carrera simultánea: bloqueo admin frente a creación admin, 17 de 40 lotes con doble ocupación; frente a reserva pública, 10 de 40. Aceptado por el owner. La opción `FOR UPDATE` tocaría los flujos públicos. Aceptado por el owner el 2026-11-01 como riesgo residual, sin cambio de código.
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
- Negativo: `SET SESSION innodb_lock_wait_timeout` cambia una conexión compartida del pool. Durante la transacción de reserva, otras consultas de esa conexión esperan como máximo 5 s por filas en lugar de 50 s.
- Negativo (F-02, F-09; medido en la ronda 25): tras una expiración (residual F1) la restauración no se ejecuta y la conexión del pool conserva `innodb_lock_wait_timeout = 5`. Las consultas posteriores en esa conexión, también las de flujos fuera de reserva (por ejemplo el editor de reglas con `FOR UPDATE` y los bloqueos de espacios), esperan como máximo 5 s por fila en lugar de 50 s, y pueden fallar con `ER_LOCK_WAIT_TIMEOUT` (400 `UNKNOWN_ERROR`) en esperas que antes habrían terminado. El valor se restaura cuando una transacción de reserva que usa esa conexión llega a `releaseBookingLocks` (deducido del código, no medido) o cuando la conexión se cierra (no medido).
- Rollback (F-09): revertir el código de F1 restaura el comportamiento de HEAD en las transacciones nuevas, pero no limpia el valor de sesión ya filtrado en las conexiones del pool ni el `GET_LOCK` retenido por una expiración. Hasta que la conexión se cierra, persiste el valor de 5 s. No hay datos que deshacer.
- Negativo (F-06; no medido): una reserva contendida puede ocupar una conexión del pool hasta unos 15 s (2 x 5 s de `GET_LOCK` más 5 s de espera de fila en el caso de una sola espera de cada tipo; más con esperas encadenadas), frente a los 5 s anteriores. Bajo ráfagas de reservas contendidas puede agotar el pool y provocar `P2024` (timeout al obtener conexión) en otras consultas. El repositorio no define `connection_limit` ni tamaño de pool.
- Pendiente: el owner decide el tamaño del pool (F-06). Acepta H1 como riesgo residual de F1 con el impacto de F-01 (denegación por fecha o teléfono mientras la conexión viva; duración y reutilización no medidas), sin rediseño (ronda 26). F2 y F3 quedan aceptadas con el riesgo indicado.
- Referencias: `docs/architecture/data-model.md` (sección "Concurrencia a nivel de datos" y "Protecciones de integridad"), `docs/architecture/api.md` (sección "Disponibilidad mensual y reservas"), `docs/architecture/business-rules.md` (Concurrency Rules), `docs/specification.md` (sección 9), `docs/runbooks/reservation-lock-cleanup.md`.
- Trazabilidad: D87 (la reprogramación pública respeta locks vigentes de otras clientas), D88 (limpieza acotada a la fecha; lectura de locks fuera del catch de conversión), D89 (limpieza de locks después de los conflictos de citas en las seis rutas), D91 (catch que solo convierte `MONTH_NOT_ALLOWED`), D92 (cron de producción), D93 (ronda 1F cerrada en código), D82 (F1, ronda 24: timeouts explícitos, espera de fila de sesión y prueba de integración `booking-lock-expiry`; riesgo residual de expiración por encima de 30 s).
