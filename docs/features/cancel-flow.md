# Cancellation Flow

## Purpose
Describir el flujo end-to-end de cancelación de citas para que sea verificable funcionalmente, incluyendo criterios de elegibilidad, validaciones, transición de estados y efectos del sistema.

## Actors
- Usuario final: inicia la cancelación capturando su teléfono y confirma la acción.
- UI de cancelación (`/cancelar`): guía el wizard de 3 pasos, muestra datos de cita elegible, errores y confirmación final.
- API de cancelación: expone búsqueda de cita cancelable y ejecución de cancelación.
- Servicios de dominio: evalúan elegibilidad de cancelación y aplican transición de estado.
- Base de datos (fuente de verdad): persiste el cambio de estado a `CANCELLED`.
- Google Calendar: integración espejo para eliminar el evento externo cuando existe `google_event_id`.

## Preconditions
- El usuario debe proporcionar teléfono válido (normalizado a 10 dígitos).
- Debe existir una cita cancelable que cumpla simultáneamente:
- Estado `CONFIRMED`.
- Fecha futura respecto a `hoy` en `America/Mexico_City`.
- Mes activo (`ACTIVE`) dentro de `active_months`.
- Distancia mínima de 24 horas para permitir cancelación por este medio web.

## High-Level Flow
1. Usuario abre `/cancelar`.
2. En el paso 1, captura teléfono y solicita búsqueda.
3. Backend busca citas cancelables con reglas de elegibilidad.
4. Si hay coincidencias, UI muestra lista de citas futuras cancelables y permite seleccionar una o varias.
5. Usuario confirma cancelación sobre la selección.
6. Backend cambia estado de cada cita seleccionada a `CANCELLED`.
7. Backend intenta eliminar el evento espejo en Google Calendar para cada cita seleccionada (si aplica).
8. UI muestra éxito y los horarios cancelados quedan disponibles nuevamente en el flujo de reserva.

## Step-by-Step Flow
1. Entrada al flujo
- Trigger: navegación a `/cancelar`.
- Resultado: UI muestra paso de búsqueda por teléfono.

2. Búsqueda por teléfono
- Trigger: envío del formulario de búsqueda.
- Validación inicial UI: formato de teléfono de 10 dígitos.
- Backend:
- Normaliza y valida teléfono.
- Busca cita `CONFIRMED` futura dentro de meses activos.
- Evalúa restricción de 24 horas mínimas.
- Resultado:
- Si cumple: retorna `appointments[]` con `appointmentId`, nombre, teléfono, fecha, hora y estatus `CONFIRMED`.
- Si no cumple: retorna error estable y UI no avanza al paso de confirmación.

3. Revisión y confirmación
- Trigger: una o más citas elegibles encontradas.
- UI: muestra lista de citas y permite seleccionar una o varias; acciones `Cancelar cita` y `Regresar al inicio`.
- Usuario confirma la cancelación.

4. Ejecución de cancelación
- Trigger: solicitud de cancelación con `appointmentIds[]` y `phone`.
- Backend:
- Ubica cada cita seleccionada bajo condiciones del flujo de cancelación.
- Cambia estado de cada cita seleccionada a `CANCELLED`.
- Intenta eliminar evento en Google Calendar para cada cita con `google_event_id`.
- Resultado:
- Cancelaciones persistidas en sistema fuente de verdad.
- Si falla eliminación en Calendar para una cita, esa cancelación se mantiene y se reporta `syncReason` en esa cita del resultado.

5. Resultado final
- Trigger: respuesta exitosa de cancelación.
- UI: muestra mensaje final de éxito del flujo.
- Efecto funcional: el slot deja de contar como ocupado para disponibilidad futura.

## Validation Points
- Teléfono:
- Entrada aceptada con separadores, validación real sobre 10 dígitos.
- Si no cumple, no debe avanzar.
- Elegibilidad de cita en búsqueda:
- Debe existir cita `CONFIRMED`.
- Debe ser futura (`date > hoy` en zona de negocio).
- Debe pertenecer a un mes activo.
- Debe cumplir ventana mínima de 24 horas para cancelación web.
- Confirmación de cancelación:
- Debe corresponder a una selección no vacía de `appointmentIds` y al teléfono de citas elegibles dentro del flujo.
- Error handling:
- Backend devuelve `errorCode` estable.
- Frontend traduce `errorCode` según idioma activo.

## State Changes
- Estado inicial cancelable: `CONFIRMED`.
- Transición principal: `CONFIRMED -> CANCELLED` por cada cita seleccionada.
- Post-condición:
- Citas en `CANCELLED` no deben bloquear disponibilidad.
- El historial de la cita cancelada se conserva.

## Error Scenarios
- Teléfono inválido en UI o backend: rechazo por validación.
- No existe cita elegible para ese teléfono: `APPOINTMENT_NOT_FOUND`.
- Cita dentro de las próximas 24 horas: rechazo de cancelación web.
- Cita fuera de meses activos o no futura: no elegible para el flujo.
- Cita ya no cancelable al confirmar (cambio concurrente de estado o datos): `APPOINTMENT_NOT_FOUND`.
- Selección vacía en paso de revisión: UI impide continuar y solicita elegir al menos una cita.
- Falla al eliminar evento en Google Calendar:
- Cancelación en sistema principal permanece exitosa.
- Respuesta puede incluir `syncReason` para seguimiento operativo.

## Concurrency Considerations
- La cancelación de estado en DB se ejecuta de forma transaccional.
- La cita objetivo se bloquea durante la actualización para evitar carreras de estado en la misma cita.
- Si dos intentos de cancelación compiten sobre la misma cita, solo uno debe aplicar transición efectiva.
- La operación sobre Google Calendar ocurre después del cambio de estado persistido y no revierte la cancelación local.

## Edge Cases
- Usuario busca con teléfono válido pero sin cita `CONFIRMED` futura elegible.
- Usuario intenta cancelar cita en umbral cercano de tiempo y queda fuera de la regla de 24h.
- Cita existe pero mes quedó inactivo: flujo la trata como no elegible.
- Cita ya fue cancelada por otro intento antes de confirmar acción en UI.
- El usuario selecciona varias citas y solo una deja de ser elegible antes de confirmar: la operación completa se rechaza para mantener consistencia de selección.
- Falla de red después de que backend canceló: UI puede no mostrar éxito inmediato aunque la cancelación ya exista.
- Falla de integración externa (Calendar) posterior a cancelación confirmada en DB.

## Observations
- La especificación exige que la cancelación web solo proceda con al menos 24 horas de anticipación.
- En el flujo actual, esta regla se valida en dos puntos:
  - Durante la búsqueda (`/api/cancelar/buscar`) para decidir si la UI puede avanzar al paso de confirmación.
  - Durante la ejecución (`/api/cancelar`) para evitar que una cita pase a no elegible por cambio de tiempo entre búsqueda y confirmación.
- El contrato de cancelación pública soporta selección múltiple: lookup retorna `appointments[]` y confirmación recibe `appointmentIds[]`.
- El código de error para la regla de 24 horas es `APPOINTMENT_IS_COMING_SOON`.
