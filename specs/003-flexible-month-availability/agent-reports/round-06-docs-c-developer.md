# Ronda 06-C (T075-C): informe del Developer

**Alcance**: segunda parte del cierre documental de la Fase 1 (T075-C). Solo documentación: `docs/architecture/business-rules.md`, una frase de `docs/architecture/api.md`, barrido de términos obsoletos y marca de T075 en `tasks.md`. Sin código, sin pruebas, sin commit, sin cambio de rama. `docs/specification.md` no se modificó (ver contradicciones C1 a C4).

**Estado**: completada. T075 queda `[X]` porque su alcance (A + B + C) está cubierto. Pendiente de decisión del Orchestrator: contradicciones C1 a C4 (sección "Contradicciones"). Ninguna afirmación de esta ronda se apoya en ejecución de pruebas.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `docs/architecture/business-rules.md` | Reescritura de las secciones de dominio afectadas (lista abajo). Resto sin cambios. |
| `docs/architecture/api.md` | Solo la frase final de la línea 489 (`VALIDATION_ERROR` para teléfono inválido, D84). La frase "discrepancia pendiente" se eliminó. Nada más. |
| `specs/003-flexible-month-availability/tasks.md` | Solo T075: `[ ]` → `[X]` (línea 186). |
| `specs/003-flexible-month-availability/agent-reports/round-06-docs-c-developer.md` | Este informe. |

No tocados: `docs/specification.md`, `docs/architecture/data-model.md`, `docs/decisions/*`, `docs/features/*`, `docs/ui/**`, código, pruebas, perfil.

## Secciones modificadas en `business-rules.md`

- **Domain Overview**: "fixed weekday/time-slot model" → modelo por reglas (días, horas, separación mínima y capacidad).
- **Core Entities**: Reservation Lock (TTL 10 min); nueva entidad *Availability Rule and Availability Exception*.
- **Core Concepts**:
  - *Operating calendar* (sustituye "lunes a viernes"): día ofrecible solo por reglas o excepciones; default L-V 09/10/13/14/17/18, 240/true/3 (D6); sábado y domingo cerrados (D28); regla de mes cierra lo no cubierto (D23); mismo día `>=` (D50).
  - *Minimum gap model* (sustituye *Slot pair model*, ADR 0001): `minGapMinutes` medido entre horas de inicio; locks cuentan como ocupados en público. Nota histórica mínima de los pares.
  - *Daily capacity model*: `maxPerDay` 1-6, `preserveCapacity`, `availableSpaces`; día sin horarios no disponible (FR-015, D46); 48 de 432 (D43, D54, ADR 0002).
  - *Active appointment definition*: ocupación pública y escrituras admin con `PENDING`, `CONFIRMED`, `SYNC_FAILED` (D68, D71); contadores admin sin `PENDING` (D66) con la consecuencia aceptada.
- **Booking Rules**: "día laborable" y "slot base oficial" sustituidos por día con horarios ofrecibles y resolvedor; mínimo de separación y capacidad; confirmación revalida reglas vigentes (D39).
- **Concurrency Rules** (nueva sección): alcance, first commit wins, orden de locks (D63, D77), editor con `FOR UPDATE`, orden de confirmación, limitaciones F1 (D82), F2 (D83), F3, F4; sin restricción de BD (enlace a `data-model.md`; ADR 0006).
- **Public Reschedule Rules**: destino por el mismo resolvedor; `SLOT_NOT_AVAILABLE`; sin `isLoyal` ni regla de 15 días. Estados, 3 horas y sincronización sin cambio.
- **Admin Dashboard Rules**: semana lunes-domingo (D57); capacidad = suma de `maxPerDay` de días abiertos, 0 si cerrado o con bloqueo de día completo (D44, D53); porcentaje diario con capacidad 0 = 0; semanal sin tope; contadores sin `PENDING` (D66); nota de Fase 2 (5 columnas en UI). Widgets de agenda, recordatorios, tips y retoque sin cambio.
- **Admin Months Catalog Rules**: alta de meses con `slot_mode = BLOCK_MODE` y sin reglas (D17, D31) en lugar de `SECOND_ONLY_MODE`.
- **Admin Month Detail Rules**:
  - *Metrics*: `occupiedSpaces` y `confirmedAppointments` sin `PENDING` (D66); `availableSpaces` por resolvedor, días pasados 0 (D12, D56); `blockedSpaces` por horas de la rejilla, día completo cuenta por hora, días pasados incluidos (D14, D41, D62); saturación con días pasados (D60).
  - *Calendar*: tonos `closed` (gris: día pasado o sin horarios ofrecibles tras bloqueos y horas pasadas, sin contar ocupación), `available >= 2`, `low = 1`, `full = 0`; sin tono de fin de semana.
  - *Availability rules policy* (nueva): versión, `expectedVersion`, citas afectadas con confirmación, `MONTH_IN_PAST` (D36).
  - *Admin edit policy*: reprogramación admin solo `CONFIRMED`/`SYNC_FAILED`, `PENDING` → `APPOINTMENT_NOT_FOUND` (D72); destino por resolvedor (D63, D68). Creación admin en cualquier mes registrado (corrige la contradicción interna con "ACTIVE" que tenía la versión anterior).
  - *Admin booking policy*: sin "día laborable", "pares" ni "ACTIVE"; ocupación con `PENDING` (D68).
  - *Admin blocked-slots policy*: `DATE_NOT_OPERATIONAL` (D76); elegibilidad de horario por resolvedor (ver C2); sin propagación direccional; sin vista "Por bloque" (D14); bloqueo de día completo como marcador `00:00` (D41, D55) con `SLOT_LOCKED`, `DAY_ALREADY_BLOCKED`, `SLOT_NOT_AVAILABLE` (ver C1); eventos espejo de 1 h (D15, D29, D30; solo bloqueos nuevos) y día completo `06:00-23:00`.
- **Availability Rules** (reescrita): reglas y excepciones (FR-001 a FR-005, D10, D20); mes sin reglas = default (D6, D17, D28, D42); resolución en 6 pasos (FR-009 a FR-015, FR-016, FR-026, D12, D25, D46, D50); límites y validación (FR-025, D21, D37, D38, D55); cambios, versión y citas afectadas (FR-021 a FR-024, FR-035, FR-041, D5, D18, D24, D35, D36, D39, D40); `slot_mode` legado y derivado con presets (FR-033, FR-034, D4, D16, D19, D31, D33; ADR 0004); migración (FR-030 a FR-032).
- **State Transitions**: "New booking creates CONFIRMED" corregido: CONFIRMED para clientas leales y PENDING para no leales (contradicción interna con *Booking confirmation rules*, que ya era la regla de la spec 7).
- **Validation Rules**: mes activo solo en público; fecha de calendario real (`VALIDATION_ERROR`); día sin horarios (`SLOT_NOT_AVAILABLE`, `DATE_NOT_OPERATIONAL`); hora `HH:mm`; `00:00` inválido en reglas (D55).
- **Invariants**: mínimo de separación, `maxPerDay` y `preserveCapacity` aplicados por el resolvedor; reglas no cambian citas (D5); `PENDING` ocupa pero no cuenta (D66, D68); admin puede agendar en cualquier mes registrado.
- **Edge Cases**: "Mismo día" (D50); capacidad y separación; lock tras eliminar horario (D39); citas fuera de la rejilla (D5, D18, D40); reprogramación admin de `PENDING` (D72); bloqueo sobre `PENDING` (D68, D71); mes pasado (D36).

## Afirmaciones verificadas en código (lectura y grep; sin ejecutar pruebas)

- `lib/availability/defaults.ts`: presets (BLOCK_MODE 6 horas 240/true/3; SECOND_ONLY 10/14/18 0/false/3), `DEFAULT_DAY_RULE` (D6), `FULL_DAY_BLOCK_SENTINEL_TIME = "00:00"`, límites `minGap` 0-1440, `maxPerDay` 1-6, 24 horas.
- `lib/availability/capacity-engine.ts`: día cerrado o con bloqueo total → 0; `occupied >= maxPerDay` → 0; horas `>= currentTime` (D50); separación entre horas de inicio; `preserveCapacity` con `best(...) >= base`; `availableSpaces = base - occupied`.
- `lib/availability/day-rule.ts`: excepción tiene prioridad y lista vacía cierra; regla con días ISO; sin cobertura y con reglas → cerrado (D23); default solo si el mes no tiene reglas (D6); traslape → `AVAILABILITY_RULE_OVERLAP`; fecha fuera del mes → `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH`.
- `lib/availability/resolver.ts`: punto único; hora actual solo si la fecha es hoy en `America/Mexico_City`. Consumidores verificados con grep: `lib/availability/service.ts`, `lib/appointments/{book-appointment,lock-reservation-slot}.ts`, `lib/my-appointments/service.ts`, `lib/admin/{appointments/service,blocked-spaces/service,dashboard/service,months/detail-service}.ts`.
- `lib/availability/rules-validation.ts`: `00:00` rechazado en horas (línea 22); límites.
- `lib/availability/slot-mode-derivation.ts`: sin reglas → `BLOCK_MODE`; una regla de mes completo igual a un preset → ese preset; si no, conserva el valor.
- `lib/availability/affected-appointments.ts`: estados `PENDING`, `CONFIRMED`, `SYNC_FAILED`; solo futuras (D50 en la hora actual); dentro de la rejilla actual y fuera de la propuesta; no incluye bloqueos.
- `lib/admin/months/validation.ts`: `expectedVersion` obligatorio en PUT (línea 225), opcional en PATCH slot-mode (línea 177). Incremento de versión en el guardado (`lib/admin/months/service.ts` ~279 y `lib/db/availability-rules.ts`).
- `lib/db/appointments.ts`: `GET_LOCK(name, 5)`; nombres `booking:date:` y `booking:phone:` ordenados alfabéticamente; `LOCK_TIMEOUT`.
- `lib/db/availability-rules.ts`: lectura `FOR SHARE` para escrituras de reserva y `FOR UPDATE` para el editor.
- `lib/appointments/lock-reservation-slot.ts`: TTL de lock 10 min (línea 24); el lock cuenta como ocupado (línea 179); sugerencia de 15 días solo aquí (`hasInsufficientDayGap`, línea 78 consulta `CONFIRMED` y `SYNC_FAILED`).
- `lib/constants/appointment-statuses.ts`: `SLOT_BLOCKING_APPOINTMENT_STATUSES` = PENDING, CONFIRMED, SYNC_FAILED (usado en reserva, confirmación, reprogramación pública, admin y bloqueos).
- `lib/my-appointments/service.ts`: `APPOINTMENT_NOT_MODIFIABLE` (3 h); no aparece la regla de 15 días. `SLOT_NOT_AVAILABLE` en el destino.
- `lib/admin/appointments/service.ts` y `lib/db/admin-appointments.ts`: reprogramación admin solo `CONFIRMED`/`SYNC_FAILED`; `APPOINTMENT_NOT_FOUND` para `PENDING` (líneas 455, 482, 563). Sin comprobación de `ACTIVE` en la creación admin; el comentario de HEAD (`git show HEAD:lib/admin/appointments/service.ts`, línea 186) dice "Admins may book in INACTIVE months". `MONTH_NOT_ACTIVE` solo aparece en un mapeo de la ruta (`app/api/admin/months/[month]/appointments/route.ts:27`) y ninguna librería lo lanza (código muerto, no documentado).
- `lib/admin/blocked-spaces/service.ts`: `DATE_NOT_OPERATIONAL` (línea 211); `DATE_IN_PAST`; `SLOT_NOT_AVAILABLE` si la hora no está en `resolveDay` (líneas 300-318); bloqueo de día completo: `SLOT_LOCKED`, `DAY_ALREADY_BLOCKED`, `SLOT_NOT_AVAILABLE` cuando no quedan horas, y `deleteBlockedSlotsByDate` (líneas 255-290); evento de 1 h para bloqueos puntuales (líneas 346-352).
- `lib/calendar/google.ts` (líneas 215-232): bloqueo `00:00` → `Día libre - [motivo]`, evento `06:00-23:00` de la misma fecha. `lib/calendar/sync-blocked-slot.ts` (líneas 80-96): en actualización solo cambia el resumen; en creación, `durationHours: 1`.
- `lib/admin/blocked-spaces/day-block.ts`: `countBlockedSpaces` cuenta cada hora de la rejilla con bloqueo; un día completo cuenta `grid.size`; sin regla, 0.
- `lib/admin/months/detail-service.ts`: `resolveTone` (0 full, 1 low, resto available); `closed` si día pasado o `hasNoResolvedTimes` (usa solo bloqueos y `fullDayBlocked`, no ocupación; ver C3); `availableSpaces = 0` en días pasados (D56); `projectedSaturation` usa `resolvedDays` (D60); `occupiedSpaces` sobre citas no `PENDING` (`lib/db/admin-months.ts:292-298`); `usesDefaultRule` (línea 227).
- `lib/db/admin-months.ts`: `createInactiveMonths` con `DEFAULT_MONTH_SLOT_MODE = BLOCK_MODE` (líneas 229-238) y sin reglas; `lib/availability/month-slot-mode.ts:8`.
- `lib/admin/dashboard/service.ts`: `getWeekDays` devuelve 7 días (línea ~389); `resolveDayCapacities` (línea 349-386): `maxPerDay` si abierto, 0 si cerrado o con bloqueo de día completo; `percent()` devuelve 0 con total 0 (línea 62); tope 100 solo en el porcentaje diario (línea 486); estados de ocupación `CONFIRMED`, `SYNC_FAILED` (línea 22 y 110-111); `getAgendaTargetDateKey` con sábado +2 y domingo +1 (D58).
- `lib/constants/slots.ts:8`: `GOOGLE_EVENT_DURATION_HOURS = 3` (duración de la cita, distinta de la de bloqueo).

## Afirmaciones tomadas de STATE o de informes previos (no re-verificadas aquí)

- Equivalencia legada: 0 diferencias sin bloqueos; 48 de 432 con bloqueos (1B, D43, D54).
- F1: lock retenido en 7 de 10 expiraciones; F2: 17/40 y 10/40 dobles; F3: sin doble atribuible tras B-1; regresión B-1 y carrera 0/120 (1E).
- F4: `catch` amplio en `validateRescheduleDestination` (`lib/my-appointments/service.ts` ~394-398), tomado del informe B; no releí ese bloque en esta ronda.
- Aplicación de `PENDING` a la reprogramación admin: 404 `APPOINTMENT_NOT_FOUND`, verificado por lectura (sin prueba), A y B.
- Versión MySQL para `CHECK` (Q-T2): no verificada.
- `POST /api/admin/months` responde 200 (no 201): tomado de A; no releído aquí.
- Conteos de pruebas y suites de 1C a 1E (STATE, History).

## Contradicciones y discrepancias (spec, business-rules, código)

Ningún cambio se hizo en `docs/specification.md`. Lo que sigue queda para decisión del Orchestrator/owner.

- **C1 (código no documentado en la spec).** Bloqueo de día completo (`lib/admin/blocked-spaces/service.ts`, líneas 255-290): además de lo que dice la spec 15.7, el código (a) borra los bloqueos puntuales que el día ya tenía (`deleteBlockedSlotsByDate`) y (b) exige que ningún lock activo caiga en la rejilla del día (`SLOT_LOCKED`) y que quede al menos una hora ofrecible (`SLOT_NOT_AVAILABLE`). `business-rules.md` recoge el comportamiento del código. Propuesta: añadirlo a la spec 15.7 o cambiar el código (decisión del owner).
- **C2 (spec 15.7 línea 1171 vs código).** La spec lista como bloqueable: no pasado, no ocupado (incluido `PENDING`), sin lock y no bloqueado. El código además exige que la hora esté en `resolveDay`, es decir, que la separación mínima y la capacidad tampoco la excluyan (`lib/admin/blocked-spaces/service.ts` 300-318). Efecto: con el día lleno o con una hora excluida por separación, no se puede bloquear esa hora (`SLOT_NOT_AVAILABLE`). `business-rules.md` sigue el código. Decidir cuál es el comportamiento deseado.
- **C3 (spec 4.1 línea 78 vs spec 15.7 línea 1114).** La spec 4.1 dice que un día con todos sus horarios ocupados, bloqueados o transcurridos "se pinta cerrado (D34)". La 15.7 dice que gris es solo sin horarios por regla, bloqueo o tiempo y días pasados, y que un día lleno de citas es `full` (0 espacios). El código sigue la 15.7 (`hasNoResolvedTimes` no usa ocupación). `business-rules.md` sigue la 15.7. Propuesta: precisar la 4.1 como comportamiento del flujo público (donde un día lleno no se ofrece) y dejar la 15.7 para el calendario admin. No lo cambié porque cambia el sentido de una regla.
- **C4 (código vs spec 7 paso 5 y business-rules).** La sugerencia de 15 días (`lib/appointments/lock-reservation-slot.ts:78`) solo considera citas `CONFIRMED` y `SYNC_FAILED`; la spec dice "citas activas futuras", que con la definición nueva incluiría `PENDING`. Efecto: una cita `PENDING` no dispara la sugerencia. Es comportamiento preexistente (informe B, discrepancia 6). Decidir si es intencional y, si lo es, precisarlo en la spec 7.
- **C5 (corregido en business-rules, sin cambio de spec).** La versión anterior de `business-rules.md` decía que la creación admin exige mes `ACTIVE` (sección Admin Month Detail) y que la reserva nueva crea siempre `CONFIRMED` (State Transitions). Ambas contradecían la spec (15.7 línea 1126; 7 paso 8) y el código. Corregidas.
- **C6 (comentarios de código obsoletos, fuera de alcance).** `lib/admin/months/detail-service.ts` (~189, D59) y `lib/admin/dashboard/service.ts` (~473, D61; ~104) afirman que `PENDING` cuenta; la consulta no lo incluye (D66). No se tocaron.
- **C7 (sin verificar).** `business-rules.md` dice que la reprogramación pública exige mes "bookable" (activo). No se verificó en `lib/my-appointments/service.ts` si exige `ACTIVE` en el destino.

## Ambigüedades para el Orchestrator

- C1, C2, C3 y C4 arriba (requieren decisión de producto o de redacción).
- Consecuencia de D66: `Disponibles` puede mostrar espacios libres que el admin no puede reservar (un `PENDING` ocupa en escrituras pero no en contadores). Está documentada como aceptada en la spec 15.7 y en `business-rules.md`. Confirmar.
- "Mes activo" para reprogramación pública (C7).
- `MONTH_NOT_ACTIVE` mapeado en una ruta sin uso: código muerto, para la limpieza de Fase 4.

## Barrido de términos obsoletos (conteos antes / después)

Medidos con `grep -oiE` por documento. "Antes" es el estado al empezar esta ronda (tras A y B). Las cuatro columnas son spec / business-rules / api / data-model.

| Término (regex) | Antes | Después |
|---|---|---|
| `WEEKDAY_ONLY` | 1 / 0 / 1 / 0 | 1 / 0 / 1 / 0 |
| `pair\|pares\|par[ ,.)]` | 1 / 23 / 0 / 1 | 1 / 3 / 0 / 1 |
| `directional\|direccional` | 2 / 10 / 0 / 0 | 2 / 4 / 0 / 0 |
| `SECOND_ONLY` | 3 / 8 / 2 / 9 | 3 / 2 / 2 / 9 |
| `BLOCK_MODE` | 7 / 9 / 3 / 12 | 7 / 4 / 3 / 12 |
| `weekday` | 3 / 14 / 5 / 9 | 3 / 7 / 5 / 9 |
| `Por bloque` | 4 / 1 / 0 / 0 | 4 / 1 / 0 / 0 |
| `/ 3` | 0 / 2 / 0 / 0 | 0 / 0 / 0 / 0 |
| `three\|tres` | 3 / 1 / 0 / 0 | 3 / 1 / 0 / 0 |
| `lunes a viernes\|lunes-viernes\|Monday to Friday\|Monday-Friday` | 6 / 5 / 2 / 3 | 6 / 8 / 2 / 3 |
| `operational weekday\|día operativo\|operational` | 2 / 10 / 1 / 0 | 2 / 7 / 1 / 0 |
| `official base\|base slots` | 0 / 3 / 0 / 0 | 0 / 0 / 0 / 0 |
| `slot-mode rules` | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 |
| `15 días\|15-day\|15-calendar` | 9 / 7 / 1 / 0 | 9 / 8 / 1 / 0 |

Las cifras de `business-rules.md` suben en `lunes a viernes`, `weekday` y `15 días` porque ahora describen el default de la regla (L-V) y la regla de días de la semana (lunes a domingo), que son legítimas. El resto baja.

Ocurrencias que quedan y su motivo (todas históricas, de legado o legítimas; no se tocaron):

- `docs/specification.md`: 73-74 (negación "no son fijos de lunes a viernes"), 514 (campo `slot_mode` legado), 590 y 600 (tablas y mención de `BLOCK_MODE` en `blocked_slots`), 626 (default de la regla 19), 628 ("Ya no existe `WEEKDAY_ONLY`"), 697 (ejemplo de formato i18n en inglés), 855, 865 y 870 (títulos de tarjetas del dashboard por día de la semana y agenda), 1045 (nota de Fase 2), 1083 (`Por bloque` en la descripción de espacios bloqueados, como ausencia), 1121 (presets como atajo), 1161 y 1173 (negaciones "no hay vista Por bloque" y "no hay propagación direccional"), 1295 (cuerpo legado de `PATCH slot-mode`).
- `docs/architecture/api.md`: 291-315 (nombre de campo `weekdays` de reglas), 345 (código `AVAILABILITY_RULE_WEEKDAYS_REQUIRED`), 372-378 (cuerpo legado `slotMode` del `PATCH slot-mode` y su semántica de preset de lunes a viernes), 389 (default de altas), 469 (nota de que `WEEKDAY_ONLY` ya no existe).
- `docs/architecture/data-model.md`: columna `weekday` (ISO), presets y su historia (138, 152, 153, 168), migración y recuperación (173, 174, 227, 233, 258, 272, 274, 296).
- `docs/architecture/business-rules.md`: 72 y 76 (modelo de pares anterior, historia mínima), 687 (`Por bloque` retirado), 662 (propagación direccional retirada), 748-756 (presets legados y migración). Resto: días de la semana y `operational` como "contexto operativo", legítimos.

## Trazabilidad (AGENTS.md)

Documentation Impact:
- Impacto en flujo: Sí (reglas de reserva, confirmación, reprogramación pública, bloqueos, dashboard y catálogo de meses).
- `docs/specification.md`: no modificado en esta ronda. Barrido sin términos obsoletos no históricos; contradicciones C1 a C4 para el Orchestrator.
- `docs/architecture/business-rules.md`: actualizado. Secciones: Domain Overview, Core Entities (Reservation Lock, Availability Rule), Core Concepts (Operating calendar, Minimum gap model, Daily capacity model, Active appointment definition, Reservation Lock), Booking Rules, Concurrency Rules (nueva), Public Reschedule Rules, Admin Dashboard Rules (weekly, busiest, daily), Admin Months Catalog Rules (creación), Admin Month Detail Rules (metrics, calendar, availability rules policy, admin edit, admin booking, blocked-slots), Availability Rules (reescrita), State Transitions, Validation Rules, Invariants, Edge Cases.
- `docs/architecture/api.md`: línea 489 (`VALIDATION_ERROR`, D84).
- `docs/architecture/data-model.md`, `docs/decisions/*`: sin cambios en esta ronda.
- `docs/features/*` y `docs/ui/**`: no tocados (Fase 2).

Flow Contract Check:
- UI steps updated: No (Fase 2, T076).
- API contract updated: Yes (la frase de `api.md`; el contrato ya estaba en `api.md` desde la ronda A).
- Validation rules updated: Yes en `business-rules.md` (Validation Rules, Availability Rules).
- Acceptance criteria updated: No (no hay criterios de aceptación en `business-rules.md`; tasks.md solo marca T075).
- docs/specification.md aligned: Yes para las secciones que describe la reserva y la disponibilidad; No para el conjunto mientras C1 a C4 no se resuelvan.

Migration Compatibility Check:
- Schema changes required: No (0022 ya existe desde 1A; esta ronda no toca esquema).
- Data backfill required: No en esta ronda (documentado en `data-model.md` y spec 10.1).
- Legacy compatibility required: Yes (`slot_mode` legado hasta Fase 4; cuerpo `slotMode` de `PATCH slot-mode`; presets SECOND_ONLY como atajo).
- Rollback strategy defined: Yes en `data-model.md` (ronda A, N4); referenciada en business-rules Availability Rules (migración).
- Cleanup phase defined: Yes (Fase 4, T078; funciones legadas de `lib/availability/rules.ts` y `month-slot-mode.ts`; `MONTH_NOT_ACTIVE` muerto).
- Integrity protections defined: Yes en Concurrency Rules (orden de locks, F1 a F4, sin restricción de BD) y en `data-model.md` (sección Protecciones de integridad).

Admin UI Check: no aplica (no hay cambios de UI).
Notification Contract Check: no aplica.

## Verificación

- `python3 scripts/check-workflow-profile.py`: exit 0. Salida: `WARNING: installed Spec Kit 0.11.9 differs from tested 1.0.5` y `OK: 9 keys, all defined, used, and resolvable`. El aviso es del entorno, no bloqueante.
- Verificación documental: estática, por lectura y grep del código citado. No se ejecutaron pruebas, build, lint, migraciones ni consultas a la BD.
- Ningún "verificado" de esta ronda se apoya en ejecución.

## Estado de T075 y pendientes que el cierre no cubre

- T075 marcado `[X]`: su texto cubre `data-model.md`, `api.md`, las secciones de spec (4.1, 4.2, 4.3, 7, 10, 11 "Mismo día", 12, 15.7), `business-rules.md` (Operating calendar, Slot pair model, Daily capacity model, Admin Month Detail, Availability Rules, Validation, Edge Cases, Invariants, reprogramación pública) y los ADR 0001 a 0006. Todos existen.
- Fuera de T075 y todavía abiertos: F1 (corrección de código, D82, antes de publicar), F2 (D83), F4, NB-6 y NB-7 de 1E (PATCH slot-mode sin `expectedVersion`; la UI no envía `confirmAffectedAppointments`), reformulación de "Antes de implementar" en `plan.md` ~63 (STATE), comentarios de código D59/D61 (C6), Q-T2 (versión MySQL), `{{test_commands}}` (Q-T1; el perfil no se cambió en esta ronda), y `data_model_doc` ya fijado por la ronda A.
- Fase 2 (T076): `docs/ui/**`, `docs/features/*` y la reconciliación de 15.1.4 y 15.7 con la UI.

## Turnos

Aproximadamente 66 llamadas de herramienta (no son turnos oficiales). No se usó compactación. Me detuve al cerrar el alcance, dentro del presupuesto.
