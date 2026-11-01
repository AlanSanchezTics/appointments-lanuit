# Ronda 1E (ciclo 1): informe del Reviewer (alto riesgo)

**Veredicto: Rejected.** Un hallazgo bloqueante (B-1): la creación admin de citas sigue permitiendo doble reserva frente a una reserva pública concurrente. La reprogramación admin sí queda protegida. Hay además cinco hallazgos no bloqueantes con corrección recomendada.

Modo auditoría: no se modificó código, pruebas ni `docs/` del repo. Las pruebas de carrera y el build se ejecutaron en copias de scratchpad o contra `appointments_test`. Único archivo creado en el repo: este informe.

## 1. Comandos ejecutados y resultados

| Comando / prueba | Resultado |
|---|---|
| `npx vitest run` dirigido (availability, admin, db, appointments, my-appointments, validation, calendar, active-months, `api-admin-*`, `api-my-appointments*`, `admin-month-detail-page`, `components/admin/months`) | 71 archivos: 69 pasan, 2 fallan. 479 pruebas pasan, 1 todo, 2 fallan (482). Fallos: `api-admin-cancel-route` "returns 200 when cancellation succeeds" y `month-detail-view` "disables schedule CTA when month is inactive". Ambos archivos no aparecen modificados en `git status`; el Developer los verificó en copia de HEAD. No lo repetí en HEAD. |
| Integración en `appointments_test` (wrapper del Developer, destino verificado `appointments_test`): `availability-concurrency`, `reschedule-concurrency`, `book-appointment`, `reservation-lock`, `availability-backfill` | 21 pruebas: 19 pasan, 2 fallan. `availability-concurrency` 4/4; `reschedule-concurrency` 1/1; `book-appointment` 9/9; `availability-backfill` 3/3; `reservation-lock` 2/4. Los 2 fallos son `expected [] to have a length of 1` en `tests/integration/reservation-lock.integration.test.ts:65` y `:145`; el cuerpo de la prueba es idéntico en HEAD (solo cambió la numeración por un import nuevo). Causa: el filtro de Prisma sobre la columna `TIME` devuelve 0 filas. No ejecuté baseline de integración en HEAD. |
| `npx tsc --noEmit` | 32 errores, todos en `tests/`; 0 fuera de `tests/` (esperado: 32). `tsconfig.tsbuildinfo` ya aparecía modificado antes de la ronda. |
| `npx eslint` sobre los archivos tocados (rutas `availability`, `slot-mode`, `days/[date]/agenda`, `my-appointments/reschedule`, `lib/admin/{months,appointments,blocked-spaces,dashboard}`, `lib/db/{admin-appointments,admin-months,availability-rules}.ts`, `lib/appointments`, `lib/my-appointments`, `lib/calendar/sync-blocked-slot.ts`, `hooks/admin/months`, dos componentes de `components/admin/months`) | exit 0. |
| `npm run lint:admin-i18n` | 0 errores, 1 aviso en `hooks/admin/useReminderAppointments.ts:13` (`DashboardReminderType` sin uso). Archivo fuera de 1E y no modificado. |
| `next build` en copia de scratchpad sin `.env` ni BD (`node_modules` clonado; el repo no se tocó) | exit 0 (`Compiled successfully`). Incluye las rutas nuevas `availability`, `availability/preview` y `agenda`. |
| Carrera admin↔pública (ver §3) | Scripts en `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/7999bae6-f9f5-4f85-9340-e8d79f1c00ee/scratchpad/r5/` (`race.ts`, `race-head-stress.ts`, `race-build-stress.ts`). Solo contra `appointments_test`, con guard que aborta si la base no es esa. |
| Revisión de consumidores retirados (`isWeekdayBookingDate`, `WEEKDAY_ONLY`, `BASE_TIME_SLOTS`, `resolveBaseSlotsByMonthMode`, `getAvailableStartSlotsWithManualBlocks`) | Sin consumidores en `lib/`, `app/` ni `hooks/`. Vivos: `components/admin/months/MonthDetailView.tsx` (selector de horas del admin, Fase 2 T049–T050) y `components/booking/calendar-modal.tsx` (`isWeekdayInMexicoCity`, flujo público, NB-7 de 1D). |

Limpieza: en `appointments_test` borré solo datos de mis experimentos (todas las `appointment_logs`, `reservation_locks`, citas del 2030-06-03, clientes con `client_number >= 200000`, mes 2030-06). No se tocó otra base.

## 2. Hallazgo bloqueante

### B-1 (blocking): la creación admin de citas permite doble reserva frente a una reserva pública concurrente. D63 no queda cerrado para la creación.

**Archivos y líneas (estado actual del árbol):**
- `lib/admin/appointments/service.ts:267`: `resolveClientForCreate(tx, input)` es la primera lectura consistente (SELECT plano) de la transacción, y ocurre **antes** de los named locks.
- `lib/admin/appointments/service.ts:271` `acquireBookingLocks`, `:274` `findMonthAvailabilityForShare`, `:281` `lockConflictingAppointments` (FOR UPDATE), `:294` `listActiveAppointmentSlotsByDateForUpdate`. Esta última es una lectura plana.
- `lib/db/admin-appointments.ts:165`: `listActiveAppointmentSlotsByDateForUpdate` usa `tx.appointment.findMany` sin cláusula de bloqueo. El nombre "ForUpdate" no describe lo que hace.
- `lib/appointments/book-appointment.ts:446` y `:534`: en la reserva pública, `releaseBookingLocks` va en el `finally` **dentro** de `prisma.$transaction`, así que el bloqueo de nombre se libera antes del COMMIT.

**Escenario de fallo:**
1. La transacción admin abre y ejecuta `resolveClientForCreate` (línea 267). InnoDB REPEATABLE READ fija el snapshot en esa primera lectura consistente.
2. Una reserva pública del mismo horario toma `booking:date:D`, inserta la cita y libera el bloqueo de nombre antes de su COMMIT (`book-appointment.ts:446`).
3. El admin obtiene el bloqueo de fecha (línea 271), pasa `FOR SHARE` y `lockConflictingAppointments`. Esa lectura bloqueante puede esperar a la cita pública no confirmada, pero la lectura de ocupación (línea 294) es plana y usa el snapshot de la línea 267, que no incluye la cita pública.
4. El admin ve el horario libre, inserta la cita y confirma. Quedan dos citas `CONFIRMED` en el mismo día y hora.

**Evidencia ejecutada (no solo por lectura):**
- Reproducción determinista (`race.ts`, modo `deterministic`): la reserva pública mantiene el bloqueo de fecha, el admin empieza y toma su snapshot, la publica inserta, libera y confirma, y luego el admin confirma. Resultado: admin `OK(CONFIRMED)`, 2 filas en `10:00`. Control (la publica confirma antes de que empiece el admin): admin `SLOT_NOT_AVAILABLE`, 1 fila.
- Estrés con llamadas reales a `bookAppointment` y `createAdminAppointment` en paralelo (`race.ts`, modo `stress`, 40 iteraciones, admin entre 0 y 15 ms después): **38 de 40 dobles** (2 de 40 correctas). Verificadas las filas en `appointments_test` (dos `CONFIRMED` a las 10:00, teléfonos `5533000002` y `5544000002`).
- Mismo estrés con el código del repo en copia de scratchpad, arranque simultáneo: **40 de 40 dobles** en dos tandas.
- **Preexistente en HEAD**: copia de `git archive HEAD` con el mismo estrés (`race-head-stress.ts`): **40 de 40 dobles**. HEAD ya tenía la lectura de cliente antes de los locks; 1E no lo introdujo, pero D63 decía que la creación admin ya estaba bien y no es así.
- **Reprogramación admin: correcta.** Con la pública reteniendo el bloqueo (modo `deterministic-reschedule`): admin `SLOT_NOT_AVAILABLE`, 1 fila. Estrés de reprogramación contra reserva pública (80 iteraciones en dos órdenes de arranque): 0 dobles. En esas muestras el admin ganó casi siempre el orden, así que el caso "pública primero con bloqueo retenido" se cubre con la prueba determinista, no con el estrés.

**Corrección probada en copia de scratchpad (no aplicada al repo):** convertir la lectura de ocupación de la creación admin en lectura bloqueante (`SELECT TIME_FORMAT(time_slot,'%H:%i') AS t FROM appointments WHERE date = ? AND status IN ('PENDING','CONFIRMED','SYNC_FAILED') FOR UPDATE`). Con esto, estrés de 40 iteraciones en dos tandas: **0 dobles**, 40 `SLOT_NOT_AVAILABLE` para el admin. Mismo código sin mutar en las mismas condiciones: 40 dobles en dos tandas. Mover solo `resolveClientForCreate` después de los named locks **no basta** (40 dobles), porque la lectura plana de ocupación sigue viendo un snapshot anterior al `COMMIT` de la pública.

**Corrección requerida:**
1. Hacer bloqueantes las lecturas de ocupación de la creación admin (como el mutante probado), o mover la primera lectura consistente de la transacción después de `lockConflictingAppointments`. Renombrar la función o hacerla realmente bloqueante, para que el nombre diga lo que hace. Revisar también `listBlockedSlotsByDateForUpdate` y `findActiveReservationLockForSlotForUpdate` en la misma transacción.
2. Añadir una prueba de integración admin creación ↔ pública (la misma estructura que `race.ts` modo `deterministic`) en `tests/integration`, que falle sin la corrección.
3. Documentar en `docs/architecture/business-rules.md` y en el ADR de D63 que el orden de locks exige que la primera lectura consistente vaya después de los conflictos, y que la liberación de named locks antes del COMMIT es un riesgo residual (ver NB-1).
4. Volver a medir con el mismo arnés y registrar el resultado.

## 3. Hallazgos no bloqueantes

- **NB-1 (non-blocking): los named locks de la reserva pública se liberan antes del COMMIT.** `lib/appointments/book-appointment.ts:446` y `:534` (`finally` dentro de `$transaction`) y `lib/my-appointments/service.ts` (reprogramación pública). Esto explica la ventana de B-1. Si B-1 se corrige con lecturas bloqueantes, queda como endurecimiento; no es necesario para cerrar B-1.
- **NB-2 (non-blocking): `rescheduleAdminAppointment` toma `acquireBookingLocks` fuera del `try`.** `lib/admin/appointments/service.ts:459` (acquire) y `:461` (try). El informe del Developer (§3, punto 2) dice que está dentro del `try`; no es así. D65 NB-3 pide ese patrón. Intenté reproducir la fuga de bloqueo: con el timeout por defecto de Prisma (5 s para transacciones interactivas, el repo no lo cambia) la transacción expira antes de que termine el `GET_LOCK` de 5 s, y el error observado fue `Transaction already closed`. En ese escenario no vi una sesión del pool que retenga `booking:date:D`. No queda demostrado, pero el patrón no coincide con D65 y el informe está mal. Corrección: mover el `acquire` dentro del `try` y corregir el informe.
- **NB-3 (non-blocking): `LOCK_TIMEOUT` no se mapea a 409 en las rutas admin.** `app/api/admin/months/[month]/appointments/route.ts:17-31` y `app/api/admin/appointments/[appointmentId]/reschedule/route.ts:20-34` devuelven 400 para `LOCK_TIMEOUT`. La ruta pública sí lo mapea a 409 (NB-4, `app/api/my-appointments/reschedule/route.ts:26`). Decisión de contrato para el Orchestrator: conviene mapear a 409 para ser consistentes. Nota: con el timeout por defecto de Prisma, `LOCK_TIMEOUT` casi no llega a la ruta (ver NB-2); el mapeo sigue siendo correcto.
- **NB-4 (non-blocking): N-R2 no implementado como dice STATE.** `lib/availability/affected-appointments.ts:43` solo filtra por `isDateInMonth(appointment.date, current.month)`; no hay guardia que lance si `current.month !== proposed.month`. Hoy ambos llamadores pasan el mismo mes, así que no hay fallo observable. El informe del Developer marca "Sin cambio", lo que no cierra el carry-forward de 1C/1D. Corrección: añadir la guardia o registrar que se cierra como "no aplica".
- **NB-5 (non-blocking): `findRescheduleRulesForShare` traga cualquier error.** `lib/my-appointments/service.ts:333-338` devuelve `null` ante cualquier fallo de `FOR SHARE` y eso se convierte en `SLOT_NOT_AVAILABLE` (409). Ya estaba aceptado como residual de 1D. Se comprobó que no hay escritura posterior: `validateRescheduleDestination` lanza antes del `UPDATE`. Un deadlock dentro de la transacción puede dejar los locks restantes ejecutándose sin transacción, aunque no escriben. Recomendación: propagar el error o mapear deadlock/timeout a un código propio.
- **NB-6 (non-blocking, decisión de Fase 2): `PATCH slot-mode` sin `expectedVersion`.** El contrato lo hace opcional en Fases 1–2 (A-01, D51). El PATCH reemplaza todas las reglas del mes, así que un cliente desactualizado puede pisar una edición concurrente hecha con PUT. La UI actual llama al PATCH sin versión (`lib/admin/months/api-client.ts:89`). Hoy no hay PUT en la UI, así que el riesgo es latente. Decisión para el owner/Orchestrator: exigir `expectedVersion` desde la UI al introducir el PUT.
- **NB-7 (non-blocking, condición de despliegue): la UI actual no envía `confirmAffectedAppointments`.** Según `contracts/admin-availability-api.md:139`, cambiar de modo con citas fuera de la nueva rejilla responde 409 y la UI no puede confirmar hasta Fase 2. Con despliegue combinado (D45) es aceptable, pero no se debe desplegar Fase 1 sin la UI de Fase 2.
- **NB-8 (non-blocking): errores de infraestructura en las rutas nuevas.** `normalizeErrorCode` (`lib/api/error-response.ts:14`) devuelve `UNKNOWN_ERROR` y `resolveStatusCode` devuelve 400. Un fallo de BD se ve como 400 y no como 500. Patrón preexistente en el resto de rutas admin; no es pérdida de datos.
- **NB-9 (non-blocking): pruebas que no cubren lo que afirman.** `tests/lib/admin/appointments.lock-order.test.ts` comprueba el orden de llamadas con mocks; no detecta la lectura previa a los locks de B-1. Las pruebas de ruta mockean el servicio. Ninguna prueba de la creación admin frente a la pública existe todavía. El literal `GOOGLE_UNAVAILABLE` → `CALENDAR_SYNC_FAILED` en `tests/lib/appointments/book-appointment.test.ts` es correcto: el mock devuelve el motivo y `finalizeCreatedAppointment` lo propaga (`lib/appointments/book-appointment.ts:348`), así que la aserción sigue comprobando lo mismo.
- **NB-10 (non-blocking, pendiente de explicar): una tanda con admin 400 ms después dio 40 dobles y otras no.** Con el código del repo y el admin 400 ms después de la pública, dos tandas de 40 dieron 40 dobles y otras tres dieron 0 dobles (ver §4). El mecanismo de B-1 no predice dobles con el admin tan tarde, así que no lo entiendo. No lo uso como evidencia. Queda como incógnita a revisar al volver a medir tras la corrección.
- **NB-11 (non-blocking): integración con 2 fallos preexistentes.** `reservation-lock` L65 y L145: el filtro de Prisma sobre `TIME` no coincide. Corrección sugerida: consulta cruda con `TIME_FORMAT` o comparación por cadena. Fuera de la lógica de 1E.

## 4. Verificación de los puntos del brief

| Punto | Resultado |
|---|---|
| Orden de locks sin ciclos (admin create, reschedule, save) | Save: `FOR UPDATE` sobre `active_months` antes de leer citas; las reservas toman `FOR SHARE` sobre la misma fila después de sus named locks. El editor no toma named locks. Sin ciclo. Reschedule admin: named → FOR SHARE → conflictos → fila. Correcto (probado). Create admin: ver B-1. |
| `expectedVersion` rechaza sin escribir | `lib/admin/months/service.ts:247-249` (PUT) y `:296-298` (PATCH), antes de escribir; `replaceMonthAvailability` repite la comprobación (`lib/db/availability-rules.ts:239`). OK. |
| Escritura de reglas bloquea lecturas `FOR SHARE` | `availability-concurrency` 4/4 incluye "makes FOR SHARE reads wait for a rules write in progress". OK. |
| Atomicidad (todo o nada) | Save y PATCH dentro de `prisma.$transaction`; `AffectedAppointmentsConfirmationError` se lanza antes de cualquier escritura. OK por lectura. |
| Citas afectadas con estado bloqueado y `confirmAffectedAppointments` exigido | `service.ts:253-257` y `:306-310`: se calculan con `current` bloqueado y se exige confirmación. OK. |
| `slot_mode` derivado y versión +1 | `deriveSlotMode` en `lib/availability/slot-mode-derivation.ts:39-58`; `replaceMonthAvailability` incrementa la versión. OK. |
| Sin `appointment_logs` por reglas (D24) | `saveAvailability` y `updateAdminMonthSlotMode` no escriben en `appointment_logs`. La reprogramación admin tampoco lo hacía en HEAD (sin cambio). OK. |
| PATCH D16/D33/D69 | Reemplaza reglas por el preset, conserva excepciones (`service.ts:312-317`), y con el mismo modo también reemplaza. OK. |
| N-R4 a solicitud inválida | `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH` llega como código y responde 400, no 500. OK. |
| F9 `preserveCapacity` | `z.boolean()` en `lib/admin/months/validation.ts:200,208` (regla y excepción). OK. |
| D66 contadores sin PENDING, público sin cambio | `listAppointmentsByMonth` y dashboard con `CONFIRMED`/`SYNC_FAILED`. Público: `listMonthAppointments` sin cambio en 1E. OK. |
| D68 PENDING ocupa en agendado, reprogramación y `availableSlots` | `listActiveAppointmentSlotsByDateForUpdate`, `listActiveAppointmentsByDateExcludingForUpdate` y `listBlockingAppointmentsByDate` usan `SLOT_BLOCKING_APPOINTMENT_STATUSES`. OK. Efecto en bloqueos admin (D71) aceptado. |
| D72 reprogramación solo CONFIRMED/SYNC_FAILED | `findAppointmentOwnerPhone` (`service.ts:162-181`) y `findActiveAppointmentByIdInMonthForUpdate` (`lib/db/admin-appointments.ts:91-100`). OK. |
| D15 bloqueos de 1 h y evento de calendario | `durationHours: 1` en `lib/admin/blocked-spaces/service.ts` y `lib/calendar/sync-blocked-slot.ts`. Día completo: 06:00–23:00 fijo (`lib/calendar/google.ts:215-230`). OK. |
| `DATE_NOT_OPERATIONAL` | Pre-check con `resolveDayRule` (`blocked-spaces/service.ts`); D76 acepta 400. Pruebas unitarias de T033 (2/2). OK. |
| D73 creación fuera de rejilla → 409 | `SLOT_NOT_AVAILABLE` → 409 en `app/api/admin/months/[month]/appointments/route.ts:22`. OK. |
| Sesión admin en todas las rutas nuevas | `await auth()` presente en las 15 rutas `app/api/admin/months/**` y `app/api/admin/appointments/**`. OK. |
| Validación de entrada (HH:mm, `00:00`, duplicados) | `TIME_SLOT_SCHEMA` y `normalizeTimes` (`lib/availability/rules-validation.ts:18-33`): HH:mm estricto, `00:00` rechazado (D55), duplicados deduplicados, solapes y fechas duplicadas rechazados. OK. |
| Fuga de datos entre meses | Consultas acotadas por `monthStart`/`monthEndExclusive`; `isDateInMonth` en la afectación. OK. |
| Auditoría: sin eventos nuevos por reglas; creación admin sigue registrando `CONFIRMED` | `createAppointmentLogEvent` en `service.ts:322`. OK. |
| D65 retoques | `return await` en `book-appointment.ts`; `acquireBookingLocks` dentro del `try` en `book`, `confirm`, `lock` y `my-appointments`. Excepciones: admin create (ver B-1; ya dentro del `try`, pero con lecturas previas) y admin reschedule (NB-2). |
| NB-4 `LOCK_TIMEOUT` → 409 pública | `app/api/my-appointments/reschedule/route.ts:26`. OK. |
| Cambios de tipo D67 | `lib/admin/appointments/types.ts`, hooks y componentes de modal solo cambian tipos. `next build` y `tsc` pasan. OK. |
| Reglas retiradas sin consumidores | Ver §1. Quedan `MonthDetailView.tsx` (Fase 2) y el flujo público de calendario (NB-7 de 1D). OK. |

### Medición de la carrera admin↔pública (D63)

| Escenario | Código | Resultado |
|---|---|---|
| Determinista, pública retiene bloqueo, admin empieza antes del COMMIT | Repo | Admin OK, 2 filas (doble) |
| Determinista, control (pública confirma antes) | Repo | Admin `SLOT_NOT_AVAILABLE`, 1 fila |
| Estrés creación, arranque simultáneo, 40 iter | Repo | 38/40 dobles (`race.ts`); 40/40 dobles en dos tandas de la copia |
| Estrés creación, arranque simultáneo, 40 iter | HEAD | 40/40 dobles (preexistente) |
| Estrés creación con mutante (lectura de ocupación `FOR UPDATE`) | Copia de scratchpad | 0/40 dobles en dos tandas |
| Estrés creación con admin 400 ms después | Repo | 0/40 (`race.ts`, y tres tandas posteriores); 40/40 en dos tandas anteriores (NB-10) |
| Determinista, reprogramación con pública retenida | Repo | Admin `SLOT_NOT_AVAILABLE`, 1 fila |
| Estrés reprogramación vs pública, 80 iter en dos órdenes | Repo | 0 dobles (orden de arranque casi siempre favorece al admin) |

## 5. Correcciones requeridas (orden sugerido)

1. **B-1**: corregir la creación admin (lecturas de ocupación bloqueantes o primera lectura después de `lockConflictingAppointments`), con prueba de integración que falle sin la corrección. Volver a medir.
2. **NB-2**: mover `acquireBookingLocks` dentro del `try` en `rescheduleAdminAppointment` y corregir §3 del informe del Developer.
3. **NB-3**: decidir el mapeo de `LOCK_TIMEOUT` en rutas admin (propuesta: 409).
4. **NB-4**: guardia de N-R2 o cierre explícito como "no aplica".
5. **NB-5**: propagar o mapear errores de `FOR SHARE` en la reprogramación pública.
6. **NB-6 y NB-7**: decisiones de Fase 2 (versión obligatoria en PATCH desde UI; UI con `confirmAffectedAppointments`) antes del despliegue combinado.

## 6. Decisiones que requieren al Orchestrator u owner

- **Alcance de D63**: el owner decidió que la creación admin ya estaba protegida. La medición indica que no. Corregirla no es una decisión de producto (es integridad de datos), pero el owner debe saber que D63 se amplía a la creación.
- **NB-3** (409 para `LOCK_TIMEOUT` en rutas admin): contrato.
- **NB-6** (`expectedVersion` obligatorio en PATCH): producto/contrato de Fase 2.

## 7. Riesgos residuales

- Mecanismo de NB-10 sin explicar (aparición intermitente de dobles con el admin tardío).
- Blocked-spaces (`createAdminBlockedSlots`) frente a reserva pública no probado con carrera: toma `FOR SHARE` primero y luego `lockConflictingAppointments`, así que el patrón parece correcto, pero no lo medí.
- Las lecturas de ocupación de `createAdminBlockedSlots` usan la misma función plana `listActiveAppointmentSlotsByDateForUpdate`. Si B-1 se corrige cambiando esa función, este flujo también cambia; hay que volver a ejecutar sus pruebas.
- Documentación (`docs/`, `api.md`, `business-rules.md`, ADR D63/D66/D68) pendiente de T075. Esto no bloquea 1E, pero la corrección de B-1 debe reflejarse ahí.
- Suite de integración completa no ejecutada (solo 5 archivos).

## 8. No ejecutado

- Suite completa (`npm test` / todas las pruebas) y e2e: la fase no cierra en esta ronda.
- Baseline de integración en HEAD (solo lo probé para la carrera de creación, con copia de HEAD y script propio).
- Mutación de las pruebas nuevas.
- Carrera con `createAdminBlockedSlots` y con `saveAvailability` frente a reservas concurrentes.
- `next build` dentro del repo (no permitido en auditoría; se ejecutó en copia).
- Prueba de fuga de bloqueos (NB-2) con timeout de Prisma ampliado: no lo hice.
