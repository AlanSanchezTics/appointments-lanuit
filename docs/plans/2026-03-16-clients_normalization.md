# Feature Planning Report

## 1. Summary

Normalizar clientes separando `clients` de `appointments`, reutilizando cliente por teléfono, y actualizar el wizard para flujo condicional por existencia de cliente.  
Corrección aplicada: **tanto cliente existente como cliente nuevo deben hacer `check + lock`** antes de avanzar a confirmación.

## 2. Current System Understanding

- Stack: Next.js 15, React 19, Prisma/MySQL, Zod, Vitest, Playwright.
- Hoy `appointments` guarda `name` y `phone`; no existe `clients`.
- Flujo actual UI: `details -> confirm -> success`.
- Lock temporal (`/api/reservar/lock`) se crea al avanzar a confirmación.
- Confirmación (`/api/reservar/confirm`) valida lock y crea cita.
- Endpoint legacy `/api/reservar` sigue activo.

## 3. Gaps, Risks, and Ambiguities

- Falta normalización de cliente (duplicados por teléfono).
- Muchas capas asumen `appointments.name/phone`.
- Riesgo de carrera en creación de cliente sin unique/upsert.
- Riesgo de rollout si se eliminan columnas legacy antes de tiempo.
- Decisiones cerradas:
  - Teléfono normalizado a 10 dígitos.
  - Mantener `/api/reservar` temporalmente.
  - Si backfill detecta mismo teléfono con nombres distintos: fallar migración y reportar.

## 4. Proposed Data Model

- Nueva tabla `clients`:
  - `id`, `name`, `phone UNIQUE`, timestamps.
- `appointments`:
  - agregar `client_id` FK + índice.
  - fase transitoria: `client_id` nullable, mantener `name/phone`.
  - fase final: `client_id` NOT NULL y drop `name/phone`.
- `reservation_locks.phone` se mantiene.
- Persistir teléfono siempre normalizado a 10 dígitos.

## 5. Backend Flow Changes

- Nuevo endpoint recomendado `POST /api/reservar/client-check-lock` (o secuencia orquestada equivalente) que haga en una transición:
  1. validar/normalizar teléfono,
  2. verificar existencia de cliente por teléfono,
  3. **crear lock temporal**.
- Resultado:
  - `clientExists=true`: avanza directo a confirm.
  - `clientExists=false`: UI solicita nombre y luego avanza a confirm con lock ya activo.
- Confirmación:
  - valida lock token/TTL,
  - resuelve cliente vía upsert por teléfono,
  - crea cita con `clientId`,
  - elimina lock,
  - sincroniza Google + arma WhatsApp.
- `/api/reservar` legacy se mantiene temporalmente usando el nuevo modelo de cliente internamente.

## 6. UI/UX Flow Changes

- Mantener estilo/componentes actuales.
- Paso 1:
  - fecha + horario + teléfono.
  - acción primaria ejecuta **check + lock**.
- Rama existente:
  - ir directo a confirm.
- Rama nuevo cliente:
  - mostrar campo nombre y botón `Siguiente`;
  - lock ya existe, solo completa dato faltante para confirmar.
- Estados:
  - loading de check+lock,
  - validación inline teléfono,
  - errores de lock/slot y recuperación,
  - contador TTL en confirm.
- Back:
  - al volver desde confirm, liberar lock.
  - preservar teléfono/nombre capturado según rama.

## 7. Migration and Rollout Plan

1. Migración 1: crear `clients` + `appointments.client_id` nullable.
2. Backfill con hard-stop si un teléfono tiene múltiples nombres.
3. Deploy app con dual-read/dual-write transitorio.
4. Verificar `client_id` completo.
5. Migración 2: `client_id` NOT NULL + drop `appointments.name/phone`.
6. Retiro progresivo de `/api/reservar` legacy.

## 8. Concurrency and Data Integrity Strategy

- `UNIQUE(clients.phone)` + upsert en transacción de confirmación.
- Mantener locks MySQL (`booking:date`, `booking:phone`) + lock temporal.
- Confirmación first-commit-wins.
- Manejo explícito de unique violation para relectura de cliente.
- TTL expirado: `LOCK_EXPIRED_OR_INVALID` y reselección.

## 9. Validation Strategy

- UI permite formato humano; backend normaliza.
- Regla final: exactamente 10 dígitos.
- Nombre mínimo 3 chars, requerido solo para cliente nuevo.
- Errores de campo inline y errores de concurrencia globales.

## 10. Impacted Areas

- `prisma/schema.prisma`, `prisma/migrations/*`
- `lib/db/appointments.ts`
- `lib/appointments/book-appointment.ts`
- `lib/appointments/lock-reservation-slot.ts` (o servicio unificado check+lock)
- `lib/validation/appointment.ts`
- `app/api/reservar/lock/route.ts`
- `app/api/reservar/confirm/route.ts`
- nuevo endpoint check+lock
- `components/booking/booking-wizard.tsx`
- `components/booking/booking-wizard-step1.tsx`
- `components/booking/booking-confirm-step.tsx`
- tests unit/integration/e2e relacionados
- `docs/specification.md`

## 11. Test Plan

- Nuevo cliente: check+lock exitoso, pide nombre, confirma y crea `client`.
- Cliente existente: check+lock exitoso, salta nombre, confirma reusando `clientId`.
- Teléfono inválido: no progresa.
- Lock conflict: error correcto y recuperación.
- Concurrencia mismo teléfono nuevo: sin duplicar cliente.
- TTL expirado: confirm falla y UX vuelve a selección.
- `/api/reservar` legacy sigue funcional en transición.

## 12. Acceptance Criteria

- Existe `clients` con unicidad por teléfono.
- Todas las nuevas citas usan `clientId`.
- Flujo UI hace **check + lock** en ambos casos (existente y nuevo).
- Nombre solo se solicita para cliente no existente.
- Lock/TTL y confirmación mantienen semántica actual.
- Cancelación/lookup continúan funcionando vía `client`.
- `docs/specification.md` alineado al flujo final.

## 13. Open Questions

- Sin bloqueantes abiertos.

## 14. Implementation Task Breakdown

### **Fase 1: backend y migraciones**
1. Crear esquema `clients` + `appointments.client_id`.
2. Backfill + validación de conflictos.
3. Implementar check+lock unificado y confirm con `clientId`.
4. Mantener compatibilidad temporal de `/api/reservar`.

### **Fase 2: UI/UX flow**
1. Ajustar wizard para ejecutar check+lock al avanzar.
2. Render condicional de nombre para cliente nuevo con lock ya activo.
3. Ajustar estados loading/error/back sin cambiar estilo visual.

### **Fase 3: pruebas y rollout**
1. Actualizar unit/API/integration/e2e del nuevo flujo.
2. Desplegar por etapas (migración+app transitoria+validación).
3. Monitorear errores de lock/validación/concurrencia.

### **Fase 4: cleanup técnico**
1. `client_id` NOT NULL.
2. Eliminar `appointments.name/phone`.
3. Retirar fallback transitorio y plan de deprecación final de `/api/reservar`.

### Documentation Impact

- Sí.
- `docs/specification.md` debe actualizarse en Flujo de Reserva, Modelo de Datos, Validaciones, Concurrencia y Casos Edge para reflejar explícitamente `check + lock` en ambas ramas.

### Flow Contract Check

```text
Flow Contract Check:
- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes (planned)
```

### Migration Compatibility Check

```text
Migration Compatibility Check:
- Schema changes required: Yes
- Data backfill required: Yes
- Legacy compatibility required: Yes
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes
```
