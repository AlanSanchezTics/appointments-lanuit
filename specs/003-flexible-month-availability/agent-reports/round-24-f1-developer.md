# Ronda 24 (F1, D82): timeouts explícitos y espera de fila acotada en las transacciones con named locks

- Rol: Developer (`developer`). Flujo: Developer → Reviewer (alto riesgo: reglas de reserva, locks y sincronización).
- Estado: implementado y verificado localmente. Sin commit. Sin UI tocada. Sin cambio de esquema.
- Riesgo residual abierto (decisión del owner): una transacción que supera 30 s sigue expirando y puede dejar su `GET_LOCK` retenido (ver "Hallazgos abiertos", H1).

## 1. Resumen

- Se fijó un `timeout` explícito de 30 s en las seis transacciones que toman named locks, vía la constante compartida `BOOKING_TRANSACTION_OPTIONS` en `lib/db/appointments.ts`.
- `acquireBookingLocks` fija `innodb_lock_wait_timeout` de sesión a 5 s antes de los `GET_LOCK`; `releaseBookingLocks` la restaura a `DEFAULT` al final.
- Efecto medido: con el timeout por defecto, la expiración deja el lock retenido en 4 de 4 casos (sonda, código de HEAD). Con la corrección, una espera de fila o de `GET_LOCK` termina con su error de dominio o de infraestructura dentro de la transacción, y el `finally` libera los locks. `LOCK_TIMEOUT` (409) pasa a ser alcanzable.
- Residual no corregido: una transacción de más de 30 s expira y el lock de sesión queda retenido (medido 2 de 2 con timeout forzado de 500 ms). Corregirlo exige rediseño (liberar en la misma sesión o sustituir `GET_LOCK` por bloqueos de fila transaccionales). No se improvisó.
- Los mapeos de error (`LOCK_TIMEOUT` → 409, `SLOT_NOT_AVAILABLE`, `UNKNOWN_ERROR`) y el orden de bloqueos de ADR 0006 no cambiaron. No hay cambio de contratos de API.

## 2. Inventario de transacciones con named locks

Búsqueda: `GET_LOCK`, `RELEASE_LOCK`, `acquireBookingLocks`, `releaseBookingLocks`, `$transaction` en `lib/` y `app/`. Los únicos llamadores de `acquireBookingLocks` son estos seis. Todos reciben ahora `BOOKING_TRANSACTION_OPTIONS`.

| # | Archivo (cierre de la transacción, tras la edición) | Función | Ruta |
|---|---|---|---|
| 1 | `lib/appointments/book-appointment.ts` L492 | `bookAppointment` | Reserva pública (`POST /api/reservar/...`) |
| 2 | `lib/appointments/book-appointment.ts` L583 | `confirmAppointmentWithLock` | Confirmación pública |
| 3 | `lib/appointments/lock-reservation-slot.ts` L216 | `acquireReservationSlotLockCore` | Bloqueo de horario del wizard (`POST /api/reservar/lock`) |
| 4 | `lib/admin/appointments/service.ts` L348 | `createAdminAppointment` | Creación admin |
| 5 | `lib/admin/appointments/service.ts` L542 | `rescheduleAdminAppointment` | Reprogramación admin |
| 6 | `lib/my-appointments/service.ts` L505 | `rescheduleMyAppointment` | Reprogramación pública (Mi cita) |

Fuera de alcance, verificado por búsqueda: `blocked-spaces/service.ts`, `months/service.ts`, `db/active-months.ts`, `maintenance/reject-pending-appointments.ts`, `cancel-appointment.ts` y `transitionPendingAppointment` no toman `GET_LOCK`. Sus `$transaction` siguen con el timeout por defecto (ver H3).

## 3. Valores antes y después

| Parámetro | Antes (HEAD) | Después |
|---|---|---|
| `timeout` de `$transaction` (6 rutas con lock) | por defecto de Prisma (5 s) | 30 s (`BOOKING_TRANSACTION_TIMEOUT_MS = 30_000`) |
| `maxWait` | por defecto (2 s) | sin cambio, a propósito: es la espera de una conexión del pool antes de tomar locks |
| `GET_LOCK` por nombre | 5 s (literal en SQL) | 5 s (`NAMED_LOCK_WAIT_SECONDS = 5`, bind parameter) |
| `innodb_lock_wait_timeout` de sesión | 50 s (valor por defecto del servidor, medido) | 5 s durante la transacción (`ROW_LOCK_WAIT_SECONDS = 5`); `DEFAULT` al liberar |
| Peor caso de espera de locks sin cadena de esperas exitosas | no acotado (expiraba antes) | 2 x 5 s + 1 x 5 s = 15 s < 30 s |

Verificaciones de orden: `ROW (5 s)` < `timeout (30 s)`, y `timeout > 2 x GET_LOCK + ROW`. Están en la prueba unitaria `tests/lib/db/booking-lock-timeouts.test.ts`.

## 4. Archivos modificados (sin commit)

Código de producción:
- `lib/db/appointments.ts`: L585-593 constantes con comentario del porqué; L600-609 `acquireNamedLock` usa `NAMED_LOCK_WAIT_SECONDS` y `acquireBookingLocks` fija la espera de fila (L609); L631 `releaseBookingLocks` la restaura.
- `lib/admin/appointments/service.ts`: import (`BOOKING_TRANSACTION_OPTIONS`); cierres L348 y L542.
- `lib/appointments/book-appointment.ts`: import; cierres L492 y L583.
- `lib/appointments/lock-reservation-slot.ts`: import; cierre L216.
- `lib/my-appointments/service.ts`: import; cierre L505.

Pruebas:
- `tests/integration/booking-lock-expiry.integration.test.ts` (nuevo, 4 pruebas, solo `appointments_test`).
- `tests/lib/db/booking-lock-timeouts.test.ts` (nuevo, 5 pruebas unitarias: invariantes de tiempos y helpers con `tx` simulado).
- `tests/lib/admin/appointments.lock-order.test.ts`: export `BOOKING_TRANSACTION_OPTIONS` en la factoría del mock y aserción en la prueba de reprogramación admin.
- `tests/lib/appointments/book-appointment.test.ts`: export en la factoría; aserciones en la prueba de reserva y en la de confirmación.
- `tests/lib/appointments/lock-reservation-slot.test.ts`: export en la factoría; aserción en "acquires a lock for an available slot".
- `tests/lib/my-appointments.service.test.ts`: aserción en la prueba de reprogramación pública (la factoría usa `importOriginal`, no hizo falta export).
- `tests/lib/admin/appointments.service.test.ts`: aserción en "does not reject booking when month is inactive" (creación admin, que llega a `$transaction`).

Documentación (Español, salvo `business-rules.md` que está en inglés):
- `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`: fecha; bloque de tiempos de las transacciones; nota de `LOCK_TIMEOUT`; texto de F1 (corregido con riesgo residual); consecuencia negativa del `SET SESSION`; pendiente; trazabilidad D82.
- `docs/architecture/data-model.md`: "Concurrencia a nivel de datos" paso 1 y limitación F1.
- `docs/architecture/business-rules.md`: Concurrency Rules 1 y Known limitations F1.
- `docs/specification.md`: sección 9, punto 1 de orden de locks; F1; encabezado de limitaciones (quitado "planificadas, no corregidas").
- `docs/architecture/api.md`: dos notas (L442 de creación admin/reprogramación, L474 de reprogramación admin) que decían que el 409 casi no se alcanza. Ya no es cierto; solo cambia la nota, no el contrato.

No tocados: UI, `specs/` salvo este informe, `.env`, `prisma/schema*` (sin cambio de esquema), `STATE.md`.

Side effect corregido: `npx tsc` incremental modificó `tsconfig.tsbuildinfo`; se restauró con `git checkout -- tsconfig.tsbuildinfo` (el estado inicial era limpio).

## 5. Comandos ejecutados y resultados

| Comando | Alcance | Resultado |
|---|---|---|
| `npx vitest run` (lista dirigida, antes de editar) | 10 archivos de lock/admin/appointments/my-appointments | 10 archivos, 79 pruebas, todas verdes |
| `npx vitest run` (lista dirigida, después) | 12 archivos (incluye `booking-lock-timeouts`) | 12 archivos, 92 pruebas, todas verdes |
| `node run-integration.mjs .../vitest run --maxWorkers=1 tests/integration/booking-lock-expiry.integration.test.ts` | nueva integración, `appointments_test` | 4/4 verdes (26,1 s) |
| `npx vitest run` (suite unitaria completa) | 820 pruebas | 737 pasan, 62 omitidas, **21 fallan en 11 archivos** (ver abajo) |
| Mismos 11 archivos en HEAD (worktree temporal `git worktree add --detach`, `node_modules` enlazado; worktree eliminado) | HEAD | **mismos 21 fallos** (11 archivos, 21 fallidas / 38 pasan de 59). Preexistente, no causado por F1 |
| `node run-integration.mjs .../vitest run --maxWorkers=1 tests/integration` | suite de integración completa, serial, `appointments_test` | 62 pruebas: 57 pasan, **5 fallan**. Son exactamente las de la línea base: cancel-appointment x3 y reservation-lock x2 |
| `npx tsc --noEmit -p .` | proyecto | 32 errores, todos en `tests/` (línea base: 32). Ninguno en los archivos nuevos ni en `lib/` |
| `npx eslint` sobre los 12 archivos de código/prueba cambiados | lint | exit 0, sin salida |

Causas de los 21 fallos unitarios preexistentes (no relacionados con locks): formato de fechas ICU (`Wednesday March 18` frente a `Wednesday, March 18`), textos de UI (`Confirmar detalles`), `Cannot redefine property: assign` (jsdom), roles/estado de componentes admin. Ninguno toca `lib/db/appointments` ni las rutas de lock.

No ejecutado: `npm run lint` completo del repositorio (solo los archivos cambiados); `npm run lint:admin-i18n` (no hay UI); pruebas E2E (`playwright`); cualquier llamada a Google o WhatsApp reales.

## 6. Evidencia de mutación

Mutaciones aplicadas sobre el código, ejecutadas y restauradas. Restauración verificada con `cmp` contra copia de respaldo.

| Mutación | Prueba | Resultado |
|---|---|---|
| M2: `BOOKING_TRANSACTION_TIMEOUT_MS = 5_000` (revertir timeout) | 1 espera de fila | FALLA (lock retenido: `expected false to be true`) |
| M2 | 2 operación de 6 s con opciones de producción | FALLA (lock retenido) |
| M2 | 3 limitación residual (timeout propio de 500 ms) | pasa (no depende del timeout de producción, por diseño) |
| M2 | 4 `LOCK_TIMEOUT` | FALLA: el error es `Invalid prisma.$queryRaw() invocation` (expiración de Prisma), no `LOCK_TIMEOUT` |
| M1: quitar `SET SESSION innodb_lock_wait_timeout` | 1 espera de fila | FALLA: el waiter termina sin error al liberarse el titular (9 s), `expected null to be an instance of Error` |
| M3 (unitaria): quitar `, BOOKING_TRANSACTION_OPTIONS` en `lock-reservation-slot.ts` | "acquires a lock for an available slot" | FALLA (1 de 12) |

Con M2 la prueba 1 falla y la 4 también: discriminan la expiración (reversión del timeout). La prueba 3 es una caracterización con timeout propio, no discrimina M2 por diseño.

## 7. Mediciones antes y después de la retención de locks

Sonda: `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/92ed9b47-cfd9-4d1b-b04d-b113455908c3/scratchpad/f1-probe/probe-expiry.ts`, ejecutada vía el wrapper en `appointments_test`. Usa los helpers reales `acquireBookingLocks`/`releaseBookingLocks` y una operación de 6 s dentro de la transacción. Los `leak2.ts`/`leak3.ts` del scratchpad no existen en esta sesión; la medición quedó en la sonda y en la prueba de integración.

| Caso | Código | Retenidos tras la expiración |
|---|---|---|
| Antes: timeout por defecto (5 s), operación 6 s | HEAD (helpers sin cambio) | **4 de 4** (error en `finally`: `Transaction already closed`) |
| Después, paso intermedio: timeout 30 s, operación 6 s, sin `SET` de sesión | timeout explícito | 0 de 3 |
| Después, final: prueba 2 (operación 6 s, opciones de producción) | código final | 0 de 1 |
| Después, final: prueba 1 (espera de fila 5 s) | código final | 0: el waiter falla a los ~5 s y los dos locks quedan libres |
| Después, final: prueba 4 (`GET_LOCK` vence a 5 s) | código final | 0: responde `LOCK_TIMEOUT` |
| Residual, final: prueba 3 (timeout forzado 500 ms, operación 1,5 s) | código final | **2 de 2** (no es el caso de producción; es el residual H1) |

Antes, en la ruta de `LOCK_TIMEOUT` (prueba 4 con el código de HEAD): el error observado es la expiración de Prisma, no `LOCK_TIMEOUT`. Eso confirma que el 409 casi no se alcanzaba.

Medición de la reconstrucción del lock: con los timeouts por defecto, la sonda imprimió el error de liberación en cada iteración, lo que confirma que el `RELEASE_LOCK` del `finally` corre sobre una transacción ya cerrada.

## 8. Hallazgos abiertos

- **H1 (residual de F1, decisión del owner).** Una transacción que supera 30 s sigue expirando. Su `finally` no puede liberar el `GET_LOCK`, que queda en la conexión del pool hasta cerrarla. Medido 2 de 2 con timeout forzado. Opciones: aceptar el riesgo antes de la Fase 1 con esta medición, o pedir rediseño (liberar en la misma sesión o sustituir `GET_LOCK` por bloqueos de fila transaccionales, que se liberan con el ROLLBACK). NB-2 y NB-3 no cubren la expiración; protegen errores de JavaScript dentro de la transacción. Este punto lo debe retirar o confirmar el Orquestador en `STATE.md`.
- **H2 (fuera de alcance, sin medir).** Los scripts `scripts/retry-sync-failed-appointments.mjs` (`acquireNamedLock` L112-118, `releaseNamedLock` L120-124, usos en L190 y L232) y `scripts/retry-sync-failed-blocked-slots.mjs` (L148-158, usos en L214 y L254) toman y liberan named locks con el cliente `prisma` **sin transacción**. El pool puede enviar `GET_LOCK` y `RELEASE_LOCK` a conexiones distintas, y entonces el lock quedaría retenido. No se midió. No usan `$transaction` ni los nombres `booking:*`.
- **H3 (observación, sin verificar).** Las transacciones de `blocked-spaces`, `months` y `reject-pending-appointments` usan el timeout por defecto de 5 s. No toman `GET_LOCK`, así que una expiración no deja named locks. Una espera larga en `FOR UPDATE` podría expirarlas. Fuera de alcance de F1.
- **H4 (STATE.md, no editado por mí).** La línea F1 de "Carry-forward de 1E" dice que NB-2 y NB-3 no protegen frente a expiración y que el 409 casi no se alcanza. El primer punto sigue siendo cierto; el segundo ya no. El Orquestador debe reescribir la línea con el estado de este informe.
- **H5 (efecto colateral del `SET SESSION`).** Tras una expiración (solo el residual H1) la restauración no corre y esa conexión del pool conserva 5 s de espera de fila en lugar de 50 s. Documentado en ADR 0006 (consecuencias).
- **H6 (no verificado en la documentación de Prisma).** Si el `timeout` cuenta desde el inicio de la transacción o desde que se obtiene la conexión (`maxWait`). La redacción no depende de ello, pero conviene confirmarlo antes de publicar.

## 9. Checks de entrega

Flow Contract Check:
- UI steps updated: No (no hay cambio de pasos de UI; el cambio es de tiempo de respuesta bajo contención).
- API contract updated: No (sin cambio de rutas, campos, códigos ni estados). Se corrigieron las notas de `api.md` que describían el 409 como casi inalcanzable.
- Validation rules updated: No (ninguna validación cambió).
- Acceptance criteria updated: No (no hay criterios de aceptación de este proceso en los documentos que toqué; la prueba de integración F1 cubre el comportamiento).
- docs/specification.md aligned: Yes (sección 9: punto 1 de orden de locks y F1).

Migration Compatibility Check:
- Schema changes required: No (ningún cambio en `prisma/schema` ni migraciones).
- Data backfill required: No.
- Legacy compatibility required: Yes (corregido en la ronda 26, F-02 y F-09 del Reviewer). El `SET SESSION innodb_lock_wait_timeout` cambia el estado de conexiones compartidas del pool: tras una expiración (residual F1) la conexión conserva 5 s de espera de fila y afecta a flujos fuera de reserva hasta que una transacción de reserva la restaure o la conexión se cierre (medido en la ronda 25). Sin cambio de esquema ni de datos.
- Rollback strategy defined: Yes, con salvedad (ronda 26). Revertir los cambios de `lib/db/appointments.ts` y los seis cierres devuelve el comportamiento de HEAD para las transacciones nuevas; no hay datos que deshacer. Salvedad: revertir no limpia el `innodb_lock_wait_timeout = 5` ni el `GET_LOCK` ya filtrados en conexiones del pool; persisten hasta que la conexión se cierre.
- Cleanup phase defined: No aplica (no hay columnas ni tablas legacy).
- Integrity protections defined: Yes, a nivel de aplicación (timeouts, cota de espera de fila, los named locks existentes). No hay restricción nueva en base de datos: el ADR ya registra que `appointments` no tiene `UNIQUE (date, time_slot)` por decisión del owner.

Documentation Impact:
- Requires change to docs/specification.md: Yes, actualizado (sección 9).
- Flow change: Yes en el tiempo de respuesta bajo contención: una espera de fila ahora falla a los 5 s (antes podía esperar hasta 50 s o expirar a los 5 s), y `LOCK_TIMEOUT` pasa a ser alcanzable. No cambian pasos ni contratos.
- Documentos actualizados: `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`, `docs/architecture/data-model.md`, `docs/architecture/business-rules.md`, `docs/architecture/api.md` (dos notas), `docs/specification.md` (sección 9).
- Ambigüedades: el residual H1 necesita decisión del owner; no se creó ningún ID de decisión nuevo (D82 se reutiliza).

Admin UI Check: No aplica (sin cambios de UI).
Notification Contract Check: No aplica (sin notificaciones UI).

## 10. Verificación pendiente y límites

- Verificado por ejecución: lo listado en la sección 5, las mutaciones de la sección 6 y las mediciones de la sección 7, todas en `appointments_test` (serial, wrapper), salvo las unitarias y el lint, que no tocan BD.
- Verificado solo por diseño (razonamiento, no medido): que las sentencias anteriores a `acquireBookingLocks` no dejan lock; que el peor caso de 15 s es una cota de diseño (no hay prueba de una cadena de esperas exitosas).
- Pendiente del owner: decisión sobre H1; confirmación de H6; aceptación manual (no aplica a esta ronda salvo reproducir la reserva en staging, que no se hizo).
- Siguiente paso sugerido: Reviewer de alto riesgo sobre esta ronda (`reviewer-high-risk`), con foco en H1 y en la lista de seis transacciones. Antes de la release combinada, el Orquestador actualiza `STATE.md` (H4).

## 11. Handoff

- Hecho: corrección (a) de F1 en código, pruebas, documentación, verificaciones y mediciones de esta ronda.
- Pendiente: decisión del owner sobre H1; actualización de `STATE.md` (H4); revisión independiente.
- Archivos tocados: los de la sección 4 más este informe.
- Turnos: cerca del tope de 80 del Developer (estimado, no medido por la plataforma en esta sesión).
