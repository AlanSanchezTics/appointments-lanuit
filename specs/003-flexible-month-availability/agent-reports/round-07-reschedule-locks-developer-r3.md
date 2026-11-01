# Ronda 07 (1F) corrección 3: informe del Developer (r3)

Transcrito por el Orchestrator desde el hand-back. Estado: el test de concurrencia discrimina en las 5 rutas y BLK-2 verificado contra el código antiguo; DOS INCIDENTES requieren decisión del owner.

## Incidentes
**0.1 Credenciales en la salida de la sesión.** Al leer `.env` el filtro `sed` enmascaró solo las URL: `DATABASE_PASSWORD_PROD` y `DATABASE_ROOT_PASSWORD_PROD` salieron en claro en la salida de herramienta. No se usaron ni se escribieron en archivos. Recomendación: el owner rota esas dos contraseñas.

**0.2 Dos archivos de producción sobrescritos por error y reconstruidos.** El respaldo por nombre base guardó solo un `service.ts`; al restaurar una mutación, `cp` copió `lib/my-appointments/service.ts` sobre `lib/admin/appointments/service.ts` y `lib/admin/blocked-spaces/service.ts`. El `diff` comparó contra el mismo respaldo y no lo detectó. Las dos primeras pasadas de mutación sobre admin/bloqueo/confirmación son inválidas (las limpias están abajo). Estado: `lib/my-appointments/service.ts`, `lib/appointments/lock-reservation-slot.ts` y `lib/appointments/book-appointment.ts` intactos (idénticos a su respaldo). Los dos archivos admin se reconstruyeron desde la copia pre-corrección 2 del scratchpad (`.../scratchpad/r07r1/copy/`, la que revisó el Reviewer en r1) aplicando SOLO los cambios del informe r2 (script `.../scratchpad/rebuild-r2.mjs`): BLK-1 creación admin (líneas 280-282), reprogramación admin (472-476), bloqueo de espacios (238-240), NB-4 (eliminados `activeLock.phone !==` en 290 y 497). No hay certeza de que sea byte a byte el estado de la corrección 2 validado por el owner (los cambios no están commiteados). Evidencia funcional: 30 unitarios de orden pasan; integración D89 9/9.
Acción: buscar copia previa (Time Machine, historial local del editor) anterior a las 22:36 del 30/10 y compararla; el Reviewer verifica el diff contra r2.

## Test que discrimina
`tests/integration/reschedule-reservation-lock.integration.test.ts`: `vi.mock` de `cleanupExpiredReservationLocks` (solo en el archivo) que ejecuta la limpieza real y se pausa hasta que la reprogramación esté en `LOCK WAIT` (sondeo de `performance_schema.data_lock_waits` > 0, falla tras 5 s). Escenario: Luis reprograma de SHARED_DATE 14:00 a DEST 10:00; la operación pausada (reserva, creación admin, reprogramación admin, bloqueo de espacios, confirmación) en SHARED_DATE; fila activa de tercera clienta en SHARED_DATE 10:00. `writeRules` acepta `maxPerDay` (CHECK <= 6).
Mutaciones (orden antiguo por ruta, restaurada y verificada): reserva pública, creación admin, reprogramación admin, bloqueo de espacios y confirmación => cada una falla solo su test con `Deadlock found ... 1213`; las otras 8 pasan. Orden actual: 9/9 y 3 repeticiones 9/9, sin flakiness en 4 corridas. Límite: confirmación probada con un token obtenido antes de armar la pausa.

## BLK-2 contra código antiguo
Mutación (try envolvente sobre las dos lecturas): fallan 2 de 3 tests nuevos (deadlock en ocupación, deadlock en bloqueos). El tercero (mes no reservable => SLOT_NOT_AVAILABLE) pasa en ambos por diseño (guarda anti-exceso). Restaurado y verificado con `cmp`.

## Scripts de limpieza global (decisión: no cambiar código)
`scripts/cleanup-reservation-locks.mjs`: `deleteMany` por PK en lotes de 5000, autocommit, solo filas expiradas; no toca citas ni gap locks sobre filas activas; no puede formar ciclo con reprogramaciones. Riesgo acotado: un ciclo solo con una limpieza de la misma fecha que toque las mismas filas expiradas en orden inverso; víctima: el script (reintento seguro) o una operación pública (400 `UNKNOWN_ERROR`, rollback completo). `lib/maintenance/cleanup-reservation-locks.ts` no tiene llamadores en la app. Acotar por fecha no elimina el ciclo; tomar `booking:date` no cubriría el bloqueo de espacios (no lo toma). Recomendación: solo advertencia en el runbook y `--batch` moderado. Texto propuesto para `docs/runbooks/reservation-lock-cleanup.md`: "Concurrencia. `locks:cleanup` borra por lotes (autocommit, por clave primaria) las filas expiradas de `reservation_locks` de todas las fechas. Ejecútalo en una ventana de bajo tráfico y con `--batch` moderado (p. ej. 500). Si termina con `Deadlock found ... 1213`, es seguro volver a ejecutarlo: los lotes confirmados se conservan. Si una reserva pública u operación admin devuelve `UNKNOWN_ERROR` mientras corre, la clienta puede repetir la acción: la transacción se revierte completa, sin doble reserva ni cita perdida. No lo ejecutes en paralelo con otras tareas de mantenimiento sobre las mismas fechas."

## Ejecución
- Todo con `DATABASE_URL` forzada a `.../appointments_test` por wrapper (`.../scratchpad/test-env.sh`, aborta si no termina en `/appointments_test`). Sin `prisma db execute` ni SQL sobre `appointments`; solo `SHOW VARIABLES`/`SHOW DATABASES` por `docker exec`. Limitación: el destino se apoya en que `DATABASE_URL` del entorno prevalece sobre `.env`.
- Integración dirigida 9/9 (x3). Integración completa: 35 tests, 30 pasan, 5 fallan = línea base. Unitarios `tests/lib` + rutas: 389 pasan, 2 fallan en `tests/lib/whatsapp/appointment-labels.test.ts` (formato `Intl`; módulo sin cambios; no verificado en HEAD). eslint `lib/` y archivo de test exit 0. tsc 32 errores en tests ajenos.
- No ejecutado: eslint global, `next build`, e2e, Reviewer.

## Documentación que debe cambiar (no tocada)
ADR 0006 (orden con RL al final en todas las rutas, D89; D88 solo limpieza por fecha); spec L202/L417/L435, 7 paso 8, 8.2, 9; `booking-flow.md` L132/L227; `business-rules.md` ~L196/~L288; runbook L10 + advertencia; `api.md` (causas de `SLOT_NOT_AVAILABLE` y `UNKNOWN_ERROR`); STATE.md (incidentes).

## Migration Compatibility Check
Sin esquema ni backfill; rollback = revertir código (reaparece 1213, sin pérdida de datos); sin restricciones nuevas de BD.
