# Tasks: Disponibilidad flexible por mes

**Input**: Design documents from `/specs/003-flexible-month-availability/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/admin-availability-api.md`, `contracts/availability-engine.md`, `quickstart.md`.

**Estado**: borrador para revisión documental, ciclo 2. Aplica D43 a D53 y las correcciones B1 a B3 y N1 a N9 del informe `agent-reports/05-docs-review.md`. Las tareas de Fase 4B siguen pendientes de la autorización de Gate 4 del owner.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: se puede ejecutar en paralelo (archivos distintos y sin dependencia incompleta).
- **[Story]**: etiqueta de trazabilidad hacia `spec.md` (`[US1]` a `[US4]`). Las fases de este archivo son las fases de AGENTS (1 a 4) y el cierre documental, no historias de usuario. Las tareas de cierre documental no llevan etiqueta.
- **Rondas**: cada fase de alto riesgo se divide en rondas de 10 tareas o menos (regla del Orchestrator). Cada ronda tiene su informe del Developer; el `reviewer-high-risk` revisa las rondas de Fase 1 y Fase 4.

## Orden de dependencias

```text
Fase 1 (alto riesgo)   Ronda 1A -> 1B -> 1C -> 1D -> 1E -> cierre documental T075
Fase 2 (UI)            depende de 1E (API y cliente) -> Ronda 2A -> 2B -> cierre documental T076
Fase 3 (pruebas)       depende de 2B (E2E) y de 1E -> Ronda 3A -> 3B -> verificación T077
Release combinado      fases 1 y 2 juntas (D45), con docs de cierre 1, 2 y 3 completadas
Fase 4 (cleanup, alto) depende de 3B y de Gate 4 -> Ronda 4A -> 4B -> cierre documental T078
```

Dentro de Fase 1, el cambio del dashboard (T022, T023, D53) va en la Ronda 1C, después del resolvedor (T009). La eliminación de la constante `MAX_APPOINTMENTS_PER_DAY` (T066) queda en Fase 4A, después de que ningún consumidor la use.

## Phase 1: Backend and migrations (AGENTS Fase 1, high risk)

Objetivo: esquema, migración con backfill, motor puro, resolvedor único, validación, dashboard, consumidores de reserva y admin, API. Sin UI nueva. Criterio de salida: pruebas de motor, equivalencia sin bloqueos, migración idempotente, dashboard y consumidores pasan; el flujo público y el admin existente devuelven los horarios esperados para meses migrados sin bloqueos.

### Ronda 1A: esquema y migración (5 tareas)

- [X] T001 [US1] Modificar `prisma/schema.prisma`: añadir modelos `AvailabilityRule`, `AvailabilityRuleWeekday`, `AvailabilityRuleTime`, `AvailabilityException`, `AvailabilityExceptionTime`, `AvailabilityMigrationRun` (ver `data-model.md`); añadir `availabilityVersion Int @default(0)` a `ActiveMonth`; cambiar el default de `slotMode` a `BLOCK_MODE`. Mantener `slotMode` y el enum `MonthSlotMode` hasta Fase 4B.
- [X] T002 [US1] Crear `prisma/migrations/0022_availability_rules/migration.sql`: DDL de las seis tablas (claves, restricciones únicas, FK con ON DELETE CASCADE); `ALTER` de `active_months` (`availability_version`, default de `slot_mode`); backfill según la tabla de mapeo D4 (una regla por mes, L-V, horas y parámetros según `slot_mode`, `max_per_day = 3`); paso `availability_version = 1` para los meses con regla creada por el backfill (`data-model.md`, paso 5); todo en transacción e idempotente mediante la fila `backfill-availability-rules-v1` en `availability_migration_runs`. Depende de T001.
- [X] T003 [US1] Crear `lib/db/availability-rules.ts`: lectura de configuración del mes (reglas, excepciones, versión, `slot_mode`); lectura con `FOR SHARE` para uso dentro de transacciones de reserva; escritura del conjunto completo con `FOR UPDATE` sobre `active_months`, comprobación de `expectedVersion`, incremento de `availability_version` y sincronización de `slot_mode` (función de `lib/availability/slot-mode-derivation.ts`, T011). Depende de T001. Solo acceso a datos, sin lógica de negocio (AGENTS, ubicación de código).
- [X] T004 [US1] Actualizar `lib/availability/month-slot-mode.ts`: `DEFAULT_MONTH_SLOT_MODE = "BLOCK_MODE"` (D17, D31). Revisar `lib/db/admin-months.ts` (`createInactiveMonths`) para que use el nuevo default.
- [X] T005 [US1] Crear `tests/integration/availability-backfill.integration.test.ts`: aplica el backfill sobre datos de muestra; verifica un mes por cada `slot_mode`; ejecuta el backfill dos veces y comprueba que no cambian filas ni `availability_version` (FR-031); verifica que `appointments` (`date`, `time_slot`, `status`, `google_event_id`) no cambian (SC-004, FR-032). Depende de T002 y T003.

**Ronda 1A criterio de salida**: `npm run prisma:generate` sin errores; `npm run test:integration -- tests/integration/availability-backfill.integration.test.ts` pasa.

### Ronda 1B: motor puro y pruebas de dominio (10 tareas)

- [X] T006 [P] [US1] Crear `lib/availability/types.ts` (tipos `AvailabilityRule`, `AvailabilityException`, `MonthAvailabilityConfig`, `DayRule`, `DayContext`, `DayAvailability`) y `lib/availability/defaults.ts` (presets D4 BLOCK y SECOND_ONLY, default D6, límites D20 y D21). Sin dependencias de Prisma ni de Next.js.
- [X] T007 [US1] Crear `lib/availability/day-rule.ts`: `resolveDayRule(config, date)` con prioridad excepción > regla > default D6 (L-V, solo si el mes no tiene reglas) > cerrado (PD-02, `contracts/availability-engine.md`). Depende de T006.
- [X] T008 [US3] Crear `lib/availability/capacity-engine.ts`: `best` exhaustivo con poda por tope (port verificado del experimento), `computeDayAvailability` con los pasos 1 a 6 de `contracts/availability-engine.md` (FR-009 a FR-014, FR-026); comparación de hora actual `>=` (D50). Sin constante fija de 3 (FR-011). Depende de T006.
- [X] T009 [US1] Crear `lib/availability/resolver.ts`: `resolveDay(config, date, { now })` y `resolveMonthDays(config, { now })`, punto único de cálculo (FR-016). Depende de T007 y T008.
- [X] T010 [P] [US1] Crear `lib/availability/rules-validation.ts`: normalización (D37) y validación con códigos `AVAILABILITY_*` (FR-003, FR-025, D20, D21, D38, A2). Lanza `Error` con código en mayúsculas, no zod por defecto (R-11). Depende de T006.
- [X] T011 [P] [US1] Crear `lib/availability/slot-mode-derivation.ts`: `deriveSlotMode(rules, currentSlotMode)` (D19, D31, FR-033; regla de A-09 como default técnico D51) y función que construye el conjunto de reglas de un preset (D16). Depende de T006.
- [X] T012 [P] [US1] Crear `lib/availability/affected-appointments.ts`: diferencia entre horario vigente y propuesto para citas activas futuras (PENDING, CONFIRMED, SYNC_FAILED), sin bloqueos, separación ni capacidad (FR-024, D35, D40, D47 con A-03 y A-04). Depende de T007.
- [X] T013 [P] [US3] Crear `tests/lib/availability/fixtures/legacy-block-oracle.ts`: copia congelada de la lógica legada de `BLOCK_MODE` y `SECOND_ONLY_MODE` de `lib/availability/rules.ts`, sin importar código de la aplicación. Debe sobrevivir a la fase 4.
- [X] T014 [US3] Crear `tests/lib/availability/capacity-engine.test.ts` y `tests/lib/availability/day-rule.test.ts`: escenarios US2 1 a 4, US3 1 a 4 (`contracts/availability-engine.md`, tabla de ejemplos), excepción vacía, hora actual con igualdad (D50: la hora igual a la actual se ofrece), hora repetida (D37). **D42**: un mes sin reglas que recibe su primera regla cierra los días que D6 abría y que la regla no cubre (caso explícito). Depende de T007 y T008.
- [X] T015 [US3] Crear `tests/lib/availability/equivalence-legacy.test.ts`: compara el motor con el oráculo para las 20 ocupaciones alcanzables y las 432 combinaciones; gate sin bloqueos: 0 diferencias en BLOCK y SECOND_ONLY (SC-002). El gate con bloqueos queda como `it.todo` hasta T057 (48 de 432, D43). Depende de T008 y T013.

**Ronda 1B criterio de salida**: `npm test -- tests/lib/availability/capacity-engine.test.ts tests/lib/availability/day-rule.test.ts tests/lib/availability/equivalence-legacy.test.ts` pasa; el gate con bloqueos aparece como pendiente hasta T057.

### Ronda 1C: validación, métricas y dashboard (8 tareas)

- [X] T016 [P] [US1] Crear `tests/lib/availability/rules-validation.test.ts`: un caso por código de FR-025, traslape de fechas (A1), días vacíos (D38), horas repetidas (D37), límite de 24 (D21), rangos 0-1440 y 1-6 (D20), excepción con lista vacía válida (A2). Depende de T010.
- [X] T017 [P] [US1] Crear `tests/lib/availability/affected-appointments.test.ts`: cita futura fuera de la rejilla (D35), bloque manual no cuenta (D40), cita pasada no se lista, solo la diferencia (A-03), día cerrado afecta todas sus citas. Depende de T012.
- [X] T018 [P] [US1] Crear `tests/lib/availability/slot-mode-derivation.test.ts`: sin reglas → `BLOCK_MODE` (D31); preset exacto → su valor; regla parcial → se conserva el valor (D19); preset conserva excepciones (D33). Depende de T011.
- [X] T019 [US4] Actualizar `lib/admin/months/detail-service.ts` y `lib/admin/months/types.ts`: `availableSpaces` con el resolvedor (PD-13, FR-026); `Disponibles` como suma de días abiertos (FR-027); tono `closed` sustituye `weekend` (D13, D34); comparación con el mes anterior con sus propias reglas, sin `previousMonthSlotMode` (A-06, D48); campos de tipos `rules`, `exceptions`, `availabilityVersion`, `usesDefaultRule`. Depende de T009.
- [X] T020 [US1] Actualizar `lib/admin/blocked-spaces/day-block.ts`: reemplazar `countBlockedSpacesByMode` por `countBlockedSpaces(dayRule, blockedTimes)`, que cuenta horas de la rejilla vigente bloqueadas, incluido día completo según rejilla (D14, D41, FR-029). Depende de T009.
- [X] T021 [US4] Actualizar `tests/lib/admin/months.detail-service.test.ts`: diciembre 2026 vacío → 67 espacios (SC-007); días 1 a 4 y 7 a 11 con 3; días 14 a 23 con 4; días 5, 6, 12, 13 y 24 a 31 cerrados; enero 2027 → 63; bloqueo de día completo cuenta la rejilla (D41). Depende de T019 y T020.
- [X] T022 [US1] Actualizar `lib/admin/dashboard/service.ts` (`WEEK_CAPACITY`, capacidad diaria y ocupación de hoy): capacidad = suma de `maxPerDay` de los días resueltos, en semana y en día (D44, D53); con día cerrado, capacidad 0 y ocupación 0 % (sin división entre cero). Dejar de usar `MAX_APPOINTMENTS_PER_DAY` en este archivo; la constante se borra en T066. Depende de T009.
- [X] T023 [US1] Crear o actualizar `tests/lib/admin/dashboard.service.test.ts`: capacidad semanal = suma de `maxPerDay` (diciembre 2026: 9×3 + 10×4 en su semana correspondiente), día cerrado con capacidad 0 y ocupación 0 %, día de regla 0/false/4 con capacidad 4 (FR-011, D44). Depende de T022.

**Ronda 1C criterio de salida**: T016 a T023 pasan; `npm test -- tests/lib/admin/months.detail-service.test.ts tests/lib/admin/dashboard.service.test.ts` muestra 67, 63 y las capacidades del dashboard.

### Ronda 1D: consumidores de reserva y reprogramación pública (6 tareas)

- [X] T024 [US1] Actualizar `lib/availability/service.ts` (`getMonthAvailability`): cargar reglas, excepciones y bloqueos del mes una vez y usar `resolveMonthDays`; quitar `isWeekdayBookingDate` y `resolveBaseSlotsByMonthMode`. Mantener la forma de salida `{ date, slots }` (FR-015, FR-018). Depende de T003 y T009.
- [X] T025 [P] [US1] Actualizar `lib/validation/appointment.ts`: quitar la comprobación `isWeekdayInMexicoCity` y el error `WEEKDAY_ONLY` (FR-017); `timeSlot` acepta `HH:mm` válido (FR-006) en lugar de `z.enum(BASE_TIME_SLOTS)`. Actualizar `lib/validation/my-appointments.ts` (`timeSlot` `HH:mm`).
- [X] T026 [US1] Actualizar `lib/appointments/book-appointment.ts`: leer reglas dentro de la transacción tras `acquireBookingLocks`, con `FOR SHARE` (PD-08); usar `resolveDay` en creación y en reprogramación; día sin horarios o horario no ofrecido → `SLOT_NOT_AVAILABLE` (D46). Quitar `resolveBaseSlotsByMonthMode` y `getAvailableStartSlotsWithManualBlocks`. Depende de T003, T009 y T025.
- [X] T027 [US1] Actualizar `lib/appointments/lock-reservation-slot.ts`: mismo patrón de lectura dentro de la transacción; mantener `SLOT_LOCKED`, `SLOT_NOT_AVAILABLE` y la regla de 15 días (`MIN_DAYS_BETWEEN_PUBLIC_APPOINTMENTS`, sin cambio). Depende de T003 y T009.
- [X] T028 [US1] Actualizar `lib/my-appointments/service.ts` (`rescheduleMyAppointment`): quitar `isWeekdayInMexicoCity`; usar el resolvedor con reglas leídas dentro de la transacción; error `SLOT_NOT_AVAILABLE` (D46) sin cambio de código. No añadir la regla de 15 días (sin cambio, FR-017 de la spec 002). Depende de T003 y T009.
- [X] T029 [US3] Crear `tests/integration/availability-concurrency.integration.test.ts` (MySQL): reserva con lock sobre horario eliminado por el editor → `SLOT_NOT_AVAILABLE` (D39); escritura de reglas bloquea lecturas `FOR SHARE` (FR-041, R-06); conflicto de versión sin escritura. Extender `tests/integration/book-appointment.integration.test.ts` y `tests/integration/reservation-lock.integration.test.ts` con reglas en lugar de `slot_mode`. Depende de T026 y T027.

**Ronda 1D criterio de salida**: pruebas de integración de reserva y concurrencia pasan; la forma de respuesta pública no cambia.

### Ronda 1E: servicios admin, API y pruebas de consumidores (10 tareas)

- [X] T030 [US1] Actualizar `lib/admin/months/validation.ts`: esquemas de entrada para `PUT availability` (`expectedVersion`, `rules`, `exceptions`, `confirmAffectedAppointments`), para `preview` y para `PATCH slot-mode` (`expectedVersion` y `confirmAffectedAppointments` opcionales, A-01 con default técnico D51). Validación delegada a `lib/availability/rules-validation.ts`. Depende de T010.
- [X] T031 [US1] Actualizar `lib/admin/months/service.ts`: `getAvailabilityForMonth`, `previewAvailability`, `saveAvailability` (en transacción: mes no pasado D36, versión PD-07, normalización, citas afectadas PD-06, escritura, derivación de `slot_mode`, versión + 1), `updateAdminMonthSlotMode` (preset que reemplaza reglas y conserva excepciones, D16, D33) y `createAdminMonths` sin reglas (D17). No escribe en `appointment_logs` (D24). Depende de T003, T011, T012 y T030.
- [X] T032 [US1] Actualizar `lib/admin/appointments/service.ts` y `lib/admin/appointments/validation.ts`: agendado y reprogramación admin con resolvedor (regla vigente, sin `isWeekdayBookingDate`); `getAdminDayAgenda` acepta `excludeAppointmentId` y devuelve `availableSlots` (PD-09, A-07); `timeSlot` `HH:mm`. Depende de T003, T009 y T030.
- [X] T033 [US1] Actualizar `lib/admin/blocked-spaces/service.ts`, `validation.ts` y `types.ts`: horarios bloqueables desde el resolvedor (`getAdminBlockableSlots`); creación con `DATE_NOT_OPERATIONAL` cuando el día no tiene horarios; `durationHours = 1` para bloqueos puntuales en todos los meses (D15, D30, PD-10); quitar `BASE_TIME_SLOTS` de los tipos. Mantener `FULL_DAY_BLOCK_TIME_SLOT` (`"00:00"`). Depende de T009 y T020.
- [X] T034 [US1] Actualizar `lib/calendar/sync-blocked-slot.ts`: la rama de `syncBlockedSlotUpdate` que crea un evento nuevo (sin `googleEventId`) pasa `durationHours = 1` para horarios puntuales (R-15). Crear o actualizar `tests/lib/calendar/sync-blocked-slot.test.ts` con mock de Google Calendar: puntual 1 h, día completo `06:00-23:00`, evento existente solo cambia resumen (D30). Depende de T033.
- [X] T035 [US1] Crear `app/api/admin/months/[month]/availability/route.ts` (GET y PUT) y `app/api/admin/months/[month]/availability/preview/route.ts` (POST): rutas delgadas que validan sesión, llaman a `lib/admin/months/service.ts` y mapean estados (`contracts/admin-availability-api.md`). Depende de T031.
- [X] T036 [US1] Actualizar rutas existentes: `app/api/admin/months/[month]/slot-mode/route.ts` (`expectedVersion` y `confirmAffectedAppointments` opcionales, 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`, respuesta con `availabilityVersion`); `app/api/admin/months/[month]/route.ts` (GET con campos aditivos `rules`, `exceptions`, `availabilityVersion`, `usesDefaultRule`); `app/api/admin/months/[month]/days/[date]/agenda/route.ts` (`excludeAppointmentId` y `availableSlots`); `app/api/admin/months/[month]/blockable-slots/route.ts` (resolvedor). Verificar `app/api/admin/months/route.ts` (POST sin reglas). Depende de T031, T032 y T033.
- [X] T037 [US1] Crear `tests/app/api-admin-month-availability-route.test.ts` (GET, PUT, preview; estados 404, 409, 422 y 400 con códigos estables) y actualizar `tests/app/api-admin-month-slot-mode-route.test.ts`, `api-admin-month-detail-route.test.ts`, `api-admin-day-agenda-route.test.ts`, `api-admin-blockable-slots-route.test.ts` y `api-admin-months-route.test.ts` (POST sin reglas, `BLOCK_MODE`). Depende de T035 y T036.
- [X] T038 [US1] Actualizar pruebas de servicios de consumidores (parte A): `tests/lib/availability/service.test.ts`, `tests/lib/availability/month-slot-mode.test.ts`, `tests/lib/admin/months.service.test.ts`, `tests/lib/admin/months.validation.test.ts`, `tests/lib/admin/appointments.service.test.ts` y `tests/lib/admin/blocked-spaces.service.test.ts`: quitar `slot_mode`, `isWeekdayBookingDate` y constantes de pares como fuente de horarios. Depende de T024 a T033.
- [X] T039 [US1] Actualizar pruebas de servicios de consumidores (parte B): `tests/lib/my-appointments.service.test.ts`, `tests/lib/appointments/book-appointment.test.ts`, `tests/lib/appointments/lock-reservation-slot.test.ts` y `tests/app/admin-month-detail-page.test.tsx`: reglas en lugar de `slot_mode`; error `SLOT_NOT_AVAILABLE` para día sin horarios (D46). Depende de T026 a T028 y T019.

**Ronda 1E criterio de salida**: `npm test` de los archivos actualizados pasa; `npm run test:integration` pasa; `npx tsc --noEmit` sin errores nuevos.

**Cierre de Fase 1**: T075 (conciliación documental) se ejecuta antes del release combinado.

## Phase 2: UI/UX (AGENTS Fase 2, medium risk)

Objetivo: editor de reglas y excepciones en el detalle mensual, diálogo de citas afectadas, cambios de bloqueos y calendario. Criterio de salida: el admin define las reglas de diciembre 2026 sin salir de `/admin/months/[month]` (SC-005); el diálogo lista citas afectadas antes de guardar; la UI usa `components/admin/ui/` y `sileo` + `react-i18next` (FR-038, FR-039).

### Ronda 2A: editor (7 tareas)

- [X] T040 [US1] Actualizar `lib/admin/months/api-client.ts`: `fetchAdminMonthAvailability`, `previewAdminMonthAvailability`, `saveAdminMonthAvailability`; `updateAdminMonthSlotMode` envía `expectedVersion` y `confirmAffectedAppointments`. Depende de T036.
- [X] T041 [P] [US1] Crear `hooks/admin/months/useAvailabilityEditor.ts`: borrador de reglas y excepciones, validación espejo con `lib/availability/rules-validation.ts` para feedback inmediato, detección de cambios sin guardar. Sin lógica de negocio en el componente (AGENTS, reglas de hooks).
- [X] T042 [US1] Crear `hooks/admin/months/useAvailabilitySave.ts`: preview, apertura del diálogo cuando hay citas afectadas, guardado con `sileo.promise` (carga, éxito y error con descripción por código), manejo de `AVAILABILITY_VERSION_CONFLICT` con mensaje para recargar. Depende de T040 y T041.
- [X] T043 [US1] Crear `components/admin/months/availability/AvailabilityRuleForm.tsx`: rango de fechas dentro del mes, selector de días ISO (1 a 7), horas con el componente de T045, `minGapMinutes` (0 a 1440), `preserveCapacity` (`Switch`), `maxPerDay` (`Select` de 1 a 6). Usa `components/admin/ui/Input`, `Select`, `Switch`, `Button`.
- [X] T044 [US2] Crear `components/admin/months/availability/AvailabilityExceptionForm.tsx`: fecha dentro del mes, horas con el componente de T045 (lista vacía = día cerrado, aviso visible), tres parámetros propios con valores por defecto 240, true, 3 (D10, A2).
- [X] T045 [P] [US1] Crear `components/admin/ui/TimeSlotChipInput.tsx`: alta y baja de horas `HH:mm` como chips, orden y sin repetidos. Es reutilizable (reglas y excepciones), por lo que cumple la regla de promoción de AGENTS; se documenta en `docs/ui/admin/components.md` (T076).
- [X] T046 [US1] Crear `components/admin/months/availability/AvailabilityEditorModal.tsx`: lista de reglas y excepciones, aviso cuando `usesDefaultRule` es verdadero (D6), botones de guardar y cancelar, confirmación al cerrar con cambios sin guardar. Sobre `components/admin/ui/Modal` o `BottomSheetModal`, `Button`, `Card`, `ListItem`. Depende de T043, T044 y T042.

**Ronda 2A criterio de salida**: componentes sin errores de render en las pruebas de T054; `npm run lint:admin-i18n` sin errores en los archivos nuevos.

### Ronda 2B: diálogo, detalle, bloqueos, textos y pruebas (10 tareas)

- [X] T047 [US1] Crear `components/admin/months/availability/AffectedAppointmentsDialog.tsx`: listado de citas afectadas (fecha, hora, estado, cliente), acciones confirmar y cancelar, sobre `components/admin/ui/Modal`. No es una notificación `sileo` (FR-023, D18). Depende de T046.
- [X] T048 [US1] Actualizar `components/admin/months/MonthDetailView.tsx`: quitar el botón, el estado (`slotModeDraft`, `isSlotModeModalOpen`), `handleUpdateMonthSlotMode` y el modal inline de `Modalidad`; añadir el botón `Reglas` que abre `AvailabilityEditorModal` con el diálogo de T047. Mover la lógica nueva a hooks (AGENTS, reglas de hooks). Depende de T046 y T047.
- [X] T049 [US1] Actualizar `components/admin/months/MonthDetailView.tsx`: quitar `monthBaseSlots` (`resolveBaseSlotsByMonthMode`) y el cálculo de horarios de reagendado en navegador (`loadAvailableSlots`); usar `availableSlots` de la agenda diaria (T036). Depende de T048.
- [X] T050 [US1] Actualizar `components/admin/months/MonthDetailView.tsx`: tono `closed` en `resolveTone` y en `switch (day.tone)` (D13, D34); quitar `allowBlockView` al renderizar `BlockSpacesModal`. Depende de T049.
- [X] T051 [P] [US1] Actualizar `components/admin/months/BlockSpacesModal.tsx` y `hooks/admin/months/useBlockSpacesModal.ts`: quitar la vista "Por bloque" (D14); horarios desde `blockable-slots`; quitar `BASE_TIME_SLOTS` del tipo `TimeSlot`.
- [X] T052 [P] [US1] Actualizar `components/admin/months/BookAppointmentModal.tsx` y `hooks/admin/months/useBookAppointmentModal.ts`: horarios de la agenda del día (resolvedor); quitar `BASE_TIME_SLOTS` y `BaseTimeSlot`.
- [X] T053 [P] [US1] Actualizar `locales/es/admin.json` y `locales/en/admin.json`: claves `monthsDetail.availability.*` (editor, reglas, excepciones, parámetros, diálogo de afectadas, errores por código `AVAILABILITY_*` y `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`, conflicto de versión, avisos de día cerrado y mes sin reglas). Las claves de `Modalidad` se retiran en T073.
- [X] T054 [US1] Crear `tests/components/admin/months/availability-editor.test.tsx` (renderiza reglas y excepciones, validación espejo, lista vacía cierra el día) y `tests/components/admin/months/availability-affected-dialog.test.tsx` (listado de afectadas, cancelar no escribe, confirmar envía la confirmación). Depende de T046 y T047.
- [X] T055 [US1] Actualizar `tests/components/admin/months/month-detail-view.test.tsx` (sin "Modalidad", con "Reglas", tono `closed`, horarios de reagendado desde la agenda) y las pruebas de `BlockSpacesModal` (sin "Por bloque"). Depende de T048 a T052.
- [X] T056 [US1] Verificar que `components/booking/booking-confirm-step.tsx`, `booking-pending-confirmation-step.tsx` y `booking-success-step.tsx` solo usan `"09:00"` como valor por defecto de etiqueta, no como lista de horarios; ejecutar `npm run lint` y `npm run lint:admin-i18n` en los archivos tocados y corregir errores. Depende de T048 a T055.

**Ronda 2B criterio de salida**: `npm test -- tests/components/admin/months` pasa; `npm run lint:admin-i18n` sin errores; Admin UI Check y Notification Contract Check cumplidos.

**Cierre de Fase 2**: T076 (conciliación documental) se ejecuta antes del release combinado.

## Phase 3: Tests and rollout (AGENTS Fase 3, medium-high risk)

Objetivo: cerrar la verificación de equivalencia, los escenarios de referencia, el rendimiento y los flujos E2E; preparar el release combinado. Criterio de salida: SC-001 a SC-007 verificados según sus medios; quickstart S-01 a S-15 ejecutados en staging.

### Ronda 3A: pruebas de dominio y consistencia (4 tareas)

- [X] T057 [US3] Completar `tests/lib/availability/equivalence-legacy.test.ts` con el gate de bloqueos manuales: 48 de 432 combinaciones difieren del legado (D43); la prueba fija la constante 48 y pasa en verde. El 27 de D2 salió de una variante con pares y queda solo como nota histórica en `research.md` (R-02). Depende de T015.
- [X] T058 [US4] Crear `tests/lib/availability/reference-months.test.ts`: escenarios completos de US4 1 y 2 (diciembre 2026: 67 espacios, días cerrados; enero 2027: 63 espacios, sábados 16 y 23 abiertos, lunes 18 y 25 cerrados, sábados 2, 9, 30 y domingos cerrados) con SC-001 y SC-007. Depende de T009.
- [X] T059 [P] [US3] Crear `tests/lib/availability/performance.test.ts`: un mes completo de 31 días, 24 horas por día y `maxPerDay` 6 en el peor caso se resuelve en menos de 200 ms en CI (plan, *Performance Goals*). Depende de T009.
- [X] T060 [US3] Crear `tests/integration/availability-public-consistency.integration.test.ts` (MySQL): para un mes de muestra con reglas y excepciones, `getMonthAvailability` coincide con `resolveDay` día por día (SC-002 sobre datos reales de muestra). **D32**: un cambio de reglas aplicado por el editor se refleja en la siguiente lectura pública, sin publicación ni borrador. **D42**: crear la primera regla de un mes sin reglas cierra los días no cubiertos en la lectura pública. Depende de T024 y T058.

**Ronda 3A criterio de salida**: T058, T059 y T060 pasan; T057 pasa con la constante 48.

### Ronda 3B: E2E y ejecución de quickstart (3 tareas)

- [ ] T061 [P] [US1] Crear `tests/e2e/admin-month-availability.spec.ts` (Playwright): crear reglas de diciembre 2026, ver diálogo con citas afectadas, cancelar sin cambios, confirmar, conflicto de versión (quickstart S-06, S-07). Depende de T054.
- [ ] T062 [P] [US3] Actualizar `tests/e2e/booking.spec.ts`: el flujo público muestra y acepta horarios del resolvedor en un mes con reglas que incluyen 07:30 y 14:30 (quickstart S-09). Depende de T024 y T025.
- [ ] T063 [US1] Ejecutar `quickstart.md` escenarios S-01 a S-15 en un entorno de staging, con la migración `0022` aplicada desde una copia de la base. Registrar resultados (verificación automatizada y manual por separado) en `specs/003-flexible-month-availability/agent-reports/05-validation.md`. Depende de T059, T060, T061 y T062.

**Ronda 3B criterio de salida**: S-01 a S-15 ejecutados; cualquier fallo se corrige antes del release combinado.

**Verificación de Fase 3**: T077 (verificación cruzada de documentación) se ejecuta antes del release combinado.

## Phase 4: Technical cleanup (AGENTS Fase 4, high risk, owner authorization)

Objetivo: retirar el código legado, las constantes de pares, la constante 3 y la lectura de `slot_mode`; después eliminar la columna y el campo `slotMode` de las respuestas. Criterio de salida: SC-006 (sin referencias a `isWeekdayBookingDate` ni a `resolveBaseSlotsByMonthMode`), reconciliación documental final.

### Ronda 4A: retirar código legado (5 tareas)

- [ ] T064 [US1] Eliminar `lib/availability/rules.ts` y `tests/lib/availability/rules.test.ts` después de confirmar con T067 que no hay importaciones. El oráculo congelado (T013) se conserva como fixture de prueba.
- [ ] T065 [US1] Actualizar `lib/availability/month-slot-mode.ts`: quitar `resolveBaseSlotsByMonthMode` y `SECOND_ONLY_BASE_TIME_SLOTS`; mantener solo el tipo `MonthSlotMode` mientras la columna exista (T069).
- [ ] T066 [US1] Actualizar `lib/constants/slots.ts`: quitar `DIRECTIONAL_SLOT_PAIRS` y `MAX_APPOINTMENTS_PER_DAY`, y `BASE_TIME_SLOTS` si ya no tiene usos. Solo borrado de constantes: el cambio del dashboard ya está en T022 (D53). Depende de T019, T020, T022 y T064.
- [ ] T067 [P] [US1] Verificar SC-006: `grep` en `app`, `lib`, `components` y `hooks` de `isWeekdayBookingDate`, `resolveBaseSlotsByMonthMode`, `DIRECTIONAL_SLOT_PAIRS` y `MAX_APPOINTMENTS_PER_DAY`. Sin resultados en código de aplicación; las pruebas pueden referirse al oráculo. Depende de T064 y T066.
- [ ] T068 [P] [US1] Retirar de las pruebas los casos que dependen de pares direccionales o de `slot_mode` como fuente de horarios (ya reemplazados en T038 y T039): revisar `tests/lib/availability/` y `tests/lib/admin/`.

**Ronda 4A criterio de salida**: `npm test` y `npm run test:integration` pasan sin los archivos legados; T067 sin coincidencias.

### Ronda 4B: eliminar `slot_mode` y `slotMode` de las respuestas (6 tareas, requiere Gate 4)

Pendiente de la autorización de Gate 4 del owner. D49 ya decide retirar `slotMode` de las respuestas de la API, sin alias.

- [ ] T069 [US1] Crear `prisma/migrations/0023_drop_active_months_slot_mode/migration.sql` que elimine `active_months.slot_mode` (y, si el owner lo decide, `availability_migration_runs`). Verificar antes que ningún proceso de la versión anterior esté activo. Depende de T067 y de Gate 4.
- [ ] T070 [US1] Eliminar `slotMode` y el enum `MonthSlotMode` de `prisma/schema.prisma`. Depende de T069.
- [ ] T071 [US1] Eliminar el mapeo de `slotMode` en `lib/db/admin-months.ts` y `lib/db/active-months.ts`, y dejar de escribir la columna en las escrituras de disponibilidad (`lib/admin/months/service.ts`). Depende de T070.
- [ ] T072 [US1] Retirar `slotMode` de las respuestas de la API (D49, sin alias): `lib/admin/months/types.ts`, `lib/admin/months/service.ts`, `app/api/admin/months/[month]/route.ts` (GET) y `app/api/admin/months/[month]/slot-mode/route.ts` (respuesta `{ month, availabilityVersion }`). `PATCH slot-mode` conserva su ruta y su cuerpo de entrada (selector de preset, RQ-1). Depende de T071.
- [ ] T073 [US1] Eliminar `lib/availability/month-slot-mode.ts` y las claves de locales de `Modalidad` en `locales/es/admin.json` y `locales/en/admin.json`. Depende de T065 y T070.
- [ ] T074 [US1] Actualizar pruebas de integración y API que leen `slotMode` en respuestas (`tests/integration/*`, `tests/app/api-admin-month-slot-mode-route.test.ts`, `api-admin-month-detail-route.test.ts`) para reflejar el contrato final de T072. Depende de T072.

**Ronda 4B criterio de salida**: migración `0023` aplicada en staging; pruebas completas en verde; ninguna referencia a `slot_mode` ni a `slotMode` en respuestas de código de aplicación.

**Cierre de Fase 4**: T078 (conciliación documental final) se ejecuta al cerrar la ronda 4B.

## Cierre documental por fase (D52)

Calendario de conciliación: `docs/specification.md` y `docs/architecture/business-rules.md` al cierre de Fase 1; features y `docs/ui/admin/components.md` al cierre de Fase 2; verificación cruzada al cierre de Fase 3, antes del release combinado de Fases 1 y 2 (D45). Las tareas no llevan etiqueta de historia.

- [X] T075 Cierre de Fase 1: crear `docs/architecture/data-model.md` (tablas, derivación de `slot_mode`, backfill, bitácora de esquema; D7); actualizar `docs/architecture/api.md` (endpoints de disponibilidad, `GET` aditivo, `PATCH slot-mode`, `POST /api/admin/months`); actualizar `docs/specification.md` (4.1 días válidos, 4.2 horarios base, 4.3 reglas de disponibilidad, 7 flujo de reserva, 10 modelo de datos, 12 invariantes 4 y 6, 15.7 catálogo de meses, edge "Mismo día" con D50); actualizar `docs/architecture/business-rules.md` (*Operating calendar*, *Slot pair model*, *Daily capacity model*, *Admin Month Detail Rules*, *Availability Rules*, *Validation Rules*, *Edge Cases*, *Invariants*, y la redacción de la reprogramación pública hacia el resolvedor); crear `docs/decisions/` con ADR de reemplazo de pares (D1), diferencias con bloqueos (D2 superada por D43: 48 de 432), duración de 1 h para bloqueos puntuales (D15, D29, D30), derivación de `slot_mode` (D19, D31) y dashboard (D44, D53). Depende de T039.
- [X] T076 Cierre de Fase 2: actualizar `docs/ui/admin/components.md` (`MonthSlotModeModal` pasa a editor de reglas; `BlockSpacesModal` sin vista "Por bloque"; `AffectedAppointmentsDialog`; `TimeSlotChipInput` como reutilizable; `AvailabilityEditorModal`) y los features afectados: `docs/features/admin-month-detail-flow.md` (pasos 7-8 Modalidad → Reglas; paso 18 Bloquear espacios con D41; reglas de cálculo; flujos alternos con diálogo D18 y exclusión de bloqueos D40), `docs/features/booking-flow.md` (horarios válidos, `SLOT_NOT_AVAILABLE` según D46), `docs/features/my-appointments-flow.md` (destino de reprogramación con el resolvedor) y `docs/features/admin-months-catalog-flow.md` (creación sin reglas, D17, D31). Depende de T056 y T075.
- [X] T077 Verificación de Fase 3: revisar `docs/specification.md`, `docs/architecture/business-rules.md`, `docs/features/*`, `docs/architecture/api.md` y `docs/ui/admin/components.md` contra la implementación y las pruebas de Fases 1 a 3; corregir las desalineaciones antes del release combinado (D45, D52). Registrar en el informe de la fase los bloques *Flow Contract Check*, *Migration Compatibility Check*, *Admin UI Check*, *Notification Contract Check* y *Documentation Impact* con Yes/No. Depende de T063 y T076.
- [ ] T078 Cierre de Fase 4: eliminar referencias restantes a `slot_mode`, `slotMode` en respuestas, pares y Modalidad en `docs/`; completar la bitácora de `data-model.md` con `0023`; cerrar los ADR en `docs/decisions/`; y actualizar la fila 003 de `specs/README.md` a `Implemented` solo después de la implementación. Depende de T072 y T073.

## Acciones del Orquestador (no son tareas de agente)

- Actualizar `data_model_doc` en `docs/standards/subagent-workflow.profile.md` a `docs/architecture/data-model.md` después de T075 (Q-T3).
- Corregir `{{test_commands}}` en el perfil (Q-T1): `CLAUDE.md` no tiene sección "Commands"; los comandos están en `package.json`.
- Confirmar RQ-3 (D52 frente a AGENTS, "antes de implementar") antes de Gate 3.
- Confirmar RQ-1 y RQ-2 antes de Gate 3.
- Autorizar Gate 4 para la ronda 4B por separado.
- Actualizar `STATE.md` antes de cada gate.

## Dependencies & Execution Order

- Fase 1 se ejecuta en cinco rondas en orden (1A → 1E). Dentro de cada ronda, las tareas [P] pueden ir en paralelo si no comparten archivo. T022 (dashboard) sigue a T009 (resolvedor), y T066 (borrado de constantes, Fase 4) sigue a T022 y T064.
- Fase 2 empieza tras 1E (T040 necesita las rutas de T035 y T036).
- Fase 3 empieza tras 2B (T061 necesita la UI). T057 depende de T015 y no bloquea el resto de la fase.
- Fase 4A empieza tras 3B; 4B empieza solo tras Gate 4.

### Parallel Opportunities

- Ronda 1B: T006 primero; después T010, T011, T012 y T013 en paralelo.
- Ronda 1C: T016, T017 y T018 en paralelo; T022 en paralelo con T019 y T020.
- Ronda 1D: T025 en paralelo con T024.
- Ronda 2A: T041 y T045 en paralelo.
- Ronda 2B: T051, T052 y T053 en paralelo.
- Ronda 3A: T059 en paralelo con T058.
- Ronda 3B: T061 y T062 en paralelo.

## Implementation Strategy

- **MVP sugerido**: Fase 1 completa (rondas 1A a 1E) y Fase 2 (rondas 2A y 2B). El backend sin UI no ofrece el editor; la UI sin backend no funciona.
- **Entrega incremental**: cada ronda cierra con sus criterios de salida y su informe del Developer; `reviewer-high-risk` revisa las rondas 1A, 1D, 4A y 4B.
- **Release combinado (D45)**: fases 1 y 2 salen juntas tras T075, T076 y T077. No hay bandera de configuración.

## Task count

| Fase | Rondas | Tareas |
|---|---|---|
| Phase 1 (backend y migraciones, alto riesgo; incluye dashboard, D53) | 1A (5), 1B (10), 1C (8), 1D (6), 1E (10) | 39 (T001 a T039) |
| Phase 2 (UI/UX) | 2A (7), 2B (10) | 17 (T040 a T056) |
| Phase 3 (pruebas y rollout) | 3A (4), 3B (3) | 7 (T057 a T063) |
| Phase 4 (cleanup, alto riesgo) | 4A (5), 4B (6, Gate 4) | 11 (T064 a T074) |
| Cierre documental por fase (D52) | 1 por fase + verificación | 4 (T075 a T078) |
| **Total** | | **78** |

## Open decisions

- RQ-1 (D49): el cuerpo de entrada de `PATCH slot-mode` conserva `slotMode` como selector de preset en Fase 4 (T072). Confirmar en Gate 3.
- RQ-2 (D45): `PATCH slot-mode` responde 409 sin confirmación cuando hay citas afectadas (T036). Confirmar en Gate 3.
- RQ-3 (D52): la conciliación de `docs/` por fases cumple AGENTS (actualizar antes de implementar). Confirmar en Gate 3.
- Q-T1 a Q-T5: ítems técnicos de Gate 3 (perfil, MySQL, `data_model_doc`, `docs/decisions/`, AGENTS.md).
- D51: defaults técnicos A-01, A-02, A-05, A-07, A-09, A-10 y A-11 marcados [ASSUMPTION], para revisar en Gate 3.
