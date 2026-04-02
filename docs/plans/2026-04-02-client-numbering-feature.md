# Client Number (Único e Incremental) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Asignar y exponer `client_number` único e incremental para todos los clientes, con asignación automática en flujo público y sugerencia editable en flujo admin.

**Architecture:** Se introduce `client_number` en `clients` con restricción única, más un servicio de dominio para resolver “siguiente número” y asignación segura con reintento por colisión. En admin, el modal de nueva cita consume una sugerencia y permite override manual antes de guardar. El backend mantiene la fuente de verdad final y valida unicidad.

**Tech Stack:** Next.js App Router, Prisma + MySQL, React hooks, react-i18next, Vitest/RTL/E2E.

---

## 1) Requerimientos

1. Persistir `client_number` en `clients` como entero único.
2. Flujo público (`/api/reservar/confirm`): cliente nuevo recibe número automático.
3. Flujo admin (`/admin/months/[month]` nueva cita):
   - sugerir siguiente número disponible,
   - permitir edición manual antes de guardar para cliente nuevo,
   - soportar autoasignación cuando el admin no lo capture.
4. Política acordada:
   - Se permiten huecos (incremental no estrictamente contiguo).
   - `client_number` no editable después de crear cliente.
   - En colisión concurrente: reintento automático backend.
5. Reflejarlo en catálogo admin:
   - lista de clientes,
   - detalle de cliente.
6. Mantener contratos de error por `errorCode` estable.

## 2) Diseño

1. **Modelo de datos**
   - Agregar `clientNumber Int @unique @map("client_number")` en `Client` (`prisma/schema.prisma`).
   - Migración en dos pasos seguros:
     - añadir columna nullable + backfill incremental para existentes,
     - convertir a NOT NULL + unique index.
2. **Servicio de numeración**
   - Nuevo módulo `lib/clients/client-number-service.ts` con:
     - `getNextClientNumberSuggestion()`,
     - `assignClientNumberForNewClient(tx, preferredNumber?)`.
   - Estrategia de concurrencia:
     - usar sugerencia por `MAX(client_number)+1`,
     - creación con número preferido/manual cuando venga,
     - ante `P2002` en `client_number`, recalcular y reintentar automáticamente con tope de intentos.
3. **Flujo público**
   - En creación de cliente nuevo dentro de `lib/appointments/book-appointment.ts`, asignar número automático.
4. **Flujo admin**
   - Extender payload `AdminCreateAppointmentPayload.client` con `clientNumber?: number`.
   - Nuevo endpoint de sugerencia `GET /api/admin/clients/next-number` (auth requerida).
   - `useBookAppointmentModal` obtiene sugerencia al entrar en modo “nuevo cliente” y la muestra editable.
   - Al guardar, enviar `client.clientNumber` si fue capturado.
5. **Catálogo y detalle admin**
   - Incluir `clientNumber` en:
     - tipos, servicios, APIs y vistas de lista/detalle.
   - UI usando componentes admin existentes y i18n (`locales/es/admin.json`, `locales/en/admin.json`).

## 3) Lista de tareas (Subagent-Driven con ownership por bloques)

1. **Bloque A — Backend + migraciones (Owner A, write set exclusivo)**
   - `prisma/schema.prisma`
   - `prisma/migrations/*client_number*/migration.sql`
   - `lib/clients/client-number-service.ts` (nuevo)
   - `tests/lib/clients/client-number-service.test.ts` (nuevo)

2. **Bloque B — Flujo público booking (Owner B, write set exclusivo)**
   - `lib/appointments/book-appointment.ts`
   - `tests/lib/appointments/book-appointment.test.ts`
   - `tests/integration/book-appointment.integration.test.ts`

3. **Bloque C — Flujo admin creación cita + sugerencia (Owner C, write set exclusivo)**
   - `app/api/admin/clients/next-number/route.ts` (nuevo)
   - `lib/admin/appointments/types.ts`
   - `lib/admin/appointments/validation.ts`
   - `lib/admin/appointments/service.ts`
   - `lib/admin/appointments/api-client.ts`
   - `hooks/admin/months/useBookAppointmentModal.ts`
   - `components/admin/months/BookAppointmentModal.tsx`
   - `tests/app/api-admin-month-appointments-route.test.ts`
   - `tests/components/admin/months/book-appointment-modal.test.tsx`

4. **Bloque D — Catálogo/detalle + documentación + cleanup (Owner D, write set exclusivo)**
   - `lib/admin/clients/types.ts`
   - `lib/admin/clients/catalog-service.ts`
   - `lib/admin/clients/detail-service.ts`
   - `components/admin/clients/ClientsList.tsx`
   - `components/admin/clients/ClientDetailView.tsx`
   - `tests/lib/admin/clients.catalog-service.test.ts`
   - `tests/lib/admin/clients.detail-service.test.ts`
   - `tests/components/admin/clients/clients-catalog-view.test.tsx`
   - `tests/components/admin/clients/client-detail-view.test.tsx`
   - `docs/specification.md`
   - `docs/architecture/business-rules.md`
   - `docs/features/booking-flow.md`
   - `docs/features/admin-clients-catalog-flow.md`
   - `docs/plans/2026-04-02-client-numbering-feature.md`

## 4) Desarrollo (modo de ejecución)

1. **Modo explícito:** `Subagent-Driven`.
2. **Secuencia obligatoria AGENTS (por fases internas):**
   - Fase 1 backend y migraciones: Bloque A.
   - Fase 2 UI/UX flow: Bloques C y D (solo UI admin + i18n).
   - Fase 3 pruebas y rollout: ejecución completa de test suite objetivo + verificación staging.
   - Fase 4 cleanup técnico: remoción de código temporal, endurecer validaciones y documentación final.
3. **Reglas de coordinación:**
   - Un bloque no modifica archivos de otro bloque.
   - Integración final en orden A → B → C → D.
   - Cualquier conflicto se resuelve moviendo ownership, no compartiendo archivo en paralelo.

## 5) Pruebas

1. **Unitarias dominio**
   - asignación automática inicial sin clientes,
   - backfill/next suggestion correcto,
   - colisión manual + reintento automático,
   - rechazo por `client_number` inválido (<=0, no entero).
2. **Unitarias/admin service**
   - create appointment con `client.clientNumber` manual único,
   - create appointment con autoasignación cuando no venga número,
   - colisión concurrente resuelta por retry.
3. **API route tests**
   - `GET /api/admin/clients/next-number` autorizado/no autorizado,
   - `POST /api/admin/months/[month]/appointments` con número manual/auto.
4. **UI tests admin**
   - modal muestra sugerencia,
   - admin puede editar número,
   - payload enviado incluye `clientNumber`,
   - lista y detalle muestran `client_number`.
5. **Integración**
   - flujo público crea cliente nuevo con `client_number`,
   - no duplicados bajo concurrencia simulada.
6. **Regresión**
   - booking/cancel/admin clients existentes sin ruptura.

## 6) Despliegue

1. Ejecutar migración en ventana controlada.
2. Ejecutar backfill y verificar:
   - total clientes con `client_number` no nulo,
   - unicidad completa (`count(distinct) == count(*)`).
3. Desplegar backend y frontend.
4. Smoke checks:
   - reserva pública cliente nuevo,
   - alta admin cliente nuevo (manual y auto),
   - visualización en catálogo/detalle.
5. Monitorear errores `P2002` y tasa de reintentos de asignación.
6. Cleanup post-rollout:
   - eliminar flags/helpers transitorios si se usaron.

## Cambios de interfaces públicas

1. `Client` (Prisma): nuevo campo `clientNumber`.
2. Admin API nuevo: `GET /api/admin/clients/next-number`.
3. Admin create appointment payload:
   - `client: { name, phone, clientNumber? }`.
4. Respuestas catálogo/detalle/admin create appointment incluyen `clientNumber` donde aplique.

## Documentation Impact

- **Sí requiere cambios.**
- `docs/specification.md`: actualizar flujo de alta cliente (público/admin), validaciones de unicidad, persistencia y concurrencia de `client_number`.
- `docs/architecture/business-rules.md`: nueva regla de identificación secundaria por número incremental único.
- `docs/features/booking-flow.md`: paso de creación cliente nuevo con autoasignación.
- `docs/features/admin-clients-catalog-flow.md`: sugerencia editable en alta admin + visualización en lista/detalle.
- Momento de actualización: durante implementación (bloque D) y validación final post-merge.

Flow Contract Check:
- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: Yes
- Data backfill required: Yes
- Legacy compatibility required: Yes
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes

## Supuestos cerrados

1. Incremental permite huecos.
2. `client_number` no se edita después de creación.
3. Concurrencia se maneja con retry automático backend.
4. Alcance UI limitado a panel admin (sin tocar UX público salvo asignación automática backend).
