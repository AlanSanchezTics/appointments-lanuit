# Real-Time Day Availability (Incremental) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar disponibilidad “near real-time” al seleccionar día en booking, y evolucionar a consulta real por día, manteniendo compatibilidad con el flujo/lock actual.

**Architecture:** Se entrega en 2 iteraciones funcionales + 1 de hardening. Iteración 1 reutiliza `refreshDays(month)` para valor rápido con control de carreras y actualización focalizada del día visible. Iteración 2 introduce endpoint por día (`GET /api/availability/[month]/[date]`) para reducir payload y mejorar latencia. Iteración 3 agrega rollout seguro, métricas y limpieza técnica.

**Tech Stack:** Next.js App Router, React hooks, TypeScript, Vitest, Playwright, i18next.

---

## Summary
- Implementar refresco de disponibilidad al seleccionar día sin romper el flujo actual.
- Evitar condiciones de carrera (respuesta vieja pisando nueva).
- Evolucionar a endpoint por día para “real-time” real y escalable.
- Mantener documentación contractual alineada (`specification`, `business-rules`, `booking-flow`).

## Important Interfaces / API Changes
- **Iteración 1:** Sin cambios de API pública; usa `GET /api/availability/[month]`.
- **Iteración 2 (nuevo contrato):**
  - `GET /api/availability/[month]/[date]`
  - Response: `{ month, date, slots: string[] }`
  - Error: payload estable con `errorCode` (alineado a `normalizeErrorCode`).
- **Frontend:** nuevo helper cliente:
  - `fetchDayAvailability(month: string, date: string): Promise<string[]>`

## Implementation Tasks

### Fase 1: backend y migraciones

### Task 1: Diseño y pruebas del endpoint por día (TDD)

**Files:**
- Create Test: `tests/app/api-availability-day.test.ts`
- Modify (reference): `tests/app/api-availability-month.test.ts`
- Create Route (later): `app/api/availability/[month]/[date]/route.ts`

**Step 1: Write the failing test**

```ts
it("returns slots for a single day", async () => {
  // mocks getDayAvailability
  // GET /api/availability/2026-03/2026-03-04
  // expect 200 + { month, date, slots }
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/app/api-availability-day.test.ts`  
Expected: FAIL (route does not exist).

**Step 3: Write minimal implementation**

- Add route handler with `dynamic = "force-dynamic"` and `revalidate = 0`.
- Reuse error response helpers.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/app/api-availability-day.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/app/api-availability-day.test.ts app/api/availability/[month]/[date]/route.ts
git commit -m "feat: add day availability route"
```

### Task 2: Servicio de disponibilidad por día sin migraciones

**Files:**
- Modify: `lib/availability/service.ts`
- Modify Test: `tests/lib/availability/service.test.ts`

**Step 1: Write the failing test**

```ts
it("returns availability only for requested day", async () => {
  // mock appointments + locks + blocks
  // expect slots only for input date
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/availability/service.test.ts`  
Expected: FAIL (new function missing).

**Step 3: Write minimal implementation**

- Add `getDayAvailability(month, date, now?)` that reuses same rules as month availability.
- No schema/DB changes.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/availability/service.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/availability/service.ts tests/lib/availability/service.test.ts
git commit -m "feat: add day-level availability service"
```

### Task 3: Confirmar impacto de migración/compatibilidad

**Files:**
- Reference: `prisma/schema.prisma`
- Reference: `docs/specification.md`

**Step 1:** Verificar explícitamente que no hay cambios de DB ni migraciones.  
**Step 2:** Registrar en entrega de ejecución `Schema changes required: No`.

### Fase 2: UI/UX flow

### Task 4: Refresco en selección de día usando API mensual (Iteración 1)

**Files:**
- Modify: `hooks/booking/use-booking-wizard.ts`
- Modify Test: `tests/app/booking-wizard.test.tsx`

**Step 1: Write the failing test**

```ts
it("refreshes availability when user selects a day", async () => {
  // click day button
  // expect refreshDays(month) called once
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/app/booking-wizard.test.tsx`  
Expected: FAIL.

**Step 3: Write minimal implementation**

- Introduce `handleDaySelection(date)` action.
- Trigger `refreshDays(month)` on day select.
- Update only selected day slots in UI state (`currentDays`) and normalize draft accordingly.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/app/booking-wizard.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/booking/use-booking-wizard.ts tests/app/booking-wizard.test.tsx
git commit -m "feat: refresh month availability on day select"
```

### Task 5: Control de carreras + reintento corto único (Iteración 1)

**Files:**
- Modify: `hooks/booking/use-booking-wizard.ts`
- Modify Test: `tests/app/booking-wizard.test.tsx`

**Step 1: Write the failing test**

```ts
it("ignores stale availability response when a newer day request exists", async () => {
  // simulate two quick day selections with delayed promises
  // assert only latest response applies
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/app/booking-wizard.test.tsx`  
Expected: FAIL.

**Step 3: Write minimal implementation**

- Add request sequencing (`requestId` / monotonic counter).
- Apply result only if request is latest.
- Keep one short retry (300–800ms; default 500ms) if snapshot unchanged.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/app/booking-wizard.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add hooks/booking/use-booking-wizard.ts tests/app/booking-wizard.test.tsx
git commit -m "fix: prevent stale day-availability race in booking wizard"
```

### Task 6: UX de “actualizando slots” por día

**Files:**
- Modify: `components/booking/booking-wizard-step1.tsx`
- Modify: `components/booking/booking-wizard.tsx`
- Modify Test: `tests/app/booking-wizard.test.tsx`

**Step 1: Write the failing test**

```ts
it("shows day-slot refresh state while selected day availability is updating", async () => {
  // expect loading indicator / disabled slots region
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/app/booking-wizard.test.tsx`  
Expected: FAIL.

**Step 3: Write minimal implementation**

- Add `isRefreshingSelectedDaySlots` state.
- Show non-blocking inline loading in slots section.
- Keep selected day visible; no full-form blocking.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/app/booking-wizard.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/booking/booking-wizard-step1.tsx components/booking/booking-wizard.tsx tests/app/booking-wizard.test.tsx
git commit -m "feat: add selected-day slot refresh UI state"
```

### Task 7: Integrar endpoint por día (Iteración 2)

**Files:**
- Modify: `lib/booking/api-client.ts`
- Modify: `hooks/booking/use-booking-wizard.ts`
- Modify Test: `tests/lib/booking/api-client.test.ts`
- Modify Test: `tests/app/booking-wizard.test.tsx`

**Step 1: Write the failing tests**

```ts
it("fetchDayAvailability requests /api/availability/:month/:date", async () => { /* ... */ });
it("uses day endpoint on day selection and updates only that day slots", async () => { /* ... */ });
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/booking/api-client.test.ts tests/app/booking-wizard.test.tsx`  
Expected: FAIL.

**Step 3: Write minimal implementation**

- Add `fetchDayAvailability(month, date)` helper (`cache: "no-store"`).
- In day selection flow, use day endpoint first.
- Fallback to monthly refresh only on day-endpoint failure (non-blocking).

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/booking/api-client.test.ts tests/app/booking-wizard.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/booking/api-client.ts hooks/booking/use-booking-wizard.ts tests/lib/booking/api-client.test.ts tests/app/booking-wizard.test.tsx
git commit -m "feat: use day-level availability endpoint on day selection"
```

### Fase 3: pruebas y rollout

### Task 8: Cobertura de API y regresión funcional

**Files:**
- Test: `tests/app/api-availability-day.test.ts`
- Test: `tests/app/booking-wizard.test.tsx`
- Test: `tests/e2e/booking.spec.ts`
- Test: `tests/e2e/locking.spec.ts`

**Step 1:** Ejecutar unit/api.

Run:

```bash
npm run test -- tests/app/api-availability-day.test.ts tests/app/api-availability-month.test.ts tests/lib/availability/service.test.ts tests/lib/booking/api-client.test.ts tests/app/booking-wizard.test.tsx
```

Expected: PASS.

**Step 2:** Agregar/ajustar e2e para cambio rápido de día y refresco de slots.

- Caso: seleccionar día A, cambiar a B rápidamente, verificar slots de B (no stale).
- Caso: lock activo + refresh + selección inmediata del mismo día, verificar que tras revalidación aparece slot sin doble refresh manual.

**Step 3:** Ejecutar e2e.

Run:

```bash
npm run test:e2e -- tests/e2e/booking.spec.ts tests/e2e/locking.spec.ts
```

Expected: PASS (o documentar skips del entorno).

**Step 4:** Commit

```bash
git add tests/e2e/booking.spec.ts tests/e2e/locking.spec.ts tests/app/booking-wizard.test.tsx
git commit -m "test: cover real-time day availability interactions"
```

### Task 9: Documentación contractual

**Files:**
- Modify: `docs/specification.md`
- Modify: `docs/features/booking-flow.md`
- Modify: `docs/architecture/business-rules.md`

**Step 1:** Añadir contrato de actualización al seleccionar día (near real-time / day endpoint).  
**Step 2:** Documentar fallback y comportamiento ante errores de refresco.  
**Step 3:** Alinear criterios de aceptación del flujo booking.

**Step 4:** Validar consistencia con reglas de negocio existentes (`lock`, TTL, concurrencia).

**Step 5:** Commit

```bash
git add docs/specification.md docs/features/booking-flow.md docs/architecture/business-rules.md
git commit -m "docs: define real-time day availability behavior in booking flow"
```

### Fase 4: cleanup técnico

### Task 10: Consolidación y guardrails

**Files:**
- Modify (if needed): `hooks/booking/use-booking-wizard.ts`
- Modify (if needed): `components/booking/booking-wizard-step1.tsx`
- Modify (if needed): `lib/booking/api-client.ts`

**Step 1:** Eliminar lógica duplicada de refresh mensual vs diario.  
**Step 2:** Centralizar utilidades de comparación/merge de días.  
**Step 3:** Verificar que no hay setState después de unmount.

**Step 4:** Run full targeted suite:

```bash
npm run test
```

Expected: PASS.

**Step 5:** Commit final

```bash
git add -A
git commit -m "refactor: cleanup real-time day availability flow"
```

## Test Plan (Scenarios)
1. Selección de día dispara actualización de disponibilidad.
2. Solo slots del día visible cambian (no flicker global del mes).
3. Dos selecciones rápidas: gana la respuesta más reciente.
4. Si endpoint diario falla, UI no se rompe (fallback controlado).
5. Lock flow sigue íntegro (`pagehide + sendBeacon`, TTL, confirm/release).
6. Reload race mitigada sin requerir segundo refresh manual.
7. Estados de loading/error en step 1 claros y no bloqueantes.

## Assumptions / Defaults
- Se implementan **Iteración 1 + Iteración 2** en el mismo esfuerzo; Iteración 3 de hardening queda incluida como cierre técnico.
- Delay de retry corto por defecto: **500ms** (dentro de 300–800ms).
- No hay cambios de esquema ni migraciones.
- Se mantiene `DELETE /api/reservar/lock` y `POST /api/reservar/lock/release-beacon` sin cambios de semántica.
- Timezone y reglas de disponibilidad siguen regidas por `America/Mexico_City`.

## Documentation Impact
- Sí requiere cambios.
- `docs/specification.md`: flujo booking, validaciones de disponibilidad en selección de día, recuperación/error.
- `docs/features/booking-flow.md`: paso de selección de día con consulta near real-time + endpoint diario.
- `docs/architecture/business-rules.md`: regla de actualización de disponibilidad por interacción.

Flow Contract Check:
- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: No
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes
