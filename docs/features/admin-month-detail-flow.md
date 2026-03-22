# Admin Month Detail Flow

## Objetivo

Describir el flujo operativo de detalle mensual en `/admin/months/[month]` para monitoreo de métricas y disponibilidad por día.

## Prerrequisitos

- Usuario autenticado en panel admin.
- Mes existente en `active_months`.
- Datos de `appointments` disponibles para el mes consultado.

## Flujo principal

1. Admin abre `/admin/months/[month]`.
2. Sistema valida sesión admin:
   - si no hay sesión, redirige a `/admin/login` (UI) y API responde `401 ADMIN_UNAUTHORIZED`.
3. Frontend solicita `GET /api/admin/months/[month]`.
4. Backend valida `month`:
   - formato obligatorio `YYYY-MM`,
   - existencia del mes en `active_months`.
5. Backend responde payload de detalle:
   - métricas: confirmadas, canceladas, espacios disponibles, espacios bloqueados, espacios ocupados,
   - saturación proyectada,
   - calendario diario del mes con tono operativo por disponibilidad.
6. UI renderiza bloques:
   - grid de métricas 2x2,
   - tarjeta de saturación proyectada,
   - calendario operativo mensual.

## Reglas de cálculo

- Confirmadas:
  - estados activos (`CONFIRMED`, `SYNC_FAILED`) dentro del mes.
- Canceladas:
  - estado `CANCELLED` dentro del mes.
- Espacios disponibles:
  - suma de slots disponibles por día hábil del mes.
- Espacios bloqueados:
  - `0` en MVP (bloqueo manual pendiente de implementación).
- Saturación proyectada:
  - `occupiedSpaces / (occupiedSpaces + availableSpaces) * 100` (redondeado).
- Tono de día:
  - `available` cuando hay `>= 2` espacios,
  - `low` cuando hay `1`,
  - `full` cuando hay `0`,
  - `weekend` en sábado/domingo.

## Flujos alternos

1. Mes inválido (`YYYY-MM` inválido):
   - API responde `400 MONTHS_INVALID_FORMAT`.
2. Mes no registrado en catálogo:
   - API responde `404 MONTH_NOT_REGISTERED`.
3. Error de backend:
   - API responde `400` con `errorCode` estable.
