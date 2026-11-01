# Ronda 1E (ciclo 2, correccion 1): informe del Reviewer (alto riesgo)

**Veredicto: Approved.** Cero hallazgos `blocking`. B-1 queda cerrado con evidencia ejecutada (codigo, prueba de regresion que falla sin la correccion, y carrera medida 120/120 sin dobles frente a 36/40 y 39/40 sin ella). NB-2 a NB-5 verificados en codigo y pruebas.

Dos hallazgos `non-blocking` requieren decision explicita del owner antes de cerrar 1E (F1 y F2, seccion 6). La medicion de F1 contradice la justificacion de NB-2 (D65): el `finally` que libera los named locks no se ejecuta cuando la transaccion expira, y el 409 de NB-3 casi nunca se alcanza con los timeouts por defecto. Esto debe comunicarse al owner; no lo cierro por mi cuenta.

Modo auditoria: no modifique codigo, pruebas ni `docs/`. Unico archivo creado en el repo: este informe.

Efectos colaterales de mis comandos (declarados):
- `npx tsc --noEmit` actualizo `tsconfig.tsbuildinfo` (cache incremental). Ya aparecia modificado antes de la ronda; no lo restaure para no descartar cambios previos.
- Experimentos en `appointments_test`: limpiados. Quedan solo las semillas del helper de integracion (2026-02 INACTIVE, 2026-03 y 2026-04 ACTIVE), sin citas, clientes, locks, logs ni bloqueos. Una fila huerfana de `availability_rules` creada por mi propia limpieza (desactive las FK por error) se elimino y se verifico.

Scripts de experimento (no commiteados) en `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/7999bae6-f9f5-4f85-9340-e8d79f1c00ee/scratchpad/r5-review/` (`run-harness.sh`, `integ.sh`, `extra.ts`, `leak2.ts`, `leak3.ts`, `leak4.ts`, `leak6.ts`, `build-copy/`, `next-build-r1.log`). Arneses del Developer en `.../scratchpad/r1e-fix/` (`race-nofix.ts`, `nofix-repo/`) y del Reviewer anterior en `.../scratchpad/r5/` (`race.ts`).

---

## 1. B-1: verificacion en el codigo

- `lib/db/admin-appointments.ts:159-173` (`listActiveAppointmentSlotsByDateForUpdate`): `SELECT ... FOR UPDATE` crudo (L169), misma forma de salida (`HH:mm`).
- `lib/db/admin-appointments.ts:124-139` (`listActiveAppointmentsByDateExcludingForUpdate`, reprogramacion): `FOR UPDATE` crudo (L135).
- `lib/admin/appointments/service.ts` creacion (L266-343): `resolveClientForCreate` (L267) sigue siendo la unica lectura plana de la transaccion antes de los locks (necesita el telefono; fija el snapshot de REPEATABLE READ). Despues: named locks (L271), `FOR SHARE` de reglas (L274), `lockConflictingAppointments` (L281), reserva activa `FOR UPDATE` (L283), ocupacion `FOR UPDATE` (L295-298), insert (L312), `finally` que libera (L341-343).
- Reprogramacion admin (L458-538): `acquireBookingLocks` dentro del `try` (L462-463, NB-2), finally (L532-534). Ocupacion `FOR UPDATE` (L499-505).
- Conjunto de filas: el `FOR UPDATE` nuevo bloquea las mismas filas que ya bloqueaba `lockConflictingAppointments` (`lib/db/appointments.ts:431-445`, rama `a.date = D`, mismos estados). No anade objetivos de lock nuevos, asi que no anade ciclos por construccion.
- Lectura plana que queda en la creacion: `listBlockedSlotsByDateForUpdate` (`lib/db/blocked-slots.ts:80-89`, `findMany` plano). Es el residual D80 aceptado por el owner (ver F2).

**Conclusion:** la correccion es correcta en su alcance: toda lectura de citas que decide la disponibilidad en la creacion admin es ahora bloqueante y posterior a los conflictos.

## 2. Comandos ejecutados y resultados

| Comando / prueba | Resultado |
|---|---|
| `npx vitest run` dirigido (availability, admin, db, appointments, my-appointments, validation, calendar, active-months, `api-admin-*`, `api-my-appointments*`, `admin-month-detail-page`, `components/admin/months`) | 71 archivos: 69 pasan, 2 fallan. **484 pasan, 1 todo, 2 fallan (487).** Fallos preexistentes: `api-admin-cancel-route` "returns 200 when cancellation succeeds" y `month-detail-view` "disables schedule CTA when month is inactive". Lo esperado. |
| Integracion en serie (`--no-file-parallelism`) contra `appointments_test` (`integ.sh`, destino verificado): `admin-create-concurrency`, `reschedule-concurrency`, `availability-concurrency`, `book-appointment`, `availability-backfill`, `reservation-lock` | **21 pasan, 2 fallan (23).** `admin-create-concurrency` 2/2; `reschedule-concurrency` 1/1; `availability-concurrency` 4/4; `book-appointment` 9/9; `availability-backfill` 3/3; `reservation-lock` 2/4: fallos preexistentes L65 y L145 (columna `TIME`). |
| Regresion B-1 en la copia sin corregir (`nofix-repo`, solo `lib/db/admin-appointments.ts` distinto de la copia de la correccion; `lib/my-appointments/service.ts` solo tiene una linea en blanco de diferencia) | **Falla 3/3 ejecuciones**: "expected 'fulfilled' to be 'rejected'" (la creacion admin tiene exito con la hora ya confirmada por la publica). El caso control pasa. |
| Regresion B-1 en el repo corregido | **Pasa 3/3 ejecuciones** (2/2 cada una). |
| `npx tsc --noEmit` | **32 errores, todos en `tests/`; 0 fuera de `tests/`.** Ninguno en los archivos nuevos o tocados de la correccion. |
| `npx eslint` sobre 14 archivos de codigo y pruebas tocados (rutas admin y publica de reprogramacion, `lib/db/admin-appointments.ts`, `lib/admin/appointments/service.ts`, `lib/my-appointments/service.ts`, `lib/availability/affected-appointments.ts`, `lib/admin/blocked-spaces/service.ts`, pruebas nuevas y modificadas) | exit 0. |
| `next build` en copia nueva del arbol (`build-copy/`, sin `.env`, sin BD, `node_modules` enlazado) | **exit 0**, "Compiled successfully". Solo los avisos de Edge Runtime preexistentes (jose / next-auth). No ejecute build dentro del repo. |
| Mediciones de carrera y fuga (seccion 3 y 6) | Solo contra `appointments_test`, con guardas que abortan si la base no es esa. |

## 3. Carrera: mediciones (arneses reales: `bookAppointment`, `createAdminAppointment`, `rescheduleAdminAppointment`, `createAdminBlockedSlots`, `saveAvailability`)

Columnas: repo corregido / copia sin corregir. Dobles = dos citas o cita y bloqueo a la misma hora, ambas exitosas.

| Escenario | Iteraciones | Corregido | Sin corregir | Infra (deadlock, timeout) |
|---|---|---|---|---|
| Admin crea 10:00 vs publica 10:00, publica retiene el lock de fecha (determinista) | 1 + control | admin `SLOT_NOT_AVAILABLE`, 1 fila | admin `OK`, **2 filas** | 0 |
| Admin crea vs publica, arranque simultaneo 0-15 ms (`race.ts stress`) | 40 x 3 | **0 dobles (120)** | **36/40 y 39/40 dobles** | 0 |
| Admin crea vs publica, admin +400 ms (NB-10) | 40 x 2 | 0 dobles | 0 dobles | 0 |
| Publica llega tarde (admin inmediata, publica 0-15 ms) | 40 | 0 dobles | no medido | 0 |
| Reprogramacion admin vs publica, determinista (publica retiene) | 1 | admin `SLOT_NOT_AVAILABLE`, 1 fila | no medido | 0 |
| Reprogramacion admin vs publica, arranques simetricos 0-15 ms | 40 | **0 dobles** (14 publica perdio, 26 admin perdio) | 0 dobles (29 admin perdio, 11 publica perdio) | 0 |
| Reprogramacion admin vs publica (`race.ts reschedule`, publica 0 y 10 ms) | 40 x 2 | 0 dobles, pero la publica perdio 80/80 | no medido | 0 |
| Creacion admin vs reprogramacion admin (mismo horario) | 40 | **0 dobles** (23 creacion OK, 17 reprogramacion OK) | no medido | 0 |
| Guardar disponibilidad (quita 10:00, `confirmAffectedAppointments=false`) vs creacion admin 10:00 | 40 | **0 violaciones** (26 guardado OK / creacion `SLOT_NOT_AVAILABLE`; 14 guardado `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` / creacion OK) | no medido | 0 |
| Bloqueo admin 10:00 vs creacion admin 10:00 | 40 | **17/40 dobles** (ambas OK) | 18/40 dobles | 0 |
| Bloqueo admin 10:00 vs publica 10:00 | 40 | **10/40 dobles** | 9/40 dobles | 0 |

Lectura:
- La correccion elimina la doble reserva admin-publica en creacion (B-1). Sin ella, 75 de 80 iteraciones de estres producen doble reserva.
- En reprogramacion, la copia sin corregir tambien da 0 dobles en la prueba simetrica. El orden de locks ya protegia la reprogramacion: el snapshot de su transaccion se fija despues de `lockConflictingAppointments`. El `FOR UPDATE` nuevo ahi es defensivo, no esta demostrado como necesario.
- Bloqueo vs creacion y bloqueo vs publica: **17/40 y 10/40 dobles con la correccion; los mismos valores sin ella.** Es el residual D80 (lectura plana de `listBlockedSlotsByDateForUpdate`). No lo introduce 1E ni lo corrige B-1. Ver F2.
- NB-10 (que en la sesion anterior dio 40 dobles con el admin 400 ms despues): **no reproducido** (0/80 corregido, 0/40 sin corregir). No tengo explicacion para la observacion anterior; no la uso como evidencia.

## 4. Deadlocks (pedido explicito del brief)

- Analisis: el `FOR UPDATE` nuevo no anade objetivos de lock frente a `lockConflictingAppointments`, que ya tomaba esas filas en HEAD. Los named locks serializan creacion y reserva publica por fecha hasta la liberacion en el `finally`; `createAdminBlockedSlots` no toma named locks, pero sus locks de fila coinciden con los de la creacion. Esto no produce ciclos nuevos por construccion.
- Medido: **0 errores de deadlock (1213), timeout de lock (1205) o LOCK_TIMEOUT** en todas las combinaciones de la seccion 3 (admin create ↔ publica, admin create ↔ admin reschedule, admin create ↔ bloqueo admin, admin create ↔ `saveAvailability`, reprogramacion ↔ publica, bloqueo ↔ publica). Los errores observados fueron solo codigos de negocio (`SLOT_NOT_AVAILABLE`, `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`).
- No medido: `createAdminBlockedSlots` ↔ `saveAvailability` (solo analisis: ambos toman `FOR SHARE`/`FOR UPDATE` sobre la fila del mes en el mismo orden que el resto).

## 5. Verificacion de NB-2, NB-3, NB-4, NB-5 y D81

| Punto | Estado | Evidencia |
|---|---|---|
| NB-2 (`acquireBookingLocks` dentro del `try` en reprogramacion admin) | **Cumplido en codigo.** Con la salvedad de F1 | `service.ts:462-463`; prueba `tests/lib/admin/appointments.lock-order.test.ts:200-207` (rechazo de `acquireBookingLocks` -> `releaseBookingLocks` como ultima llamada). No ejecute el mutante (acquire fuera del `try`) en copia. |
| NB-3 (`LOCK_TIMEOUT` -> 409 en rutas admin de creacion y reprogramacion) | **Mapeo cumplido; efecto practico no alcanzable con timeouts por defecto** (F1) | `app/api/admin/months/[month]/appointments/route.ts:22-24`; `app/api/admin/appointments/[appointmentId]/reschedule/route.ts:29-31`; pruebas de ruta con `LOCK_TIMEOUT` en ambas. Medido: con el named lock de fecha retenido por otra sesion, la creacion admin falla a los 5,0 s con "Transaction already closed ... timeout 5000 ms", no con `LOCK_TIMEOUT`. El cliente recibe 400 `UNKNOWN_ERROR`. |
| NB-4 (guardia `AFFECTED_MONTH_MISMATCH`) | **Cumplido.** No alcanzable hoy | `lib/availability/affected-appointments.ts:35-38`; prueba en `tests/lib/availability/affected-appointments.test.ts:223`. |
| NB-5 (`findRescheduleRulesForShare` eliminada, error de `FOR SHARE` propagado) | **Cumplido.** Sin referencias restantes en `lib/`, `app/`, `tests/` | `lib/my-appointments/service.ts:416` (`findMonthAvailabilityForShare` directo); prueba `tests/lib/my-appointments.service.test.ts:331` (propaga "Lock wait timeout exceeded"). Ver F4 sobre el `catch` vecino. |
| D81 (reprogramacion publica: error de `FOR SHARE` -> 400 `UNKNOWN_ERROR`) | Aceptado por el owner; verificado en `app/api/my-appointments/reschedule/route.ts:22-30` | `normalizeErrorCode` devuelve `UNKNOWN_ERROR`; la ruta responde 400. |
| Sin cambios de esquema ni de contrato en esta correccion | Migration Compatibility Check: esquema No, backfill No, compatibilidad legacy No, rollback: revertir archivos (no hay datos) | n/a |

## 6. Hallazgos (cada uno una vez)

### F1 (non-blocking, decision del owner; preexistente en HEAD): los named locks quedan retenidos cuando la transaccion expira

**Escenario medido.** Las transacciones interactivas no tienen `timeout` explicito (`grep` sin resultados en `lib/` y `app/`), asi que rige el valor por defecto de Prisma: 5000 ms. `acquireNamedLock` usa `GET_LOCK(name, 5)` (`lib/db/appointments.ts:577`). Si la transaccion espera filas (o un lock) mas de 5 s con named locks ya tomados, Prisma la expira. El `finally` que libera los locks corre sobre una transaccion cerrada y falla. `GET_LOCK` es de sesion, no de transaccion: el ROLLBACK no libera el lock.

Mediciones (`appointments_test`, fecha 2030-06-03; la sesion ajena retiene filas con `SELECT ... FOR UPDATE`, sin named locks):
- **Creacion admin**: la llamada se rechaza a los 8,0 s (cuando termina la espera de filas) con "Transaction already closed ... timeout 5000 ms". `booking:date:2030-06-03` queda retenido por una sesion MySQL inactiva (hilos 689, 696, 699, 714, 726). Desde otra sesion, `GET_LOCK(...,1)` devuelve 0. Control con retencion de 3 s: admin OK, sin fuga.
- **Reprogramacion admin**: igual (hilo 704, `GET_LOCK` = 0).
- **Reserva publica**: igual (hilo 738, `GET_LOCK` = 0). Variante con el mes retenido por el editor (`FOR UPDATE` sobre `active_months`, como en `saveAvailability`): la reserva expira, y en esa ejecucion no quedo lock (1 ejecucion, no concluyente).
- Resumen: el lock quedo retenido en 7 de 10 ejecuciones de expiracion. En las 3 restantes el lock ya no estaba al comprobarlo (dos de creacion, una de la variante con editor). Esas ejecuciones hicieron consultas sobre la conexion antes de comprobarlo, pero la liberacion no es determinista: leak3 tambien hizo consultas y mantuvo el lock. Sin consultas adicionales, la retencion duro al menos 30 s (hilo 714).
- `INNODB_TRX` de la sesion retenida: vacio. Solo queda el named lock, sin transaccion abierta ni snapshot antiguo.
- Efecto colateral en el mismo proceso: tras la expiracion, la primera lectura de `active_months` devolvio `MONTH_NOT_ALLOWED` en 6 de 7 ejecuciones con sonda, aunque la fila existia y era `ACTIVE` (verificado desde otra sesion). En una ejecucion, la primera consulta de conteo de citas fallo con "Server has closed the connection."; la siguiente devolvio el conteo correcto (`n=1`). No observe conteos silenciosamente erroneos de ocupacion, pero no lo medi de forma sistematica.
- Efecto en otras reservas: con el lock de fecha retenido, toda reserva, reprogramacion o bloqueo de esa fecha falla tras 5 s con LOCK_TIMEOUT (inferido de `acquireNamedLock` y medido con `GET_LOCK` = 0 desde otra sesion).
- Control de HEAD: no medi la fuga contra HEAD. Verifique por `git show HEAD` que el mecanismo ya existe en produccion: `GET_LOCK` en `lib/db/appointments.ts`, `acquireBookingLocks` en la creacion admin y en la reserva publica.

**Por que no bloquea 1E aqui:** el mecanismo es preexistente en HEAD, 1E no lo introduce, y el disparador requiere una espera de mas de 5 s dentro de la transaccion. Pero la justificacion de NB-2/D65 ("los locks dentro del `try` para que el `finally` los libere") solo cubre fallos de adquisicion, no expiracion. Mi informe anterior decia "no queda demostrado" y eso era incorrecto: ahora queda demostrado.

**Correccion requerida antes de la release combinada (D45); la eleccion es del owner:**
- (a) Alinear timeouts: `prisma.$transaction(fn, { timeout })` por encima del peor caso de espera de locks y filas, y `innodb_lock_wait_timeout` de sesion por debajo del timeout de transaccion. Reduce la probabilidad; no elimina la fuga si una consulta se cuelga. Ademas hace alcanzable el 409 de NB-3.
- (b) Eliminar la causa: locks transaccionales (fila de control por fecha y por telefono, `SELECT ... FOR UPDATE`) en lugar de `GET_LOCK` de sesion. Se liberan en COMMIT o ROLLBACK. Cambia el mecanismo de D63/D65 en todos los flujos (admin y publico). Es la unica opcion que lo elimina por diseno.
- Cualquier opcion debe re-medirse con `leak2.ts` y `leak3.ts` (retencion tras expiracion) y con el arnés de carrera de la seccion 3.
- Si el owner acepta F1 como residual, el Orchestrator debe registrarlo en `STATE.md` con estos datos, y la documentacion no debe decir que NB-2 protege contra expiracion.

### F2 (non-blocking; D80 cerrado por el owner, magnitud medida nueva): doble reserva de hora bloqueada por lectura plana de bloqueos

- Medido con la correccion: bloqueo admin vs creacion admin **17/40** (ambas exitosas: cita y bloqueo a la misma hora); bloqueo admin vs reserva publica **10/40**. Sin la correccion: 18/40 y 9/40. El origen es `lib/db/blocked-slots.ts:80-89`, lectura plana usada por la creacion admin (`lib/admin/appointments/service.ts:297`), la reserva publica (`lib/appointments/book-appointment.ts`, `listBlockedSlotsByDateForUpdate`) y la reprogramacion; `createAdminBlockedSlots` no toma named locks.
- D80 esta cerrado: lo acepto como residual, no lo reclasifico como `blocking`. Pero la aceptacion no tenia magnitud: la medicion sugiere que una creacion o reserva concurrente con un bloqueo de la misma hora la ignora en una proporcion alta cuando empiezan a la vez. **Pido al Orchestrator que confirme con el owner que la aceptacion cubre esta magnitud.**
- Opcion de correccion (decision del owner): `FOR UPDATE` en `listBlockedSlotsByDateForUpdate` (una consulta). Afecta a los flujos publicos, por eso no lo propongo en esta ronda.

### F3 (non-blocking, NB-1): named locks de la reserva publica se liberan antes del COMMIT

- `lib/appointments/book-appointment.ts:445-447` y `lib/my-appointments/service.ts:483-485`. Tras la correccion no medi ningun doble atribuible a esta ventana (creacion vs publica: 120 de estres y 80 con admin +400 ms; publica tardia: 40; reprogramacion simetrica: 40). Queda como endurecimiento, como pidio el brief.

### F4 (non-blocking): `catch` amplio en `validateRescheduleDestination`

- `lib/my-appointments/service.ts:394-398`: cualquier error dentro del `try` (incluidos deadlocks o timeouts de sus lecturas `findMany` y `listBlockedSlotsByDateForUpdate`, y errores de `getBookableMonthConfig`) se convierte en `SLOT_NOT_AVAILABLE` (409). NB-5 queda cerrado (el `FOR SHARE` ya no entra ahi), pero es el mismo patron. Escenario: un deadlock en la lectura de ocupacion muestra "horario no disponible" en vez de error. Recomendacion: estrechar el `catch` a errores de dominio.

### F5 (non-blocking, cobertura de pruebas)

- `tests/integration/admin-create-concurrency.integration.test.ts:62-85` replica la secuencia de locks de la reserva publica, no llama a `bookAppointment`. Si `book-appointment` cambia de orden, la prueba no lo detecta (el comentario ya lo advierte). Falla 3/3 sin la correccion y pasa 3/3 con ella: es una prueba de regresion valida para B-1.
- No hay prueba de integracion determinista de reprogramacion admin vs publica. La prueba simetrica de estres no distingue la version corregida de la anterior (0 dobles en ambas). El `FOR UPDATE` de reprogramacion queda sin prueba que lo justifique.
- `createAdminBlockedSlots` vs `saveAvailability` no medido (seccion 4).

### F6 (non-blocking, documentacion y proceso)

- Documentacion pendiente de T075: `docs/architecture/business-rules.md` (orden de locks, `LOCK_TIMEOUT` -> 409 en rutas admin, error de `FOR SHARE` en reprogramacion publica), `docs/architecture/api.md` (409 y 400 `UNKNOWN_ERROR`, D81), ADR D63/D77 (lectura bloqueante requerida; NB-1 como riesgo residual), `docs/specification.md` (errores de concurrencia). Hasta que F1 se decida, no describir NB-2 ni NB-3 como proteccion frente a expiracion.
- `round-05-admin-api-developer-r1.md` seccion 5 dice NB-2 "corregido" sin matiz. Debe matizarse con F1. Las anotaciones del Orchestrator en `round-05-admin-api-developer.md` (lineas 87 y 113) ya corrigen las afirmaciones falsas que senalo el Developer.
- Comando de integracion: debe incluir `--no-file-parallelism` (en paralelo aparecen deadlocks falsos, como anota el Developer). Pendiente en `{{test_commands}}` (Q-T1 de `STATE.md`).

## 7. Correcciones requeridas y decisiones

- **Blocking:** ninguna.
- **Decisiones para el Orchestrator / owner antes de cerrar 1E:**
  1. F1: elegir (a), (b) o aceptar como residual con los datos de la seccion 6. Es decision de protocolo de locks; afecta a flujos publicos.
  2. F2: confirmar con el owner la magnitud de la carrera con bloqueos (D80).
- **Recomendado antes de la release combinada (D45):** resolver F1; F2 si el owner lo pide; F4; las pruebas de F5 si se cambia el mecanismo.
- No pido cambios de codigo para esta ronda: B-1 y NB-2..NB-5 estan cerrados.

## 8. Riesgos residuales

- F1: fuga de named lock en expiracion (preexistente), con efecto de bloqueo de fecha y lecturas transitorias erroneas.
- F2: doble reserva de hora bloqueada en carrera (D80).
- F3: ventana de liberacion de named locks antes del COMMIT (no medida como doble tras la correccion).
- Reprogramacion admin: la proteccion depende de un orden de locks correcto, no de la lectura bloqueante (que resulto defensiva).
- Sin restriccion de BD sobre horario activo (`appointments` solo tiene indice `(date, time_slot)`): la proteccion es solo de aplicacion.

## 9. Lo que no ejecute

- Suite completa (`npm test`) y e2e: la fase no cierra en esta ronda.
- `next build` dentro del repo (no permitido en auditoria); se ejecuto en copia.
- Integracion `cancel-appointment` (fuera de la lista del brief; fallos preexistentes por `clientNumber`).
- Mutante de NB-2 (acquire fuera del `try`) para demostrar que el test falla con el codigo anterior.
- `npm run lint:admin-i18n` (no hay cambios de UI admin).
- Medicion de `createAdminBlockedSlots` vs `saveAvailability` en carrera.
- Medicion de la variante de fuga con editor en mas de una ejecucion (una sola medida).
- Baseline de HEAD para el arnés de carrera: el HEAD de la copia de scratchpad no tiene `lib/db/availability-rules.ts` (la capa llega en 1A, sin commitear), asi que no sirve como comparacion. La comparacion valida es la copia sin corregir.
- Turnos del Reviewer: no expuestos por la plataforma; no los estimo.
