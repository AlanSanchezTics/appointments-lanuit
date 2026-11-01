# Implementation Plan: Disponibilidad flexible por mes

**Branch**: `production` (sin rama nueva creada; la rama la decide el owner en Gate 4) | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-flexible-month-availability/spec.md` (confirmada por el owner en Gate 2) y decisiones D1-D53 de `agent-reports/00-decisions.md`.

**Estado del plan**: borrador para `reviewer-docs` y Gate 3. Decisiones D43 a D49 aplicadas (Ronda 3): Q-P1 a Q-P7 quedan resueltas. Quedan Q-T1 a Q-T5 como ítems técnicos de Gate 3 y dos preguntas de interpretación (RQ-1, RQ-2).

## Summary

Reemplazar `active_months.slot_mode` (BLOCK_MODE / SECOND_ONLY_MODE) como fuente de la disponibilidad por un conjunto de **reglas de disponibilidad** por mes (rango de fechas, días ISO 1-7, horas `HH:mm`, `minGapMinutes`, `preserveCapacity`, `maxPerDay`) más **excepciones por fecha** (lista de horas, vacía = cerrado, con sus propios tres parámetros). El enfoque técnico:

1. Un **resolvedor único y puro** (`lib/availability/`) calcula, para un día, la regla vigente (excepción > regla > default D6 > cerrado) y, con ocupación, bloqueos y hora actual, los horarios ofrecibles y `availableSpaces`. Ningún consumidor vuelve a implementar reglas; todos llaman al mismo módulo (FR-016).
2. El motor es un **port** del experimento de equivalencia (`scratchpad/equiv.ts`), validado en este plan: reproduce 0 diferencias sin bloqueos. Con bloqueos manuales, la semántica literal de FR-013 difiere en **48 de 432** combinaciones; esa cifra es la aceptada por el owner (D43). La cifra 27 de D2 salió de una variante con pares.
3. Persistencia en tablas normalizadas nuevas (`availability_rules`, `availability_exceptions` y tablas hijas), migración aditiva `0022`, backfill desde `slot_mode` (D4) que es idempotente por un registro de ejecución, y `slot_mode` se mantiene **sincronizado y derivado** (D19, D31) hasta la fase 4.
4. Escritura del editor como **reemplazo del conjunto completo del mes** en una transacción con bloqueo de fila sobre `active_months`, control de versión (`availabilityVersion`, FR-041/D24) y confirmación en dos pasos cuando hay citas afectadas (FR-023/D18/D40).
5. Cambio de comportamiento en el flujo público solo a través del resolvedor: la validación de día hábil (`WEEKDAY_ONLY`) se sustituye por `SLOT_NOT_AVAILABLE` cuando el día no produce horarios (FR-017, D46).

## Technical Context

**Language/Version**: TypeScript (Next.js App Router, React), Node 22 en entorno local (`node --version` = v22.22.0).
**Primary Dependencies**: Next.js, React, Prisma (`prisma-client-js`), zod (validación existente), `react-i18next`, `sileo`, `next-auth` (rutas admin). Sin dependencias nuevas.
**Storage**: MySQL (`provider = "mysql"` en `prisma/schema.prisma`). Migraciones en `prisma/migrations/` (última: `0021_public_my_appointments_audit_snapshot`; nueva: `0022_availability_rules`).
**Testing**: Vitest (`npm test` = `vitest run`; jsdom; include `tests/**/*.test.ts(x)`), `npm run test:integration` (`tests/integration`, `--maxWorkers=1`), `npm run lint`, `npm run lint:admin-i18n`. Typecheck: no hay script; usar `npx tsc --noEmit` (TypeScript está en devDependencies).
**Target Platform**: web pública de reservas (`/booking`, `/my-appointments`) y panel admin (`/admin/months/[month]`); zona horaria `America/Mexico_City` (FR-037).
**Project Type**: web application (Next.js monorepo de un paquete).
**Performance Goals**: el cálculo de un mes completo (31 días, hasta 24 horarios por día, `maxPerDay` ≤ 6) debe quedar por debajo de 200 ms en CI (prueba de presupuesto, ver *Testing Strategy*). La lista pública de disponibilidad no añade consultas por día: una lectura de reglas y excepciones por mes.
**Constraints**: flujo público sin cambios de UI más allá de mostrar y aceptar horarios del resolvedor (FR-018); admin separado del público (AGENTS: componentes admin en `components/admin/ui/`); citas, `google_event_id`, locks, logs de auditoría sin cambios de comportamiento (FR-022, FR-032, FR-035); eventos de Google Calendar existentes sin cambios (D30).
**Scale/Scope**: pocos meses activos (ventana de `ACTIVE_MONTH_WINDOW_SIZE`, por defecto 2), decenas de reglas o excepciones como máximo por mes en uso real; todos los consumidores de FR-016, más el dashboard y blocked-spaces (ver PD-14 en la sección *Design*).

## Constitution Check

GATE: debe pasar antes del diseño y de nuevo antes de la implementación.

| Principio / restricción | Estado | Nota |
|---|---|---|
| I. Docs First (`docs/specification.md` fuente permanente) | Pasa con condición | La fase 4 y la fase 2 reconcilian `docs/`. Ningún cambio de `docs/` se hace en esta etapa (brief). |
| II. Working artifacts temporales | Pasa | Este plan vive en `specs/003-...`; no reemplaza `docs/*`. |
| III. Cambios de flujo trazados | Pasa | *Documentation Impact* y *Flow Contract Check* más abajo. |
| IV. Separación de capas | Pasa con diseño | Rutas delgadas en `app/api/admin/months/[month]/availability/`; reglas de dominio en `lib/availability/`; acceso a datos en `lib/db/availability-rules.ts`; estado de editor en `hooks/admin/months/`; UI en `components/admin/months/availability/` sobre `components/admin/ui/`. |
| V. Probar el cambio | Pasa | Motor con oráculo congelado del legado, escenarios SC-001/SC-007, pruebas de migración y concurrencia. |
| Restricción: admin usa `sileo` + `react-i18next` | Pasa | Guardado con `sileo.promise`; textos en `locales/es/admin.json` y `locales/en/admin.json`. |
| Restricción: público y admin separados | Pasa | El público solo cambia el resolvedor; no se importan componentes admin. |

Violaciones que requieren justificación: ninguna. Riesgo alto declarado: migración, reglas de reserva, locks y sincronización con Google Calendar (ver *High-risk areas*).

## Documentation Impact

**Impacto en flujo: Sí.** Afecta reglas de día válido, horarios, métricas, validaciones, pasos del detalle mensual, contratos API y duración de eventos espejo.

- `docs/specification.md`: secciones 4.1, 4.2, 4.3, 7 (pasos 0 y 1, validación de lock), 10 (modelo de datos), 12 (invariantes 4 y 6), 15.7 (catálogo de meses: `Disponibles`, `Modalidad`→editor de reglas, `Bloquear espacios`, tono de calendario, `POST /api/admin/months`). Fase 4 reconcilia el resto.
- `docs/architecture/business-rules.md`: *Operating calendar*, *Slot pair model*, *Daily capacity model*, *Admin Month Detail Rules* (fórmula de `availableSpaces` y `blockedSpaces`), *Availability Rules* (resolvedor, separación, capacidad, excepciones, mes sin reglas), *Validation Rules* (día válido, rangos, 24 horarios, normalización, reglas inválidas), *Edge Cases* e *Invariants*. Además la redacción de la reprogramación pública que apunta a "slot-mode rules" debe apuntar al resolvedor.
- `docs/features/admin-month-detail-flow.md` (pasos 7-8 Modalidad→Reglas; paso 18 Bloquear espacios; reglas de cálculo; flujos alternos con diálogo D18/D40).
- `docs/features/booking-flow.md` (horarios válidos y validaciones; `WEEKDAY_ONLY` sustituido por `SLOT_NOT_AVAILABLE` (D46)).
- `docs/features/admin-months-catalog-flow.md` (creación de mes sin reglas, D17/D31).
- `docs/features/my-appointments-flow.md` (destino de reprogramación usa el resolvedor).
- `docs/architecture/api.md`: endpoints nuevos de disponibilidad, `GET /api/admin/months/[month]` (campos aditivos), `PATCH slot-mode` (D16, D33), `POST /api/admin/months` (D17).
- `docs/architecture/data-model.md` (**nuevo**, D7): tablas nuevas, relación con `active_months`, derivación de `slot_mode`, marcador de día completo (`"00:00"`, D41), bitácora de cambios de esquema. **No se crea en esta etapa.** Al crearse, el Orchestrator actualiza `data_model_doc` en el perfil (hoy `none`).
- `docs/ui/admin/components.md`: `MonthSlotModeModal` (inline hoy en `MonthDetailView`) pasa a editor de reglas; `BlockSpacesModal` sin vista "Por bloque"; diálogo de citas afectadas; componentes reutilizables nuevos (ver *Admin UI Check*).
- `docs/decisions/` (**la carpeta no existe**): crear ADR de reemplazo de pares direccionales (D1), aceptación de diferencias con bloqueos (D2, corregida por D43 a 48 de 432), duración de 1 h para bloqueos de horario puntual (D15, D29, D30), y derivación de `slot_mode` (D19, D31).

**Conciliación documental por fases (D52)**:
- Antes de implementar: el contrato de producto ya está descrito en `spec.md`. AGENTS pide documentación en el mismo flujo de trabajo; la conciliación de `docs/` se reparte por fases (RQ-3).
- Cierre de Fase 1 (T075): `docs/architecture/data-model.md` (creación, D7), `docs/architecture/api.md`, `docs/decisions/` (ADR), `docs/specification.md` (4.1, 4.2, 4.3, 7, 10, 12, 15.7) y `docs/architecture/business-rules.md`.
- Cierre de Fase 2 (T076): `docs/ui/admin/components.md`, `docs/features/admin-month-detail-flow.md`, `docs/features/booking-flow.md`, `docs/features/my-appointments-flow.md` y `docs/features/admin-months-catalog-flow.md`.
- Verificación cruzada al cierre de Fase 3 (T077), antes del release combinado de Fases 1 y 2 (D45).
- Cierre de Fase 4 (T078): retiro de referencias a `slot_mode`, pares y Modalidad; ADR final; estado 003 en `specs/README.md`.

**Cambios de contrato a documentar** (de `spec.md`, con los añadidos de este plan): día válido (FR-017); `Disponibles` y `availableSpaces` (FR-026, FR-027); tope por día (FR-011); `slotMode` legado y derivado (FR-033); duración de eventos espejo (FR-036); conteo de espacios bloqueados del día completo (FR-029, D41); `POST /api/admin/months`; `PATCH slot-mode` (FR-034). Añadidos de este plan: `exceptions` y `availabilityVersion` en el GET (además de `rules`), errores de validación con códigos estables (ver `contracts/admin-availability-api.md`), y el campo `availableSlots` en el agendado diario admin (ver *Decision PD-09*).

## Flow Contract Check

- UI steps updated: **Yes (plan)**. Pasos del editor, diálogo de afectadas y botón `Reglas` definidos en fase 2. Docs pendientes.
- API contract updated: **Yes (plan)**. Ver `contracts/admin-availability-api.md` y `contracts/availability-engine.md`. Docs pendientes.
- Validation rules updated: **Yes (plan)**. Códigos estables en `lib/availability/rules-validation.ts` (FR-025). Docs pendientes.
- Acceptance criteria updated: **Yes**. Sin cambios respecto a `spec.md` (SC-001 a SC-007). SC-003 actualizado a 48 de 432 (D43).
- `docs/specification.md` aligned: **No** (pendiente de fase 4 y de fase 2 para la UI).

## Migration Compatibility Check

- Schema changes required: **Yes**. Tablas nuevas, columna `availability_version` en `active_months`, cambio de default de `slot_mode` a `BLOCK_MODE` (D31), tabla de registro de backfill. Ver `data-model.md`.
- Data backfill required: **Yes**. Un conjunto de reglas por fila de `active_months` según D4 (`maxPerDay=3` como default técnico FR-030). Idempotente por registro (FR-031).
- Legacy compatibility required: **Yes**. `slot_mode` se conserva y se sincroniza (FR-033); `GET` y `PATCH slot-mode` mantienen contrato hasta fase 4 (FR-034).
- Rollback strategy defined: **Yes**. Ver *Rollout and rollback*. Riesgo residual: reglas creadas en la versión nueva no son visibles para la versión anterior; mitigación: fases 1 y 2 salen en el mismo release (D45), así que un rollback revierte ambas.
- Cleanup phase defined: **Yes**. Fase 4: eliminar lectura de `slot_mode`, columna `slot_mode`, campo `slotMode` de las respuestas de la API (D49), `lib/availability/rules.ts`, `lib/availability/month-slot-mode.ts`, constantes `DIRECTIONAL_SLOT_PAIRS` y `MAX_APPOINTMENTS_PER_DAY`, funciones `isWeekdayBookingDate` y `resolveBaseSlotsByMonthMode` (SC-006).
- Integrity protections defined: **Yes (plan)**. Ver *Concurrency and integrity*: restricciones de base de datos (únicas, FK, `CHECK` donde MySQL lo permita) y validaciones de aplicación (traslape de fechas bajo bloqueo de fila).

## Project Structure

### Documentation for this feature

```text
specs/003-flexible-month-availability/
├── spec.md                      (Gate 2 confirmado)
├── plan.md                      (este archivo)
├── research.md                  (decisiones técnicas y alternativas)
├── data-model.md                (tablas, derivación de slot_mode, backfill)
├── quickstart.md                (escenarios de validación)
├── contracts/
│   ├── admin-availability-api.md
│   └── availability-engine.md
├── tasks.md                     (generado por speckit-tasks)
├── agent-reports/
│   ├── 00-decisions.md, 01-specify.md, 02-clarify.md, 03-clarify-r2.md, STATE.md
│   └── 04-plan-tasks.md         (cobertura D1-D53 y preguntas)
└── checklists/requirements.md
```

### Source Code (cambios previstos)

```text
lib/availability/
├── types.ts                     NUEVO  tipos de regla, excepción, configuración y día resuelto
├── defaults.ts                  NUEVO  presets D4, default D6, constantes de límites (D20, D21)
├── day-rule.ts                  NUEVO  resolveDayRule: excepción > regla > default D6 > cerrado
├── capacity-engine.ts           NUEVO  motor puro: horarios ofrecibles, availableSpaces (port del experimento)
├── resolver.ts                  NUEVO  punto de entrada único por día y por mes (FR-016)
├── rules-validation.ts          NUEVO  normalización y validación con códigos estables (FR-003, FR-025, D37, D38)
├── affected-appointments.ts     NUEVO  citas que quedan fuera del horario (FR-024, D35, D40)
├── slot-mode-derivation.ts      NUEVO  derivación de slot_mode (D19, D31) y preset de PATCH (D16)
├── service.ts                   CAMBIA getMonthAvailability usa el resolvedor (carga de datos en servidor)
├── rules.ts                     LEGADO hasta fase 4 (oráculo congelado en tests)
├── month-slot-mode.ts           LEGADO hasta fase 4 (MonthSlotMode se mantiene mientras exista slot_mode)
lib/db/availability-rules.ts     NUEVO  lectura y escritura de reglas, excepciones y versión
lib/db/admin-months.ts           CAMBIA default de slot_mode (D17, D31), registro de backfill
lib/admin/months/service.ts      CAMBIA POST crea sin reglas; PUT availability; PATCH slot-mode
lib/admin/months/detail-service.ts CAMBIA métricas con resolvedor (FR-026, FR-027, FR-029)
lib/admin/months/validation.ts   CAMBIA esquemas de entrada de disponibilidad (sin zod default messages)
lib/admin/months/types.ts        CAMBIA tipos rules/exceptions/availabilityVersion; tone "closed"
lib/admin/months/api-client.ts   CAMBIA cliente: getAvailability, previewAvailability, saveAvailability
lib/admin/blocked-spaces/*       CAMBIA resolvedor; duración de eventos 1 h (D15); conteo D14/D41
lib/admin/appointments/*         CAMBIA agendado y reprogramación con resolvedor; agenda expone availableSlots
lib/appointments/book-appointment.ts, lock-reservation-slot.ts  CAMBIA resolvedor dentro de transacción
lib/my-appointments/service.ts   CAMBIA validación de reprogramación con resolvedor
lib/validation/appointment.ts    CAMBIA quita weekday; timeSlot HH:mm (FR-006)
lib/validation/my-appointments.ts CAMBIA timeSlot HH:mm
lib/admin/dashboard/service.ts   CAMBIA capacidad = suma de `maxPerDay` de los días resueltos (D44)
lib/constants/slots.ts           CAMBIA fase 4 (quitar pares y constante 3)
app/api/admin/months/[month]/availability/route.ts               NUEVO GET
app/api/admin/months/[month]/availability/preview/route.ts       NUEVO POST (sin escritura)
app/api/admin/months/[month]/availability/...                    PUT (en route.ts)
app/api/admin/months/[month]/slot-mode/route.ts                  CAMBIA confirmación y versión opcional
app/api/admin/months/[month]/days/[date]/agenda/route.ts         CAMBIA añade availableSlots (?excludeAppointmentId)
app/api/admin/months/[month]/blockable-slots/route.ts            CAMBIA usa resolvedor
components/admin/months/availability/*                           NUEVO editor, formularios, diálogo de afectadas
components/admin/months/MonthDetailView.tsx                      CAMBIA botón Reglas; tono; quita cálculo cliente
components/admin/months/BlockSpacesModal.tsx                     CAMBIA quita vista "Por bloque"
components/admin/months/BookAppointmentModal.tsx                 CAMBIA horarios desde servidor
components/admin/ui/*                                            NUEVO solo si un patrón se usa en 2 sitios (ver Admin UI Check)
hooks/admin/months/useAvailabilityEditor.ts                      NUEVO estado del editor (borrador, validación espejo, dirty)
hooks/admin/months/useAvailabilitySave.ts                        NUEVO preview, confirmación, sileo.promise
locales/es/admin.json, locales/en/admin.json                     CAMBIA textos del editor y del diálogo
prisma/schema.prisma                                             CAMBIA modelos nuevos; default slot_mode; availabilityVersion
prisma/migrations/0022_availability_rules/migration.sql         NUEVO
tests/lib/availability/*, tests/integration/availability-*, tests/app/api-admin-month-availability-*, tests/components/admin/months/availability-*  NUEVO
docs/*                                                           Ver Documentation Impact (no en esta etapa)
```

**Regla de ubicación (AGENTS)**: sin lógica de negocio en `app/api`; sin lógica compleja en componentes; el motor vive en `lib/availability/` (dominio) y no depende de Prisma, de `next/*` ni de React, para poder probarse de forma aislada.

## Design

### PD-01. Motor puro en `lib/availability/`

Entradas: `dayRule` (resultado de `resolveDayRule`), `occupiedTimes` (citas activas PENDING/CONFIRMED/SYNC_FAILED más locks activos en el flujo público, como hoy), `blockedTimes` (bloqueos manuales de horario puntual), `currentTime` (solo si la fecha es hoy, en `America/Mexico_City`).

Algoritmo (semántica acordada en `research.md` R-02):

1. Si no hay regla vigente o su lista de horas está vacía, el día no tiene horarios.
2. `grid` = horas de la regla menos horas bloqueadas (FR-013), menos horas anteriores a `currentTime` cuando la fecha es hoy (FR-014, D22). Comparación `>=` del legado, confirmada por D50.
3. Si `occupied.length >= maxPerDay`, no hay horarios ni espacios.
4. `base` = máximo de citas alcanzables sobre `grid` con `occupied` fijas, con tope `maxPerDay` (función `best`, port exacto del experimento).
5. Horario candidato `c` (no ocupado, en `grid`) se ofrece si: `|c - o| >= minGapMinutes` para toda `o` ocupada (FR-009, medido entre horas de inicio, D25) **y**, si `preserveCapacity`, `best(occupied + c) >= base` (FR-010).
6. `availableSpaces = base - occupied.length` (FR-026, D12; ya acotado por `maxPerDay`).

`best` se implementa primero como búsqueda exhaustiva con poda por tope (igual que el experimento, cuyo resultado está verificado). Una optimización por greedy solo se acepta si la prueba de equivalencia la confirma sobre todo el espacio de estados (ver R-05).

### PD-02. Resolvedor por día y por mes (`resolver.ts`)

- `resolveDayRule(config, date)`: prioridad (A1, D10, D23, D28):
  1. Hay excepción para la fecha → su lista y parámetros (lista vacía = cerrado, A2). Gana sobre cualquier regla.
  2. Hay al menos una regla en el mes → la regla que cubre la fecha (rango de fechas y día ISO en `weekdays`); si ninguna cubre, cerrado (D23).
  3. No hay reglas en el mes → default D6 (L-V, 09/10/13/14/17/18, 240/true/3) si el día es L-V; fin de semana cerrado (D28).
- `resolveMonthDays(config, { now })` y `resolveDay(config, date, { now })` devuelven el día resuelto y su `slots`/`availableSpaces`. Los consumidores públicos, admin, reservas y métricas llaman a estas funciones (FR-016).
- Fechas y días de la semana se interpretan en `America/Mexico_City` (FR-037). Los días ISO se calculan con fecha de calendario, no con `getUTCDay` sobre cadenas sin hora, para evitar desfases (verificado en `isWeekdayBookingDate`: usa `T12:00:00.000Z`).

### PD-03. Validación y códigos estables (`rules-validation.ts`)

Se valida con funciones explícitas que lanzan `Error` con código en mayúsculas (compatible con `normalizeErrorCode`), no con mensajes por defecto de zod (que se mapean a `VALIDATION_ERROR` genérico y no cumplen FR-025). Reglas:

- Fechas `YYYY-MM-DD` dentro del mes; inicio ≤ fin (D38, FR-001).
- Horas `HH:mm` válidas, normalizadas (sin duplicados, ordenadas, D37). Cualquier minuto (A3, FR-006).
- Regla: al menos un día ISO, al menos una hora (D38). Excepción: lista vacía permitida (A2).
- `minGapMinutes` entero 0-1440 (D20); `maxPerDay` entero 1-6 (D20); `preserveCapacity` booleano.
- Máximo 24 horarios por día contados después de normalizar (D21, D37).
- Traslape de reglas: dos reglas con intersección de fechas se rechazan, sin mirar días de la semana (A1, FR-003, edge "Traslape de reglas").
- Excepciones: fecha única por mes (restricción de base de datos y validación previa).

### PD-04. Persistencia (resumen; detalle en `data-model.md`)

- Tablas nuevas: `availability_rules`, `availability_rule_weekdays`, `availability_rule_times`, `availability_exceptions`, `availability_exception_times`, `availability_migration_runs`.
- `active_months`: se añade `availability_version INT NOT NULL DEFAULT 0`; `slot_mode` pasa a default `BLOCK_MODE` (D17, D31).
- La regla y la excepción no almacenan el mes: pertenecen a `active_months.id` (FK). Las reglas no cruzan meses (FR-019).

### PD-05. Escritura del editor: reemplazo del conjunto del mes

`PUT /api/admin/months/[month]/availability` reemplaza en una transacción el conjunto completo de reglas y excepciones del mes, con `expectedVersion`. Razones: el editor guarda un estado completo; evita estados intermedios parciales; hace que la validación de traslapes y de citas afectadas se calcule sobre el resultado final; y simplifica FR-041. Cada operación de "crear, editar o eliminar" del FR-020 se resuelve en el cliente como edición del borrador y en el servidor como diferencia entre conjuntos. Ver alternativa en `research.md` R-03.

### PD-06. Confirmación de citas afectadas (FR-023, D18, D33, D40)

Flujo en dos pasos sin escritura en el primero:
1. `POST .../availability/preview` (o el mismo `PUT` sin `confirmAffectedAppointments`) calcula la diferencia y devuelve la lista de citas que quedan fuera (D35, sin bloqueos, sin separación ni capacidad, sin citas pasadas).
2. Si la lista no está vacía, el cliente muestra el diálogo con el listado; el segundo `PUT` lleva `confirmAffectedAppointments: true`. El servidor recalcula bajo bloqueo de fila; si las citas afectadas cambiaron y no hay confirmación, responde `409 AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`.
La misma mecánica aplica a `PATCH slot-mode` (D33).

### PD-07. Control de concurrencia y versión (FR-041, D24)

- `availability_version` se incrementa en cada escritura exitosa de reglas, excepciones o `slot-mode`.
- El cliente envía `expectedVersion` leído con el GET. Si no coincide, `409 AVAILABILITY_VERSION_CONFLICT` sin modificar datos.
- `PATCH slot-mode` acepta `expectedVersion` opcional para mantener compatibilidad con el modal actual (fase 1-2); el editor nuevo lo envía siempre.

### PD-08. Lecturas y escrituras concurrentes con reservas

Hoy `bookAppointment`, `confirmAppointmentWithLock`, `acquireReservationSlotLock` y `rescheduleMyAppointment` leen la configuración del mes **antes** de la transacción (`getBookableMonthConfig`). Con el resolvedor, las reglas se leen **dentro** de la transacción, después de `acquireBookingLocks`, con `SELECT ... FOR SHARE` sobre la fila de `active_months`. Las escrituras del editor toman `FOR UPDATE` sobre esa fila. Así una reserva confirmada con reglas viejas no se mezcla con un cambio de reglas en curso (D39). Riesgo de interbloqueo revisado en *High-risk areas*.

### PD-09. Horarios para el cliente admin

`MonthDetailView` hoy calcula horarios en el navegador con `getAvailableStartSlotsWithManualBlocks` (líneas ~500-545) y con `resolveBaseSlotsByMonthMode` (línea ~305). Con reglas, el cliente no debe ejecutar el resolvedor con reglas completas: `GET .../days/[date]/agenda?excludeAppointmentId=` devuelve `availableSlots` calculados en servidor. El motor puede importarse en cliente (es puro), pero se descarta por FR-016 (un único punto de cálculo con las mismas lecturas). Alternativa en `research.md` R-07.

### PD-10. Duración de eventos espejo (D15, D29, D30)

- Bloqueo de horario puntual **creado desde el despliegue**: evento de 1 h. Hoy `blocked-spaces/service.ts` (línea ~369) usa 1 h en BLOCK_MODE y valor por defecto (3 h) en SECOND_ONLY; el cambio es que siempre sea 1 h.
- Verificar en `syncBlockedSlotUpdate` (`lib/calendar/sync-blocked-slot.ts`): cuando no hay `googleEventId` crea un evento nuevo; ese camino también debe usar 1 h.
- Día completo (`"00:00"`): sin cambio, `06:00-23:00` (`lib/calendar/google.ts`).
- Eventos existentes: sin cambio (D30). Actualizar solo el resumen (comportamiento actual).

### PD-11. Derivación de `slot_mode` (D19, D31, FR-033)

Tras cada escritura en la misma transacción:
1. Sin reglas en el mes → `BLOCK_MODE` (D31).
2. Exactamente una regla que cubre todo el mes, con los atributos de un preset D4 (`BLOCK`: L-V, 09/10/13/14/17/18, 240/true/3; `SECOND_ONLY`: L-V, 10/14/18, 0/false/3) → el valor del preset. Las excepciones no cuentan (default técnico FR-033).
3. En otro caso → se conserva el último valor (D19).

`PATCH slot-mode` reemplaza las reglas por el preset (un rango de mes completo) y conserva excepciones (D16, D33).

### PD-12. Backfill (FR-030, FR-031, D4)

Para cada fila de `active_months`, una regla de rango completo del mes, L-V (ISO 1-5), horas y parámetros según `slot_mode` (BLOCK: 09/10/13/14/17/18, 240/true; SECOND_ONLY: 10/14/18, 0/false), `maxPerDay=3` (default técnico). Idempotente: la migración inserta solo si no existe el registro `backfill-availability-rules-v1` en `availability_migration_runs`, y registra la ejecución en la misma transacción. Una segunda ejecución no añade filas ni cambia `availability_version`. Ver `data-model.md`.

### PD-13. Métricas (FR-026, FR-027, FR-029, D13, D34, D41)

- `availableSpaces` diario = `resolveDay(...).availableSpaces` sin bloqueos de día completo (día cerrado = 0).
- `Disponibles` mensual = suma de `availableSpaces` de los días resueltos (abiertos).
- `blockedSpaces` = por cada día abierto según regla vigente, número de horas de la rejilla con bloqueo manual; día completo cuenta horas de la rejilla (D41); día sin regla cuenta 0.
- Tono del calendario: `closed` (gris) si el día no tiene horarios resueltos (incluye horas pasadas, D34); en otro caso semáforo `available/low/full` con los umbrales actuales (D13). Sustituye `weekend` por `closed` en tipos y UI.
- `projectedSaturationPercent` y la comparación con el mes anterior: ver A-06 y D48.

### PD-14. Consumidores (FR-016)

| Consumidor | Cambio | Fase |
|---|---|---|
| `lib/availability/service.ts` (`getMonthAvailability`) → `/api/availability/[month]`, `/booking`, `lib/home/service.ts` | Usa `resolveMonthDays`; sin `isWeekdayBookingDate` | 1 |
| `lib/appointments/book-appointment.ts` (crear y reprogramar) | Reglas dentro de transacción (PD-08); quita weekday | 1 |
| `lib/appointments/lock-reservation-slot.ts` | Igual; mantiene `SLOT_LOCKED` y regla de 15 días (`MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS`, sin cambio) | 1 |
| `lib/my-appointments/service.ts` (`rescheduleMyAppointment`) | Quita `isWeekdayInMexicoCity`; resolvedor | 1 |
| `lib/admin/appointments/service.ts` (agendado y reprogramación admin, agenda) | Resolvedor; `availableSlots` en agenda | 1 |
| `lib/admin/blocked-spaces/service.ts` (horarios bloqueables, crear, duración) | Resolvedor; `DATE_NOT_OPERATIONAL` cuando el día no tiene horarios; 1 h | 1 |
| `lib/admin/months/detail-service.ts` (métricas y calendario) | PD-13 | 1 |
| `lib/validation/appointment.ts` | Quita `WEEKDAY_ONLY` (reemplazado por `SLOT_NOT_AVAILABLE`, D46); `timeSlot` `HH:mm` | 1 |
| `lib/validation/my-appointments.ts`, `lib/admin/appointments/validation.ts`, `lib/admin/blocked-spaces/validation.ts` | `timeSlot` `HH:mm` en lugar de `z.enum(BASE_TIME_SLOTS)` (FR-006; sin esto, 07:30 y 14:30 de D9 serían rechazados) | 1 |
| `lib/admin/months/service.ts` y `lib/db/admin-months.ts` | Default `BLOCK_MODE` (D17, D31); nuevos métodos de disponibilidad | 1 |
| `lib/db/active-months.ts` (reconcile upsert) | Hereda default de BD `BLOCK_MODE` (D31) | 1 |
| `lib/admin/dashboard/service.ts` | Capacidad = suma de `maxPerDay` de los días resueltos, en semana y en día (D44, D53). Fuera de FR-016, incluido por D44. El borrado de `MAX_APPOINTMENTS_PER_DAY` queda en Fase 4 | 1 |
| `components/admin/months/MonthDetailView.tsx`, `BlockSpacesModal.tsx`, `BookAppointmentModal.tsx`, `hooks/admin/months/useBlockSpacesModal.ts`, `useBookAppointmentModal.ts` | Horarios desde servidor; sin `BASE_TIME_SLOTS`; sin vista "Por bloque" | 2 |
| `components/booking/*` (`booking-*-step.tsx`) | Solo referencia literal `"09:00"` como valor por defecto de etiqueta; sin cambio de flujo | 2 (verificar) |

### PD-15. Admin UI (fase 2)

- Botón `Modalidad` → botón `Reglas` en el detalle del mes. Abre un editor (`components/admin/months/availability/AvailabilityEditorModal.tsx`) con dos secciones: reglas y excepciones, sobre `components/admin/ui/` (`Modal`/`BottomSheetModal`, `Button`, `Input`, `Select`, `Switch`, `Card`, `ListItem`).
- Estado en hooks: `useAvailabilityEditor` (borrador, validación espejo para feedback inmediato, dirty) y `useAvailabilitySave` (preview, diálogo, `sileo.promise` para guardado).
- Diálogo de citas afectadas: componente de feature (`AffectedAppointmentsDialog.tsx`) sobre `Modal`. No es una notificación `sileo` (spec, Notification Contract Check).
- Componentes reutilizables nuevos: un selector de horas (chips `HH:mm` con alta y baja) se usa en reglas y excepciones → candidato a `components/admin/ui/` (regla de promoción). Se documenta en `components.md`.

## High-risk areas and round split

Áreas de alto riesgo tocadas: migraciones Prisma (Fases 1 y 4), reglas de reserva, locks y Google Calendar (Fase 1), y auditoría de citas (sin cambio; se verifica D24).

Regla del Orchestrator: más de ~10 tareas en una fase de alto riesgo implica rondas de 10 tareas o menos. Esta es la división real, la misma que `tasks.md`:
- **Fase 1 (alto riesgo, 39 tareas, 5 rondas)**: 1A esquema y migración (5); 1B motor puro (10); 1C validación, métricas y dashboard (8); 1D consumidores de reserva (6); 1E servicios admin, API y pruebas de consumidores (10).
- **Fase 2 (medio, 17 tareas, 2 rondas)**: 2A editor (7); 2B diálogo, detalle, bloqueos, textos y pruebas (10).
- **Fase 3 (medio-alto, 7 tareas, 2 rondas)**: 3A pruebas de dominio y consistencia (4); 3B E2E y quickstart (3).
- **Fase 4 (alto, 11 tareas, 2 rondas)**: 4A retiro de código legado y constantes (5); 4B eliminación de `slot_mode` y de `slotMode` en respuestas (6, requiere Gate 4).
- **Cierre documental (4 tareas, T075 a T078)**: una por fase, según D52.

Total: 78 tareas.

## Rollout and rollback

Orden de despliegue (fase 1 y 2):
1. Aplicar `prisma migrate deploy` (migración `0022`). Tablas nuevas vacías; `slot_mode` se conserva; el código anterior sigue funcionando.
2. Ejecutar backfill dentro de la migración y verificar `availability_migration_runs` y conteos (`quickstart.md`, S-02).
3. Desplegar la versión nueva con consumidores del resolvedor. Con reglas copiadas de D4, los horarios públicos son los mismos que antes (verificado por la prueba de equivalencia sin bloqueos).
4. Fases 1 y 2 salen en el mismo release, sin bandera de configuración (D45). El backfill se ejecuta en la migración y se verifica antes del despliegue (S-02).

Rollback:
- Rollback: revertir el release completo, fases 1 y 2 juntas (D45). Las tablas nuevas quedan sin uso y no se eliminan.
- `slot_mode` se mantiene sincronizado (D11), así que la versión anterior muestra el preset equivalente cuando las reglas coinciden con un preset. Si las reglas no coinciden, la versión anterior mostrará el último `slot_mode` (riesgo residual aceptado por D19).
- Las tablas nuevas pueden quedar sin usar; no se eliminan en rollback.
- La migración no modifica `appointments`, `google_event_id`, `status` ni `time_slot` (FR-032).

## Concurrency and integrity

Base de datos (MySQL/InnoDB):
- `availability_exceptions`: `UNIQUE (active_month_id, date)`.
- `availability_rule_times`, `availability_exception_times`: clave primaria compuesta `(parent_id, time_slot)` (sin horas repetidas).
- `availability_rule_weekdays`: clave primaria compuesta `(rule_id, weekday)`; `CHECK weekday BETWEEN 1 AND 7` si la versión de MySQL del entorno lo soporta (ver Q-T2).
- Llaves foráneas con `ON DELETE CASCADE` desde las tablas hijas; `CHECK` de rango para `min_gap_minutes` (0-1440) y `max_per_day` (1-6) si la versión lo soporta.
- `availability_version`: entero, solo crece.

Aplicación (no expresable de forma simple en BD):
- Traslape de reglas: validación bajo `FOR UPDATE` sobre `active_months`.
- Máximo 24 horarios por día: validación de aplicación (la base no cuenta horas efectivas).
- Citas afectadas: se recalcula dentro de la misma transacción de escritura.

Bitácora: los cambios de reglas y excepciones no escriben en `appointment_logs` (D24, FR-035). Pruebas: ver S-08.

## Testing Strategy

- **Motor (unitario)**: `tests/lib/availability/capacity-engine.test.ts` y `day-rule.test.ts`: escenarios US3 (1 a 4) y US2 (1 a 4), casos de borde (excepción vacía, excepción sin regla, mes sin reglas, primera regla, hora repetida, día actual con horas pasadas).
- **Dashboard (D44, D53)**: `tests/lib/admin/dashboard.service.test.ts`: capacidad = suma de `maxPerDay`; día cerrado con capacidad 0 y ocupación 0 %. **D42**: caso explícito de primera regla en `day-rule.test.ts`.
- **Equivalencia (regresión)**: `tests/lib/availability/equivalence-legacy.test.ts` con oráculo congelado en `tests/lib/availability/fixtures/legacy-block-oracle.ts` (copia del legado BLOCK_MODE y SECOND_ONLY, para que sobreviva a la fase 4). Gate: 0 diferencias sin bloqueos (BLOCK y SECOND_ONLY); diferencias con bloqueos 48 de 432, cifra aprobada por el owner (D43). Prueba de presupuesto: un mes completo < 200 ms.
- **Métricas**: `tests/lib/admin/months.detail-service.test.ts` (actualizado): SC-007 = 67 para diciembre 2026 (9×3 + 10×4); enero 2027 = 63 (US4 escenario 2).
- **Validación**: `tests/lib/availability/rules-validation.test.ts`: cada código de FR-025, D37, D38, D20, D21, traslape (A1).
- **Afectadas**: `tests/lib/availability/affected-appointments.test.ts`: D35, D40 (bloqueos fuera del cálculo), citas pasadas excluidas, diferencia contra el conjunto actual.
- **Derivación**: `tests/lib/availability/slot-mode-derivation.test.ts`: D19, D31, D16 (preset conserva excepciones).
- **Integración (MySQL)**: `tests/integration/availability-backfill.integration.test.ts` (idempotencia S-02, SC-004), `tests/integration/availability-concurrency.integration.test.ts` (FR-041, `FOR SHARE` vs `FOR UPDATE`, D39 confirmación con lock sobre horario eliminado), extensión de `book-appointment.integration.test.ts` y `reservation-lock.integration.test.ts`.
- **D32**: un cambio de reglas es visible en la siguiente lectura pública sin publicación (`availability-public-consistency.integration.test.ts`).
- **API**: `tests/app/api-admin-month-availability-*.test.ts` (nuevas), `api-admin-month-slot-mode-route.test.ts` (compatibilidad y 409), `api-admin-month-detail-route.test.ts` (campos aditivos), `api-availability-month.test.ts` (sin cambio de forma).
- **Componentes**: `tests/components/admin/months/availability-editor.test.tsx` y `month-detail-view.test.tsx` (actualizado: sin "Modalidad", con "Reglas"); `BlockSpacesModal` sin vista "Por bloque".
- **Google Calendar**: pruebas unitarias sobre `syncBlockedSlotCreate`/`Update` con duración 1 h (sin llamadas reales; el mock existente).
- **Calidad**: `npm run lint`, `npm run lint:admin-i18n`, `npx tsc --noEmit`, `npm test`, `npm run test:integration`.
- **E2E** (opcional, fase 3): `tests/e2e/` flujo de editor y de reserva con un mes de prueba.

## Decisions taken in this plan (PD-xx)

Las decisiones técnicas aquí tomadas no cambian comportamiento de producto. Cada una tiene su alternativa en `research.md`.

- PD-01 Motor puro y port del experimento.
- PD-02 Prioridad excepción > regla > default D6 > cerrado.
- PD-03 Códigos de validación explícitos (no zod por defecto).
- PD-04 Tablas normalizadas, no JSON.
- PD-05 Editor con reemplazo del conjunto completo.
- PD-06 Confirmación en dos pasos.
- PD-07 Versión y `expectedVersion` (opcional solo en `PATCH slot-mode`).
- PD-08 Reglas leídas dentro de la transacción con `FOR SHARE`.
- PD-09 Horarios de reagendado calculados en servidor (`availableSlots`).
- PD-10 Eventos espejo de 1 h para bloqueos nuevos.
- PD-11 Derivación de `slot_mode` con preset de rango completo.
- PD-12 Backfill idempotente por registro.
- PD-13 Métricas con `closed` como tono.
- PD-14 Lista de consumidores y su fase.
- PD-15 Componentes del editor sobre `components/admin/ui`.
- PD-16 Capacidad del dashboard = suma de `maxPerDay` de los días resueltos (D44).
- PD-17 Fases 1 y 2 en un solo release, sin bandera (D45). `slotMode` se retira de las respuestas de la API en fase 4, sin alias (D49).

## Assumptions ([ASSUMPTION] = default técnico D51, a revisar en Gate 3; A-03, A-04 y A-06 confirmados por D47 y D48; A-08 resuelto por D50)

- **A-01** [ASSUMPTION] default técnico (D51): `expectedVersion` opcional en `PATCH slot-mode` para compatibilidad de Fases 1 y 2 (D45); ver también RQ-2.
- **A-02** [ASSUMPTION] default técnico (D51): el editor guarda el conjunto completo en una sola escritura; FR-020 se cumple en la UI.
- **A-03** "Citas que quedan fuera" (FR-023, D18) = citas que estaban dentro del horario vigente antes del cambio y quedan fuera después (diferencia), no todas las citas fuera del horario nuevo. Evita que un guardado sin cambios relevantes muestre citas ya fuera. Confirmado por D47.
- **A-04** "Horarios que resuelve el motor" en D35 se interpreta como la rejilla de horas de la regla o excepción del día, sin aplicar ocupación, separación ni capacidad (FR-024 excluye esos conceptos). Confirmado por D47.
- **A-05** [ASSUMPTION] default técnico (D51): los locks activos cuentan como ocupados en el flujo público (como hoy) y no en las métricas admin (como hoy).
- **A-06** `projectedSaturationPercent` conserva su fórmula (ocupadas / (ocupadas + disponibles)) con el nuevo `availableSpaces`; la comparación con el mes anterior usa las reglas de ese mes y su cálculo sin quitar horas pasadas (como hoy). Confirmado por D48.
- **A-07** [ASSUMPTION] default técnico (D51): `availableSlots` de la agenda y `excludeAppointmentId` son campos nuevos aditivos.
- **A-08** Resuelto por D50: la hora actual se compara con `>=` (legado); D22 se lee como "iguales o posteriores".
- **A-09** [ASSUMPTION] default técnico (D51): `deriveSlotMode` coincide con un preset solo si una regla cubre el mes completo (default técnico de FR-033).
- **A-10** [ASSUMPTION] default técnico (D51): días ISO 1 (lunes) a 7 (domingo), valores técnicos sin efecto de producto.
- **A-11** [ASSUMPTION] default técnico (D51): "Espacios bloqueados" cuenta solo horas de la rejilla vigente (FR-029 literal).

## Open Questions (para el Orchestrator; no se deciden aquí)

- **Q-P1 a Q-P7 resueltas (Ronda 3)**:
  - Q-P1 → **D43**: 48 de 432 combinaciones con bloqueos manuales difieren del legado (semántica literal de FR-013). El 27 de D2 salió de una variante con pares y queda como nota histórica. T057 desbloqueada.
  - Q-P2 → **D47**: A-03 y A-04 confirmados.
  - Q-P3 → **D46**: un día sin horarios responde `SLOT_NOT_AVAILABLE` (reemplaza `WEEKDAY_ONLY`).
  - Q-P4 → **D48**: `projectedSaturationPercent` conserva su fórmula; cada mes usa sus reglas (A-06 confirmado).
  - Q-P5 → **D44**: capacidad del dashboard = suma de `maxPerDay` de los días resueltos. T022 (Fase 1, D53) y T066 (Fase 4) reemplazan a T060 y T061.
  - Q-P6 → **D45**: fases 1 y 2 en el mismo release, sin bandera. `PATCH slot-mode` conserva ruta, cuerpo y forma de respuesta.
  - Q-P7 → **D49**: `slotMode` se retira de las respuestas de la API en fase 4, sin alias. T072 sin alias (Fase 4B).
- **Defaults técnicos para Gate 3 (D51)**: A-01, A-02, A-05, A-07, A-09, A-10 y A-11 (ver *Assumptions*). No son decisiones del owner.
- **Preguntas restantes (para confirmar en Gate 3)**:
  - RQ-1 (D49): el cuerpo de entrada de `PATCH slot-mode` conserva `slotMode` como selector de preset en fase 4; solo se retira de las respuestas. Interpretación del plan: confirmar.
  - RQ-2 (D45): sin `confirmAffectedAppointments` y con citas afectadas, `PATCH slot-mode` responde `409` sin escribir. Interpretación del plan: se conserva, porque el editor del mismo release siempre confirma. Confirmar que no hay clientes externos que dependan de la respuesta anterior.
  - RQ-3 (D52, AGENTS): AGENTS pide actualizar la documentación en el mismo flujo de trabajo y antes de implementar; D52 la reparte por fases (cierre de Fase 1 y de Fase 2, antes del release combinado). Confirmar con el Orchestrator que la conciliación por fases cumple AGENTS.
- **Q-T1 (perfil)**: `{{test_commands}}` apunta a `CLAUDE.md`, sección "Commands", que no existe (`CLAUDE.md` solo importa `@AGENTS.md`). El plan usa los scripts de `package.json`. Pedir al Orchestrator corregir la clave o agregar la sección.
- **Q-T2 (técnico, verificación)**: versión de MySQL del entorno para `CHECK` constraints (MySQL 8.0.16+). Si no está disponible, las validaciones quedan en aplicación.
- **Q-T3 (perfil, Orchestrator)**: `{{data_model_doc}}` es `none`. Cuando se cree `docs/architecture/data-model.md` (fase 1), actualizar el perfil. No se edita el perfil en esta etapa.
- **Q-T4 (carpeta)**: `docs/decisions/` no existe; el plan la crea en la fase 1 o 4 según el ADR. Confirmar.
- **Q-T5 (AGENTS.md)**: la fase `after_plan` del `agent-context` es opcional y no se ejecutó. El paso 4 de `speckit-plan` (actualizar marcadores SPECKIT de `AGENTS.md`) no se ejecutó porque el brief limita los archivos tocados a la carpeta del feature y `specs/README.md`.

## High-risk review checklist (para `reviewer-high-risk` en fases 1 y 4)

- Migración `0022`: idempotencia del backfill, conteos, orden de ejecución, rollback (no elimina tablas).
- Booking y reprogramación: que las lecturas de reglas ocurran dentro de la transacción y bajo `FOR SHARE`; que `SLOT_LOCKED` y `SLOT_NOT_AVAILABLE` se conserven; que el lock vigente sobre horario eliminado falle con `SLOT_NOT_AVAILABLE` (D39).
- Locks (`reservation_locks`): sin cambio de TTL (10 min) ni de limpieza.
- Google Calendar: 1 h solo para bloqueos nuevos; día completo sin cambio; eventos existentes sin cambio.
- Auditoría: ninguna escritura de reglas en `appointment_logs` (D24).
- Interbloqueo: orden de bloqueo `acquireBookingLocks` → `FOR SHARE` en `active_months`; el editor solo toma `FOR UPDATE` sobre `active_months` y no toma bloqueos de reserva.

## Complexity Tracking

Sin violaciones de la constitución que justificar.

## Preliminary references

- Oráculo y resultados de equivalencia: ejecutados en `scratchpad` durante este plan (port de `equiv.ts`). El script no es parte del repositorio; la prueba definitiva vive en `tests/lib/availability/equivalence-legacy.test.ts` (fase 3).
- Líneas de referencia de código: `lib/availability/rules.ts` (funciones de pares y `getAvailableStartSlotsWithManualBlocks`), `lib/availability/service.ts` (`getMonthAvailability`), `lib/admin/months/detail-service.ts` (métricas y `previousMonthSlotMode`), `lib/admin/blocked-spaces/service.ts` (duración de eventos y `DATE_NOT_OPERATIONAL`), `lib/validation/appointment.ts` (`WEEKDAY_ONLY`), `lib/appointments/*.ts` (lecturas de configuración fuera de transacción).
