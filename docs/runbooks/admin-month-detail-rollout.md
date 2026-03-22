# Runbook: Admin Month Detail Rollout

## Objetivo

Definir la secuencia operativa para desplegar y validar la vista de detalle mensual admin (`/admin/months/[month]`), su subflujo de agenda diaria en modal bottom-sheet y sus contratos API asociados.

## Prerrequisitos

- Migraciones de Fase 1/Fase 2 aplicadas (sin cambios de esquema para este feature).
- Entorno con sesión admin operativa.
- Catálogo `active_months` con al menos 1 mes registrado.
- Para smoke completo de agenda diaria, contar con al menos 1 cita `CONFIRMED` en un día hábil del mes activo.

## Pre-deploy checklist

1. Ejecutar pruebas de contrato API:
   - `tests/app/api-admin-month-detail-route.test.ts`
   - `tests/lib/admin/months.detail-service.test.ts`
   - `tests/app/api-admin-day-agenda-route.test.ts`
   - `tests/app/api-admin-reschedule-route.test.ts`
   - `tests/app/api-admin-cancel-route.test.ts`
2. Ejecutar pruebas de UI/admin:
   - `tests/components/admin/months/month-detail-view.test.tsx`
   - `tests/app/admin-month-detail-page.test.tsx`
3. Ejecutar E2E del flujo catálogo -> detalle -> modal diario:
   - `tests/e2e/admin-month-detail.spec.ts`
4. Ejecutar lint admin:
   - `npm run lint:admin-i18n`
5. Confirmar documentación alineada:
   - `docs/specification.md`
   - `docs/architecture/business-rules.md`
   - `docs/features/admin-month-detail-flow.md`

## Rollout en staging

1. Desplegar build en staging.
2. Probar navegación:
   - `/admin/months` -> click en fila -> `/admin/months/[month]`.
3. Validar casos funcionales:
   - mes registrado -> render completo,
   - mes inválido (`YYYY-13`) -> `notFound`,
   - mes no registrado -> `notFound` + API `404 MONTH_NOT_REGISTERED`.
4. Verificar estados visuales:
   - métricas 2x2 visibles,
   - saturación proyectada renderiza porcentaje y barra,
   - calendario aplica tonos correcto (`available`, `low`, `full`, `weekend`).
5. Validar flujo de agenda diaria:
   - click en día abre modal (`SlideFromBottom`) con encabezado + acción cerrar,
   - listado cronológico con filas min 72px,
   - acciones `Editar` y `Eliminar` visibles con separación 8px.
6. Verificar i18n:
   - `es` y `en` sin literales hardcoded.

## Rollout en producción

1. Deploy en ventana de bajo riesgo.
2. Smoke test inmediato:
   - login admin,
   - navegación a un mes activo,
   - apertura/cierre de modal diario desde calendario,
   - verificación de respuestas API 200:
     - `GET /api/admin/months/[month]`
     - `GET /api/admin/months/[month]/days/[date]/agenda`
3. Monitoreo inicial (30-60 min):
   - tasa de errores 4xx/5xx en `GET /api/admin/months/[month]`,
   - errores de frontend en consola/reporting.

## Plan de rollback

- Si falla UI pero API está sana:
  - rollback de frontend a versión previa.
- Si falla contrato API:
  - rollback completo al release anterior.
- Si falla sólo subflujo modal diario:
  - feature rollback por frontend (ocultar trigger de apertura modal) mientras se mantiene vista mensual.
- Confirmar post-rollback:
  - `/admin/months` funcional.
  - navegación al detalle vuelve a estado anterior estable.

## QA manual checklist

- [ ] Lista de meses navega correctamente a detalle.
- [ ] Métrica Confirmadas coincide con datos de base.
- [ ] Métrica Canceladas coincide con datos de base.
- [ ] Saturación se calcula sin división por cero.
- [ ] Fines de semana se muestran en gris.
- [ ] Días con `1` espacio se muestran en amarillo.
- [ ] Días con `0` espacios se muestran en rojo.
- [ ] Vista histórica de mes pasado muestra badge y no rompe flujo.
- [ ] Click en día abre modal diario con animación desde abajo.
- [ ] Cierre por botón `X`, clic en overlay y tecla `Escape`.
- [ ] Agenda diaria respeta orden cronológico por `timeSlot`.
- [ ] Acción editar reprograma y refresca métricas/calendario sin recargar manual.
- [ ] Acción eliminar cancela cita y la remueve de agenda operativa.
