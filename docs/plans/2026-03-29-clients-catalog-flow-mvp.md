# Admin Clients Catalog (V1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar el módulo `/admin/clients` con listado, detalle 360 y edición de cliente, reutilizando reglas actuales del dominio y contratos admin.

**Architecture:** Se añade un feature admin dedicado (`app/admin/clients`, `components/admin/clients`, `hooks/admin/clients`, `lib/admin/clients`) con route handlers delgados y lógica de negocio en `lib`. El listado usa filtros/search/paginación server-driven; el detalle agrega resumen + historial de citas; la edición valida identidad por teléfono y notifica con `sileo` + `react-i18next`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/MySQL, Zod, Tailwind, `react-i18next`, `sileo`, Vitest, Playwright.

---

## 1) Contratos y cambios clave

1. Nuevas rutas UI:
- `GET /admin/clients` (listado).
- `GET /admin/clients/[clientId]` (detalle).

2. Nuevos endpoints API:
- `GET /api/admin/clients/catalog?query=&status=&sort=&page=&pageSize=`.
- `GET /api/admin/clients/[clientId]`.
- `PATCH /api/admin/clients/[clientId]` con `{ name }`.

3. Contratos de respuesta:
- Catalog: `{ filters, pagination, metrics, clients[] }`.
- Client detail: `{ client, summary, appointments[] }`.
- Update: `{ clientId, name, phone, updatedAt }`.

4. Error codes estables:
- `ADMIN_UNAUTHORIZED`, `CLIENT_NOT_FOUND`, `CLIENT_NAME_TOO_SHORT`, `CLIENT_NAME_MISMATCH`, `VALIDATION_ERROR`, `UNKNOWN_ERROR`.

5. Cambios UI admin:
- Activar item sidebar `Clients` (quitar `disabled`).
- Vista mobile-first consistente con `components/admin/ui` y tokens actuales.
- Notificaciones exclusivamente con `sileo` y copy vía i18n.

---

## 2) Plan por fases y tareas ejecutables (TDD + commits)

### Fase 1: backend y migraciones
`No se requieren migraciones de schema en V1.`

### Task 1: Tipos/validaciones de catálogo y detalle
**Files:**
- Create: `lib/admin/clients/catalog-types.ts`
- Create: `lib/admin/clients/catalog-validation.ts`
- Modify: `lib/admin/clients/types.ts`
- Test: `tests/lib/admin/clients.validation.test.ts`

**Steps:**
1. Escribir tests fallando para parseo de `query/status/sort/page/pageSize`.
2. Ejecutar `pnpm vitest tests/lib/admin/clients.validation.test.ts`.
3. Implementar validación Zod mínima para filtros y paginación.
4. Re-ejecutar tests.
5. Commit: `feat(admin-clients): add catalog validation contracts`.

### Task 2: Servicio de catálogo de clientes
**Files:**
- Create: `lib/admin/clients/catalog-service.ts`
- Modify: `lib/admin/clients/service.ts` (reusar ranking/búsqueda sin duplicar)
- Test: `tests/lib/admin/clients.catalog-service.test.ts`

**Steps:**
1. Escribir tests para listado filtrado/ordenado/paginado + métricas.
2. Ejecutar test aislado.
3. Implementar consulta Prisma (select mínimo + conteos).
4. Validar orden y filtros esperados.
5. Commit: `feat(admin-clients): implement catalog service`.

### Task 3: Servicio de detalle y edición
**Files:**
- Create: `lib/admin/clients/detail-service.ts`
- Create: `lib/admin/clients/update-service.ts`
- Test: `tests/lib/admin/clients.detail-service.test.ts`
- Test: `tests/lib/admin/clients.update-service.test.ts`

**Steps:**
1. Escribir tests fallando para `getClientDetail` y `updateClientName`.
2. Ejecutar tests.
3. Implementar lectura de cliente + resumen + citas.
4. Implementar update con validación de nombre y reglas de identidad.
5. Re-ejecutar tests y commit: `feat(admin-clients): add detail and update services`.

### Task 4: Route handlers API
**Files:**
- Create: `app/api/admin/clients/catalog/route.ts`
- Create: `app/api/admin/clients/[clientId]/route.ts`
- Test: `tests/app/api-admin-clients-catalog-route.test.ts`
- Test: `tests/app/api-admin-client-route.test.ts`

**Steps:**
1. Escribir tests de contratos HTTP (200/400/401/404).
2. Ejecutar tests fallando.
3. Implementar handlers delgados (`auth`, parse, service, error mapping).
4. Re-ejecutar tests.
5. Commit: `feat(admin-clients): expose catalog and detail/update routes`.

---

### Fase 2: UI/UX flow

### Task 5: Ruta y composición de página clients
**Files:**
- Create: `app/admin/clients/page.tsx`
- Create: `components/admin/clients/ClientsCatalogView.tsx`
- Create: `hooks/admin/clients/useClientsCatalog.ts`
- Test: `tests/app/admin-clients-page.test.tsx`

**Steps:**
1. Escribir test de render base y carga inicial.
2. Implementar página y wiring principal.
3. Validar patrón Next.js (server route + client view/hook).
4. Ejecutar test.
5. Commit: `feat(admin-clients): add clients page scaffold`.

### Task 6: Componentes de listado y filtros
**Files:**
- Create: `components/admin/clients/ClientsMetricsGrid.tsx`
- Create: `components/admin/clients/ClientsFiltersPanel.tsx`
- Create: `components/admin/clients/ClientsList.tsx`
- Test: `tests/components/admin/clients/clients-catalog-view.test.tsx`

**Steps:**
1. Escribir tests de filtros/search/paginación/empty-state.
2. Implementar componentes reusando `Card`, `Input`, `Select`, `Button`, `ListItem`.
3. Alinear estilos a tokens admin (sin estilos ad hoc).
4. Ejecutar tests.
5. Commit: `feat(admin-clients): implement catalog UI components`.

### Task 7: Vista detalle de cliente
**Files:**
- Create: `app/admin/clients/[clientId]/page.tsx`
- Create: `components/admin/clients/ClientDetailView.tsx`
- Create: `hooks/admin/clients/useClientDetail.ts`
- Test: `tests/app/admin-client-detail-page.test.tsx`
- Test: `tests/components/admin/clients/client-detail-view.test.tsx`

**Steps:**
1. Escribir tests de detalle, resumen e historial.
2. Implementar página y componente de detalle.
3. Cubrir estados loading/error/not-found.
4. Ejecutar tests.
5. Commit: `feat(admin-clients): add client detail view`.

### Task 8: Edición de cliente + notificaciones
**Files:**
- Create: `components/admin/clients/EditClientModal.tsx`
- Create: `hooks/admin/clients/useEditClientForm.ts`
- Modify: `components/admin/clients/ClientDetailView.tsx`
- Test: `tests/components/admin/clients/edit-client-modal.test.tsx`

**Steps:**
1. Escribir tests fallando para validación y submit.
2. Implementar modal + hook + `sileo.promise` para update.
3. Integrar i18n para labels, errores y toasts.
4. Ejecutar tests.
5. Commit: `feat(admin-clients): add client edit flow`.

### Task 9: Sidebar e integración navegación
**Files:**
- Modify: `components/admin/layout/sidebar-nav.ts`
- Modify: `locales/es/admin.json`
- Modify: `locales/en/admin.json`
- Test: `tests/components/admin/layout/admin-layout-shell.test.tsx`

**Steps:**
1. Escribir test fallando de item activo `/admin/clients`.
2. Activar enlace de sidebar y sección header.
3. Ajustar traducciones nuevas del módulo.
4. Ejecutar tests.
5. Commit: `feat(admin-clients): enable clients navigation`.

---

### Fase 3: pruebas y rollout

### Task 10: Cobertura integración/end-to-end
**Files:**
- Create: `tests/e2e/admin-clients-catalog.spec.ts`
- Modify: `tests/integration/helpers/db.ts` (fixtures de clientes si aplica)

**Steps:**
1. Escribir flujo E2E: login -> clients list -> filter -> detail -> edit success.
2. Ejecutar test E2E en modo headed/headless local.
3. Ajustar selectores/testids en componentes si faltan.
4. Re-ejecutar suite parcial admin.
5. Commit: `test(admin-clients): add e2e coverage`.

### Task 11: Hardening y criterios de aceptación
**Files:**
- Modify: tests afectados por snapshots/contracts
- No funcional code changes salvo fixes mínimos de estabilidad

**Steps:**
1. Ejecutar: `pnpm vitest tests/app tests/lib tests/components/admin --run`.
2. Ejecutar: `pnpm playwright test tests/e2e/admin-clients-catalog.spec.ts`.
3. Corregir flakes/errores de contrato.
4. Commit: `chore(admin-clients): stabilize tests and contracts`.

---

### Fase 4: cleanup técnico

### Task 12: Consolidación y deuda técnica
**Files:**
- Modify: `lib/admin/clients/service.ts` y módulos nuevos para evitar duplicidad.
- Modify: referencias donde la búsqueda de clientes pueda reutilizar el nuevo catálogo.
- Test: suites de clients y agendado admin.

**Steps:**
1. Identificar duplicidad entre search actual y nuevo catálogo.
2. Consolidar utilidades de ranking/filtros.
3. Ejecutar tests de `admin/months` + `admin/clients`.
4. Commit: `refactor(admin-clients): consolidate client query logic`.

---

## 3) Test plan y aceptación

1. API:
- Autorización requerida en todos los endpoints (`401 ADMIN_UNAUTHORIZED`).
- Filtros/paginación válidos e inválidos.
- `GET [clientId]` inexistente retorna `404 CLIENT_NOT_FOUND`.
- `PATCH [clientId]` valida nombre mínimo y conflicto lógico de identidad.

2. UI:
- Listado renderiza métricas, filtros y resultados.
- Empty/error/loading states correctos.
- Navegación a detalle.
- Edición exitosa/errónea con `sileo` e i18n.

3. E2E:
- Flujo completo admin de catálogo y edición sin romper `/admin/months`.

4. Criterios de Done:
- Sidebar clients activo y funcional.
- Contratos API estables y testeados.
- Cobertura mínima de módulo nueva en app/lib/components/e2e.
- Documentación actualizada y alineada.

---

## 4) Documentación obligatoria y trazabilidad

**Documentation Impact: Yes**
- Actualizar `docs/specification.md`:
  - Sección Admin: nuevo flujo catálogo de clientes, contratos API de catálogo/detalle/edición, validaciones y criterios de aceptación.
- Actualizar `docs/architecture/business-rules.md`:
  - Reglas de gestión de cliente en admin (edición de nombre, identidad por teléfono, consulta de historial).
- Crear `docs/features/admin-clients-catalog-flow.md`:
  - Flujo principal + alternos + validaciones + estados.
- Actualizar `docs/ui/admin/components.md`:
  - Nuevos componentes reusables de clients (si se promueven a `components/admin/ui`).

**Flow Contract Check:**
- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes (required in this plan)

**Migration Compatibility Check:**
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Yes (convive con search actual durante transición)
- Rollback strategy defined: Yes (feature rollback por rutas/UI sin migración)
- Cleanup phase defined: Yes
- Integrity protections defined: Yes

**Admin UI Check:**
- Uses components/admin/ui: Yes
- Reused existing components: Yes
- New reusable components created: Optional (only if pattern repeats)
- Tokens respected: Yes
- design-system.md aligned: Yes
- Public flow untouched: Yes

**Notification Contract Check:**
- Sileo used for success/warning/error/info: Yes
- Sileo action notifications used when applicable: N/A in V1
- Sileo promise notifications used when applicable: Yes
- i18n applied in admin notifications: Yes
- Alternative notification systems introduced: No

---

## 5) Assumptions and defaults

- Alcance V1 fijado: `listado + detalle + editar` (sin alta manual ni merge de duplicados).
- Sin cambios de schema DB en V1.
- Mantener compatibilidad con flujo de agendado actual en `/admin/months/[month]`.
- Implementación siguiendo `@next-best-practices` (handlers delgados, separación RSC/client, async params/cookies) y `@tailwind-design-system` (tokens/admin DS existente, sin introducir sistema visual paralelo).
- Archivo objetivo para persistir este plan cuando salgas de Plan Mode: `docs/plans/2026-03-29-admin-clients-catalog-v1.md`.
