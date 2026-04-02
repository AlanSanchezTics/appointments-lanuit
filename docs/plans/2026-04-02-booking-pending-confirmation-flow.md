# Booking Público con Confirmación Diferida (PENDING) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introducir confirmación diferida para clientas no fieles: crear cita `PENDING`, mostrar CTA de envío de comprobante por WhatsApp y habilitar gestión admin (`CONFIRMED`/`REJECTED`) con auto-rechazo a 36 horas.

**Architecture:** El estado de cita evoluciona de un modelo de 3 estados a uno de 5 (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `SYNC_FAILED`). El flujo público decide el estado inicial por lealtad de cliente (`clients.is_loyal`), y el dashboard admin añade un bloque operativo de pendientes con acciones explícitas de transición. El auto-rechazo se implementa como proceso de mantenimiento programable, idempotente y seguro para rollback.

**Tech Stack:** Next.js App Router, Prisma + MySQL, React 19 hooks, react-i18next, Vitest/RTL/E2E, scripts Node para maintenance jobs.

---

## 0) Modo de ejecución (obligatorio)

**Execution Mode:** `Subagent-Driven`.

Regla de coordinación para evitar conflictos:
1. Ownership por bloques con write-set exclusivo.
2. No se permite que dos subagentes editen el mismo archivo.
3. Integración secuencial: `A -> B -> C -> D -> E`.
4. Cada bloque debe cerrar con tests del bloque + commit atómico.

## 1) Requerimientos

1. Flujo público:
- Si clienta es fiel (`clients.is_loyal=true`): comportamiento actual, cita `CONFIRMED`.
- Si clienta no fiel (`clients.is_loyal=false`): cita nueva en `PENDING`.
- En confirmación (`components/booking/booking-confirm-step.tsx`) para no fiel: mensaje de “pendiente de confirmación” con:
  - Título: `Ya estamos casi listas`
  - Descripción multilinea exacta del requerimiento
  - Botón primary: `Enviar comprobante`
  - Botón ghost: `Volver`
- Botón `Enviar comprobante` abre `wa.me` con plantilla predefinida y datos de cita.

2. Admin dashboard:
- Mostrar bloque de citas pendientes (`status=PENDING`).
- Por cita: mostrar nombre, teléfono, número de clienta, fecha/hora.
- Acciones:
  - Confirmar -> `CONFIRMED`
  - Rechazar -> `REJECTED`

3. Regla temporal:
- Citas `PENDING` sin transición manual en 36 horas -> `REJECTED` automático.

4. Consistencia contractual:
- Actualizar contratos API/UI por nuevo estado.
- Actualizar reglas de disponibilidad para excluir `PENDING` de ocupación activa (evita bloquear agenda 36h).
- Mantener `CONFIRMED`/`SYNC_FAILED` como estados activos para conflictos.

5. Documentación desalineada detectada (debe corregirse en implementación):
- `docs/specification.md` y `docs/features/booking-flow.md` hoy indican “nueva reserva = CONFIRMED”.
- `docs/architecture/business-rules.md` no contempla `PENDING` ni `REJECTED`.

## 2) Diseño

### 2.1 Modelo de estado y tipado (typescript-advanced-types)

1. Extender enum Prisma `AppointmentStatus`:
- Añadir `PENDING` y `REJECTED`.

2. Centralizar tipos de estado por dominio (evitar unions sueltas repetidas):
- Crear/ajustar utilidades de tipo para:
  - `ActiveAppointmentStatus = "CONFIRMED" | "SYNC_FAILED"`
  - `PendingReviewStatus = "PENDING"`
  - `TerminalAppointmentStatus = "REJECTED" | "CANCELLED"`
- Aplicar discriminated unions en respuestas de booking:
  - `BookingSuccessConfirmed`
  - `BookingSuccessPending`
  - `BookingSuccessSyncFailed`

3. Ajustar tipos de API/servicios/UI a unions exhaustivas (switch exhaustivo en TS).

### 2.2 Flujo público (vercel-react-best-practices)

1. Resolver `is_loyal` dentro de transacción de confirmación y decidir estado inicial:
- Existing loyal: `CONFIRMED` (con sync a calendar como hoy).
- Existing non-loyal: `PENDING` (sin crear evento de calendar todavía).
- New client (por defecto no fiel): `PENDING`.

2. Evitar waterfalls en confirmación:
- Mantener validaciones y locks en paralelo/orden óptimo (`async-parallel`, `async-defer-await`).

3. UI de confirmación:
- En vez de ir siempre a success genérico, render condicional por `success.status`.
- Para `PENDING`: card de pendiente + CTA WhatsApp con copy solicitado.

4. WhatsApp template:
- Nueva plantilla i18n para pendiente (es/en), manteniendo `encodeURIComponent`.
- Incluir formato: día semana, día, mes, año, hora.

### 2.3 Admin dashboard y acciones

1. Agregar query de pendientes al servicio dashboard.
2. Nuevo bloque reusable en `components/admin/ui/` para lista de pendientes.
3. Nuevos endpoints admin para transición de estado:
- `POST /api/admin/appointments/[appointmentId]/confirm`
- `POST /api/admin/appointments/[appointmentId]/reject`

4. Reglas backend de transición:
- Solo `PENDING -> CONFIRMED` y `PENDING -> REJECTED`.
- Rechazar transición desde otro estado (`APPOINTMENT_STATUS_INVALID_TRANSITION`).

5. Notificaciones admin:
- Usar `sileo` + `react-i18next` en feedback de acciones (si se agrega interacción client-side en bloque).

### 2.4 Auto-rechazo 36h

1. Proceso idempotente de mantenimiento:
- Script `scripts/reject-pending-appointments.mjs`.
- Criterio: `status=PENDING` y `created_at <= now - 36h`.
- Actualiza en batch a `REJECTED`.

2. Scheduling:
- Exponer comando npm (`pending:cleanup` o `appointments:reject-pending`).
- Documentar runbook con cadencia recomendada (por ejemplo cada 15 min).

## 3) Lista de tareas (Subagent-Driven con ownership por bloques)

### Bloque A — Backend core + migraciones (Owner A)

**Files (exclusive write set):**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/0012_appointments_pending_rejected/migration.sql`
- Modify: `lib/appointments/book-appointment.ts`
- Modify: `lib/booking/types.ts`
- Modify: `lib/validation/appointment.ts`
- Modify: `tests/lib/appointments/book-appointment.test.ts`
- Modify: `tests/app/api-reservar-confirm-route.test.ts`
- Modify: `tests/lib/validation/appointment.test.ts`

**Micro-steps (TDD):**
1. Escribir tests fallando para nuevo status `PENDING` en booking no fiel.
2. Ejecutar: `npm run test -- tests/lib/appointments/book-appointment.test.ts`
3. Extender schema + migración y regenerar cliente Prisma.
4. Implementar decisión de estado por lealtad en `confirmAppointmentWithLock`.
5. Ajustar contrato de respuesta API (`BookingSuccess`).
6. Re-ejecutar tests del bloque.
7. Commit del bloque.

### Bloque B — Public UI flow + WhatsApp pending copy (Owner B)

**Files (exclusive write set):**
- Modify: `components/booking/booking-confirm-step.tsx`
- Modify: `components/booking/booking-wizard.tsx`
- Modify: `components/booking/booking-success-step.tsx`
- Modify: `hooks/booking/use-booking-success.ts`
- Modify: `lib/whatsapp/message.ts`
- Modify: `locales/es/common.json`
- Modify: `locales/en/common.json`
- Modify: `tests/app/booking-confirm-step.test.tsx`
- Modify: `tests/app/booking-success-step.test.tsx`
- Modify: `tests/app/booking-wizard.test.tsx`
- Modify: `tests/lib/whatsapp/message.test.ts`

**Micro-steps (TDD):**
1. Agregar pruebas de render para mensaje `PENDING` con título/descripcion/botones exactos.
2. Agregar prueba para URL WhatsApp con plantilla “Adjunto comprobante…”.
3. Implementar ramas UI por `success.status` (pending vs confirmed).
4. Integrar nuevas keys i18n.
5. Ejecutar tests del bloque.
6. Commit del bloque.

### Bloque C — Admin dashboard pending block + acciones (Owner C)

**Files (exclusive write set):**
- Modify: `lib/admin/dashboard/types.ts`
- Modify: `lib/admin/dashboard/service.ts`
- Modify: `app/admin/page.tsx`
- Create: `components/admin/ui/PendingAppointmentsCard.tsx`
- Modify: `components/admin/ui/admin-icons.ts` (si aplica nuevo icono)
- Modify: `lib/admin/appointments/types.ts`
- Modify: `lib/admin/appointments/service.ts`
- Modify: `lib/admin/appointments/validation.ts`
- Create: `app/api/admin/appointments/[appointmentId]/confirm/route.ts`
- Create: `app/api/admin/appointments/[appointmentId]/reject/route.ts`
- Modify: `locales/es/admin.json`
- Modify: `locales/en/admin.json`
- Modify: `tests/lib/admin/dashboard.service.test.ts` (crear si no existe)
- Modify: `tests/app/admin-dashboard-page.test.tsx`
- Create: `tests/app/api-admin-confirm-route.test.ts`
- Create: `tests/app/api-admin-reject-route.test.ts`
- Modify: `tests/lib/admin/appointments.service.test.ts`

**Micro-steps (TDD):**
1. Crear tests de servicio dashboard para listado `PENDING`.
2. Crear tests route para confirmar/rechazar con auth y códigos de error.
3. Implementar servicios de transición de estado.
4. Implementar card reusable admin usando `components/admin/ui/`.
5. Integrar card en `app/admin/page.tsx` y textos i18n.
6. Ejecutar tests del bloque.
7. Commit del bloque.

### Bloque D — Auto-rechazo 36h + runbook (Owner D)

**Files (exclusive write set):**
- Create: `scripts/reject-pending-appointments.mjs`
- Modify: `package.json`
- Create: `lib/maintenance/reject-pending-appointments.ts`
- Create: `tests/lib/maintenance/reject-pending-appointments.test.ts`
- Create: `docs/runbooks/pending-appointments-cleanup.md`

**Micro-steps (TDD):**
1. Test unitario de maintenance para cutoff de 36h e idempotencia.
2. Implementar helper en `lib/maintenance`.
3. Implementar script `.mjs` batch-safe.
4. Exponer script npm.
5. Documentar operación, monitoreo y rollback.
6. Ejecutar tests del bloque.
7. Commit del bloque.

### Bloque E — Documentación contractual y cierre (Owner E)

**Files (exclusive write set):**
- Modify: `docs/specification.md`
- Modify: `docs/architecture/business-rules.md`
- Modify: `docs/features/booking-flow.md`
- Modify: `docs/features/admin-month-detail-flow.md` (si el bloque de pendientes se relaciona con detalle operativo)
- Modify: `docs/ui/admin/components.md` (registrar nuevo `PendingAppointmentsCard`)
- Modify: `docs/ui/admin/design-system.md` y/o `docs/ui/admin/tokens.md` (solo si se introducen variantes nuevas)

**Micro-steps:**
1. Actualizar contrato de estados y transiciones de cita.
2. Actualizar flujo público por tipo de clienta (fiel/no fiel).
3. Actualizar contrato admin de acciones sobre pendientes.
4. Documentar regla automática de 36h.
5. Verificar alineación final código/documentación.
6. Commit del bloque.

## 4) Desarrollo

### 4.1 Fases operativas obligatorias (AGENTS)

1. **Fase 1: backend y migraciones**
- Ejecutar Bloque A + parte de D (modelo y maintenance helper).

2. **Fase 2: UI/UX flow**
- Ejecutar Bloque B (flujo público) + Bloque C (dashboard admin).

3. **Fase 3: pruebas y rollout**
- Ejecutar suites objetivo + smoke end-to-end.

4. **Fase 4: cleanup técnico**
- Consolidar tipos, remover ramas temporales, cerrar documentación (Bloque E).

### 4.2 Criterios de integración

1. No mergear un bloque con tests rojos.
2. No permitir cambios cross-block durante ejecución paralela.
3. Cada bloque debe incluir evidencia de contratos API/UI actualizados.

## 5) Pruebas

1. **Unitarias dominio booking**
- no fiel -> `PENDING`
- fiel -> `CONFIRMED`/`SYNC_FAILED`
- `PENDING` no cuenta como ocupación activa en reglas de disponibilidad

2. **API públicas**
- `POST /api/reservar/confirm` devuelve `status=PENDING` cuando corresponde
- errores de lock/validación sin regresión

3. **UI pública (RTL)**
- render de mensaje de pendiente en paso confirmación
- CTA `Enviar comprobante` genera URL WhatsApp correcta
- botón `Volver` retorna al paso anterior

4. **Admin dashboard + routes**
- bloque muestra solo `PENDING`
- confirmar cambia a `CONFIRMED`
- rechazar cambia a `REJECTED`
- transiciones inválidas devuelven error estable

5. **Maintenance**
- auto-rechazo solo a `PENDING` con antigüedad >=36h
- idempotencia en ejecución repetida

6. **Regresión**
- cancelación pública sigue exigiendo `CONFIRMED`
- month detail y agenda no rompen por nuevos estados
- pruebas de i18n admin/public sin literales hardcodeados

7. **Comandos sugeridos**
- `npm run test -- tests/lib/appointments/book-appointment.test.ts`
- `npm run test -- tests/app/api-reservar-confirm-route.test.ts`
- `npm run test -- tests/app/booking-confirm-step.test.tsx tests/app/booking-success-step.test.tsx`
- `npm run test -- tests/lib/admin/appointments.service.test.ts tests/app/admin-dashboard-page.test.tsx`
- `npm run test -- tests/lib/maintenance/reject-pending-appointments.test.ts`
- `npm run test`
- `npm run test:e2e -- tests/e2e/booking.spec.ts`

## 6) Despliegue

1. Ejecutar migraciones Prisma en entorno de staging.
2. Desplegar backend + frontend con feature completo.
3. Configurar scheduler para script de auto-rechazo (36h).
4. Smoke checks:
- reserva clienta fiel -> confirmada
- reserva clienta no fiel -> pendiente + CTA WhatsApp
- admin confirma/rechaza pendiente
- pendiente expirada auto-rechazada por job
5. Monitorear:
- conteo de `PENDING` abiertos >36h
- tasa de transición manual (`CONFIRMED`/`REJECTED`)
- errores de rutas admin nuevas
6. Rollback:
- si falla UI admin, desactivar card sin revertir schema
- si falla job, pausar scheduler (datos quedan consistentes)

## Documentation Impact

- **Sí requiere cambios.**
- `docs/specification.md`: flujo de reserva por lealtad, estados, validaciones, contrato de confirmación y auto-rechazo 36h.
- `docs/architecture/business-rules.md`: state model (`PENDING`/`REJECTED`), transiciones permitidas, invariantes de ocupación activa.
- `docs/features/booking-flow.md`: paso de confirmación para no fiel con WhatsApp de comprobante.
- `docs/ui/admin/components.md`: nuevo bloque reusable `PendingAppointmentsCard`.
- Momento: durante implementación (Bloque E) y verificación final antes de cierre.
- Ambigüedad detectada a cerrar en requerimientos: para clienta nueva (aún no fiel), se asume `PENDING` por default.

Flow Contract Check:
- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: Yes
- Data backfill required: No
- Legacy compatibility required: Yes
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes

## Code Impact

- Alto: modelo de estado de citas + booking confirmation + dashboard admin + maintenance job.

## Data Impact

- Medio: extensión de enum de estado + transición automática temporal a `REJECTED`.

## UI/UX Impact

- Alto:
- público: confirmación con mensaje/CTA distintos para no fiel.
- admin: nuevo bloque operativo de pendientes y acciones de transición.

## Testing Impact

- Alto: nuevas rutas, nuevas transiciones de estado, nuevas ramas de UI, nuevo maintenance flow.
