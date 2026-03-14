# Temporal Slot Locking During Reservation Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bloquear temporalmente un slot al entrar al Paso 2 (confirmación), con expiración a 10 minutos, evitando dobles reservas antes de confirmar.

**Architecture:** Mantener MySQL/Prisma como fuente de verdad e introducir una tabla `reservation_locks` con expiración (`expires_at`) para lock temporal robusto ante concurrencia y reinicios. El flujo UI/API se divide en `acquire lock` (al pasar a Paso 2), `confirm` (convierte lock en cita), y `release/expire` (abandono o timeout). Google Calendar seguirá ejecutándose solo después de persistir la cita confirmada.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma + MySQL, Vitest, Playwright.

---

## Summary

- Estado actual detectado:
  1. La reserva hoy se confirma directamente en `POST /api/reservar` sin estado temporal.
  2. Ya existe protección concurrente con `GET_LOCK` + `SELECT ... FOR UPDATE` en `bookAppointment`.
  3. Disponibilidad mensual se calcula desde citas activas (`CONFIRMED`, `SYNC_FAILED`).
  4. Google Calendar se sincroniza después de commit DB, y si falla marca `SYNC_FAILED`.
- Decisión de estrategia de locking:
  1. Se elige **Option A (Database Lock Table)**, no Redis.
  2. Razón: el sistema ya está centrado en MySQL/Prisma, sin Redis operativo, y la expiración puede resolverse con `expires_at` + filtros transaccionales de forma consistente.
  3. Política de TTL confirmada: **fijo de 10 minutos (sin auto-renovación)**.

## Public Interfaces and Data Model Changes

- Nuevas rutas API:
  1. `POST /api/reservar/lock` para crear/renovar lock de slot al entrar a confirmación.
  2. `DELETE /api/reservar/lock` para liberar lock cuando usuario regresa/abandona.
  3. `POST /api/reservar/confirm` para confirmar usando lock válido (reemplaza submit final directo a `/api/reservar` en el wizard).
- Cambios de contrato en frontend:
  1. Paso 1 -> Paso 2: primero intenta lock; si falla, muestra conflicto y no avanza.
  2. Confirmar cita: envía `lockId` o `lockToken` junto con datos de reserva.
- Cambios DB/Prisma:
  1. Nueva tabla `reservation_locks` (`id`, `date`, `time_slot`, `phone`, `lock_token`, `expires_at`, `created_at`, `updated_at`).
  2. Índices: `INDEX(date, time_slot, expires_at)`, `UNIQUE(lock_token)`, `INDEX(phone, expires_at)`.
  3. Estados de lock (modelo de proceso, no enum de `appointments`): `PENDING` (vigente), `CONFIRMED` (consumido al reservar), `EXPIRED` (derivado por tiempo; no requiere columna de estado).
  4. `appointments` mantiene estados actuales (`CONFIRMED`, `CANCELLED`, `SYNC_FAILED`) sin agregar `PENDING`.

## Implementation Phases (Decision-Complete)

### Phase 1: Reservation Flow Analysis and Lock Insertion Point

- Objetivo:
  1. Documentar el punto exacto en UI y backend donde se adquiere lock (al pasar a `step === "confirm"`).
  2. Definir payload mínimo de lock (`date`, `timeSlot`, `phone`, `name`, `lockToken`).
- Archivos clave:
  1. [components/booking/booking-wizard.tsx](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/booking/booking-wizard.tsx)
  2. [components/booking/booking-confirm-step.tsx](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/booking/booking-confirm-step.tsx)
  3. [app/api/reservar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/reservar/route.ts)
- Resultado:
  1. Flujo nuevo: Step1 valida -> lock -> Step2 confirma -> confirm API crea cita.

### Phase 2: Temporary Lock Infrastructure

- Objetivo:
  1. Crear persistencia y servicios de lock temporal con expiración fija.
  2. Impedir que otros usuarios reserven o lockeen el mismo slot mientras haya lock vigente.
- Archivos clave:
  1. [prisma/schema.prisma](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/prisma/schema.prisma)
  2. [lib/db/appointments.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/db/appointments.ts)
  3. [lib/availability/service.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/availability/service.ts)
- Cambios:
  1. Crear modelo `ReservationLock` en Prisma + migración SQL.
  2. Nuevo servicio `lib/appointments/lock-reservation-slot.ts` con create/release/validate-expiration.
  3. Ajustar disponibilidad para excluir slots con locks vigentes.
  4. Reusar locks actuales (`GET_LOCK`) para serializar creación de lock por `date`/`phone`.

### Phase 3: Reservation Confirmation with Lock Consumption

- Objetivo:
  1. Confirmar cita solo si lock sigue vigente y pertenece al `lockToken`.
  2. Consumir lock dentro de la misma transacción que inserta cita.
- Archivos clave:
  1. [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts)
  2. [lib/calendar/sync-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/calendar/sync-appointment.ts)
  3. [app/api/reservar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/reservar/route.ts)
- Cambios:
  1. Separar `bookAppointment` en dos caminos: confirmación con lock (nuevo) y fallback interno (si se conserva ruta vieja temporalmente).
  2. Si lock expiró o no coincide token -> error `LOCK_EXPIRED_OR_INVALID` (409).
  3. Google Calendar se mantiene post-commit, sin evento cuando lock expira/abandona.

### Phase 4: Lock Expiration and Cleanup

- Objetivo:
  1. Liberación automática por `expires_at` sin cron obligatorio.
  2. Limpieza oportunista para mantener tabla acotada.
- Cambios:
  1. Todas las consultas de lock consideran solo `expires_at > now`.
  2. Agregar cleanup liviano en rutas de lock/confirm (`DELETE WHERE expires_at <= now`) en ventana acotada.
  3. Endpoint `DELETE /api/reservar/lock` libera lock explícitamente al volver atrás.
  4. UX: contador de 10 minutos en confirmación; al vencer, regresar a Step1 con mensaje.
  5. Política explícita sin cron:
     - `POST /api/reservar/lock`: ejecutar cleanup liviano antes de crear lock.
     - `POST /api/reservar/confirm`: ejecutar cleanup liviano antes de validar/consumir lock.
     - `GET /api/availability/[month]`: no borra registros; solo filtra locks vigentes (`expires_at > now`).

### Phase 6: Deep Cleanup Operations

- Objetivo:
  1. Controlar crecimiento histórico de `reservation_locks` sin depender de cron interno.
- Cambios:
  1. Agregar script manual `scripts/cleanup-reservation-locks.mjs` que elimine locks expirados antiguos por lotes.
  2. Umbral de retención recomendado: conservar expirados recientes y borrar los que tengan más de 7 días.
  3. Cadencia operativa recomendada: ejecutar cleanup profundo 1 vez por semana (o bajo alerta de tamaño de tabla).
  4. Comando operativo: `node --env-file=.env scripts/cleanup-reservation-locks.mjs --older-than-days=7 --batch=5000`.
  5. Documentar runbook en `docs/` con criterio de ejecución ad-hoc (p. ej. tabla > 100k filas).

### Phase 5: Concurrency Hardening

- Objetivo:
  1. Garantizar first-commit-wins con lock temporal + confirmación transaccional.
  2. Evitar carreras lock-vs-confirm y confirm-vs-confirm.
- Cambios:
  1. En confirmación: validar lock vigente `FOR UPDATE`, validar disponibilidad final, insertar cita, invalidar lock, commit.
  2. Errores normalizados: `LOCK_TIMEOUT`, `SLOT_NOT_AVAILABLE`, `LOCK_EXPIRED_OR_INVALID`, `PHONE_ALREADY_BOOKED`.
  3. Mantener compatibilidad de errores 409 en APIs.

## Test Plan

- Unit (Vitest):
  1. Crea lock con TTL 10 minutos.
  2. Rechaza lock duplicado para mismo slot con lock vigente.
  3. Expiración lógica: lock vencido no bloquea disponibilidad.
  4. Confirmación consume lock válido y crea cita.
  5. Confirmación rechaza lock expirado/token incorrecto.
  6. Google no se dispara si lock no confirma.
- Integration (Vitest + DB):
  1. Dos usuarios intentan lockear mismo slot: uno gana, otro falla.
  2. Lock vigente bloquea selección/confirmación de segundo usuario.
  3. Al expirar lock, tercer intento logra lock y confirmación.
  4. Confirmación concurrente sobre mismo lock: solo una exitosa.
- E2E (Playwright):
  1. Usuario A entra a Paso 2 y bloquea slot; Usuario B no puede tomarlo.
  2. Al pasar 10 min, slot vuelve a aparecer.
  3. Confirmación exitosa crea cita y devuelve payload de éxito.
  4. Flujo de retorno desde Paso 2 libera lock y reabre slot.
- Operacional:
  1. Test del script de cleanup profundo: borra solo expirados fuera de retención y preserva locks vigentes.
  2. Smoke test manual de cleanup en staging con conteo antes/después.

## Files to Modify/Add

- Modificar:
  1. [components/booking/booking-wizard.tsx](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/booking/booking-wizard.tsx)
  2. [app/api/reservar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/reservar/route.ts)
  3. [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts)
  4. [lib/db/appointments.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/db/appointments.ts)
  5. [lib/availability/service.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/availability/service.ts)
  6. [prisma/schema.prisma](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/prisma/schema.prisma)
- Crear:
  1. `app/api/reservar/lock/route.ts`
  2. `app/api/reservar/confirm/route.ts`
  3. `lib/appointments/lock-reservation-slot.ts`
  4. Nueva migración Prisma para `reservation_locks`
  5. `scripts/cleanup-reservation-locks.mjs`
  6. Tests unit/integration/e2e de locking temporal

## Assumptions and Defaults

1. Lock TTL fijo de 10 minutos desde creación, sin heartbeat.
2. Lock owner se identifica con `lockToken` generado en cliente (UUID) y validado en backend.
3. No se introduce Redis; toda consistencia queda en MySQL.
4. No se altera el modelo de estados de `appointments`.
5. El lock temporal no crea eventos Google ni registros de cita hasta confirmación final.
6. Se aplica cleanup lazy en endpoints críticos y cleanup profundo/manual semanal (sin cron interno).
