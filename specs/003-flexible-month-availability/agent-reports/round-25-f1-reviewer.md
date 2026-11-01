# Ronda 25: revisión independiente de alto riesgo de F1 (ronda 24, D82)

- Rol: Reviewer de alto riesgo, modo auditoría. Sin commit, sin `git stash`, sin worktree, sin cambios en el código del Developer.
- Fecha: 2026-11-01.
- Entrega revisada: árbol de trabajo sin commit sobre la rama `003-flexible-month-availability` (base 91874d6).
- Informe del Developer: `specs/003-flexible-month-availability/agent-reports/round-24-f1-developer.md`.
- Decisión de contexto: D82 (opción a) y `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`. El owner aceptó H1 como riesgo residual; no se reporta como bloqueante salvo que sea alcanzable por debajo de 30 s en uso normal (no lo es, ver F-03).

## Veredicto

**Approved con no bloqueantes.**

Hallazgos: 0 bloqueantes, 11 no bloqueantes (F-01 a F-11).

El cambio cumple D82 (opción a): las seis transacciones que toman `GET_LOCK` usan `timeout` de 30 s, la sesión espera como máximo 5 s por fila, y `LOCK_TIMEOUT` (409) ya es alcanzable. Las pruebas discriminan las mutaciones relevantes y la regresión coincide con la línea base. Quedan puntos de documentación, de cobertura y de impacto del riesgo residual H1 que el owner debe conocer en su forma completa (F-01, F-02) antes de cerrar la aceptación. Varios hallazgos requieren decisión del Orquestador o del owner; están marcados.

## 1. Comandos ejecutados y resultados

| # | Comando | Alcance | Resultado |
|---|---|---|---|
| 1 | `npx vitest run` con los 6 archivos de prueba que el round toca (`tests/lib/db/booking-lock-timeouts.test.ts`, `tests/lib/admin/appointments.lock-order.test.ts`, `tests/lib/admin/appointments.service.test.ts`, `tests/lib/appointments/book-appointment.test.ts`, `tests/lib/appointments/lock-reservation-slot.test.ts`, `tests/lib/my-appointments.service.test.ts`) | unitaria dirigida | 6/6 archivos, 60/60 pruebas |
| 2 | `node run-integration.mjs npx vitest run --maxWorkers=1 tests/integration/booking-lock-expiry.integration.test.ts` (wrapper, `appointments_test`, `ENABLE_INTEGRATION_DB=1`) | integración nueva | 4/4 (26,1 s) |
| 3 | Mismo wrapper con `npx vitest run --maxWorkers=1 tests/integration` | integración completa serial | 62 pruebas: 57 pasan, 5 fallan. Son las de la línea base: `cancel-appointment` x3 (`PrismaClientValidationError` en `prisma.client.create`) y `reservation-lock` L65 y L145 (`expected [] to have a length of 1`). Ninguna es de lock ni de timeout |
| 4 | `npx vitest run` (suite unitaria completa, sin variables de integración) | unitaria completa | 820 pruebas: 737 pasan, 62 omitidas, 21 fallan en 11 archivos. Igual que la línea base (21 fallos, 11 archivos) |
| 5 | `npx tsc --noEmit -p . --incremental false` | tipos | 32 errores, todos en `tests/` (línea base 32). Ninguno en `lib/` ni `app/`. `tsconfig.tsbuildinfo` sin cambios en git |
| 6 | `npx eslint` sobre los 5 archivos de producción tocados y los 2 tests nuevos | lint | exit 0 |
| 7 | Probe H5 (ver sección 3), wrapper, `appointments_test` | medición | Confirmado: la conexión conserva 5 s tras la expiración |
| 8 | Consulta de solo lectura `@@GLOBAL.wait_timeout`, `@@GLOBAL.innodb_lock_wait_timeout`, `@@GLOBAL.version` (wrapper, `appointments_test`) | entorno | `wait_timeout` 28800 s, `innodb_lock_wait_timeout` global 50 s, MySQL 8.4.8 |
| 9 | `grep` de `$transaction`, `GET_LOCK`, `RELEASE_LOCK`, `acquireBookingLocks`, `releaseBookingLocks`, `innodb_lock` y del cliente global `prisma.` en `lib/`, `app/`, `scripts/` | inventario | Ver sección 4, punto 1 |

No se ejecutó ninguna prueba contra `appointments` ni contra producción. No se leyó ni imprimió `.env`; el wrapper lo lee internamente y solo se usó como lanzador.

## 2. Mutaciones (todas restauradas y verificadas)

Respaldo previo: copias en la scratchpad y `sha256` de los 5 archivos de producción, más el `sha256` del `git diff` de esos archivos. Tras cada mutación se restauró desde la copia y se comparó el hash. Tras la última, `shasum -c` dio OK para los 5 archivos y el hash del `git diff` coincidió con el inicial.

| ID | Mutación | Prueba que debía fallar | Resultado |
|---|---|---|---|
| A | `BOOKING_TRANSACTION_TIMEOUT_MS = 5_000` (`lib/db/appointments.ts:591`) | Integración nueva | Detectada: fallan la espera de fila, la operación de 6 s y `LOCK_TIMEOUT`. El error de la prueba LOCK_TIMEOUT es la expiración de Prisma: "The timeout for this transaction was 5000 ms, however 5005 ms passed since the start of the transaction". La prueba residual pasa (esperado, usa su propio timeout) |
| B | Quitar `SET SESSION innodb_lock_wait_timeout = ${ROW_LOCK_WAIT_SECONDS}` (`lib/db/appointments.ts:609`) | Integración nueva | Detectada: falla la espera de fila con `expected null to be an instance of Error` (la espera termina al liberarse el titular) |
| C1 | Quitar `await releaseNamedLock(tx, lockName)` del bucle de `releaseBookingLocks` (`lib/db/appointments.ts:628`) | Integración nueva | Detectada: fallan 2 pruebas con `expected false to be true`. La prueba de LOCK_TIMEOUT pasa: la espera falla antes de tomar el lock, así que no hay nada que liberar (correcto) |
| C2 | Quitar `SET SESSION innodb_lock_wait_timeout = DEFAULT` (`lib/db/appointments.ts:631`) | Integración nueva | **No detectada por integración** (4/4 pasan). Detectada por la unitaria `releaseBookingLocks libera en orden inverso y restaura...` (1 fallo). Ver F-05 |
| E | Quitar `BOOKING_TRANSACTION_OPTIONS` de la reprogramación pública (`lib/my-appointments/service.ts:505`) | Unitaria `my-appointments.service.test.ts` | Detectada (1 fallo de 17) |
| G | Quitar `BOOKING_TRANSACTION_OPTIONS` de la reserva pública (`lib/appointments/book-appointment.ts:492`) | Unitaria `book-appointment.test.ts` | Detectada (1 fallo de 15) |

Las mutaciones A, B, C1 y C2 se hicieron con `perl -pi` o `perl -ni` sobre la línea exacta; E y G sobre la línea indicada. El aviso del harness de "archivo modificado tras lectura" tras G corresponde a la mutación, no a un cambio no autorizado; la restauración se verificó por hash.

Las seis transacciones tienen al menos una prueba que afirma sus opciones: `tests/lib/appointments/book-appointment.test.ts:258` (reserva) y `:323` (confirmación), `tests/lib/appointments/lock-reservation-slot.test.ts:126` (wizard), `tests/lib/admin/appointments.service.test.ts:106` (creación admin), `tests/lib/admin/appointments.lock-order.test.ts:183` (reprogramación admin) y `tests/lib/my-appointments.service.test.ts:285` (reprogramación pública).

## 3. Probes de solo lectura y medición de H5

Probe `probe-h5.mjs` (scratchpad), lanzado por el wrapper contra `appointments_test` con `connection_limit=1`, replica la secuencia de `acquireBookingLocks`/`releaseBookingLocks` con SQL directo: `SET SESSION ... = 5`, `GET_LOCK`, operación de 1,5 s con `timeout` de transacción de 500 ms (expira), `finally` con `RELEASE_LOCK` y `SET ... = DEFAULT`. Salida:

- Antes de la transacción: conexión 1641, `innodb_lock_wait_timeout` 50.
- La transacción expira: "Invalid prisma.$queryRaw() invocation".
- Después, mismo cliente y **misma conexión 1641**: `innodb_lock_wait_timeout` **5**.
- Lock retenido por otra sesión (`IS_USED_LOCK` no nulo): **sí**.

Esto confirma H5 (que el Developer describe pero no midió) y la parte de H1 sobre el lock. El probe no escribió datos; solo tomó y dejó de tener un lock con nombre `probe:r25-h5`, que el cierre de la sesión liberó.

## 4. Respuesta a los puntos del brief

### Punto 1: las seis transacciones y las esperas

- Grep de `GET_LOCK`: solo en `lib/db/appointments.ts:597` (y en los dos scripts con nombres `sync-retry:*`, ver F-08). No hay ninguna otra transacción que tome `GET_LOCK`.
- `acquireBookingLocks` aparece solo en las seis transacciones, cada una dentro de `try { ... } finally { releaseBookingLocks }`:
  1. `lib/appointments/book-appointment.ts` L473-492 (reserva pública; `acquireBookingLocks` L476).
  2. `lib/appointments/book-appointment.ts` L521-583 (confirmación; L524, cierre L583).
  3. `lib/appointments/lock-reservation-slot.ts` L112-216 (wizard; L115, cierre L216).
  4. `lib/admin/appointments/service.ts` L267-348 (creación admin; L272, cierre L348).
  5. `lib/admin/appointments/service.ts` L462-542 (reprogramación admin; L467, cierre L542).
  6. `lib/my-appointments/service.ts` L413-505 (reprogramación pública; L418, cierre L505).
- Las seis tienen `BOOKING_TRANSACTION_OPTIONS` (sección 2 para las pruebas de cada una).
- Llamadas externas (Google Calendar, WhatsApp): todas fuera de las transacciones. Verificado por posición: `finalizeCreatedAppointment`/`finalizeRescheduledAppointment` después de L492 y L583; `syncRescheduledAppointment` después de L542; `updateCalendarEvent` y `createCalendarEvent` de la reprogramación pública después de L505; `syncAppointmentToCalendar` de la creación admin después de L348. No hay llamada externa dentro de ninguna de las seis.
- Cliente global dentro de las transacciones: ninguno. Los `prisma.` que quedan en esos archivos están fuera de las transacciones (`lib/appointments/lock-reservation-slot.ts:255` está en `releaseReservationSlotLock`; los demás, en `finalize*`, `syncRescheduledAppointment` o `cancel*`). Los helpers de lectura global de `lib/db/appointments.ts` (`listMonthAppointments`, `listMonthActiveReservationLocks`, etc.) no tienen llamadores dentro de las seis transacciones. Así no hay una segunda conexión del pool dentro de una transacción.
- Peor caso real: el valor 30 s es mayor que el caso de una sola espera (2 x 5 s de `GET_LOCK` + 5 s de fila = 15 s), pero **no es una cota superior**. La reserva pública tiene al menos cinco sentencias que pueden esperar por fila (`lib/appointments/book-appointment.ts` L45 `FOR SHARE`, L149 `FOR UPDATE` de conflictos, L187 inserción de cita, L204 bitácora, y los `DELETE` de locks de reserva de la limpieza). Con esperas exitosas casi al límite, el tiempo total es 10 + 5k s, y k = 4 ya llega a 30 s. Ver F-03.
- Alcanzabilidad por debajo de 30 s en uso normal: no encontrada. Llegar a 30 s exige varias esperas exitosas casi al límite de 5 s. No es un caso de uso normal, así que no se reporta como bloqueante (condición del owner).

### Punto 2: `SET SESSION innodb_lock_wait_timeout`

- ¿Misma conexión que la transacción? Sí: `tx.$executeRawUnsafe` usa la conexión de la transacción. Lo demuestra la prueba 1 (B la hace fallar).
- ¿Se restaura siempre? En éxito y en error de cuerpo (el `finally` corre con la transacción viva). **No** tras expiración, ni si `releaseNamedLock` lanza un error antes del `SET ... = DEFAULT` (L631 queda sin ejecutar). El caso de error de `RELEASE_LOCK` con transacción viva no es esperable en uso normal; no se midió.
- ¿Puede filtrarse el 5? Sí, tras expiración: medido (H5, sección 3). La conexión sigue en el pool con 5 s. Ver F-02.
- ¿Afecta a flujos que no son de reserva? Solo a través de esa conexión filtrada. Los flujos fuera de reserva no ejecutan el `SET`.
- ¿Rompe operaciones legítimas lentas que antes esperaban 50 s? **No**, porque antes de F1 las seis transacciones tenían el `timeout` por defecto de Prisma, de 5 s. Una espera de fila que superaba 5 s ya hacía expirar la transacción antes del cambio (sin lock liberado, es decir, con fuga). Lo que cambia es el modo de fallo: antes, expiración de Prisma (400 `UNKNOWN_ERROR`, con fuga); ahora, `ER_LOCK_WAIT_TIMEOUT` (1205) a los 5 s, que también llega a 400 `UNKNOWN_ERROR` y libera. Las esperas de 0 a 5 s se comportan igual que antes. Las transacciones fuera de las seis no cambian (`blocked-spaces`, `months`, `reject-pending`, `cancel`, `transitionPendingAppointment` siguen con 5 s y sin `SET`).

### Punto 3: mapeos de error

- `lib/api/error-response.ts` (`normalizeErrorCode`) sin cambios. Un mensaje con espacios (`Lock wait timeout exceeded...`, `Deadlock found...`, expiración de Prisma) se normaliza a `UNKNOWN_ERROR`, que las rutas convierten en 400. Igual antes y después de F1: 1205 y 1213 siguen en 400 `UNKNOWN_ERROR`. No hay conversión a 409 ni a 500.
- `LOCK_TIMEOUT` a 409: rutas `app/api/reservar/lock/route.ts:26`, `app/api/reservar/confirm/route.ts:26`, `app/api/reservar/client-check-lock/route.ts:23`, `app/api/my-appointments/reschedule/route.ts:26`, `app/api/admin/months/[month]/appointments/route.ts:23`, `app/api/admin/appointments/[appointmentId]/reschedule/route.ts:29`. Sin cambios en `app/` (git diff). Ahora se alcanza (prueba 3 llega con `LOCK_TIMEOUT` como mensaje de la excepción).
- `SLOT_NOT_AVAILABLE` no cambia: ningún código del round lo emite ni lo cambia.
- La UI pública sí tiene texto para `LOCK_TIMEOUT` (`locales/es/errors.json:7`, "Hubo un conflicto temporal al reservar. Intenta de nuevo."). La admin no (ver F-07).

### Punto 4: pruebas

- La integración nueva discrimina: A, B y C1 la hacen fallar; C2 no (F-05).
- Pruebas unitarias con mocks: afirman el valor literal `{ timeout: 30_000 }` contra la fábrica del mock (`tests/lib/admin/appointments.lock-order.test.ts:71`, `tests/lib/appointments/book-appointment.test.ts:73`, `tests/lib/appointments/lock-reservation-slot.test.ts:43`). Eso prueba que el sitio de llamada pasa las opciones con el valor esperado, no el valor real de la constante. El valor real lo afirma `tests/lib/db/booking-lock-timeouts.test.ts` (`BOOKING_TRANSACTION_OPTIONS` toEqual `{ timeout: 30_000 }`). Aceptable.
- La prueba 4 (residual) afirma la limitación (`retained` = `[true, true]`). Es intencional y el comentario lo dice; cuando se corrija, fallará por diseño. Correcto.

### Punto 5: documentación frente a código

- Números: 30 s, 5 s por nombre, 5 s de fila, 15 s de caso único, 500 ms de la prueba residual y 7 de 10 (medición anterior) son coherentes entre ADR, `data-model.md`, `business-rules.md`, `api.md`, `specification.md` §9 y el código. Ningún documento cita un número distinto.
- "El 409 ya se alcanza": verdadero (prueba 3, integración). La nota de `api.md` L442 y la de L474 lo dicen correctamente.
- "NB-2 y NB-3 no cubren expiración": verdadero y acorde a D82 ("no describir NB-2/NB-3 como protección frente a expiración"). Solo aparece en ADR L55; no se describen como protección en ningún otro documento (`grep` en `docs/`).
- Incoherencias: la lista de rutas (ver F-04). "Peor caso" de 15 s (ver F-03). La descripción del riesgo residual no dice qué ocurre al usuario (ver F-01).
- `docs/specification.md` §9 L423 y L453: consistentes con el código.

### Punto 6: regresión

- Sin fallos nuevos en ninguna suite. Los 5 fallos de integración y los 21 unitarios coinciden con la línea base. `tsc`: 32, todos en `tests/`. ESLint: limpio.
- No se creó worktree. La línea base de HEAD se tomó del brief y del informe del Developer, no se repitió en HEAD.

### Punto 7: H2, H3 y H6

- **H2 (scripts `retry-sync-failed-*`)**: confirmado y **preexistente**. `scripts/retry-sync-failed-appointments.mjs` L112-124 (`GET_LOCK(name, 0)` y `RELEASE_LOCK` con el cliente global, sin transacción; usos en L189-190 y L232) y `scripts/retry-sync-failed-blocked-slots.mjs` L148-160 (usos en L213-214 y L254). Usan nombres `sync-retry:*`, no `booking:*`, así que no compiten con las reservas. F1 no cambia esos archivos. No hay efecto de F1 salvo el de H5 (si la conexión reutilizada conserva 5 s). Según D92 el cron `*/10` está habilitado en producción. El riesgo de que `GET_LOCK` y `RELEASE_LOCK` vayan a conexiones distintas no se midió. No es bloqueante para F1 (ver F-08).
- **H3 (`blocked-spaces`, `months`, `reject-pending` con 5 s)**: confirmado que no toman `GET_LOCK` (grep), así que una expiración no deja named lock. No cambia con F1. Observación, no bloqueante.
- **H6 (timeout desde el inicio o desde `maxWait`)**: resuelto por la propia evidencia de Prisma. El mensaje de expiración dice "since the start of the transaction" (ver prueba A: "5005 ms passed since the start of the transaction"). En el runtime JS (`node_modules/@prisma/client/runtime/client.js`, rama de driver adapter) el temporizador arranca al pasar a `running`, después de `startTransaction`, y `maxWait` tiene su propio temporizador. El motor Rust, que es el que usa la aplicación (`prisma/schema.prisma` no define `engineType`), no se inspeccionó, pero el mensaje y la prueba A coinciden. La redacción de la ADR no depende de H6. Ver F-10.

## 5. Hallazgos

Severidad: todos **no bloqueantes**. Ninguno cumple la condición de bloqueo del owner (alcanzable por debajo de 30 s en uso normal) ni es un defecto de corrección del código del round.

### F-01 (no bloqueante, decisión del owner): H1 significa denegación de reservas por fecha o teléfono, no solo fuga de un lock

- Evidencia: el probe (sección 3) muestra que, tras la expiración, la conexión 1641 sigue viva y `IS_USED_LOCK` devuelve su id. Las demás sesiones que pidan `GET_LOCK('booking:date:<fecha>')` reciben 0 y la reserva responde `LOCK_TIMEOUT` (409) mientras esa conexión exista. Lo mismo para `booking:phone:<teléfono>`. Según la documentación de MySQL, si el pool reutiliza esa conexión para otra reserva de la misma fecha, `GET_LOCK` es re-entrante y el lock sigue retenido tras el `RELEASE_LOCK` (contador). No medido.
- Duración: no medida. El servidor local cierra conexiones inactivas a los 28800 s (`wait_timeout`); el ciclo de vida de las conexiones del pool de Prisma no se verificó.
- Documentación: ADR `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` L55 dice "el lock queda en la conexión del pool hasta que esa conexión se cierre", pero no dice que las reservas de esa fecha o teléfono responden 409 durante ese tiempo. `docs/specification.md` L453 tampoco. Tampoco aparece en `business-rules.md` L206 ni `data-model.md` L218.
- Acción: el owner debe confirmar que acepta H1 con este impacto (denegación por fecha o teléfono mientras la conexión viva), no solo "lock retenido". El Orquestador decide si lo registra en `STATE.md` y en la ADR.

### F-02 (no bloqueante): H5 medido. El pool conserva `innodb_lock_wait_timeout = 5` tras la expiración

- Evidencia: probe (sección 3), misma conexión 1641, valor 5 tras la expiración.
- Efecto: cualquier consulta posterior en esa conexión espera como máximo 5 s por fila en lugar de 50 s, también las de flujos fuera de reserva (editor `FOR UPDATE` de `lib/db/availability-rules.ts`, bloqueos de espacios). La restauración la hace la siguiente transacción de reserva que use esa conexión (su `releaseBookingLocks` ejecuta `DEFAULT`). Esto se deduce del código; no medido. Ese mismo `GET_LOCK` seguiría retenido (F-01).
- Rollback: revertir el código no limpia los valores ya filtrados, porque el código anterior no restaura. Hasta que la conexión se cierre, persiste el 5 s. Ver F-09.
- Acción: documentar en la ADR (ya está en "Consecuencias negativas", L72) que el efecto se extiende a flujos fuera de reserva. Corregir el check de compatibilidad (F-09).

### F-03 (no bloqueante, documentación): "Peor caso 15 s" no es una cota superior

- Evidencia: ADR L37 ("Peor caso sin cadena de esperas que se conceden justo a tiempo: 2 x 5 s de GET_LOCK + 1 espera de fila de 5 s = 15 s < 30 s"), `lib/db/appointments.ts:584-588` (comentario "Peor caso sin cadena de esperas exitosas") y `tests/lib/db/booking-lock-timeouts.test.ts:34-37` (nombre "el timeout de la transacción supera el peor caso de espera").
- Problema: la reserva pública tiene al menos cinco sentencias con posible espera por fila (`lib/appointments/book-appointment.ts` L45, L149, L187, L204, y los `DELETE` de locks de reserva). Con k esperas exitosas casi al límite, el total es 10 + 5k s; k = 4 llega a 30 s. La limitación de una sola espera no se sostiene como "peor caso".
- Alcanzabilidad: no por debajo de 30 s en uso normal; por eso no es bloqueante.
- Acción: reformular en ADR, comentario y nombre de la prueba: "caso de una espera; el 30 s protege frente a esperas aisladas; las cadenas de esperas exitosas son el riesgo residual H1". Así el owner acepta H1 con la cifra correcta.

### F-04 (no bloqueante, documentación): listas de transacciones contradictorias

- ADR L30: "Seis rutas aplican este orden: reserva pública, confirmación, reprogramación pública, creación admin, reprogramación admin y bloqueo de espacios." Esa lista incluye el bloqueo de espacios, que no toma `GET_LOCK` (D83, `business-rules.md` L187 y L206; `docs/decisions/0006` F2).
- ADR L32 (texto nuevo de F1): las seis transacciones que toman `GET_LOCK` son reserva pública, confirmación, bloqueo de horario del wizard, creación admin, reprogramación admin y reprogramación pública. Esta lista es la correcta según el código.
- `docs/architecture/data-model.md` L199: "Reservas públicas, reprogramación pública, creación admin y reprogramación admin siguen el mismo orden" (omite confirmación y wizard).
- Acción: unificar la lista en ADR L30 con la de L32, y completar `data-model.md` L199.

### F-05 (no bloqueante, cobertura): huecos en la prueba de integración y en la de restauración

- `tests/integration/booking-lock-expiry.integration.test.ts`, prueba "una espera de fila que vence antes que la transacción...": afirma `waiterError` como `Error`, no el tipo (`Lock wait timeout exceeded`, 1205). Cualquier error pasaría esa aserción. La discriminación real viene de los tiempos y del estado del lock.
- C2 (quitar `SET ... = DEFAULT`) no la detecta ninguna prueba de integración: la restauración solo la afirma la unitaria, con un `tx` simulado, lo que comprueba la cadena SQL, no el estado del servidor.
- Acción sugerida (no bloqueante): (a) afirmar que `waiterError.message` coincide con `/Lock wait timeout/`; (b) dentro de una transacción de integración, después de `releaseBookingLocks`, leer `SELECT @@SESSION.innodb_lock_wait_timeout` y afirmar 50.
- Nota de registro: el informe del Developer numera las pruebas de la tabla M2 como "3 = limitación residual, 4 = LOCK_TIMEOUT", pero en el archivo la prueba 3 es LOCK_TIMEOUT y la 4 es la residual. Sin efecto en la conclusión.

### F-06 (no bloqueante, capacidad): una reserva contendida ocupa una conexión del pool hasta ~15 s

- Antes: la expiración de Prisma (5 s) liberaba la conexión. Ahora una espera de `GET_LOCK` (5 s) más otra (5 s) y una espera de fila (5 s) pueden retener la conexión hasta ~15 s, y con esperas exitosas más. Con el pool por defecto de Prisma (el repo no define `connection_limit`) y `maxWait` de 2 s, una ráfaga de reservas contendidas puede dejar a las demás consultas sin conexión (P2024). No medido.
- No lo menciona el informe del Developer ni la ADR. Acción: documentar como consecuencia negativa en la ADR; decisión sobre tamaño del pool, para el owner o el Orquestador.

### F-07 (no bloqueante, decisión de producto): el 409 `LOCK_TIMEOUT` cae en texto genérico en el admin

- `components/admin/months/MonthDetailView.tsx` L81-94 (`resolveBookAppointmentErrorDescriptionKey`) y el `switch` de reprogramación (desde L96) solo tratan `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED` y otros. `LOCK_TIMEOUT` cae en `default` (texto genérico). Antes de F1 la respuesta era `UNKNOWN_ERROR`, que también caía en genérico: no hay regresión. Pero el caso ahora es alcanzable y el mensaje correcto ("conflicto temporal, intenta de nuevo", como en la UI pública) no existe en el admin.
- Decisión: si el owner quiere ese texto, es una micro-ronda de UI (con i18n y `sileo`). Fuera de alcance de F1. El Orquestador decide.

### F-08 (no bloqueante, preexistente, fuera de F1): scripts de reintento con locks sin transacción

- `scripts/retry-sync-failed-appointments.mjs` L112-124, L189-190, L232; `scripts/retry-sync-failed-blocked-slots.mjs` L148-160, L213-214, L254. `GET_LOCK(name, 0)` y `RELEASE_LOCK` van con el cliente global, sin transacción: el pool puede enviarlos a conexiones distintas y el lock quedaría en la primera. No compiten con `booking:*`. F1 no los cambia. Según D92 están en cron `*/10` en producción. Impacto posible: reintentos de sincronización omitidos para ese id mientras la conexión viva. No medido.
- Acción: ronda aparte, no F1. Recomendar al owner priorizarla.

### F-09 (no bloqueante, documentación del check de migración): "Legacy compatibility required: No" debería ser Yes

- El informe del Developer marca "No" en "Legacy compatibility required", pero H5 (F-02) cambia el estado de conexiones compartidas del pool, con efecto sobre flujos fuera de reserva. "Rollback strategy defined: Yes" necesita la salvedad de F-02 (revertir no limpia valores filtrados).
- Acción: corregir el bloque en el informe de la ronda 24 o en la ADR.

### F-10 (no bloqueante, documentación): H6 se puede cerrar

- Ver sección 4, punto 7. Acción: añadir a la ADR (sección de tiempos) que el `timeout` cuenta desde el inicio de la transacción y que `maxWait` no entra. Sin cambio de cifras.

### F-11 (no bloqueante, precondición de despliegue): compatibilidad de `SET SESSION` en producción no verificada

- `acquireBookingLocks` ejecuta `SET SESSION innodb_lock_wait_timeout = 5` en cada reserva (`lib/db/appointments.ts:609`). Verificado en MySQL 8.4.8 local (`docker-compose.yml`, imagen `mysql:8.4`). La versión y los permisos del servidor de producción no están en el repo ni los verifiqué. Si el servidor rechazara la sentencia, las seis rutas fallarían con 400 `UNKNOWN_ERROR`.
- Acción: antes de la release combinada (D45), prueba de humo en staging o en una réplica (reservar, confirmar, reprogramar), que el informe ya lista como pendiente. Responsabilidad del owner.

### F-12 (informativo, sin acción en F1): sentencia previa a los locks en la creación admin

- `lib/admin/appointments/service.ts` L267-272: `resolveClientForCreate(tx, input)` escribe y lee filas de cliente antes de `acquireBookingLocks`. Puede esperar hasta 50 s (sin el `SET`), pero la transacción la corta a 30 s y no hay named lock tomado, así que no hay fuga. Documentado en ADR L39. Puede formar ciclo con un `GET_LOCK` de reserva pública (que toma el cliente después del lock): el ciclo se rompe por el `GET_LOCK` de 5 s o la espera de fila de 5 s. No es regresión. No se toca en F1.

## 6. Checks del Developer

- Flow Contract Check: de acuerdo (UI No, API contract No, validaciones No, criterios No, spec alineada Yes).
- Migration Compatibility Check: de acuerdo salvo "Legacy compatibility required: No", que debería ser **Yes** (F-02, F-09). "Rollback strategy defined: Yes" con la salvedad de F-02.
- Documentation Impact: de acuerdo ("Requires change to docs/specification.md: Yes"). La lista de rutas de la ADR es inconsistente (F-04).

## 7. Qué NO verifiqué

- Producción y staging: nada se ejecutó ahí. La versión y los permisos de MySQL de producción no se conocen (F-11).
- Ciclo de vida de conexiones del pool de Prisma y tiempo real de un lock huérfano (F-01).
- Respuesta de `GET_LOCK` desde otra sesión directamente: solo `IS_USED_LOCK`.
- Ocupación del pool bajo carga (F-06): no medido.
- Motor Rust de Prisma para el origen del temporizador (H6): se cerró con el mensaje de Prisma y el runtime JS (driver adapter).
- Scripts `retry-sync-failed-*` (H2): no se ejecutaron ni se midieron.
- E2E (`playwright`), `npm run lint` completo, `npm run lint:admin-i18n` (no hay UI tocada).
- Código de error exacto 1205 en la prueba 1 de integración (no lo afirma).
- Línea base de HEAD: tomada del brief y del informe del Developer, no reproducida en un worktree.
- Documentación fuera de los pasajes indicados (spec §9 completa, `docs/features/`, `docs/architecture/api.md` completo).

## 8. Riesgos residuales (para el owner)

- H1 (aceptado): una transacción de más de 30 s expira y deja el lock en la conexión, con denegación por fecha o teléfono mientras la conexión viva (F-01). Sin reproducción por debajo de 30 s en uso normal.
- H5 (medido): tras la expiración, la conexión conserva 5 s de espera de fila (F-02).
- Capacidad del pool bajo contención (F-06): no medida.
- Compatibilidad de `SET SESSION` en producción: no verificada (F-11).

## 9. Correcciones requeridas

Ninguna bloqueante. Recomendadas, no bloqueantes, en orden de prioridad:

1. Confirmar con el owner la aceptación de H1 incluyendo la denegación por fecha o teléfono (F-01). Decisión del owner.
2. Corregir ADR L30 (lista de seis rutas), `data-model.md` L199 (F-04) y reformular "peor caso" como caso de una espera (F-03).
3. Documentar en la ADR el efecto sobre flujos fuera de reserva y la salvedad de rollback (F-02, F-09) y el riesgo de pool (F-06).
4. Reforzar pruebas: afirmar el mensaje 1205 en la prueba 1 y la restauración de sesión dentro de una transacción (F-05).
5. Prueba de humo en staging antes de la release combinada (F-11). Responsabilidad del owner.
6. Decisiones de producto para el Orquestador: texto admin de `LOCK_TIMEOUT` (F-07); tamaño del pool (F-06); ronda aparte para los scripts de reintento (F-08).
