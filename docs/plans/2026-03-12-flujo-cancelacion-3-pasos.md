# Mejora integral del flujo de cancelación (3 pasos)

## Resumen
Implementar un wizard de cancelación en `/cancelar` con UX equivalente al flujo de reserva y 3 estados explícitos:
1. Captura de teléfono.
2. Vista de cita confirmada futura del mes activo + acciones (`Cancelar cita`, `Regresar al inicio`).
3. Confirmación final con el texto exacto: **“Tu cita ha sido cancelada con exito”**.

También se actualizarán pruebas (unitarias + integración + E2E) y la especificación formal del proyecto.

## Cambios clave de implementación
- UI/UX (similar a booking wizard):
  - Reemplazar el formulario plano por un `CancelWizard` con pasos visuales, barra de progreso, estados de carga, errores inline y foco accesible.
  - Paso 1: input de teléfono (10 dígitos) + botón “Buscar cita”.
  - Paso 2: tarjeta de detalle (nombre, fecha, hora, teléfono) solo para citas `CONFIRMED` futuras del mes activo; botones:
    - `Cancelar cita` (acción destructiva primaria).
    - `Regresar al inicio` (reinicia al paso 1 en la misma página).
  - Paso 3: pantalla de éxito con el mensaje requerido.
- Backend/API:
  - Agregar endpoint de búsqueda de cita cancelable (por teléfono) para soportar el paso 2.
  - Ajustar endpoint de cancelación para cancelar la cita encontrada en el paso 2 de forma segura (vinculada al registro mostrado, no cancelación “ciega”).
  - Restringir búsqueda/cancelación a:
    - `status = CONFIRMED`
    - fecha futura (`date > hoy` en `America/Mexico_City`)
    - dentro del mes activo.
  - Estandarizar códigos de error para mapear mensajes UI (p. ej. `APPOINTMENT_NOT_FOUND`, `MONTH_NOT_ALLOWED`, `VALIDATION_ERROR`).
- Dominio y datos:
  - Incorporar función de consulta específica para “cita confirmada cancelable del mes activo”.
  - Mantener reglas existentes de transacción/bloqueo para evitar condiciones de carrera al cancelar.

## APIs/interfaces públicas a actualizar
- Nueva API de consulta de cancelación:
  - `POST /api/cancelar/buscar`
  - Input: `{ phone: string }`
  - Output 200: `{ appointmentId, name, phone, date, timeSlot, status: "CONFIRMED" }`
  - Output 404: `{ error: "APPOINTMENT_NOT_FOUND" }`
- API de cancelación ajustada:
  - `POST /api/cancelar`
  - Input: identificador de la cita mostrada en paso 2 (y validación de pertenencia/coherencia con teléfono).
  - Output 200: `{ appointmentId, status: "CANCELLED" }` (+ `syncReason` cuando aplique).
- Tipos frontend:
  - Nuevo `CancellationDraft`, `CancellationStep`, `CancellationLookupResult`.
  - Mapeo explícito de errores API -> mensajes de UI.

## Plan de pruebas
- Unitarias (UI):
  - Paso 1 valida teléfono inválido.
  - Paso 1 -> Paso 2 cuando búsqueda responde cita válida.
  - Paso 2 muestra datos correctos y botón `Regresar al inicio` reinicia estado.
  - Paso 2 -> Paso 3 al cancelar con éxito y renderiza texto exacto de éxito.
  - Errores de búsqueda/cancelación se muestran inline sin romper el wizard.
- Unitarias (API/servicios):
  - `/api/cancelar/buscar` responde 200/404/400 según escenario.
  - `/api/cancelar` cancela cita válida y retorna contrato esperado.
  - Rechazo de cita fuera del mes activo, no futura, o estatus distinto de `CONFIRMED`.
- Integración:
  - Cancelación completa cambia estado a `CANCELLED` y conserva comportamiento de sync con Google.
  - No permite cancelar registros no elegibles por reglas del nuevo flujo.
- E2E:
  - Escenario completo 3 pasos desde `/cancelar` con cita válida.
  - Escenario sin cita confirmada futura del mes activo.
  - Escenario de éxito muestra mensaje final requerido.

## Documentación a actualizar
- `docs/specification.md`:
  - Sección de flujo de cancelación en 3 pasos.
  - Restricción explícita: solo `CONFIRMED` futuro del mes activo.
  - Mensaje final de éxito definido literalmente.
- Registrar decisión técnica del rediseño en un plan de implementación en `docs/plans/` para trazabilidad de cambios.

## Supuestos y defaults cerrados
- “Regresar al inicio” = volver al paso 1 del wizard en `/cancelar` (sin navegación externa).
- El flujo de cancelación nuevo considera únicamente `CONFIRMED` (no `SYNC_FAILED`).
- Se mantiene estética y lenguaje visual del wizard de reserva para consistencia de experiencia.
