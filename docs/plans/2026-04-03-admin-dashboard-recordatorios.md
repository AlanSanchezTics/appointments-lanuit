# Admin Dashboard Recordatorios Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar en `/admin` un bloque de Recordatorios que muestre citas de mañana y de la próxima semana, permita abrir `wa.me` con mensaje predefinido y registre cada envío para control.

**Architecture:** Se extiende el agregado de datos del dashboard para incluir dos buckets de recordatorios (`NEXT_DAY`, `NEXT_WEEK`) basados en citas activas y timezone de negocio. La acción de envío se implementa en UI admin como apertura de `wa.me` + registro en endpoint admin dedicado con persistencia en tabla nueva `appointment_reminders` y restricción de no reenvío por cita/tipo. El rollout se divide en backend/migración, UI flow, pruebas y cleanup con ejecución Subagent-Driven por ownership de bloques.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma + MySQL, NextAuth, react-i18next, sileo, Vitest, Playwright.

---

## Execution Mode

- **Modo explícito:** `Subagent-Driven`.
- **Regla de ownership por bloques (sin conflictos):**
  - **Bloque A (Backend + DB + API):** `prisma/*`, `lib/admin/dashboard/*`, `lib/admin/appointments/*`, `app/api/admin/appointments/*`.
  - **Bloque B (UI + i18n):** `components/admin/ui/*`, `app/admin/page.tsx`, `locales/*/admin.json`.
  - **Bloque C (Documentación):** `docs/specification.md`, `docs/architecture/business-rules.md`, `docs/features/*`, `docs/ui/admin/components.md`.
  - **Bloque D (Testing + rollout):** `tests/lib/*`, `tests/app/*`, `tests/e2e/*`, checklist de despliegue.

---

## 1. Requerimientos

- Agregar bloque `Recordatorios` en dashboard admin.
- Mostrar citas de:
  - día siguiente,
  - dentro de una semana.
- Mostrar por cita:
  - avatar cliente,
  - nombre,
  - número de cliente,
  - teléfono,
  - hora.
- Acción por cita: `Enviar recordatorio` (icono).
- Al hacer clic:
  - abrir `wa.me` en nueva pestaña con texto predefinido según tipo,
  - registrar el envío para trazabilidad.
- Reglas cerradas para esta implementación:
  - solo estados activos: `CONFIRMED`, `SYNC_FAILED`,
  - no permitir reenvío para misma cita + mismo tipo,
  - teléfono `wa.me` = `52` + 10 dígitos,
  - trazabilidad completa (`appointmentId`, `reminderType`, `adminUserId`, `targetPhone`, `message`, `openedAt`).

---

## 2. Diseño

- **UI Contract**
  - Nuevo componente reusable: `ReminderAppointmentsCard`.
  - Dos secciones internas: `Mañana` y `Próxima semana`.
  - Empty states por sección.
  - Acción icon button con accesibilidad (`aria-label`).
  - Feedback con `sileo` y textos por `react-i18next`.

- **Data Contract**
  - Extender payload del dashboard:
    - `reminders.nextDay[]`
    - `reminders.nextWeek[]`
  - Item incluye:
    - `appointmentId`,
    - `clientNumber`,
    - `name`,
    - `phone`,
    - `date`,
    - `timeSlot`,
    - `reminderType`.

- **API Contract**
  - `POST /api/admin/appointments/[appointmentId]/reminders`
  - Request:
    - `reminderType: "NEXT_DAY" | "NEXT_WEEK"`
    - `message: string`
    - `targetPhone: string`
  - Success: `200` con registro persistido.
  - Errores:
    - `401 ADMIN_UNAUTHORIZED`,
    - `404 APPOINTMENT_NOT_FOUND`,
    - `409 APPOINTMENT_REMINDER_ALREADY_SENT`,
    - `400 VALIDATION_ERROR|UNKNOWN_ERROR`.

- **Persistence**
  - Nueva tabla `appointment_reminders`:
    - `id`,
    - `appointment_id` (FK),
    - `reminder_type`,
    - `target_phone`,
    - `message`,
    - `sent_by_admin_user_id` (FK nullable),
    - `opened_at`,
    - `created_at`,
    - `updated_at`.
  - Índice único:
    - `UNIQUE(appointment_id, reminder_type)` para bloquear reenvío.

---

## 3. Lista de tareas

### Task 1: Migración y modelo de recordatorios (Bloque A)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/0013_appointment_reminders/migration.sql`
- Test: `tests/lib/admin/appointments.service.test.ts`

**Step 1: Write the failing test**
- Agregar caso que intente registrar el mismo recordatorio dos veces y espere conflicto de dominio.

**Step 2: Run test to verify it fails**
- Run: `npm run test -- tests/lib/admin/appointments.service.test.ts`
- Expected: FAIL por ausencia de modelo/servicio de recordatorios.

**Step 3: Write minimal implementation**
- Agregar enum/model Prisma y migración SQL con índice único `(appointment_id, reminder_type)`.

**Step 4: Run test to verify it passes**
- Run: `npm run test -- tests/lib/admin/appointments.service.test.ts`
- Expected: PASS del caso de conflicto.

**Step 5: Commit**
- `git add prisma/schema.prisma prisma/migrations/0013_appointment_reminders/migration.sql tests/lib/admin/appointments.service.test.ts`
- `git commit -m "feat: add appointment reminders persistence with unique constraint"`

### Task 2: Servicio y endpoint de tracking (Bloque A)

**Files:**
- Modify: `lib/admin/appointments/types.ts`
- Modify: `lib/admin/appointments/service.ts`
- Create: `app/api/admin/appointments/[appointmentId]/reminders/route.ts`
- Test: `tests/app/api-admin-appointment-reminders-route.test.ts`

**Step 1: Write the failing test**
- Crear test de route para `200`, `401`, `404`, `409`.

**Step 2: Run test to verify it fails**
- Run: `npm run test -- tests/app/api-admin-appointment-reminders-route.test.ts`
- Expected: FAIL por ruta inexistente.

**Step 3: Write minimal implementation**
- Implementar servicio transaccional de registro + route handler delgado.

**Step 4: Run test to verify it passes**
- Run: `npm run test -- tests/app/api-admin-appointment-reminders-route.test.ts`
- Expected: PASS.

**Step 5: Commit**
- `git add lib/admin/appointments/types.ts lib/admin/appointments/service.ts app/api/admin/appointments/[appointmentId]/reminders/route.ts tests/app/api-admin-appointment-reminders-route.test.ts`
- `git commit -m "feat: add admin reminder tracking endpoint"`

### Task 3: Agregado dashboard para listas de recordatorio (Bloque A)

**Files:**
- Modify: `lib/admin/dashboard/types.ts`
- Modify: `lib/admin/dashboard/service.ts`
- Test: `tests/lib/admin/dashboard.service.test.ts`

**Step 1: Write the failing test**
- Agregar expectativas para `reminders.nextDay` y `reminders.nextWeek` con filtros de estado activo.

**Step 2: Run test to verify it fails**
- Run: `npm run test -- tests/lib/admin/dashboard.service.test.ts`
- Expected: FAIL por propiedad inexistente.

**Step 3: Write minimal implementation**
- Construir queries `+1` y `+7` días en timezone MX y mapear campos de UI.

**Step 4: Run test to verify it passes**
- Run: `npm run test -- tests/lib/admin/dashboard.service.test.ts`
- Expected: PASS.

**Step 5: Commit**
- `git add lib/admin/dashboard/types.ts lib/admin/dashboard/service.ts tests/lib/admin/dashboard.service.test.ts`
- `git commit -m "feat: include reminders datasets in admin dashboard summary"`

### Task 4: UI card de recordatorios + integración dashboard (Bloque B)

**Files:**
- Create: `components/admin/ui/ReminderAppointmentsCard.tsx`
- Modify: `components/admin/ui/admin-icons.ts`
- Modify: `app/admin/page.tsx`
- Test: `tests/app/admin-dashboard-page.test.tsx`

**Step 1: Write the failing test**
- Validar render de título `Recordatorios`, secciones y acción `Enviar recordatorio`.

**Step 2: Run test to verify it fails**
- Run: `npm run test -- tests/app/admin-dashboard-page.test.tsx`
- Expected: FAIL por componente no implementado.

**Step 3: Write minimal implementation**
- Crear card reusable con dos listas y acción por item.
- Integrar card en `app/admin/page.tsx`.

**Step 4: Run test to verify it passes**
- Run: `npm run test -- tests/app/admin-dashboard-page.test.tsx`
- Expected: PASS.

**Step 5: Commit**
- `git add components/admin/ui/ReminderAppointmentsCard.tsx components/admin/ui/admin-icons.ts app/admin/page.tsx tests/app/admin-dashboard-page.test.tsx`
- `git commit -m "feat: render admin reminders block in dashboard"`

### Task 5: Acción WA + tracking + notificaciones/i18n (Bloque B)

**Files:**
- Modify: `components/admin/ui/ReminderAppointmentsCard.tsx`
- Modify: `locales/es/admin.json`
- Modify: `locales/en/admin.json`
- Test: `tests/app/admin-dashboard-page.test.tsx`

**Step 1: Write the failing test**
- Caso de click:
  - abre URL `wa.me` esperada,
  - llama endpoint de tracking,
  - muestra feedback apropiado.

**Step 2: Run test to verify it fails**
- Run: `npm run test -- tests/app/admin-dashboard-page.test.tsx`
- Expected: FAIL por acción incompleta.

**Step 3: Write minimal implementation**
- Generar mensaje por tipo (`NEXT_DAY`, `NEXT_WEEK`) y locale admin.
- `window.open(..., "_blank")` + POST tracking.
- Manejar `409` con `sileo.warning`.

**Step 4: Run test to verify it passes**
- Run: `npm run test -- tests/app/admin-dashboard-page.test.tsx`
- Expected: PASS.

**Step 5: Commit**
- `git add components/admin/ui/ReminderAppointmentsCard.tsx locales/es/admin.json locales/en/admin.json tests/app/admin-dashboard-page.test.tsx`
- `git commit -m "feat: add whatsapp reminder action with admin i18n and notifications"`

### Task 6: Documentación de contrato funcional y UI (Bloque C)

**Files:**
- Modify: `docs/specification.md`
- Modify: `docs/architecture/business-rules.md`
- Modify: `docs/features/admin-auth-flow.md` (o create `docs/features/admin-dashboard-flow.md`)
- Modify: `docs/ui/admin/components.md`

**Step 1: Write the failing test**
- Definir checklist documental de alineación (manual) contra implementación final.

**Step 2: Run test to verify it fails**
- Validar docs actuales: no existe contrato de bloque Recordatorios ni tracking.

**Step 3: Write minimal implementation**
- Documentar flujo, validaciones, estados, API, tracking y reglas de no reenvío.

**Step 4: Run test to verify it passes**
- Revisión manual de consistencia docs vs código.

**Step 5: Commit**
- `git add docs/specification.md docs/architecture/business-rules.md docs/features/admin-auth-flow.md docs/ui/admin/components.md`
- `git commit -m "docs: add admin reminders flow and contracts"`

### Task 7: Pruebas integrales y despliegue controlado (Bloque D)

**Files:**
- Modify/Create: `tests/e2e/admin-dashboard-reminders.spec.ts` (si no existe, crear)
- Modify: `docs/runbooks/admin-dashboard-reminders-rollout.md` (crear si no existe)

**Step 1: Write the failing test**
- E2E:
  - render del bloque,
  - existencia de citas objetivo,
  - click abre `wa.me`,
  - segundo click bloqueado por duplicado.

**Step 2: Run test to verify it fails**
- Run: `npm run test:e2e -- tests/e2e/admin-dashboard-reminders.spec.ts`
- Expected: FAIL antes de ajustes finales.

**Step 3: Write minimal implementation**
- Ajustes finales de estabilidad y selectors.
- Añadir runbook de despliegue/smoke.

**Step 4: Run test to verify it passes**
- Run:
  - `npm run lint`
  - `npm run lint:admin-i18n`
  - `npm run test -- tests/lib/admin/dashboard.service.test.ts tests/app/api-admin-appointment-reminders-route.test.ts tests/app/admin-dashboard-page.test.tsx`
  - `npm run test:e2e -- tests/e2e/admin-dashboard-reminders.spec.ts`
- Expected: PASS.

**Step 5: Commit**
- `git add tests/e2e/admin-dashboard-reminders.spec.ts docs/runbooks/admin-dashboard-reminders-rollout.md`
- `git commit -m "test: add reminders e2e coverage and rollout runbook"`

---

## 4. Desarrollo (Fases obligatorias)

- **Fase 1: backend y migraciones**
  - Modelo + migración + endpoint + servicio de tracking.
- **Fase 2: UI/UX flow**
  - Card de recordatorios + acción WA + notificaciones + i18n.
- **Fase 3: pruebas y rollout**
  - Unit/API/UI/E2E + runbook + smoke de producción.
- **Fase 4: cleanup técnico**
  - Consolidar helpers de mensaje y tipos compartidos, remover duplicación.

---

## 5. Pruebas

- Unit:
  - servicio dashboard (bucket `nextDay`/`nextWeek`),
  - servicio tracking (duplicados, cita inválida, auth).
- API:
  - route de recordatorios (200/401/404/409/400).
- UI:
  - render de secciones y click action.
- E2E:
  - apertura correcta de `wa.me`,
  - registro y bloqueo de reenvío.

---

## 6. Despliegue

- Orden:
  1. aplicar migración DB,
  2. desplegar API/backend,
  3. desplegar frontend admin,
  4. ejecutar smoke.
- Smoke checklist:
  - bloque visible en `/admin`,
  - mensajes correctos por tipo,
  - redirección `wa.me` correcta,
  - bloqueo de reenvío funcionando,
  - sin regresiones en widgets existentes.

---

## Documentation Impact

- `docs/specification.md`: **Sí**, actualizar sección de dashboard admin con contrato de Recordatorios.
- Flujo cambiado: se agrega subflujo de envío de recordatorios y trazabilidad.
- Secciones a corregir/agregar:
  - Dashboard blocks,
  - Validaciones de envío,
  - Contrato API admin recordatorios,
  - Criterios de aceptación del bloque.
- Momento de actualización: durante implementación y verificación final post-pruebas.
- Ambigüedad detectada y resuelta:
  - estados incluidos (`CONFIRMED`, `SYNC_FAILED`),
  - política de reenvío (bloqueado),
  - formato teléfono WA (`52` + 10 dígitos),
  - trazabilidad completa.

## Trazabilidad

- Impacto en flujo: **Sí**
- Impacto documental: **Sí**
- `docs/specification.md` actualizado: **Requerido**
- Secciones afectadas: **Admin Dashboard / Recordatorios / Contratos API y validaciones**

## Flow Contract Check

- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes

## Migration Compatibility Check

- Schema changes required: Yes
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes

