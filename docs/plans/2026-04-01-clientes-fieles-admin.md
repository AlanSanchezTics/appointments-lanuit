# Admin Clientes Fieles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir marcar clientes como `Cliente fiel` desde detalle, filtrarlos en el catálogo y exponer analítica de cantidad y porcentaje de clientes fieles.

**Architecture:** El cambio se implementa sobre el feature existente de clientes admin: se agrega un atributo persistente `isLoyal` en `clients`, se extiende el contrato de catálogo/detalle/update, y se integra UI reactiva en detalle + filtros/métricas de catálogo. Se mantiene separación por capas (route handler delgado, validación en `lib/admin/clients/validation.ts`, lógica de dominio en `lib/admin/clients/*`, estado UI en hooks). La métrica de fidelidad se calcula como analítica global del catálogo (estable al filtrar), consistente con el patrón actual de métricas.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma + MySQL, Zod, Tailwind Admin DS, react-i18next, sileo, Vitest, Playwright.

---

## 1) Requerimientos

### Funcionales
1. En `/admin/clients/[clientId]` el admin puede marcar/desmarcar `Cliente fiel`.
2. En `/admin/clients` el admin puede filtrar para ver solo clientes fieles.
3. En `/admin/clients` se muestra analítica de fidelidad:
- cantidad de clientes fieles,
- porcentaje sobre total de clientes.
4. El cambio debe respetar i18n (`locales/es/admin.json`, `locales/en/admin.json`) y notificaciones admin con `sileo`.

### No funcionales
1. Mantener contrato de errores estables (`errorCode`) sin copy backend localizado.
2. Mantener UI admin con `components/admin/ui/*` y tokens oficiales.
3. Mantener comportamiento reactivo actual del catálogo (filtros sin botón aplicar).
4. Mantener compatibilidad transitoria del `PATCH /api/admin/clients/[clientId]` para payload actual (`{ name }`) y nuevo payload parcial (`{ name?, isLoyal? }`).

### Supuestos explícitos
1. Un cliente fiel es una marca manual booleana (`true/false`) sin cálculo automático.
2. El porcentaje de fidelidad se calcula como `loyalClients / totalClients * 100` redondeado a entero.
3. Si `totalClients = 0`, el porcentaje mostrado es `0%`.

### Documentation Impact
- `docs/specification.md`: **Sí requiere cambios** (flujo de catálogo/detalle admin y contratos API de clientes).
- `docs/architecture/business-rules.md`: **Sí requiere cambios** (nueva regla de segmentación por fidelidad y su analítica).
- `docs/features/admin-clients-catalog-flow.md`: **Sí requiere cambios** (paso de marcado en detalle, filtro loyal en catálogo y métricas nuevas).
- Momento de actualización:
1. Antes de código: actualizar contratos esperados.
2. Durante implementación: ajustar payloads/validaciones finales.
3. Después: validar alineación final con comportamiento real.
- Ambigüedad detectada: el criterio de porcentaje no estaba definido; este plan lo fija en entero redondeado y debe validarse con negocio.

## 2) Diseño

### Diseño de datos
1. Extender `Client` con `isLoyal Boolean @default(false) @map("is_loyal")`.
2. Migración Prisma no destructiva con default `false` (backfill implícito por default).

### Diseño de contratos API
1. `GET /api/admin/clients/catalog`
- Nuevo filtro: `status=LOYAL` (además de los actuales).
- Nuevas métricas globales:
  - `loyalClients`
  - `loyalClientsPercentage`
- Cada item de `clients[]` incluye `isLoyal`.

2. `GET /api/admin/clients/[clientId]`
- `client.isLoyal` en payload.

3. `PATCH /api/admin/clients/[clientId]`
- Payload parcial: `{ name?: string, isLoyal?: boolean }`.
- Debe rechazar payload vacío con `VALIDATION_ERROR`.

### Diseño UI/UX admin
1. Detalle cliente:
- Añadir bloque en `ClientDetailView` con control `Cliente fiel`.
- Acción guardado usando `sileo.promise` (loading/success/error) y copy por i18n.

2. Catálogo clientes:
- Filtro de estado con opción adicional `Solo clientes fieles`.
- Métrica adicional en grid:
  - `Clientes fieles` (count)
  - `% fidelidad`.

### Diseño de pruebas
1. Unit/lib: schema/validación, catálogo, detalle, update.
2. API route: contratos HTTP y errores.
3. Componentes/hooks: interacción de toggle + filtros + métricas.
4. E2E: flujo end-to-end de marcar fiel y filtrar fieles.

## 3) Lista de tareas (resumen)

1. Migrar esquema `clients` para `is_loyal`.
2. Extender tipos de dominio/admin clients.
3. Extender validaciones de query/payload.
4. Actualizar `catalog-service` (filtro + métricas + item flag).
5. Actualizar `detail-service` (flag en detalle).
6. Actualizar `update-service` (patch parcial name/isLoyal).
7. Ajustar route handlers y api client frontend.
8. Ajustar hooks y componentes de catálogo/detalle.
9. Ajustar i18n (ES/EN) y notificaciones `sileo`.
10. Actualizar tests unitarios, API, componentes y E2E.
11. Actualizar documentación funcional y reglas de negocio.
12. Ejecutar smoke/regresión y checklist de despliegue.

## 4) Desarrollo

### Fase 1: backend y migraciones

### Task 1: Prisma schema + migración `is_loyal`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_client_is_loyal/migration.sql`
- Test: `tests/lib/admin/clients.detail-service.test.ts`

**Step 1: Write the failing test**

```ts
it("returns client.isLoyal in detail response", async () => {
  // mock prisma client with isLoyal: true
  // expect response.client.isLoyal toBe(true)
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/admin/clients.detail-service.test.ts`
Expected: FAIL because `isLoyal` is not selected/mapped.

**Step 3: Write minimal implementation**

```prisma
model Client {
  // ...
  isLoyal Boolean @default(false) @map("is_loyal")
}
```

Then generate migration SQL with Prisma.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/admin/clients.detail-service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/lib/admin/clients.detail-service.test.ts
git commit -m "feat(admin-clients): add loyal flag to client schema"
```

### Task 2: Contratos de tipos admin clients

**Files:**
- Modify: `lib/admin/clients/types.ts`
- Test: `tests/lib/admin/clients.catalog-service.test.ts`

**Step 1: Write the failing test**

```ts
expect(result.metrics).toMatchObject({
  loyalClients: 2,
  loyalClientsPercentage: 20,
});
expect(result.clients[0]).toMatchObject({ isLoyal: true });
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/admin/clients.catalog-service.test.ts`
Expected: FAIL because new metric/type keys do not exist.

**Step 3: Write minimal implementation**

Add new union value `LOYAL`, metrics fields, and `isLoyal` in item/detail/update response types.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/admin/clients.catalog-service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/admin/clients/types.ts tests/lib/admin/clients.catalog-service.test.ts
git commit -m "feat(admin-clients): extend contracts for loyal clients"
```

### Task 3: Validación query/payload para filtro loyal y patch parcial

**Files:**
- Modify: `lib/admin/clients/validation.ts`
- Modify: `tests/lib/admin/clients.validation.test.ts`

**Step 1: Write the failing test**

```ts
expect(parseAdminClientsCatalogQuery(params).status).toBe("LOYAL");
expect(parseUpdateAdminClientPayload({ isLoyal: true })).toEqual({ isLoyal: true });
expect(() => parseUpdateAdminClientPayload({})).toThrow("VALIDATION_ERROR");
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/admin/clients.validation.test.ts`
Expected: FAIL because `LOYAL` and partial payload are not accepted.

**Step 3: Write minimal implementation**

Use Zod schema allowing `{ name?: string, isLoyal?: boolean }` with refinement: at least one field.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/admin/clients.validation.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/admin/clients/validation.ts tests/lib/admin/clients.validation.test.ts
git commit -m "feat(admin-clients): validate loyal filter and partial update payload"
```

### Task 4: Servicio de catálogo con filtro y analítica de fidelidad

**Files:**
- Modify: `lib/admin/clients/catalog-service.ts`
- Modify: `tests/lib/admin/clients.catalog-service.test.ts`

**Step 1: Write the failing test**

```ts
it("applies LOYAL filter and returns loyal metrics", async () => {
  // expect prisma query where isLoyal true
  // expect loyalClients and loyalClientsPercentage
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/admin/clients.catalog-service.test.ts`
Expected: FAIL because filter/metrics are missing.

**Step 3: Write minimal implementation**

- Add `isLoyal: true` to `listWhere` when `status === "LOYAL"`.
- Add extra count for loyal clients.
- Compute percentage with guard for divide-by-zero.
- Include `isLoyal` in row mapping.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/admin/clients.catalog-service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/admin/clients/catalog-service.ts tests/lib/admin/clients.catalog-service.test.ts
git commit -m "feat(admin-clients): add loyal filter and loyalty analytics"
```

### Task 5: Servicio de detalle y update de fidelidad

**Files:**
- Modify: `lib/admin/clients/detail-service.ts`
- Modify: `lib/admin/clients/update-service.ts`
- Modify: `tests/lib/admin/clients.detail-service.test.ts`
- Modify: `tests/lib/admin/clients.update-service.test.ts`

**Step 1: Write the failing test**

```ts
it("updates isLoyal without requiring name", async () => {
  // updateAdminClient(clientId, { isLoyal: true })
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/admin/clients.detail-service.test.ts tests/lib/admin/clients.update-service.test.ts`
Expected: FAIL because current service only updates `name`.

**Step 3: Write minimal implementation**

- Select/map `isLoyal` in detail.
- Build dynamic `data` object in update service for provided fields only.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/admin/clients.detail-service.test.ts tests/lib/admin/clients.update-service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/admin/clients/detail-service.ts lib/admin/clients/update-service.ts tests/lib/admin/clients.detail-service.test.ts tests/lib/admin/clients.update-service.test.ts
git commit -m "feat(admin-clients): support loyal flag in detail and update services"
```

### Fase 2: UI/UX flow

### Task 6: Route handlers y cliente HTTP para nuevos contratos

**Files:**
- Modify: `app/api/admin/clients/catalog/route.ts`
- Modify: `app/api/admin/clients/[clientId]/route.ts`
- Modify: `lib/admin/clients/api-client.ts`
- Modify: `tests/app/api-admin-clients-catalog-route.test.ts`
- Modify: `tests/app/api-admin-client-route.test.ts`

**Step 1: Write the failing test**

```ts
// catalog route accepts status=LOYAL
// patch route accepts { isLoyal: true }
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/app/api-admin-clients-catalog-route.test.ts tests/app/api-admin-client-route.test.ts`
Expected: FAIL in validation/contract assertions.

**Step 3: Write minimal implementation**

Adjust parsing/serialization and preserve stable error handling.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/app/api-admin-clients-catalog-route.test.ts tests/app/api-admin-client-route.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/admin/clients/catalog/route.ts app/api/admin/clients/[clientId]/route.ts lib/admin/clients/api-client.ts tests/app/api-admin-clients-catalog-route.test.ts tests/app/api-admin-client-route.test.ts
git commit -m "feat(admin-clients): expose loyal contracts in client routes"
```

### Task 7: Hook de detalle para marcar cliente fiel

**Files:**
- Modify: `hooks/admin/clients/useClientDetail.ts`
- Test: `tests/components/admin/clients/client-detail-view.test.tsx`

**Step 1: Write the failing test**

```tsx
it("triggers loyal toggle update and refresh", async () => {
  // click loyal control
  // expect update API called with { isLoyal: true }
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/admin/clients/client-detail-view.test.tsx`
Expected: FAIL because hook only exposes `updateName`.

**Step 3: Write minimal implementation**

Add `updateLoyalStatus(isLoyal: boolean)` in hook using same update endpoint + refresh.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/admin/clients/client-detail-view.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/admin/clients/useClientDetail.ts tests/components/admin/clients/client-detail-view.test.tsx
git commit -m "feat(admin-clients): add loyal status action in detail hook"
```

### Task 8: UI de detalle con control `Cliente fiel` y notificación

**Files:**
- Modify: `components/admin/clients/ClientDetailView.tsx`
- Modify: `components/admin/ui/Input.tsx` (only if adding reusable checkbox/toggle helper is needed)
- Modify: `locales/es/admin.json`
- Modify: `locales/en/admin.json`
- Test: `tests/components/admin/clients/client-detail-view.test.tsx`

**Step 1: Write the failing test**

```tsx
expect(screen.getByLabelText(/cliente fiel|loyal client/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/admin/clients/client-detail-view.test.tsx`
Expected: FAIL because control/labels do not exist.

**Step 3: Write minimal implementation**

- Add labeled toggle/checkbox in detail card.
- Fire `sileo.promise` for `loading/success/error` using i18n keys.
- Keep admin token styles and existing components.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/admin/clients/client-detail-view.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/clients/ClientDetailView.tsx locales/es/admin.json locales/en/admin.json tests/components/admin/clients/client-detail-view.test.tsx
git commit -m "feat(admin-clients): add loyal toggle in client detail"
```

### Task 9: Catálogo con filtro loyal y métricas de fidelidad

**Files:**
- Modify: `components/admin/clients/ClientFiltersPanel.tsx`
- Modify: `components/admin/clients/ClientsMetricsGrid.tsx`
- Modify: `components/admin/clients/ClientsCatalogView.tsx`
- Modify: `hooks/admin/clients/useClientsCatalog.ts`
- Modify: `tests/components/admin/clients/clients-catalog-view.test.tsx`
- Modify: `tests/app/admin-clients-page.test.tsx`

**Step 1: Write the failing test**

```tsx
expect(screen.getByText(/solo clientes fieles|loyal clients only/i)).toBeInTheDocument();
expect(screen.getByText(/clientes fieles|loyal clients/i)).toBeInTheDocument();
expect(screen.getByText(/% fidelidad|loyalty %/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/admin/clients/clients-catalog-view.test.tsx tests/app/admin-clients-page.test.tsx`
Expected: FAIL because new filter/metrics are missing.

**Step 3: Write minimal implementation**

- Add `LOYAL` option in status select.
- Render fidelity metrics cards.
- Keep metrics stability behavior during filter interactions.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/admin/clients/clients-catalog-view.test.tsx tests/app/admin-clients-page.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/clients/ClientFiltersPanel.tsx components/admin/clients/ClientsMetricsGrid.tsx components/admin/clients/ClientsCatalogView.tsx hooks/admin/clients/useClientsCatalog.ts tests/components/admin/clients/clients-catalog-view.test.tsx tests/app/admin-clients-page.test.tsx
git commit -m "feat(admin-clients): add loyal filter and metrics to clients catalog"
```

### Fase 3: pruebas y rollout

### Task 10: Cobertura E2E del flujo loyal

**Files:**
- Modify: `tests/e2e/admin-clients-catalog.spec.ts`

**Step 1: Write the failing test**

```ts
// login -> open client detail -> mark loyal -> back to catalog -> filter loyal -> assert client visible
```

**Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/admin-clients-catalog.spec.ts`
Expected: FAIL because loyal controls/filter are not present.

**Step 3: Write minimal implementation**

Add/select robust locators (`data-testid` only if existing selectors are fragile).

**Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- tests/e2e/admin-clients-catalog.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/e2e/admin-clients-catalog.spec.ts
git commit -m "test(admin-clients): cover loyal client flow in e2e"
```

### Task 11: Regresión dirigida del módulo

**Files:**
- Modify: tests only if regressions appear

**Step 1: Write the failing test**

No new test; use regression suite as acceptance gate.

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/admin/clients.validation.test.ts tests/lib/admin/clients.catalog-service.test.ts tests/lib/admin/clients.detail-service.test.ts tests/lib/admin/clients.update-service.test.ts tests/app/api-admin-clients-catalog-route.test.ts tests/app/api-admin-client-route.test.ts tests/components/admin/clients/clients-catalog-view.test.tsx tests/components/admin/clients/client-detail-view.test.tsx`
Expected: PASS (if fail, create focused test and fix).

**Step 3: Write minimal implementation**

Fix only broken assertions/contracts introduced by loyal feature.

**Step 4: Run test to verify it passes**

Repeat command until PASS.

**Step 5: Commit**

```bash
git add tests app lib components hooks
git commit -m "chore(admin-clients): stabilize loyal client feature tests"
```

### Fase 4: cleanup técnico

### Task 12: Limpieza de deuda y consistencia final

**Files:**
- Modify: `lib/admin/clients/*` (shared helpers if duplicated)
- Modify: `components/admin/clients/*` (remove temporary code)
- Test: same regression suite + lint

**Step 1: Write the failing test**

Add test only if cleanup changes behavior; otherwise no new tests.

**Step 2: Run test to verify it fails**

Run: `npm run lint`
Expected: PASS.

**Step 3: Write minimal implementation**

Remove duplication, keep helpers DRY/YAGNI, ensure readable contracts.

**Step 4: Run test to verify it passes**

Run: `npm run lint && npm run test -- tests/lib/admin/clients.catalog-service.test.ts tests/components/admin/clients/clients-catalog-view.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app lib components hooks tests
git commit -m "refactor(admin-clients): cleanup loyal feature implementation"
```

## 5) Despliegue

### Pre-deploy checklist
1. Ejecutar migraciones en staging con backup previo de DB.
2. Verificar `PATCH /api/admin/clients/[clientId]` con payload viejo (`{ name }`) y nuevo (`{ isLoyal }`).
3. Validar UI admin en ES/EN:
- marcar/desmarcar cliente fiel,
- filtrar clientes fieles,
- métricas de fidelidad.
4. Ejecutar smoke de rutas:
- `/admin/clients`
- `/admin/clients/[clientId]`.

### Deploy order
1. Deploy backend + migración (`prisma migrate deploy`).
2. Deploy frontend admin.
3. Smoke tests manuales y automáticos.
4. Monitoreo de errores API (`VALIDATION_ERROR`, `CLIENT_NOT_FOUND`, `UNKNOWN_ERROR`).

### Rollback
1. Rollback de app a versión previa.
2. Mantener columna `is_loyal` (rollback no destructivo, compatible hacia atrás).
3. Si se requiere reversión lógica, ocultar control/filtro loyal por feature flag temporal (si existe) o revert commit de UI.

---

## Trazabilidad y checks obligatorios

**Code Impact:** Sí (schema, servicios, API, hooks, UI, tests).

**Data Impact:** Sí (`clients.is_loyal`, default `false`, sin pérdida de datos).

**UI/UX Impact:** Sí (nuevo control en detalle, filtro y métricas en catálogo).

**Documentation Impact:** Sí.
- `docs/specification.md` (flujo admin clientes + contratos API + validaciones + aceptación).
- `docs/architecture/business-rules.md` (segmentación por clientes fieles y métrica).
- `docs/features/admin-clients-catalog-flow.md` (pasos UI/API actualizados).

**Testing Impact:** Sí (unit/API/component/E2E).

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

Admin UI Check:
- Uses components/admin/ui: Yes
- Reused existing components: Yes
- New reusable components created: No (unless checkbox/toggle pattern repeats)
- Tokens respected: Yes
- design-system.md aligned: Yes
- Public flow untouched: Yes

Notification Contract Check:
- Sileo used for success/warning/error/info: Yes
- Sileo action notifications used when applicable: No
- Sileo promise notifications used when applicable: Yes
- i18n applied in admin notifications: Yes
- Alternative notification systems introduced: No
