# My Appointments Flow

## Purpose

Describir el flujo público unificado para consultar, modificar o cancelar citas futuras desde `/my-appointments`.

`docs/specification.md` es la fuente normativa principal para este comportamiento.

## Actors

- Usuario final: captura su teléfono, consulta sus citas futuras y elige entre modificar o cancelar.
- UI pública (`/my-appointments`): guía el lookup, muestra la lista de citas con selección activa y orquesta la rama de cancelación o modificación.
- API pública de gestión de citas: lookup, cancelación y modificación.
- Servicios de dominio: validan elegibilidad, disponibilidad, ventanas temporales y sincronización externa.
- Base de datos: persiste cambios de estado y reprogramación sobre la misma cita.
- Google Calendar: sistema espejo para citas `CONFIRMED` o `SYNC_FAILED`.

## Entry Point

1. Usuario navega a `/my-appointments`.
2. La ruta legacy `/citas/cancelar` redirige a `/my-appointments`.
3. El usuario captura su teléfono.

## Main Flow

1. Usuario abre `/my-appointments`.
2. UI muestra formulario de búsqueda por teléfono.
3. Usuario envía teléfono válido.
4. Backend busca citas futuras vinculadas al teléfono capturado.
5. Si hay resultados, UI muestra la lista de citas futuras y usa la selección activa para habilitar las acciones.
6. UI expone acciones:
   - `Cancelar cita`
   - `Modificar cita`
   - cuando una cita ya no admite acciones por ventana de tiempo, debe mostrarse bloqueada con advertencia explícita.
7. La UI pública de `/my-appointments` debe reutilizar el mismo lenguaje visual del flujo público existente:
   - `booking-mobile-shell`,
   - encabezado con progreso por pasos,
   - jerarquía tipográfica y botones del sistema público,
   - layout mobile-first consistente con `/booking` y el flujo legacy de cancelación.
8. Usuario elige una rama.

## Lookup Rules

- El teléfono se normaliza a 10 dígitos.
- El lookup ignora `active_months` para la cita origen.
- Devuelve citas futuras aunque alguna ya no permita acciones por ventana de tiempo.
- Estados contemplados:
  - `PENDING`
  - `CONFIRMED`
  - `SYNC_FAILED`
- Una cita puede aparecer:
  - solo modificable,
  - solo cancelable,
  - con ambas acciones disponibles,
  - o bloqueada sin acciones disponibles por la ventana de tiempo.
- Cuando una cita no tenga acciones disponibles, la UI debe mostrarla bloqueada con advertencia de que ya no se pueden realizar cambios o cancelaciones por la ventana temporal.

## Cancellation Branch

1. Usuario selecciona una o varias citas cancelables.
2. Usuario confirma `Cancelar cita`.
3. Backend valida:
   - estado `CONFIRMED` o `SYNC_FAILED`,
   - cita futura,
   - al menos 24 horas de anticipación.
4. Backend cambia estado a `CANCELLED`.
5. Backend intenta eliminar el evento espejo en Google Calendar cuando exista `google_event_id`.
6. UI muestra éxito, intenta redirección automática única a WhatsApp y mantiene CTA de WhatsApp como fallback manual.

## Reschedule Branch

1. Usuario selecciona una cita modificable.
2. UI muestra un flujo similar a `/booking` para elegir nueva fecha y nuevo horario.
3. Backend valida:
   - estado `PENDING`, `CONFIRMED` o `SYNC_FAILED`,
   - cita futura,
   - al menos 3 horas de anticipación,
   - nuevo slot disponible según reglas del booking público.
4. El flujo no aplica:
   - `isLoyal`
   - sugerencia/umbral de 15 días
5. Backend actualiza la misma fila de `appointments`:
   - preserva `appointments.id`,
   - actualiza `date`,
   - actualiza `timeSlot`.
6. Si la cita origen estaba en `CONFIRMED` o `SYNC_FAILED`, backend intenta resincronizar Google Calendar:
   - éxito: actualiza `google_event_id` y estado final `CONFIRMED`,
   - fallo: mantiene reprogramación local y estado final `SYNC_FAILED`.
7. Si la cita origen estaba en `PENDING`:
   - no intenta sincronización,
   - conserva `google_event_id = null`,
   - permanece `PENDING`.
8. UI muestra éxito, intenta redirección automática única a WhatsApp usando `whatsapp.messageTemplate` y mantiene CTA manual visible como fallback.
9. Una reprogramación exitosa registra `Cita modificada` con actor `Cliente` y evidencia anterior/nueva en `appointment_logs.payload`.

## Validation Points

- Teléfono válido de 10 dígitos.
- Lookup sin citas futuras devuelve error estable.
- Cancelación web requiere al menos 24 horas.
- Modificación web requiere al menos 3 horas.
- La cita origen debe seguir siendo futura al confirmar.
- El nuevo slot debe seguir disponible al confirmar.

## Concurrency Considerations

- La modificación debe ejecutarse de forma transaccional.
- La disponibilidad del nuevo slot se revalida en confirmación.
- Si la cita pierde elegibilidad entre lookup y acción final, la operación se rechaza con error estable.

## Acceptance Criteria

- `/my-appointments` es la ruta pública canónica para autogestión.
- `/citas/cancelar` solo actúa como redirect.
- La clienta puede consultar la cita seleccionada antes de actuar.
- La clienta puede ver citas futuras bloqueadas cuando ya no existe una acción disponible por tiempo.
- La clienta puede cancelar citas elegibles con la regla de 24 horas.
- La clienta puede modificar citas elegibles con la regla de 3 horas.
- El flujo de modificación no aplica `isLoyal` ni la sugerencia de 15 días.
