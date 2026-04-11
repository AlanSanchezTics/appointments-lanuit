# Admin Blocked Slots -> Google Calendar Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sincronizar bloqueos manuales de slots y día completo del admin con Google Calendar, manteniendo DB local como source of truth y tolerancia a fallos de sincronización.

**Architecture:** Se extiende `blocked_slots` con metadatos de sincronización (`googleEventId`, `calendarSyncStatus`, `calendarSyncReason`). Las operaciones create/update/delete de bloqueos intentan sincronización con Calendar y devuelven `syncSummary/syncWarnings` sin revertir mutaciones locales ante fallo externo. Se agrega job de reintento por lotes para `SYNC_FAILED`.

**Tech Stack:** Next.js App Router, Prisma/MySQL, googleapis, Vitest, react-i18next, sileo.

---

## Fase 1: backend y migraciones

1. Migrar esquema `blocked_slots` para estado de sync Calendar.
2. Extender capa DB para mapear/actualizar estado de sync.
3. Implementar utilidades Calendar para eventos de bloqueos (slot y día completo).
4. Integrar sync en servicio admin `blocked-spaces` con respuesta de warnings.
5. Ajustar contratos API y pruebas de rutas.
6. Añadir job de retry para `SYNC_FAILED` y runbook operativo.

## Fase 2: UI/UX flow

1. Mostrar advertencias de sincronización en UI admin vía `sileo.warning`.
2. Mantener éxito funcional local cuando Calendar falle.
3. Resolver textos por `react-i18next` (`es/en`).

## Fase 3: pruebas y rollout

1. Cubrir unit tests para DB, service y sync de Calendar.
2. Cubrir rutas API con nuevo contrato.
3. Ejecutar suite focal + lint admin i18n.
4. Preparar checklist de despliegue y cron de retry.

## Fase 4: cleanup técnico

1. Consolidar helpers de Calendar compartidos.
2. Eliminar duplicación entre sync de citas y sync de bloqueos.
3. Verificar consistencia de contratos y documentación.

## Documentation Impact

- `docs/specification.md`: actualizado flujo y contrato de blocked slots con `syncSummary/syncWarnings`.
- `docs/architecture/business-rules.md`: agregada política de espejo Calendar para bloqueos admin.
- `docs/features/admin-month-detail-flow.md`: actualizado flujo de bloqueos con warnings no bloqueantes.
- `docs/runbooks/blocked-slots-sync-failed-retry.md`: nuevo runbook de operación.
