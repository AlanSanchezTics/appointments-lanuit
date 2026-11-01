# Ronda 1E, corrección 1 (r1): B-1 y NB-2 a NB-5 (Developer)

**Estado: completa para B-1, NB-2, NB-3, NB-4 y NB-5 con evidencia ejecutada; pendiente de re-revisión por `reviewer-high-risk` y de validación del owner. Documentación (T075) pendiente; no se tocó `docs/`.**

Flujo: Developer → validación humana del owner → `reviewer-high-risk` (también en correcciones). Este informe no cierra la ronda.

No se hizo commit, no hubo cambio de rama, no se tocó `docs/`, no se ejecutó `next build` dentro del repo.

## 1. Archivos modificados en esta corrección

Código:

| Archivo | Cambio |
|---|---|
| `lib/db/admin-appointments.ts` | B-1: `listActiveAppointmentSlotsByDateForUpdate` pasa de `findMany` plano (snapshot) a `SELECT ... FOR UPDATE` crudo con `TIME_FORMAT`, misma forma de salida (`HH:mm`). También `listActiveAppointmentsByDateExcludingForUpdate` (reprogramación admin) pasa a `FOR UPDATE` crudo, para que el nombre diga lo que hace. Import de `Prisma` como valor. |
| `lib/admin/appointments/service.ts` | B-1: comentario D77 en la lectura de ocupación de `createAdminAppointment` (sin cambio de orden). NB-2: `acquireBookingLocks` movido dentro del `try` en `rescheduleAdminAppointment`. |
| `lib/my-appointments/service.ts` | NB-5: se elimina `findRescheduleRulesForShare` (que tragaba cualquier error y devolvía `null`); la reprogramación pública llama directamente a `findMonthAvailabilityForShare`, y un error de `FOR SHARE` se propaga. `SLOT_NOT_AVAILABLE` queda solo para "horario no ofrecido" en `validateRescheduleDestination`. |
| `lib/availability/affected-appointments.ts` | NB-4: guardia N-R2, lanza `AFFECTED_MONTH_MISMATCH` si `current.month !== proposed.month`. |
| `app/api/admin/months/[month]/appointments/route.ts` | NB-3: `LOCK_TIMEOUT` → 409. |
| `app/api/admin/appointments/[appointmentId]/reschedule/route.ts` | NB-3: `LOCK_TIMEOUT` → 409. |

Pruebas:

| Archivo | Cambio |
|---|---|
| `tests/integration/admin-create-concurrency.integration.test.ts` | **Nuevo.** B-1: carrera determinista admin creación vs reserva pública (rechazo `SLOT_NOT_AVAILABLE` y 1 fila) y control (pública confirmada antes). |
| `tests/lib/admin/appointments.lock-order.test.ts` | NB-2: si `acquireBookingLocks` falla, `releaseBookingLocks` se llama. |
| `tests/lib/availability/affected-appointments.test.ts` | NB-4: `AFFECTED_MONTH_MISMATCH` cuando los meses no coinciden. |
| `tests/lib/my-appointments.service.test.ts` | NB-5: un error de `FOR SHARE` se propaga, no es `SLOT_NOT_AVAILABLE`; no hay lock conflictivo ni escritura; se liberan los locks. |
| `tests/app/api-admin-month-appointments-route.test.ts` | NB-3: 409 con `LOCK_TIMEOUT`. |
| `tests/app/api-admin-reschedule-route.test.ts` | NB-3: 409 con `LOCK_TIMEOUT`. |

Informe:

| Archivo | Cambio |
|---|---|
| `specs/003-flexible-month-availability/agent-reports/round-05-admin-api-developer-bis.md` | Corrección NB-2 (nota tras la tabla de §3). |

No tocados (a propósito): `lib/admin/blocked-spaces/service.ts` (usa la función corregida; no requiere cambio de código, ver §6), `lib/db/blocked-slots.ts` (fuera de la lista autorizada, ver §6), `app/api/my-appointments/reschedule/route.ts` (no hace falta código nuevo: el error se propaga y la ruta lo trata como antes), `tasks.md` (ninguna tarea nueva ni completada por esta corrección; no hay una tarea de la carrera admin en `tasks.md`), `docs/**`.

## 2. Causa de B-1 y corrección

Causa (confirmada por la medición, no solo por lectura de código): en InnoDB con REPEATABLE READ, el snapshot se fija en la primera lectura no bloqueante. En `createAdminAppointment`, esa primera lectura es `resolveClientForCreate` (línea ~267), que va antes de los named locks porque necesita el teléfono. Después, `listActiveAppointmentSlotsByDateForUpdate` era un `findMany` plano, así que leía ese snapshot anterior al COMMIT de la reserva pública. Las lecturas bloqueantes (`lockConflictingAppointments`, `findMonthAvailabilityForShare`, `findActiveReservationLockForSlotForUpdate`) sí esperaban al COMMIT, pero no servían de nada si la ocupación se leía después desde el snapshot viejo.

Corrección: la lectura de ocupación de la creación es `FOR UPDATE` (lectura bloqueante, siempre la última versión confirmada). El orden de la transacción no cambia: named locks → `FOR SHARE` de reglas → `lockConflictingAppointments` (FOR UPDATE) → `findActiveReservationLockForSlotForUpdate` (FOR UPDATE) → lecturas de ocupación (ahora FOR UPDATE) → insert. Las lecturas nuevas no toman filas que `lockConflictingAppointments` no haya tomado ya (mismo rango de fecha, mismos estados), así que no añaden lock targets ni ciclos nuevos con la reserva pública ni con la reprogramación.

Mover solo `resolveClientForCreate` después de los locks no lo corrige: `lockPhone` se necesita para los named locks, así que esa lectura debe ir antes. Por eso la corrección está en la lectura de ocupación.

## 3. Comandos ejecutados y resultados

Todos contra `appointments_test` (contenedor `appointments-lanuit-db-1`), con el envoltorio `scratchpad/r1e-fix/integ.sh`, que deriva la URL del `.env` reemplazando la base por `appointments_test`, aborta si no coincide, fija `ENABLE_INTEGRATION_DB=1` y elimina `DATABASE_URL_PROD`. Ningún comando tocó `appointments`.

| Comando | Resultado |
|---|---|
| `npx vitest run` (14 archivos unitarios tocados: affected, my-appointments, lock-order, admin appointments/blocked-spaces, route admin month/reschedule, my-appointments reschedule route, `tests/lib/appointments`, `tests/lib/db`) | 14 archivos pasan, 95 pruebas pasan. |
| `npx vitest run` dirigido de los criterios de salida (availability, admin, db, appointments, my-appointments, validation, calendar, active-months, `api-admin`, `api-my-appointments`, `admin-month-detail-page`, `components/admin/months`) | 71 archivos: 69 pasan, 2 fallan. **484 pasan, 2 fallan, 1 todo (487).** Línea base 479 + 5 pruebas nuevas unitarias. Fallos preexistentes: `api-admin-cancel-route` "returns 200 when cancellation succeeds" y `month-detail-view` "disables schedule CTA when month is inactive". |
| Integración en serie (`--no-file-parallelism`): `admin-create-concurrency`, `reschedule-concurrency`, `availability-concurrency`, `book-appointment`, `availability-backfill`, `reservation-lock`, `cancel-appointment` | 21 pasan, 5 fallan. `admin-create-concurrency` 2/2; `reschedule-concurrency` 1/1; `availability-concurrency` 4/4; `book-appointment` 9/9; `availability-backfill` 3/3; `reservation-lock` 2/4 (fallos preexistentes en L65 y L145, columna `TIME`); `cancel-appointment` 0/3 (preexistente, fuera de la lista del brief: la prueba crea clientes sin `clientNumber`, error de Prisma `Argument clientNumber is missing`; no toco esa ruta). |
| `npx tsc --noEmit` | **32 errores, todos en `tests/`; 0 fuera de `tests/`.** Igual que la línea base del Reviewer. |
| `npx eslint` sobre los archivos de código y de prueba tocados | exit 0 (y de nuevo exit 0 tras una corrección solo de espacios en `lib/my-appointments/service.ts`). |
| Prueba B-1 en copia sin corregir (ver §4) | 1 fallo esperado (el admin resuelve con éxito) y control en verde. |

Nota de arnés: ejecutar archivos de integración en paralelo contra la misma base produce falsos fallos (`Deadlock found` 1213 y `MONTH_NOT_REGISTERED` en `availability-concurrency`, por otro archivo que resetea las mismas tablas). Con `--no-file-parallelism` todo es determinista. Esto debe reflejarse en el comando de integración del perfil (`{{test_commands}}`).

## 4. Prueba de regresión B-1: falla sin la corrección, pasa con ella

La prueba nueva `tests/integration/admin-create-concurrency.integration.test.ts` tiene dos casos:
- **Carrera:** la reserva pública (replicada con la misma secuencia de locks que `book-appointment.ts`: named locks, `FOR SHARE`, `FOR UPDATE`, insert, liberación de named locks antes del COMMIT) retiene su bloqueo; el admin arranca y fija snapshot; 800 ms después la pública inserta y confirma. Esperado: admin `SLOT_NOT_AVAILABLE` y 1 fila a las 10:00.
- **Control:** la pública confirma antes de que empiece el admin. Esperado: `SLOT_NOT_AVAILABLE` y 1 fila.

Demostración de fallo: copia del árbol en `scratchpad/r1e-fix/nofix-repo` (sin `node_modules` propio, enlazado al del repo; sin `.git`), con **solo** `lib/db/admin-appointments.ts` restaurado a la versión original. El repo no se tocó.

- Con la corrección (repo): 2/2 pasan.
- Sin la corrección (copia): la carrera **falla**: el admin resuelve con éxito (`fulfilled`) en el horario que la pública acaba de confirmar, y la prueba aborta en la aserción de rechazo. El control pasa. El número de filas (2) no se imprimió en esa ejecución; se deduce del éxito del admin con la pública ya confirmada y coincide con la medición del Reviewer (`bookedAtSlot: 2`).

Re-medición con el arnés del Reviewer (`scratchpad/r5/race.ts`, copias `race-fixed.ts` y `race-nofix.ts`, solo `appointments_test`):

| Escenario | Con corrección (repo) | Sin corrección (copia) |
|---|---|---|
| Determinista, pública retiene bloqueo | admin `ERR(SLOT_NOT_AVAILABLE)`, 1 fila (2 ejecuciones) | admin `OK(CONFIRMED)`, 2 filas |
| Determinista, control | admin `ERR(SLOT_NOT_AVAILABLE)`, 1 fila | admin `ERR(SLOT_NOT_AVAILABLE)`, 1 fila |
| Estrés creación, 40 iter, tanda 1 | **0 dobles** (40/40 `pub OK / adm SLOT_NOT_AVAILABLE`) | 37 dobles |
| Estrés creación, 40 iter, tanda 2 | **0 dobles** | 34 dobles |
| Estrés creación, 40 iter, tanda 3 (desglose) | **0 dobles**; 0 errores de infraestructura | 34 dobles (34 `pub OK / adm OK`, 6 `pub OK / adm SLOT_NOT_AVAILABLE`); 0 errores de infraestructura |
| Reprogramación admin, determinista (pública retiene) | admin `ERR(SLOT_NOT_AVAILABLE)`, 1 fila | no medido en copia (el cambio de reprogramación no se probó aislado) |
| Reprogramación admin vs pública, 40 iter | **0 dobles**: 40/40 `pub ERR(SLOT_NOT_AVAILABLE) / adm-reschedule OK`; 0 errores | no medido |

Lectura: el estrés sin corregir reproduce la doble reserva en 34 a 37 de 40 (el Reviewer midió 38/40 y 40/40 antes; el orden de arranque cambia el número). Con la corrección, 0 dobles en 120 iteraciones repartidas en tres tandas. NB-10 (la tanda con admin 400 ms después) no se investigó, como pidió el brief; no se re-midió esa variante.

## 5. Hallazgos no bloqueantes: estado

- **NB-2 (reprogramación admin, `acquireBookingLocks` fuera del `try`):** corregido. Prueba unitaria nueva en `tests/lib/admin/appointments.lock-order.test.ts`. **No demostrado que falle sin el cambio** (no lo ejecuté en copia).
- **NB-2 (informe bis):** el Reviewer atribuyó al bis una afirmación sobre la reprogramación admin que ese archivo no contiene literalmente; el bis sí afirma que la creación tiene el `acquire` dentro del `try` (correcto, pero incompleto). Nota añadida en `round-05-admin-api-developer-bis.md` (ver §7). La afirmación errónea sobre la reprogramación está en `round-05-admin-api-developer.md`, línea 87, fuera de mi alcance.
- **NB-3 (`LOCK_TIMEOUT` → 409 en rutas admin):** corregido en las dos rutas, con prueba de ruta en cada archivo. **No demostrado que falle sin el cambio** (no lo ejecuté en copia).
- **NB-4 (guardia N-R2):** implementada como guardia (no como "no aplica"), porque es de dos líneas. Hoy no es alcanzable: el único llamador (`lib/admin/months/service.ts`, `findAffectedAppointments`) pasa el mes del path en ambos lados. Si se alcanza, lanza `AFFECTED_MONTH_MISMATCH`, que `normalizeErrorCode` devuelve como código y la ruta responde 400 sin mapeo específico. Prueba unitaria nueva. **No demostrado que falle sin el cambio.**
- **NB-5 (`findRescheduleRulesForShare` traga errores):** corregido: el error de `FOR SHARE` se propaga. Prueba unitaria nueva. **No demostrado que falle sin el cambio.** Ver §6, cambio de comportamiento en la ruta pública.
- **NB-1 (named locks liberados antes del COMMIT en la reserva pública):** sin cambio, como pidió el brief. La prueba de B-1 replica esa liberación y la corrección funciona con ella. Queda como riesgo residual documentado (ver §8).
- **NB-6, NB-7, NB-8, NB-9, NB-11:** sin cambio (NB-6 y NB-7 son decisiones de Fase 2 o de despliegue; NB-8 patrón preexistente; NB-9 se reporta abajo; NB-11 fuera de 1E).
- **NB-9 (honestidad de pruebas):** `appointments.lock-order.test.ts` verifica el orden con mocks y **no** detecta B-1; la prueba que sí lo detecta es la de integración `admin-create-concurrency`. Las pruebas de ruta siguen mockeando el servicio.

## 6. Limitaciones y riesgos residuales

1. **`listBlockedSlotsByDateForUpdate` sigue siendo lectura plana** (`lib/db/blocked-slots.ts`). Es la otra lectura de la creación admin que el Reviewer pidió revisar. No la cambié: el archivo no está en la lista autorizada, y los flujos públicos (`book-appointment`, `lock-reservation-slot`, reprogramación pública) también la usan. Riesgo: un bloqueo admin concurrente con una creación admin podría no verse (el bloqueo no toca filas de `appointments`, así que `lockConflictingAppointments` no espera por él). **No medido.** Decisión necesaria del Orchestrator: autorizar `lib/db/blocked-slots.ts` para hacerla `FOR UPDATE` (cambio de una consulta) y medirla, o aceptar el residual.
2. **`createAdminBlockedSlots` (D71):** usa `listActiveAppointmentSlotsByDateForUpdate`, que ahora es `FOR UPDATE`. Sus pruebas unitarias pasan (`tests/lib/admin/blocked-spaces.service.test.ts`, 9/9), pero esas pruebas mockean la función. **No hay prueba de integración de bloqueos admin contra la base** en `tests/integration`, así que el comportamiento real de este flujo con el cambio no se ejecutó en la base. Las lecturas bloqueantes sobre las mismas filas que ya toma `lockConflictingAppointments` no deberían cambiar el resultado, pero es inferencia, no medición.
3. **Cambio de comportamiento en la reprogramación pública (NB-5):** un error de `FOR SHARE` (deadlock o timeout) antes respondía 409 `SLOT_NOT_AVAILABLE`; ahora se propaga como error no mapeado y la ruta responde **400 `UNKNOWN_ERROR`**. El brief pedía propagar el error y permitía un código propio solo si era mínimo. Mapear deadlock/timeout de MySQL a `LOCK_TIMEOUT` exige detectar los códigos de error de MySQL (1205, 1213) o los de Prisma (P2034), lo que no hice. **Decisión para el Orchestrator/owner**: ¿409 `LOCK_TIMEOUT` (requiere detección) o 400 `UNKNOWN_ERROR` (lo que deja el código actual)?
4. **`validateRescheduleDestination` (dentro de `lib/my-appointments/service.ts`)** tiene un catch-all que convierte **cualquier** error (también errores de BD de sus propias lecturas) en `SLOT_NOT_AVAILABLE`. No estaba en el alcance de NB-5 (que se limita a `FOR SHARE`). Queda igual; hay que decidir si se extiende.
5. **Nombre de `findActiveAppointmentByIdInMonthForUpdate`** (lectura plana con nombre `ForUpdate`, en reprogramación y cancelación admin): no cambiado. En reprogramación la lectura va después de `lockConflictingAppointments`, así que el orden actual la hace correcta; en cancelación es la primera lectura de la transacción. Deuda de nombre, no de integridad demostrada.
6. **Sin restricción de BD contra dobles:** `appointments` tiene índice `(date, time_slot)` pero no una restricción única sobre horario activo. La protección es solo de aplicación (locks y lecturas). Decisión de arquitectura si el owner quiere una barrera adicional; no la propongo en esta ronda.
7. **Prueba de integración replica la estructura, no el código**: `publicBookingHeldUntil` reproduce la secuencia de locks de `book-appointment.ts`. Si ese flujo cambia de orden, la prueba debe actualizarse (está indicado en su comentario).
8. **Integración preexistente:** `reservation-lock` (2 fallos por columna `TIME`) y `cancel-appointment` (3 fallos por `clientNumber`) no se tocaron; no hay baseline de HEAD para la suite de integración completa.
9. **No ejecutado:** suite completa `npm test`, e2e, `next build` dentro del repo (no permitido), mutación de las pruebas nuevas, carrera de bloqueos admin contra la base, carrera con `saveAvailability`, NB-10.
10. **Turnos:** no expuestos por la plataforma; no los estimo. Esta corrección ocupó aproximadamente 60 llamadas a herramientas.

## 7. Corrección de informes

- `round-05-admin-api-developer-bis.md`: se añadió una nota tras la tabla de §3. Aclara que el bis no contiene la frase sobre la reprogramación que cita el Reviewer; que sus líneas 14 y 30 sobre `createAdminAppointment` son correctas en cuanto a los named locks pero no cubren la lectura de ocupación; y que la reprogramación admin tenía el `acquire` fuera del `try`, ya corregido.
- `round-05-admin-api-developer.md` (línea 87, reprogramación admin: "acquireBookingLocks dentro del try") y línea 113 (creación: "acquireBookingLocks antes del try"): ambas afirmaciones son **incorrectas** según el código actual (reprogramación: fuera del try antes de esta corrección; creación: dentro del try). No edité ese archivo porque no está en la lista autorizada. **Pendiente de corregir por el Orchestrator.**

## 8. Documentation Impact

- Requiere actualización de documentación: **Sí.** No se actualizó en esta ronda (`docs/**` fuera de alcance del Developer). Queda pendiente de T075.
- Secciones a actualizar:
  - `docs/architecture/business-rules.md`: orden de locks de la creación admin (la primera lectura consistente va después de los conflictos; la ocupación se lee con lectura bloqueante); `LOCK_TIMEOUT` → 409 en las rutas admin de creación y reprogramación; un error de `FOR SHARE` en la reprogramación pública no es "horario no ofrecido".
  - ADR de D63 y D77 (`docs/decisions/`): orden de locks; la lectura de ocupación bloqueante es requisito; **riesgo residual**: los named locks de la reserva pública se liberan antes del COMMIT (NB-1), lo que produce la ventana de la carrera; la corrección cierra la creación admin frente a esa ventana, pero la reserva pública sigue liberando antes del COMMIT.
  - `docs/architecture/api.md`: `POST /api/admin/months/{month}/appointments` y `PATCH /api/admin/appointments/{appointmentId}/reschedule` responden 409 con `LOCK_TIMEOUT` (nuevo); `POST /api/my-appointments/reschedule` ante un error de `FOR SHARE` responde 400 `UNKNOWN_ERROR` (decisión pendiente, ver §6.3); `AFFECTED_MONTH_MISMATCH` es interno y no alcanzable hoy.
  - `docs/specification.md`: sección de errores y recuperación (códigos de concurrencia) y, si aplica, de la reprogramación pública.
- Ambigüedades: §6.1 (bloqueos admin) y §6.3 (código de error de la reprogramación pública).

## 9. Flow Contract Check

```text
Flow Contract Check:
- UI steps updated: No (sin cambio de UI)
- API contract updated: No en docs (api.md pendiente T075). En código sí cambia: LOCK_TIMEOUT -> 409 en dos rutas admin; FOR SHARE en la reprogramación pública -> 400 UNKNOWN_ERROR (decisión pendiente)
- Validation rules updated: No (sin cambio de validaciones de entrada; nueva guardia interna N-R2 no alcanzable)
- Acceptance criteria updated: No
- docs/specification.md aligned: No (pendiente T075)
```

## 10. Migration Compatibility Check

```text
Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Sí (revertir los archivos de esta corrección; no hay datos que deshacer). Revertir solo lib/db/admin-appointments.ts reintroduce la doble reserva de B-1
- Cleanup phase defined: No aplica (sin datos ni esquema)
- Integrity protections defined: Parcial. Protección solo de aplicación (locks nombrados, FOR SHARE, FOR UPDATE). Sin restricción de BD nueva (ver §6.6); lista pendiente de decisión
```

## 11. Handoff

- **Hecho:** B-1 (código, prueba de integración, demostración de fallo en copia, re-medición), NB-2, NB-3, NB-4 (guardia), NB-5, corrección del informe bis, limpieza de `appointments_test`.
- **Pendiente:** T075 (`docs/`), corrección de `round-05-admin-api-developer.md` (líneas 87 y 113), decisiones del Orchestrator o del owner sobre §6.1 (autorizar `lib/db/blocked-slots.ts`), §6.3 (código de error de la reprogramación pública) y §6.6 (restricción de BD). Re-revisión del `reviewer-high-risk` y validación del owner antes de cerrar 1E.
- **Archivos tocados:** los listados en §1.
- **Siguiente paso:** el Orchestrator decide §6.1 y §6.3, y lanza `reviewer-high-risk` sobre 1E corregida. No seguir a otra ronda sin esa revisión.
- **Limpieza:** `appointments_test` limpio (mes 2030-06, citas, clientes, locks, `appointment_logs`, bloqueos). Scripts temporales en el scratchpad (`scratchpad/r1e-fix/`); copia sin corregir en `scratchpad/r1e-fix/nofix-repo`.
