# Booking Flow

## Purpose
Describir de forma estructurada el flujo end-to-end de reserva de citas, desde la entrada al mes activo hasta la confirmación final en UI, incluyendo validaciones, estados, control de concurrencia y efectos del sistema.

## Actors
- Usuario final: selecciona fecha/horario, captura teléfono, confirma la cita y decide si envía confirmación por WhatsApp.
- UI de Booking (`/citas/YYYY-MM` y `/citas/YYYY-MM/booking`): guía el wizard, muestra disponibilidad, errores y estado de lock.
- API de reservas: ejecuta `check + lock`, confirmación y liberación de lock.
- Servicios de dominio: validan reglas de negocio (mes activo, disponibilidad, teléfono, restricciones por pares y máximo diario).
- Base de datos (fuente de verdad): persiste clientes, citas y locks temporales; aplica transacciones y bloqueos.
- Google Calendar: integración espejo posterior al commit (no fuente de verdad).
- WhatsApp: canal externo abierto explícitamente por el usuario desde la UI de éxito.

## Preconditions
- El mes solicitado en la ruta (`/citas/YYYY-MM`) debe estar en `active_months` con estado `ACTIVE`.
- El flujo opera en zona horaria `America/Mexico_City`.
- Solo se pueden reservar días lunes a viernes.
- Solo se permiten horarios base oficiales: `09:00`, `10:00`, `13:00`, `14:00`, `17:00`, `18:00`.
- Para el mismo día, solo se permiten horarios futuros (no transcurridos).
- El teléfono se valida/persiste normalizado a 10 dígitos.
- Un teléfono solo puede tener una cita activa futura por mes (`CONFIRMED` o `SYNC_FAILED`).
- Un mismo teléfono puede tener citas activas futuras en meses distintos.

## High-Level Flow
1. Usuario entra a `/`:
   - si existe al menos un mes activo elegible (`>= currentMonth`), se redirige a `/citas/YYYY-MM` del primer mes activo disponible (orden ascendente),
   - si no existe ningún mes activo elegible, se muestra vista de indisponibilidad con mensaje y CTA para contactar por WhatsApp.
2. En `/citas/YYYY-MM`, visualiza la entrada del flujo y selecciona `Agendar cita`.
3. En `/citas/YYYY-MM/booking` (paso de captura): selecciona día, horario y teléfono.
4. Al continuar, backend ejecuta `check + lock` temporal (TTL 10 minutos).
5. Si el cliente ya existe por teléfono, avanza directo a confirmación.
6. Si el cliente no existe, la UI solicita nombre y continúa con el mismo lock activo.
7. Usuario confirma la cita; backend confirma de forma atómica usando `lock_token`.
8. Tras commit, se intenta crear evento en Google Calendar.
9. UI muestra vista de éxito local.
10. Usuario puede ejecutar explícitamente `Enviar confirmación por WhatsApp`.

## Step-by-Step Flow
1. Entrada al mes
- Trigger: navegación a `/`.
- Comportamiento:
  - intenta redirect automático al primer mes activo elegible (`/citas/YYYY-MM`),
  - si no hay meses activos elegibles, renderiza vista de indisponibilidad con acción de contacto por WhatsApp.
- Resultado:
  - con meses activos: el flujo inicia sin pantalla de bienvenida intermedia,
  - sin meses activos: usuario recibe salida controlada para contacto y no entra al flujo de booking.

2. Pantalla de entrada del mes
- Trigger: carga de `/citas/YYYY-MM`.
- Comportamiento: se obtiene disponibilidad del mes activo y se presentan CTAs (`Agendar cita`, `Cancelar cita`).
- Resultado: usuario entra al flujo de booking en `/citas/YYYY-MM/booking`.

3. Captura de datos base (wizard)
- Trigger: paso inicial de `/booking`.
- Datos: `date`, `timeSlot`, `phone`.
- Comportamiento: UI valida formato base y solicita avance.

4. Check + lock temporal
- Trigger: continuar desde paso inicial.
- Backend:
  - valida reglas de reserva (mes, día hábil, horario futuro, slot válido),
  - verifica conflictos por disponibilidad,
  - verifica restricción por teléfono (cita activa futura en el mismo mes),
  - crea lock temporal (`reservation_locks`) con TTL 10 minutos.
- Resultado:
  - cliente existente: retorna `clientExists=true` y avanza a confirmación,
  - cliente nuevo: retorna `clientExists=false`, UI pide nombre y mantiene lock.

5. Captura de nombre (solo cliente nuevo)
- Trigger: respuesta `clientExists=false`.
- Regla: nombre mínimo 3 caracteres.
- Resultado: al cumplir validación, avanza a confirmación con lock vigente.

6. Confirmación de cita
- Trigger: acción `Confirmar cita`.
- Backend (transaccional):
  - limpia locks expirados,
  - valida lock vigente por `lock_token`, fecha, horario y teléfono,
  - valida disponibilidad final bajo bloqueo,
  - resuelve cliente por teléfono (reutiliza o crea),
  - inserta cita `CONFIRMED`,
  - elimina lock consumido,
  - `COMMIT`.
- Resultado: cita confirmada en DB.

7. Sincronización externa
- Trigger: confirmación exitosa en DB.
- Comportamiento: intenta crear evento en Google Calendar.
- Resultado:
  - éxito: cita permanece `CONFIRMED`,
  - falla: cita cambia a `SYNC_FAILED` y sigue contando como activa para conflictos.

8. Éxito en UI + WhatsApp
- Trigger: respuesta de confirmación.
- Comportamiento: UI muestra pantalla de éxito local y CTA explícito para abrir `wa.me` con mensaje codificado.
- Resultado: envío por WhatsApp depende de acción explícita del usuario.

9. Abandono o expiración
- Si usuario retrocede/abandona: lock puede liberarse explícitamente o vencer por TTL.
- Si expira TTL en confirmación: se rechaza confirmación y se fuerza re-selección de horario.

## Validation Points
- Mes:
  - Formato `YYYY-MM` válido.
  - Mes no pasado.
  - Mes marcado `ACTIVE` en `active_months`.
- Fecha:
  - Debe pertenecer al mes activo solicitado.
  - Solo lunes a viernes.
  - Si es hoy, el horario debe ser futuro en `America/Mexico_City`.
- Horario:
  - Debe ser uno de los slots base oficiales.
  - Debe cumplir disponibilidad global del día (ocupados + locks + regla direccional + máximo diario).
- Teléfono:
  - Se normaliza a 10 dígitos.
  - Un teléfono no puede tener más de una cita activa futura en el mismo mes.
  - Un teléfono puede tener citas activas futuras en meses distintos.
- Nombre:
  - Requerido para cliente nuevo.
  - Mínimo 3 caracteres.
  - Un teléfono no puede asociarse a nombres distintos.
- Lock temporal:
  - Requerido para confirmar.
  - Debe estar vigente y corresponder a `date/timeSlot/phone` de la confirmación.

## State Changes
- Appointment:
  - Creación de reserva exitosa: `CONFIRMED`.
  - Falla de sincronización con Calendar después de crear cita: `SYNC_FAILED`.
  - `CANCELLED` existe en el dominio pero pertenece al flujo de cancelación.
- Reservation Lock:
  - Creación al `check + lock`.
  - Consumo/eliminación al confirmar cita exitosamente.
  - Expiración automática por TTL (10 minutos) o liberación explícita.

## Error Scenarios
- Mes inválido/inactivo/pasado: rechazo de disponibilidad y/o reserva.
- Fecha fuera de reglas (fin de semana o slot pasado en mismo día): rechazo.
- Slot no disponible por ocupación, lock activo o restricciones direccionales: conflicto.
- Teléfono con cita activa futura en el mismo mes: conflicto, no permite nueva reserva.
- Lock inexistente, expirado o no coincidente: conflicto en confirmación.
- Timeout al adquirir locks de concurrencia: conflicto.
- Validación de payload inválida: error de validación.
- Endpoint legacy `POST /api/reservar`: respuesta `410` (deprecado).
- Falla de Calendar: no revierte la cita; devuelve estado `SYNC_FAILED`.

## Concurrency Considerations
- Modelo aplicado: `first-commit-wins`.
- Confirmación se ejecuta en transacción con bloqueo pesimista.
- Se limpian locks expirados antes de validar lock/confirmar.
- El lock temporal evita captura simultánea del mismo slot durante confirmación.
- La validación final de disponibilidad ocurre dentro de la transacción de confirmación.
- Locks de aplicación por fecha/teléfono reducen carreras entre intentos concurrentes.
- Google Calendar se ejecuta fuera de la transacción y no define validez de reserva.

## Edge Cases
- El usuario selecciona un slot válido y, antes de confirmar, ese slot deja de ser válido por competencia concurrente.
- El lock expira mientras el usuario completa nombre o revisa confirmación.
- El horario del mismo día cruza el umbral temporal durante el flujo y deja de ser elegible.
- El día queda sin slots por combinación de citas activas + locks + regla direccional.
- Reintentos tras error de conflicto requieren refrescar disponibilidad y re-seleccionar slot.
- Re-reserva de un slot previamente cancelado genera una nueva cita (histórico preservado).

## Observations
- El contrato funcional define 4 vistas del flujo de reserva (entrada de mes + 3 vistas del wizard), pero el etiquetado visual interno del wizard muestra una progresión `step1Of2`/`step2Of2` y luego éxito. No hay contradicción funcional, pero sí diferencia de nomenclatura de pasos.
- El endpoint legacy `POST /api/reservar` está deprecado (`410`) y el flujo vigente usa `client-check-lock` + `confirm`, alineado con la especificación.
- La propiedad del texto final de WhatsApp está en frontend (mensaje localizado + `encodeURIComponent`), consistente con el contrato que evita que backend retorne copy final de UX.
