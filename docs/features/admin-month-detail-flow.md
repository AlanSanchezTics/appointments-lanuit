# Admin Month Detail Flow

## Objetivo

Describir el flujo operativo de detalle mensual en `/admin/months/[month]` para monitoreo de métricas, configuración de disponibilidad del mes y gestión de citas y bloqueos por día.

## Prerrequisitos

- Usuario autenticado en panel admin.
- Mes existente en `active_months` (registrado en el catálogo). Puede estar `ACTIVE` o `INACTIVE`.
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
   - calendario diario del mes con tono operativo por disponibilidad (`available`, `low`, `full`, `closed`).
6. UI renderiza bloques:
   - grid de métricas 2x2,
   - tarjeta de `Ocupación proyectada para este mes`,
   - comparativa de ocupación vs mes anterior dentro de la misma tarjeta en formato `N% más/menos comparado con (mes) (año)` con icono de tendencia,
   - calendario operativo mensual,
   - tags de estado (`Activo|Inactivo`) y `Histórico` debajo del título cuando `isPastMonth=true`.
7. Si `isPastMonth=false`, el bloque de acciones del mes incluye el botón `Reglas`. Abre el editor de disponibilidad (sección "Editor de reglas y excepciones"). Reemplaza al antiguo selector `Modalidad`, que ya no existe.
8. Si `isPastMonth=false`, debajo del calendario admin puede usar `Compartir agenda`.
9. `Compartir agenda` se mantiene deshabilitado cuando `monthStatus=INACTIVE`. `Agendar cita` (mes y día) permanece habilitado aunque el mes sea `INACTIVE`: el admin puede agendar en meses inactivos.
10. Al usar `Compartir agenda`, frontend intenta copiar al portapapeles la URL pública completa `<origen>/citas/[month]` del mes actual (ej. `https://dominio.com/citas/2026-03`) y muestra toast de éxito.
    - Si clipboard no está disponible (casos frecuentes en mobile), usa fallback de copia legacy.
    - Si la copia sigue fallando y el navegador soporta Web Share API, abre el flujo nativo de compartir para la misma URL.
11. Admin puede abrir `Agendar nueva cita`.
12. `Agendar nueva cita` abre `BottomSheetModal` con:
    - selector horizontal de días del mes,
    - selector de horarios del día (ver "Horarios ofrecidos"),
    - selector de cliente con dos modalidades:
      - cliente existente por búsqueda remota,
      - alta inline de cliente nuevo (nombre + alias opcional + teléfono + `client_number` sugerido editable),
    - CTA `Agendar cita` para ejecutar alta en backend.
13. Al confirmar `Agendar cita`:
    - backend crea la cita y ejecuta sync de calendario según reglas de dominio,
    - UI muestra vista local de éxito en el mismo bottom sheet,
    - acción `Volver` cierra modal y refresca métricas/calendario del mes.
14. Debajo de `Agendar nueva cita`, admin puede abrir `Bloquear espacios`.
15. Debajo de `Bloquear espacios`, admin visualiza CTA contextual para estado:
    - si el mes está `ACTIVE`, CTA roja `Desactivar mes`,
    - si el mes está `INACTIVE`, CTA verde `Activar mes`.
16. Al tocar la CTA de estado:
    - frontend ejecuta `PATCH /api/admin/months/[month]/status` con el estado destino,
    - backend actualiza `active_months.status`,
    - UI refresca detalle mensual al finalizar.
17. `Bloquear espacios` abre `BottomSheetModal` con:
    - selector horizontal de días con al menos un horario bloqueable,
    - lista de horarios bloqueables del día activo (sin vista `Por bloque`; cada horario es un espacio),
    - selección múltiple de horarios bloqueables,
    - acción masiva `Seleccionar todo` (selecciona todos los horarios bloqueables del día activo),
    - acción `Día completo` (bloquea el día completo en una sola operación). Solo se habilita si el día tiene al menos un horario bloqueable,
    - acción `Limpiar selección` (resetea la selección de horarios),
    - selección única de motivo (`DESCANSO`, `PERSONAL`, `OTRO`).
18. Al confirmar:
    - UI bloquea todas las interacciones del modal mientras procesa,
    - frontend ejecuta `POST /api/admin/months/[month]/blocked-slots`,
    - backend persiste bloqueo por horario en `blocked_slots`,
    - backend intenta crear evento espejo por bloqueo en Google Calendar,
    - título del evento espejo:
      - bloqueo por horario => `No disponible - [Motivo]`,
      - bloqueo de día completo => `Día libre - [Motivo]`,
    - rango del evento espejo:
      - bloqueo por horario => evento de 1 hora,
      - bloqueo de día completo => evento `06:00-23:00` del mismo día (`America/Mexico_City`),
    - si la acción fue `Día completo`, backend elimina los bloqueos por horario que el día ya tenía (y sus eventos espejo) y persiste un único marcador de día completo en `blocked_slots`, sin una fila por hora,
    - si Calendar falla, el bloqueo local se conserva y backend devuelve `syncWarnings`,
    - frontend muestra advertencia operativa cuando recibe `syncWarnings`,
    - frontend refresca detalle mensual (métricas + calendario).
19. Efecto de los bloqueos en la disponibilidad del día:
    - cada horario bloqueado sale de la rejilla del día antes de calcular separación mínima y capacidad,
    - no hay propagación entre horarios: el efecto depende solo de la regla vigente,
    - un día completo bloqueado no tiene horarios ofrecibles.
20. Si `isPastMonth=true`, no se renderiza el bloque de acciones del mes (`Compartir agenda`, `Reglas`, `Agendar nueva cita`, `Bloquear espacios`, `Activar|Desactivar mes`).
21. Admin toca un día del calendario y se abre modal de detalle diario. Los días `closed` de fin de semana están deshabilitados (ver "Selección de días en el calendario").
22. Frontend solicita `GET /api/admin/months/[month]/days/[date]/agenda`.
23. Modal muestra agenda cronológica del día con acciones por cita y sección de espacios bloqueados:
    - Incluye bloque de acciones:
      - `Agendar nueva cita`: abre el mismo `BottomSheetModal` de agendado del detalle mensual con la fecha del día preseleccionada.
      - `Bloquear espacios`: abre el mismo `BottomSheetModal` de bloqueo del detalle mensual con la fecha del día preseleccionada.
    - El bloque de acciones se muestra solo cuando existen espacios elegibles para ese día; si el día queda totalmente bloqueado o sin espacios elegibles, se oculta.
    - Cada fila incluye hora + nombre + teléfono (subtítulo).
    - `Editar`: reprogramar fecha+horario dentro del mismo mes solo para citas futuras (ver "Reagendado desde la agenda diaria").
      - Al guardar edición, el subformulario se cierra de inmediato.
      - Mientras procesa la mutación, las acciones de la fila se reemplazan por spinner.
      - Al finalizar, la agenda diaria se refresca con los cambios persistidos.
      - Tras una reprogramación exitosa, además del toast de éxito, aparece un toast con acción `¿Avisar a la clienta por WhatsApp?` / botón `Enviar por WhatsApp`.
        - el botón abre `https://wa.me/52{phone}` con el mensaje `🗓️ *Nos vemos el {date} a las {time}*!` usando la nueva fecha y horario confirmados por el backend y el teléfono de la cita.
        - solo se abre por click del admin; si la reprogramación falla no se ofrece la acción. No persiste nada.
    - `Editar` en citas pasadas permanece deshabilitado y debe mostrar feedback explícito de no editable.
    - `Eliminar`: solicita confirmación y luego cancela cita (estado `CANCELLED`) tanto para citas pasadas como futuras.
    - En `Espacios bloqueados`:
      - `Editar`: permite cambiar motivo (`DESCANSO`, `PERSONAL`, `OTRO`) y guardar solo en horarios bloqueados futuros.
        - al guardar, backend intenta sincronizar el cambio de motivo en Google Calendar.
      - `Editar` en horarios pasados permanece deshabilitado y debe mostrar feedback explícito de no editable.
      - `Eliminar`: solicita confirmación y elimina el bloqueo manual tanto en horarios pasados como futuros.
        - al eliminar, backend intenta eliminar el evento espejo en Google Calendar.
        - fallos de Calendar no revierten la operación local y se reportan como `syncWarnings`.
      - cuando el día está bloqueado completo, se muestra como un único item y `Eliminar` desbloquea todo el día en una sola acción.
      - Ambas acciones refrescan agenda diaria y métricas/calendario del mes al finalizar.

## Editor de reglas y excepciones

Abre con `Reglas` (solo meses no pasados) y muestra el editor de disponibilidad del mes.

1. Carga: el editor pide `GET /api/admin/months/[month]/availability` y muestra las reglas semanales y las excepciones por fecha del mes con su `availabilityVersion`. Si la carga falla, muestra el error con `Reintentar`.
2. Valores por defecto de los ítems nuevos (D6, D10, D99):
   - regla nueva: rango = mes completo, días lunes a viernes, horario `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, separación mínima `240`, `Conservar capacidad` activado, máximo `3` citas por día;
   - excepción nueva: fecha = día 1 del mes, horario vacío (día cerrado, con aviso visible), separación `240`, `Conservar capacidad` activado, máximo `3`.
   - un mes sin reglas muestra el aviso de horario por defecto (lunes a viernes, fin de semana cerrado).
3. Entrada de horarios: el admin agrega horas con el campo de hora nativo y el botón `+` (o `Enter`). Las horas se muestran en 12 h con AM/PM y se guardan en `HH:mm` (24 h). El formato del campo nativo depende del dispositivo. `00:00` no es un horario válido.
4. Validación por ítem mientras se edita: rango dentro del mes, horas válidas, días de la semana, separación mínima entre 0 y 1440 (vacío = error), máximo entre 1 y 6 citas por día y máximo de 24 horas por día. El error aparece en la tarjeta del ítem.
5. Validación del conjunto, cuando todos los ítems son válidos: dos reglas con fechas en común (traslape) y dos excepciones con la misma fecha. `Guardar` queda deshabilitado mientras haya algún error o sin cambios.
6. Cancelar o cerrar con cambios sin guardar pide confirmación `¿Descartar cambios?`. Aparece como tarjeta superpuesta al panel, con scrim sobre el encabezado. `Seguir editando` (valor inicial del foco, también con `Escape`) mantiene el borrador. `Descartar` cierra y pierde los cambios. Tocar el scrim no hace nada.
7. Guardar:
   - frontend pide una previsualización (`POST .../availability/preview`) que devuelve las citas activas futuras que quedarían fuera de la nueva rejilla;
   - si hay citas afectadas, abre la confirmación de citas afectadas (ver "Confirmación de citas afectadas") y no escribe nada;
   - si no hay citas afectadas, envía el guardado (`PUT .../availability`) con la `expectedVersion` cargada.
8. Éxito: se muestra `Disponibilidad guardada`, el detalle del mes se recarga y el editor se cierra. Los cambios aplican de inmediato a nuevas reservas, locks y reprogramaciones.
9. Conflicto de versión: si la disponibilidad cambió desde que se abrió el editor, el servidor responde `AVAILABILITY_VERSION_CONFLICT`, no guarda nada y la UI muestra `La disponibilidad cambió mientras editabas. Cierra el editor y ábrelo de nuevo para cargar la versión actual.` El editor no recarga por sí solo.
10. Durante el guardado, controles, cierre y `Guardar` quedan bloqueados.

### Confirmación de citas afectadas

- Se abre cuando la previsualización o el guardado encuentran citas activas futuras (`PENDING`, `CONFIRMED` o `SYNC_FAILED`) que quedan fuera de la rejilla propuesta. Las citas pasadas no se listan.
- Muestra por cita fecha, hora, estado y cliente, y el total.
- `Cancelar` cierra la confirmación. No guarda la disponibilidad y no modifica nada.
- `Confirmar y guardar` reenvía el guardado con `confirmAffectedAppointments: true`. El servidor guarda la regla nueva. Las citas no cambian de fecha, hora ni estado, y no se cancelan.
- Si entre la previsualización y `Confirmar` se crea una cita nueva fuera de la rejilla, el servidor la acepta sin mostrarla en el diálogo (riesgo residual aceptado por el owner): la cita queda fuera de horario sin aviso y sin cancelarse.
- Si el 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` llega en el guardado (carrera con la previsualización), la UI abre el diálogo con la lista del cuerpo de la respuesta, sin notificación de error.

## Horarios ofrecidos

- Los horarios de `Agendar nueva cita` y de reagendado vienen de la agenda del día del servidor (`availableSlots`). La UI no calcula horarios en el navegador.
- Mientras carga la agenda del día, no hay horario seleccionado y `Agendar cita` está deshabilitado.
- Al cambiar de día, la lista y la selección visible se vacían hasta que llega la agenda del nuevo día.
- Si el horario elegido sigue ofrecido al recargar la agenda, se conserva. Si el día nuevo no lo ofrece, se elige el valor por defecto.
- Valor por defecto del reagendado: la hora actual de la cita, si el servidor la ofrece; si no, la primera ofrecida; si no hay ninguna, vacío.
- La elección explícita del admin se conserva mientras siga ofrecida, incluso al cambiar de día y volver. Cambiar de cita o cerrar el modal la reinicia.
- En la creación, si el horario elegido sigue ofrecido tras una recarga se conserva; si no, se elige el primero.

## Reagendado desde la agenda diaria

- La agenda del día de la cita se pide con `excludeAppointmentId`. Así, la hora actual de la cita aparece entre los horarios ofrecidos.
- Selector de fecha: días no pasados con espacios disponibles (`availableSpaces > 0`), más el día de la cita aunque no tenga espacios libres.
- `Guardar` queda deshabilitado mientras no haya horario seleccionado.
- Mientras la agenda del día nuevo carga, el selector de horario queda vacío, `Guardar` deshabilitado, el selector marca `aria-busy` y aparece el texto `Cargando horarios…` (`Loading times…` en inglés) con `role="status"`. El texto no aparece en recargas de la misma fecha, ni con la lista ya cargada, ni si la carga falla.
- El envío usa el horario tal como lo confirmó la última agenda. El destino se revalida en el servidor (ver contrato de reagendado admin).

## Selección de días en el calendario

- Un día `closed` de fin de semana está deshabilitado en el calendario (no se puede abrir su agenda). Un sábado o domingo abierto por una excepción usa el semáforo normal y se puede abrir.
- Un día entre semana `closed` (pasado o sin horarios) sigue siendo seleccionable para ver su agenda.

## Reglas de cálculo

- Confirmadas:
  - estados `CONFIRMED` y `SYNC_FAILED` dentro del mes.
- Canceladas:
  - estado `CANCELLED` dentro del mes.
- Ocupación para contadores y saturación:
  - las citas `PENDING` no cuentan en los contadores del mes ni en el dashboard (D66). Sí ocupan horario en la reserva pública y en las escrituras admin.
- Espacios disponibles:
  - en métricas mensuales: suma de `availableSpaces` de los días del mes, calculados con el resolvedor de disponibilidad. Los días anteriores a hoy aportan `0`.
  - en `calendarDays.availableSpaces`: citas adicionales alcanzables ese día, acotadas por `maxPerDay`, con la regla vigente, las citas activas, los locks temporales y los bloqueos manuales.
- Espacios bloqueados:
  - un horario de la rejilla del día con bloqueo manual cuenta `1`;
  - un bloqueo de día completo cuenta `1` por cada horario de la rejilla del día según la regla vigente (si la regla no produce horarios, cuenta `0`).
- Ocupación proyectada para este mes:
  - `occupiedSpaces / (occupiedSpaces + availableSpaces) * 100` (redondeado). Los días pasados sí entran en el cálculo de saturación.
- Comparativa contra mes anterior:
  - `previousProjectedSaturationPercent`: misma fórmula aplicada al mes previo con sus propias reglas.
  - `deltaPercentPoints`: diferencia `actual - mesAnterior` en puntos porcentuales.
  - UI deriva texto de tendencia:
    - `delta > 0`: `N% más` + icono `ArrowCircleUp` en verde.
    - `delta < 0`: `N% menos` + icono `ArrowCircleDown` en rojo.
    - `delta = 0`: `Misma ocupación comparada con el mes anterior` + icono `MinusCircle` neutro.
- Tono de día (`tone`):
  - `closed`: el día es anterior a hoy, o no queda ningún horario de la rejilla después de quitar los horarios bloqueados y las horas ya transcurridas. No cuenta las citas. Lo produce también un fin de semana sin regla o excepción que lo abra.
  - `available` cuando hay `>= 2` espacios,
  - `low` cuando hay `1`,
  - `full` cuando hay `0` y el día no es `closed` (por ejemplo, horarios ocupados por citas, capacidad diaria o separación mínima agotadas, o una mezcla de bloqueos y citas).
- Semáforo UI del calendario:
  - `available` usa fondo azul y texto azul;
  - `low` usa fondo amarillo y texto amarillo;
  - `full` usa fondo verde y texto verde cuando el día tiene al menos una cita activa (`appointmentsCount > 0`); si no tiene citas, usa fondo gris y texto gris (D105);
  - `closed` usa fondo gris y texto gris;
  - el día actual se marca con un fondo de acento propio.

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
   - API responde `SLOT_NOT_AVAILABLE` (hora no ofrecida por el resolvedor, día sin horarios, mes no reservable) o `SLOT_LOCKED`.
6. Bloqueo manual con conflicto:
   - API responde `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED` o `BLOCKED_SLOT_ALREADY_EXISTS`.
7. Bloqueo de día completo con conflicto:
   - `SLOT_LOCKED` si un lock temporal vigente cae en un horario de la rejilla del día;
   - `DAY_ALREADY_BLOCKED` si el día ya tiene un bloqueo de día completo;
   - `SLOT_NOT_AVAILABLE` si, con las citas activas, los locks y los bloqueos puntuales, no queda ningún horario libre. La UI no permite elegir `Día completo` en ese caso.
8. Bloqueo en un día sin horarios en las reglas: `DATE_NOT_OPERATIONAL`.
9. Cambio de reglas en mes pasado (crear, editar, eliminar reglas o excepciones, o `PATCH slot-mode`):
   - API responde `MONTH_IN_PAST` (`422`).
10. Cambio de estado en mes pasado:
    - API responde `MONTH_IN_PAST` (`422`).
11. Guardado de disponibilidad con versión vencida:
    - API responde `409 AVAILABILITY_VERSION_CONFLICT`. No guarda nada.
12. Guardado con citas afectadas sin confirmar:
    - API responde `409 AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` con la lista de citas. No guarda nada.
13. Reagendado o creación con horario que dejó de ofrecerse mientras la UI está abierta:
    - el servidor responde `SLOT_NOT_AVAILABLE` o `SLOT_LOCKED`. La UI muestra el error y el admin debe elegir otro horario de la lista actualizada.

## Contrato backend para agendado admin (Fase 1)

- Endpoint de búsqueda de clientes:
  - `GET /api/admin/clients/search?query=<texto>&limit=<n>`
  - requiere sesión admin (`401 ADMIN_UNAUTHORIZED`).
  - responde `{ query, total, clients[] }` con `clients[] = { clientId, clientNumber, name, alias, phone }`.
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
    - `{ date, timeSlot, client: { name, alias?, phone, clientNumber? } }`
    - frontend debe enviar `client.name` en forma canónica (trim) para evitar espacios residuales.
    - frontend envía `client.alias` opcional; backend normaliza trim y persiste `null` cuando queda vacío.
  - reglas de dominio aplicadas:
    - el mes debe estar registrado. Puede estar `ACTIVE` o `INACTIVE` (solo el flujo público exige `ACTIVE`),
    - disponibilidad del horario (ocupación incluida `PENDING`, locks, bloqueos manuales, separación mínima y capacidad diaria; el horario debe ser uno que el resolvedor ofrece ese día),
    - permite múltiples citas activas futuras para el mismo cliente/teléfono cuando agenda admin,
    - validaciones de identidad por teléfono/nombre,
    - `clientNumber` opcional; si se omite, backend asigna automáticamente el siguiente disponible.
  - respuesta exitosa (`201`):
    - `{ appointmentId, date, timeSlot, status, client, syncReason? }`
