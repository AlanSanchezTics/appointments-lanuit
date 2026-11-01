# Ronda 06-B (T075-B): informe del Developer (parcial, handoff)

**Alcance**: segunda mitad del cierre documental de la Fase 1 (T075). Solo `docs/` y este informe. Sin código, sin pruebas, sin commit, sin cambio de rama.

**Estado**: PARCIAL. Completadas: `docs/architecture/api.md` (PHONE_INVALID) y casi toda `docs/specification.md`. **Pendiente: `docs/architecture/business-rules.md` (completo)**, el barrido final de términos y la marca de T075 en `tasks.md`. **T075 NO se marca `[X]`**: su alcance incluye `business-rules.md` y no está cubierto.

Turnos: aproximadamente 70 llamadas de herramienta (no son turnos oficiales). Se detuvo por presupuesto (~65). No se usó compactación.

## Archivos modificados en esta ronda

- `docs/architecture/api.md`: solo la línea de `PHONE_INVALID` en "Public My Appointments" (ahora `VALIDATION_ERROR`, D84). Nada más.
- `docs/specification.md`: secciones listadas abajo.
- `specs/003-flexible-month-availability/agent-reports/round-06-docs-b-developer.md`: este informe.

No tocados: `docs/architecture/business-rules.md` (pendiente), `docs/features/*`, `docs/ui/**`, `tasks.md`, código y pruebas.

## Secciones modificadas en `docs/specification.md`

- **4.1 Días válidos**: fin de "solo lunes a viernes"; días válidos por reglas y excepciones (FR-017, D46); mes sin reglas D6/D28; día cerrado D23; mismo día con `>=` (D50); pintado gris D34.
- **4.2 Horarios base**: sin lista fija; `HH:mm` (FR-006); `07:30` y `14:30` válidos; 24 horas máximo (D21); normalización (D37); `00:00` = marcador de día completo (D55); listas antiguas solo como presets (D4, D16).
- **4.3 Reglas de disponibilidad, separación y capacidad** (reemplaza "Reglas por Modalidad + Máximo Diario"): reglas y excepciones (FR-001 a FR-005, D10, D20, D38); traslape por fechas (FR-003); motor en 5 pasos (FR-009 a FR-014, FR-016); `availableSpaces` (FR-026, D12); equivalencia legada y 48 de 432 (D43, ADR 0002); cambios de reglas, versión y `expectedVersion` (FR-021 a FR-024, FR-035, FR-041, D5, D24, D36).
- **7 Flujo de reserva**: paso 4 (validación de fecha → `VALIDATION_ERROR`; `SLOT_NOT_AVAILABLE` D46; `SLOT_LOCKED`); paso 6 (códigos); paso 8 (orden de locks, FOR SHARE, D39: confirmación valida reglas vigentes); criterio de `Por horario` (sin "pares").
- **8.2 Rama de modificación**: paso 4 reescrito para el resolvedor; sin 15 días ni `isLoyal`; `SLOT_NOT_AVAILABLE` (D46).
- **9 Control de concurrencia**: orden de locks (ADR 0006); orden de confirmación real (sustituye el orden antiguo); limitaciones F1, F2, F3 y F4 (F4 no estaba en la lista del brief, la incluí por ser un comportamiento visible); sin `UNIQUE(date, time_slot)` en `appointments`.
- **10 Modelo de datos**: `slot_mode` default `BLOCK_MODE` (0022), `availability_version`; nueva subsección **10.1** con las 5 tablas nuevas (enlace a `data-model.md`, sin copiar columnas), cascada, `blocked_slots` `00:00`, migración sin tocar citas (FR-032).
- **11 Casos edge**: edge 4 (D50), edge 6 (maxPerDay / separación), nuevos edges 19 a 27 (mes sin reglas, primera regla, día sin horarios, fecha inválida, lock tras eliminar horario, citas fuera de la rejilla, reprogramación admin de PENDING, bloqueo sobre PENDING, mes pasado).
- **12 Invariantes**: 4 (reformulada) y 6 (reformulada); nuevas 16 (D5) y 17 (PENDING, D66/D68).
- **15.1.4 Dashboard**: capacidad = suma de `maxPerDay` de días abiertos (D44, D53, D57); día cerrado o con bloqueo total = 0; semana lunes a domingo (D57) con nota de que la UI sigue en 5 columnas hasta la Fase 2; hoy en fin de semana usa el lunes siguiente (D58); semana sin tope (aceptado); barra diaria con tope visual 100 %; contadores sin PENDING (D66).
- **15.7 Catálogo de meses**: nota de estado de implementación (Fase 1 motor/API; Fase 2 UI); fórmula de `Disponibles` (D12, D56, D66); `espacios bloqueados` (D14, D41); semáforo (D13, D34); editor de reglas en lugar de `Modalidad` (D4, D16, D32, D33, D36, D69); efecto de bloqueo sin propagación (D2, D43); evento espejo 1 h y día completo `06:00-23:00` (D15, D29, D30); `DATE_NOT_OPERATIONAL` (D76); bloqueo sobre PENDING (D71); POST meses sin reglas y `BLOCK_MODE` (D17, D31); agendado y reprogramación admin (D63, D68, D72, D73, D78); contrato: campos aditivos de `GET`, validación de agendado (no requiere ACTIVE), reprogramación admin (409, solo CONFIRMED/SYNC_FAILED), lista de rutas de disponibilidad enlazada a `api.md`, reemplazo de presets en `PATCH slot-mode`.

Mantenido a propósito en 15.7: `PATCH slot-mode` con cuerpo `{ slotMode }` (RQ-1, D49, fase 4). Mantenidas las frases de dashboard "lunes-viernes" que describen títulos de la tarjeta según el día (no la capacidad).

## Afirmaciones verificadas en código (lectura y grep; sin ejecutar pruebas)

- Motor: `lib/availability/{day-rule,capacity-engine,resolver,rules-validation,affected-appointments,slot-mode-derivation,defaults}.ts`. Orden de la rejilla, `best`, `preserveCapacity`, `>=` en hora actual, `DEFAULT_DAY_RULE` (D6), `FULL_DAY_BLOCK_SENTINEL_TIME = "00:00"`, límites D20/D21, normalización D37/D38, traslape por fechas, `AVAILABILITY_*`.
- Resolvedor: `resolveDay`/`resolveMonthDays` usados por `lib/availability/service.ts`, `lib/appointments/{book-appointment,lock-reservation-slot}.ts`, `lib/my-appointments/service.ts`, `lib/admin/{appointments,blocked-spaces,months/detail-service,dashboard}`. Los servidores ya no usan `isWeekdayBookingDate` ni `resolveBaseSlotsByMonthMode` (grep sin usos fuera de definiciones).
- Locks: `GET_LOCK` con espera de 5 s (`lib/db/appointments.ts`); nombres `booking:date:` y `booking:phone:` ordenados; `RELEASE_LOCK` en `finally` dentro de la transacción, antes del COMMIT (F3); `FOR SHARE` y `FOR UPDATE` sobre la fila de `active_months` (`lib/db/availability-rules.ts`); `lockConflictingAppointments` en creación y reprogramación; sin `timeout:` en `$transaction` (F1).
- Lock público: TTL 10 min (`RESERVATION_LOCK_WINDOW_MINUTES = 10`); `SLOT_LOCKED` si la hora no se ofrece y tiene lock; `LOCK_EXPIRED_OR_INVALID` en confirmación.
- Reprogramación pública: candidatos `PENDING`/`CONFIRMED`/`SYNC_FAILED`; 3 horas (`APPOINTMENT_NOT_MODIFIABLE`); sin 15 días; `validateRescheduleDestination` con `catch` amplio (F4).
- 15 días: solo en la sugerencia de reserva (`hasInsufficientDayGap`, `MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS = 15`), no en reprogramación pública.
- Admin: ocupación de escritura con `SLOT_BLOCKING_APPOINTMENT_STATUSES` (incluye PENDING, D68, D71); reprogramación admin con `CONFIRMED`/`SYNC_FAILED` (D72); `SLOT_NOT_AVAILABLE` y `LOCK_TIMEOUT` → 409; `APPOINTMENT_NOT_FOUND` → 404 en reprogramación admin; alta admin de citas responde 201; `POST /api/admin/months` responde 200.
- Contadores: `COUNTED_APPOINTMENT_STATUSES` = CONFIRMED, SYNC_FAILED, CANCELLED (`lib/db/admin-months.ts:292`, D66); dashboard `ACTIVE_APPOINTMENT_STATUSES` = CONFIRMED, SYNC_FAILED; `dayRule.maxPerDay` si abierto y 0 si no (`resolveDayCapacities`, D44/D57); `percent()` devuelve 0 con total 0; porcentaje diario con `Math.min(100, ...)`; semana sin tope; `getWeekDays` devuelve 7 días (D57); `agendaTargetDateKey` (D58).
- Detalle del mes: `GET` añade `rules`, `exceptions`, `availabilityVersion`, `usesDefaultRule` (`lib/admin/months/detail-service.ts:224-227`); `tone` gris si `closed` (día anterior a hoy o sin horarios); umbrales 0/1/≥2.
- Alta de meses: `createInactiveMonths` usa `DEFAULT_MONTH_SLOT_MODE = BLOCK_MODE` y no crea reglas (D17, D31).
- `slot_mode`: `@default(BLOCK_MODE)` en `prisma/schema.prisma`; derivación en `deriveSlotMode` (sin reglas → BLOCK_MODE).
- Duración del evento de cita: `GOOGLE_EVENT_DURATION_HOURS = 3` (`lib/constants/slots.ts`).
- Tablas nuevas y cascada: `onDelete: Cascade` desde `ActiveMonth` y desde las tablas hijas (`prisma/schema.prisma`).
- Lectura pública de bloqueos: `listBlockedSlotsByDateForUpdate` usado en reserva, confirmación y reprogramación pública (F2).
- Fecha inválida: `isValidIsoDate` en `lib/validation/appointment.ts` y `lib/validation/my-appointments.ts` (`VALIDATION_ERROR` en reprogramación pública; ZodError → `VALIDATION_ERROR` en `lib/api/error-response.ts`).

## Afirmaciones tomadas de STATE o de informes previos (no re-verificadas aquí)

- Equivalencia legada: 0 diferencias sin bloqueos; 48 de 432 con bloqueos (prueba de 1B).
- F1: lock retenido en 7 de 10 expiraciones; F2: 17/40 y 10/40 dobles; F3: sin doble atribuible tras B-1.
- Conteos de pruebas y suites de 1C a 1E (STATE, History).
- Versión por defecto de `availability_version` en meses backfilleados (1A).
- Versión de MySQL para CHECK (Q-T2): no verificada.

## Discrepancias plan o contrato frente a código (gana el código; documentado así donde aplica)

1. **Componente admin todavía usa funciones legadas** (Fase 2, pero bloqueante para la release combinada D45): `components/admin/months/MonthDetailView.tsx` importa `resolveBaseSlotsByMonthMode` (línea 38) y `getAvailableStartSlotsWithManualBlocks` (línea 45), que se usan en líneas 305 y 521. La rejilla que ve el admin puede diferir de la del servidor. FR-016 pide reemplazarlas. No documentado como comportamiento; es deuda de Fase 2.
2. **`lib/availability/rules.ts` y `lib/availability/month-slot-mode.ts` conservan funciones legadas** (`isWeekdayBookingDate`, `getAvailableStartSlots*`, `resolveBaseSlotsByMonthMode`). Sin usos en servidor; se retiran en la limpieza (SC-006, fase 4). El plan no lo asigna con claridad a T073.
3. **Derivación de `slot_mode`**: FR-033 dice "las reglas coinciden con un preset". El código exige **una sola regla que cubra todo el mes** igual al preset (`lib/availability/slot-mode-derivation.ts`). Documentado como código en `data-model.md` (ronda A) y citado en la spec por referencia. Ambigüedad menor para el Orchestrator.
4. **Consecuencia de D66 en el detalle del mes**: `listAppointmentsByMonth` excluye PENDING, así que `availableSpaces` y el semáforo del detalle tratan una PENDING como libre. Es la consecuencia aceptada de D66 ("Disponibles puede mostrar más espacios"). Documentado en 15.7. Comentarios D59 de `detail-service.ts` (línea ~189) y D61 de `dashboard/service.ts` (línea ~473) quedan obsoletos (fuera de alcance).
5. **Dashboard**: el backend devuelve 7 días (D57) y la UI muestra 5 columnas (`WeeklyOccupancyCard.tsx`, Fase 2). Documentado con nota.
6. **15 días en la sugerencia de reserva**: `listActiveFutureAppointmentsInMonth` solo considera `CONFIRMED` y `SYNC_FAILED`, no `PENDING`. La spec (7, paso 5) dice "citas activas futuras". Comportamiento preexistente; no documentado como cambio. Revisar.
7. **`PHONE_INVALID`** (A2/D84): corregido en `api.md` línea 243. **La línea 489 de `api.md` (sección nueva de ronda A) sigue diciendo "pendiente de decisión"**, ya decidido. Fuera del alcance autorizado (solo la línea de PHONE_INVALID); pido al Orchestrator autorizar eliminar esa frase.
8. **F4**: `validateRescheduleDestination` convierte cualquier error en `SLOT_NOT_AVAILABLE` (`lib/my-appointments/service.ts`, catch amplio). Documentado como limitación en la sección 9.
9. **Reprogramación admin de PENDING**: 404 `APPOINTMENT_NOT_FOUND` (verificado por lectura, sin prueba). Documentado.
10. **`POST /api/admin/months` responde 200** (la convención de `api.md` dice 201). Ya reportado en ronda A; la spec no fija el código.

## Ambigüedades para el Orchestrator

- **Editor y UI en 15.7**: la sección describe el comportamiento objetivo y avisa de que la UI llega en Fase 2. Confirmar si se prefiere una redacción distinta.
- **D66 en `Disponibles`**: documentado como consecuencia aceptada. Confirmar redacción.
- **F4** incluido en la sección 9 aunque el brief no lo listaba. Confirmar.
- **Línea 489 de `api.md`**: ver discrepancia 7.
- **FR-033**: ver discrepancia 3.
- **"Sin bloqueos, el motor reproduce el legado"** (sección 4.3): tomado de la evidencia de 1B, no re-ejecutado en esta ronda.

## Pendiente (para cerrar T075-B)

1. **`docs/architecture/business-rules.md`** (no iniciado). Lista de cambios necesarios, verificada con el barrido de abajo:
   - *Domain Overview* línea 18: "fixed weekday/time-slot model".
   - *Operating calendar* y *Slot pair model* (líneas ~61-75): reemplazar por reglas y `minGapMinutes`; nota histórica mínima opcional.
   - *Daily capacity model*: `maxPerDay` por regla, `preserveCapacity`, bloqueos fuera de la rejilla (ADR 0002).
   - *Active appointment definition*: contadores admin sin PENDING (D66); escrituras y bloqueos con PENDING (D68, D71).
   - Nueva entrada de concurrencia (orden de locks, F1 como limitación conocida, enlace a ADR 0006).
   - *Booking Rules* (líneas ~99-110): día "weekday" → día con horarios ofrecidos; "official base slots" → resolvedor; "pair-direction" → separación y capacidad.
   - *Booking confirmation rules*: D39 (validación contra reglas vigentes).
   - *Public Reschedule Rules* (líneas ~243-247): redacción hacia el resolvedor y "slot-mode rules".
   - *Admin Dashboard Rules* (líneas ~294-330): `/3`, `/15`, lunes-viernes, 5 bars → capacidad por `maxPerDay`, L-D (D57), D58.
   - *Admin Month Detail Rules* (líneas ~516-600): `availableSpaces` (D12, D56, D66), `blockedSpaces` (D14, D41), calendario (D13, D34), admin booking (weekday, pares, `ACTIVE`, D17/D68), reprogramación admin (D72), bloqueos (líneas ~593-648: sin propagación, eventos de 1 h, `DATE_NOT_OPERATIONAL`, sin "Por bloque", bloqueo sobre PENDING).
   - *Availability Rules* (líneas ~650-680): reescritura completa (reglas, excepciones, D6/D17/D23/D28, resolvedor, separación, capacidad, bloqueos, `slot_mode` derivado).
   - *Validation Rules* (líneas ~697-717): día no fijo; validación de fecha; reglas de rango (D20, D21, D37, D38).
   - *Invariants* (líneas ~725-737): invariante de pares y de lunes-viernes; añadir D5 y PENDING.
   - *Edge Cases* (líneas ~739-752): capacidad/separación; lock tras eliminar horario (D39).
   - *Admin Months Catalog Rules* (línea ~435): `slot_mode = SECOND_ONLY_MODE` → BLOCK_MODE sin reglas (D17, D31).
2. **Barrido final de términos obsoletos** en `business-rules.md`. Conteo actual: `pair` 18, `directional` 10, `BLOCK_MODE` 9, `SECOND_ONLY` 8, `weekday` 14, `Por bloque` 1, `/ 3` 2, `three` 1, `official base` 2, `Monday to Friday` 1, `slot-mode rules` 1. `WEEKDAY_ONLY`: 0. En `specification.md`, las menciones que quedan son intencionales (texto que dice que el término ya no existe, o describe `PATCH slot-mode` con su cuerpo `slotMode` legado, o títulos de la tarjeta por día de la semana).
3. **Marca de T075** en `tasks.md` (línea 186): **no marcar** hasta completar el punto 1.
4. Actualizar `docs/architecture/api.md` línea 489 (si el Orchestrator lo autoriza).

## Trazabilidad (AGENTS.md)

Documentation Impact:
- Impacto en flujo: Sí.
- `docs/specification.md`: actualizado (secciones de arriba). Quedan pendientes solo las menciones de la sección 15.7 y 15.1.4 que dependen de Fase 2 (indicadas en el texto).
- `docs/architecture/business-rules.md`: NO actualizado (pendiente, ver arriba).
- `docs/architecture/api.md`: línea de PHONE_INVALID corregida; línea 489 pendiente de autorización.
- Ambigüedades: ver sección correspondiente.

Flow Contract Check:
- UI steps updated: No (Fase 2; 15.7 describe el objetivo y avisa).
- API contract updated: Yes (15.7 contrato y `api.md` PHONE_INVALID).
- Validation rules updated: Yes en `specification.md`; No en `business-rules.md` (pendiente).
- Acceptance criteria updated: No (no tocadas).
- docs/specification.md aligned: Yes en las secciones tratadas; No para el conjunto (pendiente de business-rules y de la reconciliación final de Fase 2 en 15.7 y 15.1.4).

Migration Compatibility Check:
- Schema changes required: No en esta ronda (la migración 0022 ya existe desde 1A).
- Data backfill required: No en esta ronda (documentado en ronda A y en spec 10.1).
- Legacy compatibility required: Yes (`slot_mode` legado hasta fase 4; `PATCH slot-mode` con `slotMode`).
- Rollback strategy defined: Yes en `data-model.md` (ronda A); referenciado en spec 10.1.
- Cleanup phase defined: Yes (fase 4; funciones legadas de la discrepancia 2).
- Integrity protections defined: Yes en spec 9 y 10.1 (sin UNIQUE en `appointments`; protección de aplicación).

Admin UI Check: no aplica (sin cambios de UI).
Notification Contract Check: no aplica.

## Verificación

- `python3 scripts/check-workflow-profile.py`: exit 0. Salida: `OK: 9 keys, all defined, used, and resolvable`. Aviso no bloqueante: Spec Kit instalado 0.11.9, probado 1.0.5.
- Verificación documental: estática, por lectura y grep del código citado arriba. No se ejecutaron pruebas, build, lint, migraciones ni consultas a la BD.
- Ninguna afirmación de "verificado" se apoya en ejecución de esta ronda.

## Handoff (para el siguiente Developer o el Orchestrator)

- Hecho: `api.md` (PHONE_INVALID); `specification.md` (4.1, 4.2, 4.3, 7, 8.2, 9, 10 y 10.1, 11, 12, 15.1.4, 15.7).
- Pendiente: `business-rules.md` completo (lista del punto 1); barrido final; marca de T075 (solo después); autorización para `api.md` línea 489.
- Archivos tocados: `docs/specification.md`, `docs/architecture/api.md`, este informe.
- Siguiente paso: nueva ronda 06-C (o continuación) limitada a `docs/architecture/business-rules.md`, con este informe y `STATE.md` como contexto. Después, el Orchestrator marca T075 si el owner lo confirma.
