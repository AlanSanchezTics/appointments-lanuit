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
7. Admin puede tocar botón `Modalidad` junto al título del mes para abrir modal de configuración.
8. En el modal de modalidad selecciona:
   - `Bloques de horarios` (`BLOCK_MODE`): base `09:00,10:00,13:00,14:00,17:00,18:00`.
   - `Horario fijo` (`SECOND_ONLY_MODE`): base `10:00,14:00,18:00`.
   - frontend ejecuta `PATCH /api/admin/months/[month]/slot-mode`.
9. Debajo del calendario, admin puede abrir `Bloquear espacios`.
10. `Bloquear espacios` abre `BottomSheetModal` con:
   - selector horizontal de días bloqueables,
   - selector de visualización de espacios (`Por hora` / `Por bloque`) solo en `BLOCK_MODE`,
   - en `SECOND_ONLY_MODE` solo se muestra `Por hora`,
   - selección múltiple de slots bloqueables (en `Por bloque`, cada tarjeta selecciona el par direccional completo),
   - acción masiva `Seleccionar todo` (selecciona todos los slots bloqueables del día activo),
   - acción `Limpiar selección` (resetea la selección de slots),
   - selección única de motivo (`DESCANSO`, `PERSONAL`, `OTRO`).
11. Al confirmar:
   - UI bloquea todas las interacciones del modal mientras procesa,
   - frontend ejecuta `POST /api/admin/months/[month]/blocked-slots`,
   - backend persiste bloqueo por slot en `blocked_slots`,
   - frontend refresca detalle mensual (métricas + calendario).
   - disponibilidad pública/admin del día se recalcula con regla direccional de bloqueos manuales:
     - slot único bloqueado en par => propagación direccional,
     - par completo bloqueado => sin propagación adicional,
     - día completo bloqueado => sin disponibilidad.
12. Admin toca un día del calendario y se abre modal de detalle diario.
13. Frontend solicita `GET /api/admin/months/[month]/days/[date]/agenda`.
14. Modal muestra agenda cronológica del día con acciones por cita:
   - Cada fila incluye hora + nombre + teléfono (subtítulo).
   - `Editar`: reprogramar fecha+slot dentro del mismo mes.
     - Al guardar edición, el subformulario se cierra de inmediato.
     - Mientras procesa la mutación, las acciones de la fila se reemplazan por spinner.
     - Al finalizar, la agenda diaria se refresca con los cambios persistidos.
   - `Eliminar`: solicita confirmación y luego cancela cita (estado `CANCELLED`).

## Reglas de cálculo

- Confirmadas:
  - estados activos (`CONFIRMED`, `SYNC_FAILED`) dentro del mes.
- Canceladas:
  - estado `CANCELLED` dentro del mes.
- Espacios disponibles:
  - `(días hábiles del mes * 3) - (citas activas + espacios bloqueados)`.
- Espacios bloqueados:
  - total de slots persistidos en `blocked_slots` para el mes.
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
4. `date` fuera de `month`:
   - API agenda responde `DATE_OUTSIDE_MONTH`.
5. Reprogramación con conflicto:
   - API responde `SLOT_NOT_AVAILABLE` o `SLOT_LOCKED`.
6. Bloqueo manual con conflicto:
   - API responde `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED` o `BLOCKED_SLOT_ALREADY_EXISTS`.
7. Cambio de modalidad en mes pasado:
   - API responde `MONTH_IN_PAST` (`422`).
