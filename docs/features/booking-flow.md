# Booking Flow

## Purpose
Describir de forma estructurada el flujo end-to-end de reserva de citas, desde la entrada al mes activo hasta la confirmación final en UI, incluyendo validaciones, estados, control de concurrencia, flujo de pendientes para clientas no fieles y efectos del sistema.

## Actors
- Usuario final: selecciona fecha/horario, captura teléfono, confirma la cita y decide si envía confirmación por WhatsApp.
- UI pública (`/` y `/citas/YYYY-MM/booking`): muestra meses disponibles, guía el wizard, muestra disponibilidad, errores y estado de lock.
- API de reservas: ejecuta `check + lock`, confirmación y liberación de lock.
- Servicios de dominio: validan reglas de negocio (mes activo, disponibilidad, teléfono, restricciones por pares y máximo diario).
- Base de datos (fuente de verdad): persiste clientes, citas y locks temporales; aplica transacciones y bloqueos.
- Google Calendar: integración espejo posterior al commit (no fuente de verdad).
- WhatsApp: canal externo abierto explícitamente por el usuario desde la UI de éxito.

## Preconditions
- El mes solicitado en la ruta (`/citas/YYYY-MM`) debe estar en `active_months` con estado `ACTIVE`.
- El flujo opera en zona horaria `America/Mexico_City`.
- Solo se pueden reservar días lunes a viernes.
- Los horarios válidos dependen de `slotMode` del mes:
  - `BLOCK_MODE`: `09:00`, `10:00`, `13:00`, `14:00`, `17:00`, `18:00`.
  - `SECOND_ONLY_MODE`: `10:00`, `14:00`, `18:00`.
- Para el mismo día, solo se permiten horarios futuros (no transcurridos).
- El teléfono se valida/persiste normalizado a 10 dígitos.
- Un teléfono puede tener más de una cita activa futura por mes (`CONFIRMED` o `SYNC_FAILED`) si la separación entre citas activas del mismo mes es de al menos 15 días naturales.
- Un mismo teléfono puede tener citas activas futuras en meses distintos.
- El flujo público distingue entre clienta fiel y no fiel:
  - clienta fiel: la cita se confirma de forma inmediata,
  - clienta no fiel: la cita se registra inicialmente como `PENDING`.

## High-Level Flow
1. Usuario entra a `/`:
   - se muestra pantalla de bienvenida con CTAs por mes disponible (`/citas/YYYY-MM/booking`),
   - solo se listan meses `ACTIVE` con al menos un slot disponible,
   - si no hay meses disponibles, se mantiene layout de bienvenida con aviso de indisponibilidad y CTA de cancelación.
2. En `/citas/YYYY-MM/booking` (paso de captura): selecciona día, horario y teléfono.
4. Al continuar, backend ejecuta `check + lock` temporal (TTL 10 minutos).
5. Si el cliente ya existe por teléfono, avanza directo a confirmación.
6. Si el cliente ya tiene citas futuras activas en el mismo mes, UI muestra la vista de `Detalles de tu nueva cita` + `Ya tienes citas activas en este mes`.
7. Si la nueva fecha cumple separación mínima de 15 días naturales con todas sus citas activas del mes, esa vista muestra separador `O` y botón `Agendar como nueva cita`.
8. Si la nueva fecha no cumple separación mínima de 15 días naturales con alguna cita activa, el cliente debe seleccionar cuál cita reagendar al nuevo `date + timeSlot` para continuar en autoservicio.
9. Si el cliente no existe, la UI solicita nombre y continúa con el mismo lock activo.
   - al confirmar, backend crea cliente con `client_number` único asignado automáticamente.
10. Al seleccionar cita a reagendar o al elegir `Agendar como nueva cita`, UI avanza a confirmación.
11. Usuario confirma la cita; backend confirma de forma atómica usando `lock_token`.
12. Tras commit, se intenta crear evento en Google Calendar.
13. UI muestra vista de éxito local.
14. Usuario puede ejecutar explícitamente `Enviar confirmación por WhatsApp`.

## Step-by-Step Flow
1. Entrada al flujo público
- Trigger: navegación a `/`.
- Comportamiento:
  - renderiza bienvenida + lista de meses disponibles con links directos a `/citas/YYYY-MM/booking`,
  - filtra meses por elegibilidad (`ACTIVE`, `>= currentMonth`) y disponibilidad real de slots,
  - cuando no hay meses disponibles, muestra aviso de indisponibilidad en el mismo layout.
- Resultado:
  - con meses disponibles: el flujo inicia al seleccionar un CTA de mes,
  - sin meses disponibles: usuario conserva salida por cancelación.

2. Entrada de compatibilidad por mes
- Trigger: navegación a `/citas/YYYY-MM`.
- Comportamiento: redirect server-side directo a `/citas/YYYY-MM/booking`.
- Resultado: se conserva compatibilidad sin mantener pantalla intermedia.

3. Captura de datos base (wizard)
- Trigger: paso inicial de `/booking`.
- Datos: `date`, `timeSlot`, `phone`.
- Comportamiento:
  - UI valida formato base y solicita avance.
  - El selector de días muestra todos los días disponibles en carrusel horizontal (scroll) y mantiene resaltado el día seleccionado.
  - CTA secundaria `Volver` regresa al inicio público (`/`).

4. Check + lock temporal
- Trigger: continuar desde paso inicial.
- Backend:
  - valida reglas de reserva (mes, día hábil, horario futuro, slot válido),
  - verifica conflictos por disponibilidad,
  - verifica restricción por teléfono (separación mínima de 15 días naturales entre citas activas futuras del mismo mes),
  - crea lock temporal (`reservation_locks`) con TTL 10 minutos.
- Resultado:
  - cliente existente sin citas futuras activas en ese mes: retorna `clientExists=true` y avanza a confirmación,
  - cliente existente con citas futuras activas en ese mes: retorna `futureAppointmentsInMonth[]` y mantiene lock para entrar a vista de decisión,
  - cuando separación es válida: además retorna `canBookAsNewAppointment=true`,
  - cuando separación no es válida: retorna `canBookAsNewAppointment=false` y mantiene solo opciones de reagendado,
  - cliente nuevo: retorna `clientExists=false`, UI pide nombre y mantiene lock.

5. Selección de cita a reagendar o agendar como nueva (cliente con citas futuras activas en el mes)
- Trigger: respuesta con `futureAppointmentsInMonth[]`.
- Regla:
  - si `canBookAsNewAppointment=false`, el cliente debe elegir una cita activa para reagendar,
  - si `canBookAsNewAppointment=true`, además de reagendar se permite `Agendar como nueva cita`,
  - antes de esta lista, UI muestra un bloque resumen con `date`, `timeSlot`, `name` y `phone` actualmente seleccionados.
  - en este estado no se renderizan los bloques del paso 1 para seleccionar día, horario y teléfono.
- Resultado: al seleccionar cita o al elegir `Agendar como nueva cita`, avanza a confirmación con lock vigente.

6. Captura de nombre (solo cliente nuevo)
- Trigger: respuesta `clientExists=false`.
- Regla: nombre mínimo 3 caracteres.
- Resultado: al cumplir validación, avanza a confirmación con lock vigente.

7. Confirmación de cita
- Trigger: acción `Confirmar cita`.
- UI:
  - el encabezado del paso de confirmación es condicional por tipo de clienta,
  - clienta nueva: `Hola {Nombre}, Bienvenida a La Nuit Nail Studio! ✨`,
  - clienta existente: mantiene saludo de retorno (`welcomeBack`).
  - previo al `POST /api/reservar/confirm`, frontend envía `name` en forma canónica (trim).
- Backend (transaccional):
  - limpia locks expirados,
  - valida lock vigente por `lock_token`, fecha, horario y teléfono,
  - valida disponibilidad final bajo bloqueo,
  - si llega `appointmentIdToReschedule`, reprograma esa cita,
  - si no llega `appointmentIdToReschedule`, resuelve cliente por teléfono (reutiliza o crea) e inserta cita con estado inicial según lealtad del cliente:
    - clienta fiel: `CONFIRMED`,
    - clienta no fiel: `PENDING`,
  - si crea cliente nuevo, asigna `client_number` único (incremental con huecos permitidos),
  - elimina lock consumido,
  - `COMMIT`.
- Resultado: cita creada o reprogramada en DB.

8. Sincronización externa
- Trigger: confirmación exitosa en DB.
- Comportamiento: intenta crear evento en Google Calendar solo cuando la cita quedó `CONFIRMED`.
- Resultado:
  - éxito: cita permanece `CONFIRMED`,
  - falla: cita cambia a `SYNC_FAILED` y sigue contando como activa para conflictos.
  - `PENDING` no crea evento en Calendar hasta que un admin la confirme.

9. Éxito en UI + WhatsApp
- Trigger: respuesta de confirmación.
- Comportamiento:
  - si la cita quedó `CONFIRMED`, UI muestra pantalla de éxito local y CTA explícito para abrir `wa.me` con mensaje codificado de confirmación;
  - si la cita quedó `PENDING`, UI muestra `Ya estamos casi listas`, explica que la cita quedó pre-registrada y muestra CTA principal `Enviar comprobante` y CTA secundaria `Volver`.
  - CTA `Volver`/`Regresar al inicio` en éxito regresa al inicio público (`/`).
- Resultado: envío por WhatsApp depende de acción explícita del usuario.

10. Abandono o expiración
- Si usuario retrocede/abandona: lock puede liberarse explícitamente o vencer por TTL.
- Si ocurre salida inesperada (refresh/cierre/navegación fuera de la página), frontend dispara `pagehide` e intenta liberar lock mediante `sendBeacon` a `POST /api/reservar/lock/release-beacon` (best-effort, idempotente).
- Cuando la navegación es `reload`, frontend fuerza revalidación inmediata de disponibilidad (`no-store`) y hace un reintento corto único para mitigar stale UI mientras termina de procesarse la liberación del lock.
- Si ese envío no se entrega, el lock sigue protegido por expiración automática de TTL (10 minutos).
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
  - Debe cumplir disponibilidad global del día (ocupados + locks + bloqueos manuales + máximo diario).
  - En `BLOCK_MODE` aplica regla direccional por pares.
  - En `SECOND_ONLY_MODE` no aplica propagación direccional entre pares.
- Teléfono:
  - Se normaliza a 10 dígitos.
  - Puede tener más de una cita activa futura en el mismo mes solo si existe separación mínima de 15 días naturales entre citas activas.
  - Un teléfono puede tener citas activas futuras en meses distintos.
  - Si la nueva fecha no cumple la separación mínima de 15 días con alguna cita activa del mes, para continuar debe seleccionarse cita a reagendar.
- Nombre:
  - Requerido para cliente nuevo.
  - Mínimo 3 caracteres.
  - La comparación contra nombre existente por teléfono ignora espacios al inicio/fin (trim en ambos valores).
  - Un teléfono no puede asociarse a nombres distintos.
- Número de cliente:
  - Se asigna automáticamente para cliente nuevo durante confirmación exitosa.
  - Debe ser único y entero positivo.
- Lock temporal:
  - Requerido para confirmar.
  - Debe estar vigente y corresponder a `date/timeSlot/phone` de la confirmación.
- Estado de cita:
  - Una cita confirmada por clienta fiel queda en `CONFIRMED`.
  - Una cita nueva de clienta no fiel queda en `PENDING`.
  - En disponibilidad pública por slot, `PENDING`, `CONFIRMED` y `SYNC_FAILED` bloquean ocupación.

## State Changes
- Appointment:
  - Creación de reserva exitosa: `CONFIRMED` para clienta fiel, `PENDING` para clienta no fiel.
  - Falla de sincronización con Calendar después de crear cita: `SYNC_FAILED`.
  - `CANCELLED` existe en el dominio pero pertenece al flujo de cancelación.
  - `REJECTED` representa una cita pendiente que fue descartada manualmente o por expiración de 36 horas.
- Reservation Lock:
  - Creación al `check + lock`.
  - Consumo/eliminación al confirmar cita exitosamente.
  - Expiración automática por TTL (10 minutos) o liberación explícita.

## Error Scenarios
- Mes inválido/inactivo/pasado: rechazo de disponibilidad y/o reserva.
- Fecha fuera de reglas (fin de semana o slot pasado en mismo día): rechazo.
- Slot no disponible por ocupación, lock activo o restricciones direccionales: conflicto.
- Teléfono con cita activa futura en el mismo mes y separación menor a 15 días naturales respecto a la nueva fecha: conflicto para creación directa (debe reagendar o elegir otra fecha).
- Lock inexistente, expirado o no coincidente: conflicto en confirmación.
- Timeout al adquirir locks de concurrencia: conflicto.
- Validación de payload inválida: error de validación.
- Endpoint legacy `POST /api/reservar`: respuesta `410` (deprecado).
- Falla de Calendar: no revierte la cita; devuelve estado `SYNC_FAILED`.
- Cita pendiente sin resolución manual dentro de 36 horas: se considera rechazada y deja de estar disponible para confirmación.

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
- Una cita `PENDING` sí participa en la lógica de ocupación del slot hasta resolverse (`CONFIRMED` o `REJECTED`).

## Observations
- El contrato funcional define 4 vistas del flujo de reserva (entrada global en `/` + 3 vistas del wizard), pero el etiquetado visual interno del wizard muestra una progresión `step1Of2`/`step2Of2` y luego éxito. No hay contradicción funcional, pero sí diferencia de nomenclatura de pasos.
- El endpoint legacy `POST /api/reservar` está deprecado (`410`) y el flujo vigente usa `client-check-lock` + `confirm`, alineado con la especificación.
- La propiedad del texto final de WhatsApp está en frontend (mensaje localizado + `encodeURIComponent`), consistente con el contrato que evita que backend retorne copy final de UX.
