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
   - tarjeta de `Ocupación proyectada para este mes`,
   - comparativa de ocupación vs mes anterior dentro de la misma tarjeta en formato `N% más/menos comparado con (mes) (año)` con icono de tendencia,
   - calendario operativo mensual,
   - tags de estado (`Activo|Inactivo`) y `Histórico` debajo del título cuando `isPastMonth=true`.
7. Si `isPastMonth=false`, admin puede tocar botón `Modalidad` en el encabezado para abrir modal de configuración.
8. En el modal de modalidad selecciona:
   - `Bloques de horarios` (`BLOCK_MODE`): base `09:00,10:00,13:00,14:00,17:00,18:00`.
   - `Horario fijo` (`SECOND_ONLY_MODE`): base `10:00,14:00,18:00`.
   - frontend ejecuta `PATCH /api/admin/months/[month]/slot-mode`.
9. Si `isPastMonth=false`, debajo del calendario admin puede usar `Compartir agenda`.
10. `Compartir agenda` se mantiene deshabilitado cuando `monthStatus=INACTIVE`.
11. Al usar `Compartir agenda`, frontend intenta copiar al portapapeles la URL pública completa `<origen>/citas/[month]` del mes actual (ej. `https://dominio.com/citas/2026-03`) y muestra toast de éxito.
    - Si clipboard no está disponible (casos frecuentes en mobile), usa fallback de copia legacy.
    - Si la copia sigue fallando y el navegador soporta Web Share API, abre el flujo nativo de compartir para la misma URL.
12. Debajo de `Compartir agenda`, admin puede abrir `Agendar nueva cita`.
13. `Agendar nueva cita` abre `BottomSheetModal` con:
   - selector horizontal de días agendables,
   - selector de horarios disponibles por día,
   - selector de cliente con dos modalidades:
     - cliente existente por búsqueda remota,
     - alta inline de cliente nuevo (nombre + teléfono + `client_number` sugerido editable),
   - CTA `Agendar cita` para ejecutar alta en backend.
14. Al confirmar `Agendar cita`:
   - backend crea la cita y ejecuta sync de calendario según reglas de dominio,
   - UI muestra vista local de éxito en el mismo bottom sheet,
   - acción `Volver` cierra modal y refresca métricas/calendario del mes.
15. Debajo de `Agendar nueva cita`, admin puede abrir `Bloquear espacios`.
16. Debajo de `Bloquear espacios`, admin visualiza CTA contextual para estado:
   - si el mes está `ACTIVE`, CTA roja `Desactivar mes`,
   - si el mes está `INACTIVE`, CTA verde `Activar mes`.
17. Al tocar la CTA de estado:
   - frontend ejecuta `PATCH /api/admin/months/[month]/status` con el estado destino,
   - backend actualiza `active_months.status`,
   - UI refresca detalle mensual al finalizar.
18. `Bloquear espacios` abre `BottomSheetModal` con:
   - selector horizontal de días bloqueables,
   - selector de visualización de espacios (`Por hora` / `Por bloque`) solo en `BLOCK_MODE`,
   - en `SECOND_ONLY_MODE` solo se muestra `Por hora`,
   - selección múltiple de slots bloqueables (en `Por bloque`, cada tarjeta selecciona el par direccional completo),
   - acción masiva `Seleccionar todo` (selecciona todos los slots bloqueables del día activo),
   - acción `Día completo` (bloquea el día completo en una sola operación),
   - acción `Limpiar selección` (resetea la selección de slots),
   - selección única de motivo (`DESCANSO`, `PERSONAL`, `OTRO`).
19. Al confirmar:
   - UI bloquea todas las interacciones del modal mientras procesa,
   - frontend ejecuta `POST /api/admin/months/[month]/blocked-slots`,
   - backend persiste bloqueo por slot en `blocked_slots`,
   - si la acción fue `Día completo`, backend persiste un marcador de bloqueo diario en `blocked_slots` sin crear una fila por cada hora,
   - frontend refresca detalle mensual (métricas + calendario).
   - disponibilidad pública/admin del día se recalcula con regla direccional de bloqueos manuales:
     - slot único bloqueado en par => propagación direccional,
     - par completo bloqueado => sin propagación adicional,
     - día completo bloqueado => sin disponibilidad.
20. Si `isPastMonth=true`, no se renderiza el bloque completo de 4 CTAs (`Compartir agenda`, `Agendar nueva cita`, `Bloquear espacios`, `Activar|Desactivar mes`).
21. Admin toca un día del calendario y se abre modal de detalle diario.
22. Frontend solicita `GET /api/admin/months/[month]/days/[date]/agenda`.
23. Modal muestra agenda cronológica del día con acciones por cita y sección de espacios bloqueados:
   - Incluye acciones rápidas:
     - `Bloquear día`: se muestra solo cuando el día está completamente disponible (sin citas ni bloqueos) y bloquea el día completo en una sola operación.
     - `Bloquear resto de espacios`: se muestra cuando el día ya tiene al menos una cita y bloquea todos los espacios aún elegibles del día.
   - Las acciones rápidas se muestran solo cuando existen espacios bloqueables para ese día; si el día queda totalmente bloqueado o sin espacios elegibles, se ocultan.
   - Cada fila incluye hora + nombre + teléfono (subtítulo).
   - `Editar`: reprogramar fecha+slot dentro del mismo mes solo para citas futuras.
     - Al guardar edición, el subformulario se cierra de inmediato.
     - Mientras procesa la mutación, las acciones de la fila se reemplazan por spinner.
     - Al finalizar, la agenda diaria se refresca con los cambios persistidos.
   - `Editar` en citas pasadas permanece deshabilitado y debe mostrar feedback explícito de no editable.
   - `Eliminar`: solicita confirmación y luego cancela cita (estado `CANCELLED`) tanto para citas pasadas como futuras.
   - En `Espacios bloqueados`:
     - `Editar`: permite cambiar motivo (`DESCANSO`, `PERSONAL`, `OTRO`) y guardar solo en slots futuros.
     - `Editar` en slots pasados permanece deshabilitado y debe mostrar feedback explícito de no editable.
     - `Eliminar`: solicita confirmación y elimina el bloqueo manual tanto en slots pasados como futuros.
     - cuando el día está bloqueado completo, se muestra como un único item y `Eliminar` desbloquea todo el día en una sola acción.
     - Ambas acciones refrescan agenda diaria y métricas/calendario del mes al finalizar.

## Reglas de cálculo

- Confirmadas:
  - estados activos (`CONFIRMED`, `SYNC_FAILED`) dentro del mes.
- Canceladas:
  - estado `CANCELLED` dentro del mes.
- Espacios disponibles:
  - `(días hábiles del mes * 3) - (citas activas + espacios bloqueados)`.
- Espacios bloqueados:
  - unidades de capacidad bloqueada por modalidad:
    - `BLOCK_MODE`: un espacio bloqueado = par direccional completo bloqueado.
    - `SECOND_ONLY_MODE`: un espacio bloqueado = un slot base bloqueado.
    - bloqueo de día completo = `3` espacios bloqueados.
- Ocupación proyectada para este mes:
  - `occupiedSpaces / (occupiedSpaces + availableSpaces) * 100` (redondeado).
- Comparativa contra mes anterior:
  - `previousProjectedSaturationPercent`: misma fórmula aplicada al mes previo.
  - `deltaPercentPoints`: diferencia `actual - mesAnterior` en puntos porcentuales.
  - UI deriva texto de tendencia:
    - `delta > 0`: `N% más` + icono `ArrowCircleUp` en verde.
    - `delta < 0`: `N% menos` + icono `ArrowCircleDown` en rojo.
    - `delta = 0`: `Misma ocupación comparada con el mes anterior` + icono `MinusCircle` neutro.
- Tono de día:
  - `available` cuando hay `>= 2` espacios,
  - `low` cuando hay `1`,
  - `full` cuando hay `0`,
  - `weekend` en sábado/domingo.
- Semáforo UI del calendario:
  - disponibilidad alta (`available`) usa fondo azul y texto azul,
  - disponibilidad nula por citas agendadas (`full` con cupo cubierto por citas) usa fondo verde y texto verde,
  - disponibilidad nula por espacios bloqueados (`full` con slots bloqueados) y fines de semana (`weekend`) usa fondo gris y texto gris.

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
8. Cambio de estado en mes pasado:
   - API responde `MONTH_IN_PAST` (`422`).

## Contrato backend para agendado admin (Fase 1)

- Endpoint de búsqueda de clientes:
  - `GET /api/admin/clients/search?query=<texto>&limit=<n>`
  - requiere sesión admin (`401 ADMIN_UNAUTHORIZED`).
  - responde `{ query, total, clients[] }` con `clients[] = { clientId, clientNumber, name, phone }`.
- Endpoint de sugerencia de número de cliente:
  - `GET /api/admin/clients/next-number`
  - requiere sesión admin (`401 ADMIN_UNAUTHORIZED`).
  - responde `{ nextClientNumber }`.
- Endpoint de creación de cita desde admin:
  - `POST /api/admin/months/[month]/appointments`
  - requiere sesión admin (`401 ADMIN_UNAUTHORIZED`).
  - soporta payload con cliente existente:
    - `{ date, timeSlot, clientId }`
  - soporta payload con alta inline de cliente:
    - `{ date, timeSlot, client: { name, phone, clientNumber? } }`
  - reglas de dominio aplicadas:
    - `month` registrado y `ACTIVE`,
    - disponibilidad del slot (ocupación + locks + bloqueos manuales + reglas direccionales),
    - permite múltiples citas activas futuras para el mismo cliente/teléfono cuando agenda admin,
    - validaciones de identidad por teléfono/nombre,
    - `clientNumber` opcional; si se omite, backend asigna automáticamente el siguiente disponible.
  - respuesta exitosa (`201`):
    - `{ appointmentId, date, timeSlot, status, client, syncReason? }`
