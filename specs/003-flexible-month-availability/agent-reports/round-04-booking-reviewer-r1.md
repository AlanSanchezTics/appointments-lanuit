# Ronda 1D — Reviewer (re-revisión, corrección 1) — `reviewer-high-risk`

Modo auditoría: no se modificó código ni pruebas del repositorio. Los experimentos se ejecutaron con scripts y copias en el scratchpad. Contra la base de datos solo se usó `appointments_test` (wrapper que sobrescribe `DATABASE_URL` y aborta si el destino no es `appointments_test`; `DATABASE_URL_PROD` no se exporta).

## Veredicto

**Approved** para el alcance de la Ronda 1D (T024–T029), sin hallazgos `blocking`.

- B1 y B2 del ciclo 1 están corregidos en el código y verificados (ver sección 1).
- Hay 9 hallazgos `non-blocking`. Dos requieren decisión del owner antes de la release combinada (D45): NB-1 (doble reserva admin↔pública, preexistente) y NB-6 (comportamiento transitorio de la ruta admin de creación). Dos requieren corrección del informe del Developer (NB-5, NB-9).

## 1. Verificación de B1 y B2

### B1 — orden de locks en `rescheduleMyAppointment` (corregido en código)

Código actual, `lib/my-appointments/service.ts`:

- L422: `acquireBookingLocks(tx, date, phone)` (named locks, `GET_LOCK` ordenados).
- L424: `try {`
- L425: `findRescheduleRulesForShare` → `FOR SHARE` sobre `active_months` (vía `findMonthAvailabilityForShare`).
- L426: `lockConflictingAppointments(tx, date, phone)` → `FOR UPDATE` sobre citas con fecha o teléfono coincidentes.
- L428: `findAppointmentForRescheduleForUpdate` → `FOR UPDATE` de la cita (ya incluida en el conjunto anterior, no añade espera).
- L493: `finally { releaseBookingLocks }`, dentro del callback de `$transaction`.

Orden igual al de reserva (`lib/appointments/book-appointment.ts` L430–446) y confirmación (L477–534). No hay ciclo entre named locks, `FOR SHARE` y `FOR UPDATE`: los named locks se toman siempre en el mismo orden, y `FOR SHARE` y `FOR UPDATE` van después dentro de la misma transacción. La liberación está en `finally`, y se ejecuta también cuando la reprogramación falla (prueba unitaria `releases the booking locks when the reschedule fails`).

Evidencia ejecutada:

- Prueba del repo `tests/integration/reschedule-concurrency.integration.test.ts`: 1/1 pasa.
- Experimento de dos reprogramaciones públicas concurrentes al mismo día y hora (8 lotes × 20 rondas = 160 rondas, con la corrección): 0 dobles reservas.

Nota sobre la evidencia (ver NB-5): la afirmación del informe de "5/5 falla sin el fix" no se reproduce. Con una copia mutada sin `acquireBookingLocks` en `rescheduleMyAppointment`, la prueba del repo pasa 5/5 y el experimento de 160 rondas da 0 dobles. El orden de locks sigue siendo el correcto por diseño (PD-08, D39), pero esa prueba no demuestra que el fix sea necesario.

### B2 — fechas de calendario inválidas (corregido)

- `lib/validation/appointment.ts` L29–30: `date: z.string().refine(isValidIsoDate, ...)`. Se aplica a `bookingCoreSchema`, así que lo heredan `bookingSchema`, `lockReservationSchema` y `confirmBookingWithLockSchema`.
- `lib/validation/my-appointments.ts` L12: `dateSchema` con `isValidIsoDate` (usado por `myAppointmentsRescheduleSchema`).
- `isValidIsoDate` (`lib/availability/day-rule.ts` L5–16) usa `daysInMonth` (años bisiestos incluidos) y rechaza mes fuera de 1–12.
- Un `ZodError` pasa por `normalizeErrorCode` (`lib/api/error-response.ts` L6–7) → `VALIDATION_ERROR`. Las cuatro rutas responden 400 por el caso por defecto de su `switch`.
- Pruebas: `tests/lib/validation/appointment.test.ts` L83–100 (los tres esquemas de reserva/lock/confirmación con `2026-02-30`, `2026-13-01`, `2026-04-31`), `tests/lib/validation/my-appointments.test.ts` L23, `tests/lib/my-appointments.service.test.ts` L339. Todas pasan.

## 2. Riesgos declarados por el Developer

**(a) `LOCK_TIMEOUT` en reprogramación pública → 400.** Valoración: `non-blocking` (NB-4).
- `app/api/my-appointments/reschedule/route.ts` L22–27 mapea a 409 solo `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_NOT_MODIFIABLE` y `SLOT_NOT_AVAILABLE`.
- En la práctica, el error observado no es `LOCK_TIMEOUT`. La transacción interactiva de Prisma tiene timeout por defecto de 5000 ms, igual que el `GET_LOCK` de 5 s, y la transacción vence primero. El mensaje es multilínea ("Transaction already closed…"), así que `normalizeErrorCode` devuelve `UNKNOWN_ERROR` y la ruta responde 400. Las rutas de reserva/lock/confirmación ya responden lo mismo hoy. Antes de 1D, una espera larga sobre `FOR UPDATE` ya caía en el mismo timeout.

**(b) Admin reschedule sin named locks.** Valoración: `non-blocking`, preexistente, requiere decisión del owner (NB-1). Demostrado.

**(c) `return createAppointmentInTransaction(...)` sin `await`.** Valoración: `non-blocking`, preexistente (NB-2). Confirmado por lectura: `lib/appointments/book-appointment.ts` L435. El `finally` (L444–446) se ejecuta antes de que la promesa de creación termine, así que `releaseBookingLocks` corre antes del insert y del cliente. No reproduje daño: 60 pares concurrentes de reservas de un teléfono nuevo (mismo día, distinta hora) dieron OK/OK, con un cliente creado por par. `confirmAppointmentWithLock` sí usa `await` (L523).

**(d) Lock sobre hora quitada y bloqueada por otro teléfono → `SLOT_LOCKED`.** Valoración: `non-blocking` (NB-8). Código: `lib/appointments/lock-reservation-slot.ts` L184–190: si la hora no está en `availableSlots` y además está en `lockedSlots`, responde `SLOT_LOCKED`. Ambos códigos son 409. D39 habla de confirmación (`SLOT_NOT_AVAILABLE`).

## 3. Regresiones revisadas

- `WEEKDAY_ONLY`: ningún consumidor en código, pruebas, i18n ni componentes (grep excluyendo specs y docs). Sin consumidores rotos.
- `isWeekdayInMexicoCity`: sigue exportado (`lib/datetime/mexico-city.ts` L78) y lo usa `components/booking/calendar-modal.tsx` L9 y L93. Ni roto ni eliminado (NB-7).
- `lib/availability/service.ts`: el filtro de hora actual (`slot >= currentTime`) desaparece del servicio pero lo aplica `resolveDay` (`lib/availability/resolver.ts` L35, FR-014). Sin regresión observada en las pruebas.
- Ruta admin de creación: ver NB-6.
- Ruta admin de reprogramación: `lib/admin/appointments/service.ts` no está modificado respecto a HEAD (`git diff --stat HEAD` vacío).

## 4. Hallazgos

Cada hallazgo aparece una sola vez.

### NB-1 — `non-blocking` (preexistente, decisión del owner) — doble reserva admin ↔ reprogramación pública

- Archivo: `lib/admin/appointments/service.ts` L359–451 (`rescheduleAdminAppointment`). Solo toma `lockConflictingAppointments` (L398), sin `acquireBookingLocks` ni `FOR SHARE` de reglas. La creación admin sí toma named locks (L201–205).
- Escenario demostrado: una reprogramación admin de una cita de otro teléfono y una reprogramación pública de otro teléfono, ambas a 2030-06-10 10:00 (día sin citas). Experimento `admin-vs-public` (14 lotes × 20 rondas = 280 rondas; 5 lotes con doble reserva): en los 4 lotes con doble reserva que pude inspeccionar (de los 5 observados), ambas respondieron `OK` y quedaron 2 citas PENDING/CONFIRMED a 10:00 del mismo día. Las inspeccionadas ocurrieron en la primera ronda concurrente del lote. Las otras rondas se serializaron (`ERR:SLOT_NOT_AVAILABLE` para el perdedor). Frecuencia baja (≈2 %) pero reproducible.
- Preexistencia: el servicio admin no cambió respecto a HEAD, y la reprogramación pública de HEAD no tomaba named locks (`git show HEAD:lib/my-appointments/service.ts` no contiene `acquireBookingLocks`). 1D no empeora la probabilidad: solo añade serialización al lado público.
- Corrección sugerida: en `rescheduleAdminAppointment`, `acquireBookingLocks` antes del `try` (o dentro, ver NB-3), `FOR SHARE` de reglas y la misma secuencia que `createAdminAppointment`. Requiere tocar una ruta fuera de alcance, así que es decisión del owner: corregir en 1E (que ya reescribe el servicio admin para usar reglas) o antes de D45. Propuesta: aceptar como carry-forward con fecha límite D45, y añadir una prueba admin-vs-pública a 1E.

### NB-2 — `non-blocking` (preexistente, corrección de una palabra recomendada)

- Archivo: `lib/appointments/book-appointment.ts` L435. `return createAppointmentInTransaction(...)` sin `await` dentro de `try` con `finally` que libera los locks (L444–446). Ver (c) arriba.
- Corrección: `return await createAppointmentInTransaction(...)`. El archivo está en el alcance de la ronda y el cambio no altera el comportamiento de éxito.

### NB-3 — `non-blocking` (robustez, preexistente en 3 rutas y nuevo en reprogramación)

- `acquireBookingLocks` está fuera del `try` en `book-appointment.ts` L430 (`bookAppointment`), L477 (`confirmAppointmentWithLock`), `lock-reservation-slot.ts` L111 y `my-appointments/service.ts` L422. Si el segundo `GET_LOCK` falla, el primero queda tomado en la sesión MySQL y el `finally` no se ejecuta. Los named locks son de sesión y no los libera el `ROLLBACK`.
- Hoy no lo reproduje: el timeout de Prisma (5 s) expira antes, cierra la conexión (`Server has closed the connection`) y `IS_USED_LOCK` devuelve `NULL` después del fallo. Si el timeout de Prisma se sube o cambia, el riesgo es real.
- Corrección sugerida: mover `acquireBookingLocks` dentro del `try` en las cuatro rutas. `RELEASE_LOCK` sobre un nombre no tomado por la sesión devuelve 0 sin efectos.

### NB-4 — `non-blocking` (carry-forward, fuera de alcance)

- `app/api/my-appointments/reschedule/route.ts` L22–27: `LOCK_TIMEOUT` no está en la lista de 409. Ver (a) arriba. Corrección cuando se toque la ruta: añadir `LOCK_TIMEOUT` a los 409, como hacen reserva/lock/confirmación.

### NB-5 — `non-blocking` (correcciones al informe del Developer; prueba B1 poco discriminante)

- El informe afirma "5/5 pasa con el fix, 5/5 falla sin él". Mi reproducción: con el mutante (sin `acquireBookingLocks` en `rescheduleMyAppointment`, copia en scratchpad) la prueba del repo pasa 5/5, y el experimento público-vs-público da 0/160 dobles.
- Corrección requerida: retirar la afirmación "falla sin él" del informe del Developer y del STATE, o añadir una prueba que determinísticamente exponga la ausencia del lock (por ejemplo, retener una transacción en un punto intermedio). La aserción unitaria de orden (`tests/lib/my-appointments.service.test.ts` L277–284) sí verifica el orden de llamadas.

### NB-6 — `non-blocking` (transitorio, decisión del owner) — ruta admin de creación cambia de comportamiento

- Causa: `lib/admin/appointments/service.ts` L101 usa `bookingSchema.parse` y L187 `validateBookingRules`, ambos compartidos. Tras quitar la comprobación de día hábil y aceptar cualquier `HH:mm`:
  1. Sábados y domingos pasan la validación, pero la disponibilidad admin sigue usando las horas base legacy (`resolveBaseSlotsByMonthMode`), así que un admin puede crear citas en fines de semana aunque ninguna regla los abra. D46 no se aplica en la ruta admin hasta 1E.
  2. Una hora fuera de la rejilla base (por ejemplo `07:30`) responde `SLOT_NOT_AVAILABLE` (409, `app/api/admin/months/[month]/appointments/route.ts` L22) en vez de `VALIDATION_ERROR` (400).
- Estado: lectura estática, no ejecutado. El Developer no lo listó. Contradice la restricción "no cambiar rutas fuera de alcance".
- Decisión del owner: aceptar como transitorio hasta 1E (los cambios de 1A–1E solo se despliegan en la release combinada, D45), o preservar el comportamiento admin en esta ronda.

### NB-7 — `non-blocking` (carry-forward de Fase 2)

- `components/booking/calendar-modal.tsx` L93 sigue usando `isWeekdayInMexicoCity`: en la UI pública un sábado abierto por regla no se puede seleccionar, aunque la API lo acepta. Archivo fuera de la ronda. Añadir a los carry-forward de Fase 2 junto con `WeeklyOccupancyCard` y `MonthDetailView` (ya listados en STATE).

### NB-8 — `non-blocking` (decisión de redacción, D39)

- `lib/appointments/lock-reservation-slot.ts` L184–190 responde `SLOT_LOCKED` cuando la hora fue quitada de las reglas y además la tiene otro teléfono bloqueada. D39 dice `SLOT_NOT_AVAILABLE` para horario eliminado (aplicado a confirmación). Ambos 409. Decidir si la precedencia es `SLOT_LOCKED` (comportamiento actual) y dejarla escrita en D39 o en `booking-flow`.

### NB-9 — `non-blocking` (corrección al informe: causas de fallo de integración)

- El informe atribuye todos los fallos completos de `book` y `reservation-lock` a `appointment_logs`. Medido:
  - `book-appointment.integration.test.ts`: 9/9 fallan por FK de `appointment_logs` en `beforeEach` (preexistente del helper). Aislados, con `appointment_logs` vacío, los 9 pasan, incluido el caso nuevo "books a day the rules open and rejects a day without offered times (FR-017, D46)".
  - `reservation-lock.integration.test.ts`: 1 pasa; 2 fallan por consulta de igualdad sobre columna `TIME` (líneas 60–65 y 137–145, `expect(...).toHaveLength(1)`), no por FK. Mismo código en HEAD; el propio `reschedule-concurrency.integration.test.ts` L120 documenta ese problema. El caso nuevo "locks only the times that the rules offer (D46, D55)" falla por FK en la ejecución completa y pasa aislado.
  - `afterAll` de ambos archivos también falla por FK (código de salida 1 aunque los casos pasen).
- Corrección requerida al informe: separar FK (helper, ya en STATE) y `TIME` (dos pruebas preexistentes, no mencionadas).

## 5. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx vitest run tests/lib/availability tests/lib/admin tests/lib/db tests/lib/appointments tests/lib/my-appointments.service.test.ts tests/lib/validation` | 37 archivos, 289 pasan, 1 todo, exit 0 |
| `npx tsc --noEmit` | exit 2, 61 errores, todos en `tests/` (13 en `availability/service.test.ts`, 6 en `book-appointment.test.ts`, 5 en `lock-reservation-slot.test.ts`, resto en otros). Ninguno en `lib/`, `app/` o `components/`. No comparé por archivo contra HEAD (el total baja de 62 a 61). |
| `npx eslint` sobre los 14 archivos tocados de 1D | exit 0 |
| Integración `availability-concurrency` (appointments_test) | 4/4 pasan |
| Integración `reschedule-concurrency` (appointments_test) | 1/1 pasa |
| Integración `book-appointment` (archivo completo) | 9/9 fallan (FK preexistente); aislados, 9/9 pasan |
| Integración `reservation-lock` (archivo completo) | 1 pasa, 3 fallan (2 `TIME` preexistentes, 1 FK); caso nuevo aislado pasa |
| Experimento admin-vs-pública (scratch) | 14 lotes × 20 rondas; 5 lotes con doble reserva (NB-1) |
| Experimento pública-vs-pública con fix (scratch) | 8 × 20 = 160 rondas; 0 dobles |
| Mutante sin `acquireBookingLocks` (copia en scratch) | pública-vs-pública 8 × 20 = 160 rondas; 0 dobles. `reschedule-concurrency` con mutante: 5/5 pasa |
| Dos reservas concurrentes de teléfono nuevo (scratch) | 3 × 20 = 60 rondas; 60 OK/OK; un cliente por ronda (NB-2) |
| Retención de `booking:phone` > 5 s (scratch) | Timeout de Prisma (5000 ms) antes de `LOCK_TIMEOUT`; sin lock colgado tras el fallo (NB-3) |

Notas sobre los datos: vacié la tabla `appointment_logs` de `appointments_test` antes de los casos aislados. Los scripts de scratch dejaron filas de prueba (meses 2030-06, clientes 2030 y similares) en `appointments_test`; las suites de integración resetean esas tablas al empezar. No se tocó `appointments` ni `DATABASE_URL_PROD`.

## 6. Correcciones requeridas

Ninguna corrección bloquea el veredicto. Pedidas al Developer o al Orchestrator:

1. NB-2: `return await createAppointmentInTransaction(...)` en `lib/appointments/book-appointment.ts` L435 (una palabra, dentro del alcance).
2. NB-5 y NB-9: corregir el informe `round-04-booking-developer.md` (afirmación 5/5 sin fix; causas de fallo de integración).
3. NB-6: el Developer debe listar el cambio de la ruta admin de creación en el informe.

Para el Orchestrator y el owner (decisiones):

- NB-1: aceptar como carry-forward con fecha límite D45, o exigir corrección ahora. Añadir a STATE.
- NB-6 y NB-8: decidir si el comportamiento transitorio de admin y la precedencia `SLOT_LOCKED` se aceptan.
- NB-3, NB-4, NB-7: carry-forward (robustez y ruta fuera de alcance; UI de Fase 2).

## 7. Riesgos residuales

- Los locks con nombre se liberan dentro de la transacción, antes del `COMMIT`. Se apoya en que los `FOR UPDATE`/gap locks siguen tomados hasta el commit. No observé fallos, pero es una dependencia implícita.
- `findRescheduleRulesForShare` (`lib/my-appointments/service.ts` L333–339) traga cualquier error de `FOR SHARE` y lo convierte en `SLOT_NOT_AVAILABLE` (409). Un error de infraestructura se reporta como horario no disponible. Mismo patrón catch-all que HEAD.
- Un deadlock entre dos reprogramaciones que intercambian días (cada una tiene su cita en el día destino de la otra) lo resolvería InnoDB con rollback de una, sin reintento. Riesgo teórico no probado.
- El `lock-order` unitario verifica el orden de llamadas, no que la liberación ocurra después del `UPDATE`.

## 8. No ejecutado / no verificado

- Baseline de integración en HEAD (no ejecuté el archivo completo en HEAD; la preexistencia de las pruebas `TIME` y del FK se sostiene por código y por STATE).
- `tsc` por archivo contra HEAD.
- `next build` y `lint:admin-i18n` (fuera de alcance de esta re-revisión).
- Suite completa (la ronda no es de cierre de fase).
- La ruta admin de creación (NB-6) se valoró por lectura estática; no la ejecuté.
- Prueba determinística de la carrera admin↔pública (solo estadística, 5 lotes).
