# Slot Rules by Mode (BLOCK vs SECOND_ONLY) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Alinear código y documentación para que `BLOCK_MODE` mantenga regla direccional por pares, y `SECOND_ONLY_MODE` opere sin propagación direccional (citas + bloqueos manuales), con consistencia entre flujo público, admin y vista mensual.

**Architecture:** Se consolidará la lógica de disponibilidad por modalidad en el núcleo de `availability`, y todos los flujos (público lock/confirm, admin agendar/reagendar, blockable slots y métricas por día del detalle mensual) consumirán la misma semántica. Se evitarán forks de reglas por módulo. La documentación contractual (`specification`, `business-rules`, `features`) se actualizará en paralelo para cerrar desviaciones.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/MySQL, Vitest, Playwright, react-i18next.

---

## Fase 1: Requerimientos

1. **Regla funcional objetivo (cerrada)**
- `BLOCK_MODE`: conserva pares oficiales, máximo 3 activas/día, máximo 1 activa por par, y propagación direccional entre pares.
- `SECOND_ONLY_MODE`: slots oficiales `10:00,14:00,18:00`, máximo 3 activas/día, máximo 1 activa por slot, sin propagación direccional entre slots.
- En `SECOND_ONLY_MODE`, bloqueo manual también es por slot individual, sin propagación entre pares.
- Slot candidato válido: no ocupado por cita activa, no lock activo de otro teléfono, no bloqueado manualmente, no pasado (same-day), y dentro de slots permitidos por modalidad.

2. **Gap analysis confirmado**
- Documentación actual no modela explícitamente “sin propagación” para `SECOND_ONLY_MODE`.
- Código actual aplica propagación direccional también en `SECOND_ONLY_MODE` (disponibilidad y bloqueos manuales).
- Flujo público lock/confirm no aplica `blocked_slots` en todas sus validaciones transaccionales.
- Vista mensual admin usa cálculo agregado (`3 - ocupados - bloqueados`) que puede divergir de la disponibilidad real por slot.

3. **Criterios de éxito**
- Mismo día/caso produce mismo resultado en:
  - `/api/availability/[month]`,
  - `POST /api/reservar/client-check-lock`,
  - `POST /api/reservar/confirm`,
  - `POST /api/admin/months/[month]/appointments`,
  - `PATCH /api/admin/appointments/[id]/reschedule`,
  - `GET /api/admin/months/[month]/blockable-slots`,
  - `GET /api/admin/months/[month]` (`calendarDays.availableSpaces`/`tone`).
- Documentación alineada y sin contradicciones entre `specification`, `business-rules` y `features`.

## Fase 2: Diseño

1. **Diseño de reglas por modalidad**
- Extender núcleo de disponibilidad para que la evaluación reciba `slotMode`.
- Reglas de compatibilidad:
  - `BLOCK_MODE`: reglas actuales (ocupación direccional + propagación de bloqueos manuales por par).
  - `SECOND_ONLY_MODE`: desactivar propagación direccional (ocupación y bloqueos manuales); conservar exclusión exacta por slot.
- Mantener límites:
  - Base slots derivados por `slotMode`.
  - Validación same-day contra hora actual.
  - full-day block (`00:00`) mantiene día no disponible.

2. **Diseño de reutilización (single source of truth)**
- Reusar el mismo evaluador para:
  - disponibilidad pública por mes,
  - blockable slots admin,
  - validación de create/reschedule admin,
  - validación de lock/confirm público,
  - cálculo diario del detalle mensual.
- Evitar cálculos paralelos que no pasen por el evaluador.

3. **Diseño de detalle mensual admin**
- `calendarDays.availableSpaces` debe derivarse de conteo real de slots elegibles por día según `slotMode` y reglas completas, no solo de fórmula agregada.
- Mantener métricas agregadas (`occupiedSpaces`, `blockedSpaces`) para KPIs, pero separar semántica visual diaria de disponibilidad real.

4. **Contratos/API afectados**
- No se agregan endpoints nuevos.
- No se cambian payloads de request/response.
- Cambia comportamiento de disponibilidad y conflictos (`SLOT_NOT_AVAILABLE`) en escenarios `SECOND_ONLY_MODE`.

5. **Riesgo/control**
- Riesgo principal: regresión en `BLOCK_MODE`.
- Mitigación: tests de matriz por modalidad (unit + integración + UI contract tests).

## Fase 3: Lista de tareas (bite-sized, TDD)

### Task 1: Tests de reglas núcleo por modalidad
**Files**
- Modify test: `tests/lib/availability/rules.test.ts`
- (si aplica) Modify source: `lib/availability/rules.ts`

### Task 2: Disponibilidad pública por mes y bloqueo admin consumen regla nueva
**Files**
- Modify source: `lib/availability/service.ts`, `lib/admin/blocked-spaces/service.ts`
- Modify tests: `tests/lib/availability/service.test.ts`, `tests/lib/admin/blocked-spaces.service.test.ts`

### Task 3: Flujo público lock/confirm aplica también blocked slots
**Files**
- Modify source: `lib/appointments/lock-reservation-slot.ts`, `lib/appointments/book-appointment.ts`
- Modify tests: `tests/lib/appointments/lock-reservation-slot.test.ts`, `tests/lib/appointments/book-appointment.test.ts`

### Task 4: Admin agendar/reagendar + detalle mensual consistentes
**Files**
- Modify source: `lib/admin/appointments/service.ts`, `lib/admin/months/detail-service.ts`
- Modify tests: `tests/lib/admin/appointments.service.test.ts`, `tests/lib/admin/months.detail-service.test.ts`
- Modify UI contract tests: `tests/components/admin/months/month-detail-view.test.tsx`

### Task 5: Documentación contractual
**Files**
- Modify docs: `docs/specification.md`
- Modify docs: `docs/architecture/business-rules.md`
- Modify docs: `docs/features/booking-flow.md`
- Modify docs: `docs/features/admin-month-detail-flow.md`

### Task 6: Validación final integral
- Ejecutar suite de pruebas focales por disponibilidad, reservas y admin month detail.

## Fase 4: Desarrollo (orden de implementación)

1. Implementar primero núcleo de reglas (`availability/rules`) y fijar matriz modal.
2. Propagar consumo de regla a disponibilidad pública/admin (`availability/service`, `blocked-spaces/service`).
3. Corregir transaccionales de booking público (`lock-reservation-slot`, `book-appointment`) para incluir bloqueos manuales.
4. Ajustar admin create/reschedule y cálculo diario de month detail.
5. Ajustar pruebas de componente de detalle mensual solo después de estabilizar services.
6. Actualizar documentación al final de cada bloque funcional, no al final del todo.

## Fase 5: Pruebas

1. **Unitarias críticas**
- Reglas por modalidad (`rules.test.ts`).
- Disponibilidad mensual (`availability/service.test.ts`).
- Lock/confirm público (`lock-reservation-slot.test.ts`, `book-appointment.test.ts`).
- Bloqueos admin y agenda (`blocked-spaces.service.test.ts`, `appointments.service.test.ts`).
- Month detail (`months.detail-service.test.ts`).

2. **Contrato API**
- Rutas públicas y admin devuelven `409 SLOT_NOT_AVAILABLE` en conflictos correctos sin cambiar shape de payload.

3. **UI/Flujo**
- `month-detail-view.test.tsx`: semáforo y lista de días/slots coherentes con reglas reales.
- E2E booking + admin month detail para escenarios de regresión.

## Fase 6: Despliegue

1. **Rollout**
- Deploy único (sin feature flag) por no cambio de esquema ni contrato externo.
- Ejecutar smoke post-deploy en un mes `SECOND_ONLY_MODE` y otro `BLOCK_MODE`.

2. **Verificación operativa**
- Crear caso real en staging:
  - `SECOND_ONLY_MODE`, día con `18:00` ocupado + `14:00` bloqueado.
  - Confirmar `10:00` visible y agendable en público y admin.

## Documentation Impact

- **Sí** hay impacto documental.
- `docs/specification.md`: secciones de disponibilidad por modalidad, bloqueo manual y detalle mensual.
- `docs/architecture/business-rules.md`: `Availability Rules` y `Admin blocked-slots policy`.
- `docs/features/booking-flow.md`: validaciones efectivas en lock/confirm.
- `docs/features/admin-month-detail-flow.md`: cálculo visual de disponibilidad diaria y reglas por modalidad.

## Flow Contract Check (objetivo al cierre)

- UI steps updated: **Yes**
- API contract updated: **No** (shape), **Yes** (behavior semantics)
- Validation rules updated: **Yes**
- Acceptance criteria updated: **Yes**
- docs/specification.md aligned: **Yes**

## Migration Compatibility Check

- Schema changes required: **No**
- Data backfill required: **No**
- Legacy compatibility required: **No**
- Rollback strategy defined: **Yes** (rollback de release)
- Cleanup phase defined: **Yes**
- Integrity protections defined: **Yes**
