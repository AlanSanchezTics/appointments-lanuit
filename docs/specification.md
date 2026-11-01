## Documento Fuente de Verdad

Este documento define las reglas normativas del sistema.

Cualquier otro archivo (incluyendo AGENTS.md o copilot-instructions.md)
debe alinearse a esta especificación.

En caso de discrepancia, este documento prevalece.

# Especificación Técnica Formal

# Sistema de Reservas — Portal de Citas Manicurista

---

## 1. Objetivo

Definir formalmente las reglas funcionales, invariantes, restricciones técnicas y comportamiento del sistema de reservas para una manicurista independiente.

Este documento está diseñado para servir como especificación fuente para implementación backend, frontend y validaciones por agente de IA local.

---

## 2. Contexto General

- Profesional única (no múltiples recursos).
- Fuente de verdad: MySQL.
- Zona horaria obligatoria: America/Mexico_City.
- Integraciones:
  - Google Calendar (sistema espejo).
  - WhatsApp (notificación vía redirección: auto-intento en éxito `CONFIRMED`/`SYNC_FAILED` con fallback manual; manual en `PENDING`). En el admin, tras confirmar `CONFIRMED`/`SYNC_FAILED` se ofrece un toast con botón para enviar, sin redirección automática.
- Enfoque Mobile-first.
- Regla general de calendarios: el grid de días de todo calendario mensual va de lunes a domingo (público y admin). Los encabezados empiezan en lunes y los huecos iniciales se calculan con el mismo cálculo compartido en todos los calendarios, de modo que el día 1 queda en su columna de lunes a domingo. Aplica a `/booking` (selector de días y calendario modal), `Mis citas` (selección de nueva fecha) y al detalle del mes del admin (sección 15.7).

---

## 3. Alcance Temporal

### 3.1 Regla de Meses Activos

El sistema permite reservar únicamente dentro de los meses marcados como `ACTIVE` en `active_months`.

Formato de ruta:

    /citas/YYYY-MM

Restricciones:

- No se permiten meses pasados.
- Los meses futuros solo se permiten si están marcados como `ACTIVE`.
- El backend valida que el mes solicitado esté en `active_months` con estado `ACTIVE`.
- Todas las reglas de disponibilidad aplican únicamente dentro de meses activos.
- Ventana operativa por defecto: mes actual + siguiente mes (`ACTIVE_MONTH_WINDOW_SIZE=2`), extensible a N meses.
- Los meses pasados deben quedar `INACTIVE` por reconciliación automática.
- La entrada raíz (`/`) debe mostrar una vista pública de bienvenida con:
  - `home.welcome`,
  - `home.title`,
  - `home.subtitle`,
  - CTA primaria `Agendar cita` (`/booking`),
  - CTA secundaria `Mis citas` (`/my-appointments`).
- Un mes disponible para la vista de `/` debe cumplir simultáneamente:
  - `status=ACTIVE` en `active_months`,
  - mes actual o futuro (`>= currentMonth`),
  - al menos un horario disponible en `getMonthAvailability(month)`.
- Meses inactivos o sin cupo no deben mostrarse como CTA en `/`.
- Si no existe ningún mes disponible bajo esas reglas, `/` mantiene el layout de bienvenida y muestra aviso de indisponibilidad, conservando la acción hacia `Mis citas`.

---

## 4. Reglas de Disponibilidad

### 4.1 Días válidos

- Los días válidos no son fijos de lunes a viernes. Un día es válido para reservar, reprogramar o agendar si las reglas o excepciones del mes lo cubren y producen al menos un horario ofrecible (FR-017, D46). Un sábado o domingo es válido si una regla o excepción lo abre.
- Un mes sin reglas aplica el default de lunes a viernes (D6) en los días que ninguna excepción cubre; sábados y domingos quedan cerrados (D28).
- Un mes con al menos una regla cierra todo día que no cubran ni una regla ni una excepción (D23).
- Se permiten citas el mismo día solo para horarios iguales o posteriores a la hora actual en la zona `America/Mexico_City` (D50).
- Horarios del mismo día ya transcurridos no deben mostrarse como disponibles.
- Si ningún horario de un día es ofrecible (porque están ocupados, bloqueados, transcurridos o excluidos por la separación mínima o la capacidad diaria), el día no está disponible en el flujo público: se muestra deshabilitado y no se puede seleccionar (sección 7.1). El flujo público no distingue entre un día lleno y uno cerrado. Los tonos `closed`, `full` y gris son del calendario admin (sección 15.7, D13, D34).
- Los horarios con lock temporal vigente tampoco deben mostrarse como disponibles.
- En flujo público, un slot se considera ocupado cuando existe una cita en `PENDING`, `CONFIRMED` o `SYNC_FAILED` para ese mismo `date + timeSlot`.

### 4.2 Horarios Base

- No existe una lista fija de horarios. Los horarios de un día son las horas (`times`) de la regla o excepción que lo cubre, en formato `HH:mm` (FR-006): cualquier hora válida, sin granularidad fija. Por ejemplo, `07:30` y `14:30` son válidos (caso de referencia de diciembre 2026).
- Cada regla o excepción admite hasta 24 horas distintas (D21). Las horas se normalizan al guardar: sin duplicados y ordenadas (D37).
- `00:00` no es un horario válido en reglas ni excepciones; es el marcador interno de bloqueo de día completo (D55).
- Las listas de los modos anteriores (`09:00, 10:00, 13:00, 14:00, 17:00, 18:00` y `10:00, 14:00, 18:00`) sobreviven solo como presets de migración y del `PATCH slot-mode` (D4, D16). No son fuente de horarios.

### 4.3 Reglas de disponibilidad, separación y capacidad

Reglas por mes (FR-001 a FR-005, FR-025):

- Una regla define un rango de fechas dentro del mes, uno o más días de la semana (lunes a domingo), una o más horas `HH:mm` y tres parámetros: `minGapMinutes` (0 a 1440), `preserveCapacity` y `maxPerDay` (1 a 6). Al crear una regla, los valores por defecto son `240`, `true` y `3` (D20, FR-002).
- Dos reglas del mismo mes no pueden tener fechas en común. El traslape se valida por fechas, no por días de la semana, y se rechaza al guardar (FR-003).
- Una excepción por fecha tiene sus propias horas y sus propios tres parámetros. Tiene prioridad sobre cualquier regla que cubra esa fecha y también abre o cierra fechas que ninguna regla cubre (FR-004, D10). Una excepción con lista de horas vacía cierra ese día (FR-005, A2).
- Las reglas y excepciones no cruzan meses (FR-019).
- Antes de guardar se validan: fechas dentro del mes, horas `HH:mm`, rangos válidos, al menos un día de la semana y una hora por regla, parámetros dentro de rango y máximo de 24 horas por día (FR-025, D21, D38). Cada error tiene un código estable `AVAILABILITY_*`; el contrato está en `docs/architecture/api.md`.
- Un mes sin reglas usa el default de la sección 4.1 (D6, D28).

Motor de disponibilidad (FR-009 a FR-014, FR-016):

- Todas las validaciones de disponibilidad usan un único resolvedor por día. Lo usan la lista de días del flujo público, el lock, la confirmación, la reprogramación pública, el agendado y la reprogramación admin, los horarios bloqueables, las métricas y el detalle del mes (FR-016).
- Para cada día, el motor parte de la rejilla de horas de la regla o excepción vigente y:
  1. Quita los horarios con bloqueo manual de horario puntual (FR-013, D2, D43).
  2. En el día actual, quita los horarios anteriores a la hora actual en `America/Mexico_City` (FR-014, D50).
  3. Aplica la separación mínima (FR-009): un horario se ofrece solo si su hora de inicio dista al menos `minGapMinutes` de cada cita activa del día. La separación se mide entre horas de inicio (D25). En el flujo público, los locks vigentes cuentan como ocupados (A-05).
  4. Si `preserveCapacity` es `true`, ofrece un horario solo si reservarlo no reduce la cantidad máxima de citas que todavía caben ese día, con tope `maxPerDay` (FR-010). Si es `false`, solo aplican la separación mínima y el máximo diario (FR-012).
  5. Máximo diario: si el día ya tiene `maxPerDay` citas activas, no ofrece horarios (FR-011).
- `availableSpaces` de un día es el número de citas adicionales alcanzables, acotado por `maxPerDay` (FR-026, D12). El cálculo no usa una constante fija de 3 (FR-011).
- Un día sin horarios ofrecibles, ya sea por regla, excepción vacía, bloqueo de día completo o horas transcurridas, se trata como no disponible (FR-015).
- Sin bloqueos manuales, el motor reproduce el comportamiento legado (SC-002). Con bloqueos manuales, 48 de 432 combinaciones difieren del legado y esa diferencia se acepta (D43, SC-003; ver ADR 0001 y ADR 0002 en `docs/decisions/`).

Cambios de reglas y versión (FR-021 a FR-024, FR-035, FR-041):

- Crear, editar o eliminar reglas o excepciones, y ejecutar `PATCH slot-mode`, solo se permite en meses no pasados (D36, `MONTH_IN_PAST`).
- Cada mes tiene una versión de reglas. Un guardado debe llevar la versión que el admin editó; si ya cambió, se rechaza sin modificar nada (`AVAILABILITY_VERSION_CONFLICT`, FR-041, D24).
- Cambiar reglas o excepciones no modifica ni cancela citas ni eventos de Google Calendar (FR-022, D5). Una cita activa futura que queda fuera de la rejilla vigente se lista antes de guardar (FR-023, FR-024, D35, D40); las citas no cambian de fecha, hora ni estado.
- Los cambios de reglas no generan registros en la auditoría de citas (FR-035, D24).
- La columna legada `slot_mode` del mes ya no se lee ni se escribe en el código y no aparece en ninguna respuesta de la API (FR-033, D49). Se elimina con la migración `0023_drop_active_months_slot_mode`, aplicada solo en la BD de pruebas y pendiente de despliegue en producción (ver `docs/architecture/data-model.md`, sección "Estado legado de slot_mode").
- `PATCH slot-mode` reemplaza las reglas del mes por el preset del modo indicado y conserva las excepciones (FR-034, D16, D33).

---

## 5. Restricciones por Teléfono

- Flujo público (`/citas/*`): un número telefónico puede tener más de una cita activa futura en el mismo mes.
- Flujo público (`/citas/*`): puede tener citas activas futuras en meses distintos.
- Flujo admin (`/admin/months/[month]`): puede crear múltiples citas activas futuras para el mismo cliente/teléfono.
- En flujo público, el umbral de 15 días naturales no bloquea la creación de citas adicionales; se usa solo para detonar una sugerencia de UX para que la clienta decida entre reagendar una cita existente o continuar como cita nueva.
- Formato persistido obligatorio: 10 dígitos numéricos.
- En UI se permite captura con separadores (espacios/guiones/paréntesis), pero backend normaliza a 10 dígitos antes de validar y persistir.
- Nombre mínimo: 3 caracteres.
- Alias de cliente:
  - campo opcional en `clients.alias` (`VARCHAR(100)`, nullable),
  - se normaliza con `trim`,
  - si queda vacío, se persiste `null`,
  - no requiere unicidad.
- El cliente se identifica por teléfono.
- Un teléfono no puede estar asociado a más de un nombre.
- La validación de nombre canónico por teléfono debe ignorar espacios al inicio y final del texto (trim en ambos valores) para evitar falsos `CLIENT_NAME_MISMATCH`.
- Cada cliente tiene `client_number` único (entero positivo) asignado al momento de creación.
- En flujo público, `client_number` se asigna automáticamente con el siguiente número disponible.
- En flujo admin, para cliente nuevo inline, se sugiere el siguiente número disponible y se permite override manual antes de guardar.

---

## 6. Estados de Cita

- PENDING
- CONFIRMED
- REJECTED
- CANCELLED
- SYNC_FAILED

`PENDING` representa una cita pre-registrada que requiere revisión manual; si no se confirma ni rechaza en 36 horas, el sistema la marca como `REJECTED` automáticamente.

`SYNC_FAILED` representa una cita activa sin espejo en Calendar; un job programado puede reintentar la sincronización y, si crea evento correctamente, transicionarla a `CONFIRMED`.

---

## 7. Flujo de Reserva

0. Usuario ingresa al inicio (`/`) y el sistema muestra una pantalla de bienvenida pública.
   - Renderiza botones por mes disponible con destino `/citas/YYYY-MM/booking`.
   - Solo se listan meses `ACTIVE` con al menos un horario disponible.
   - Meses sin cupo o inactivos no se muestran.
   - Si no hay meses disponibles, se muestra aviso de indisponibilidad en el mismo layout y se mantiene CTA `Mis citas`.
   - El CTA secundario en `/` apunta a `/my-appointments`.
   - La selección de idioma (`es`/`en`) permanece disponible en todo el producto:
     - flujo público: selector tipo FAB global,
     - panel admin autenticado (`/admin/*` excepto `/admin/login`): selector integrado al `appHeader`.
   - Resolución de idioma: preferencia persistida (`cookie/localStorage`) -> idioma del dispositivo -> fallback `es`.
   - La preferencia manual del usuario tiene prioridad sobre el idioma del dispositivo.

1. Usuario selecciona `Agendar cita` desde `/` y navega a `/booking`.
2. Las rutas `/citas/YYYY-MM` y `/citas/YYYY-MM/booking` se mantienen como compatibilidad y redirigen a `/booking?month=YYYY-MM`.
3. En el paso 1 del wizard selecciona día y horario.
4. Al avanzar desde paso 1, backend genera lock temporal (`TTL = 10 minutos`) para `date + timeSlot`.
   - Antes de crear el lock, backend valida la fecha de calendario (una fecha inexistente o malformada, como `2026-02-30`, responde `VALIDATION_ERROR`) y resuelve los horarios del día con el resolvedor de la sección 4.3.
   - Si el día no tiene horarios ofrecibles, o la hora no se ofrece, responde `SLOT_NOT_AVAILABLE` (D46). Si la hora no se ofrece porque tiene un lock vigente de otro teléfono, responde `SLOT_LOCKED`.
5. En el paso 2 del wizard captura teléfono y backend ejecuta `check + lock` para ese teléfono:
   - Si el cliente existe por teléfono y no tiene citas futuras activas en el mismo mes, se avanza directo a confirmación.
   - Si el cliente tiene citas futuras activas en el mismo mes y la nueva fecha queda a menos de 15 días naturales de al menos una de ellas, UI entra a la vista de `Detalles de tu nueva cita` + `Ya tienes citas activas` para decidir cómo continuar.
   - Si no existe ninguna cita activa del mes dentro de ese umbral (<15 días), UI avanza directo a confirmación (sin vista de sugerencia).
   - Para el umbral de 15 días, las citas activas son `PENDING`, `CONFIRMED` y `SYNC_FAILED` (D95). Una cita `PENDING` dispara la sugerencia igual que las demás; `CANCELLED` y `REJECTED` no cuentan.
   - Una cita `PENDING` de la lista de sugerencia puede reprogramarse: la confirmación con `appointmentIdToReschedule` la mueve al nuevo `date + timeSlot`, la deja en `PENDING`, no crea ni borra evento de calendario (`googleEventId` queda nulo) y registra un evento `MODIFIED` en la bitácora, igual que la reprogramación `PENDING` de Mi cita. Las validaciones de horario, lock y bloqueos aplican igual (`SLOT_NOT_AVAILABLE`, `LOCK_EXPIRED_OR_INVALID`). `CONFIRMED` y `SYNC_FAILED` conservan su comportamiento: recrean el evento de calendario y quedan `CONFIRMED`, o `SYNC_FAILED` si falla la sincronización. El reagendar del wizard no escribe bitácora para `CONFIRMED` ni `SYNC_FAILED` (inconsistencia aceptada por el owner; no corregida en la spec 003); Mi cita registra la bitácora en todos los estados.
   - En la vista de sugerencia, la lista de citas activas del mes inicia sin cita preseleccionada; la clienta debe elegir explícitamente qué cita reagendar o decidir continuar como cita nueva.
   - En la vista de decisión, el CTA principal es dinámico:
     - sin cita seleccionada y con `canBookAsNewAppointment=true`: `Continuar como nueva cita`,
     - con cita seleccionada: `Reagendar cita seleccionada`.
   - Mientras UI está en selección de cita a reagendar, se muestra un bloque resumen con `name`, `phone`, `date` y `timeSlot` actualmente seleccionados, antes de la lista de citas activas del mes.
   - En este estado se ocultan los controles del paso 1 para cambiar `date`, `timeSlot` y `phone`.
   - En esa misma vista, `Regresar` no debe navegar a `/`; debe ejecutar una regresión interna equivalente a `Editar información` (liberar lock activo y volver a edición del paso 1).
   - Si el cliente no existe, UI solicita nombre en el paso 2 y luego avanza a confirmación usando lock vigente.
6. Si el lock no puede crearse (horario no ofrecido por ocupación, separación, capacidad, bloqueo manual o hora transcurrida, `SLOT_NOT_AVAILABLE`; o lock vigente de otro teléfono, `SLOT_LOCKED`), usuario debe elegir otro horario.
7. Usuario confirma cita (paso 3 del wizard).
   - CTA principal del paso 3:
     - clienta fiel: `Confirmar cita`,
     - clienta no fiel: `Siguiente`.
8. Backend:
   - Inicia transacción.
   - Adquiere los locks con nombre de fecha y de teléfono y lee las reglas del mes con bloqueo compartido, en ese orden (sección 9, «Orden de confirmación», pasos 2 y 3).
   - Toma con bloqueo los conflictos de citas del día y del teléfono (sección 9, «Orden de confirmación», paso 4).
   - Limpia los locks expirados de la fecha de la reserva (`expires_at <= now`), después de esos conflictos y sin tocar locks de otras fechas (sección 9, «Orden de confirmación», paso 5; D88, D89).
   - Valida lock temporal vigente (`lock_token`) para fecha/slot/teléfono (sección 9, «Orden de confirmación», paso 6).
   - Valida disponibilidad contra las reglas vigentes en el momento de confirmar (D39). Un lock vigente no garantiza que el horario siga existiendo: si una regla o excepción lo eliminó, la confirmación responde `SLOT_NOT_AVAILABLE`, el mismo error que un horario no disponible.
   - Resuelve cliente por teléfono (reutiliza si existe, crea si no existe).
   - Si crea cliente nuevo, asigna `client_number` automáticamente (único e incremental con huecos permitidos).
   - Si se envía `appointmentIdToReschedule`, reprograma esa cita del cliente al nuevo `date + timeSlot`.
   - Si no se envía `appointmentIdToReschedule`, inserta cita ligada a `client_id` con estado inicial según lealtad del cliente:
     - clienta fiel: `CONFIRMED`,
     - clienta no fiel: `PENDING`.
   - Elimina lock temporal consumido.
   - Commit.
9. Si la cita quedó `CONFIRMED`, crea evento en Google Calendar.

- El título (`summary`) del evento debe usar siempre el `name` canónico completo del cliente (no `alias`).

9. UI muestra pantalla local de éxito (paso 3 del wizard).
   - Si la cita quedó `PENDING`, la UI muestra el mensaje `Ya estamos casi listas` con la explicación de que la cita quedó pre-registrada y requiere envío del comprobante por WhatsApp para terminar de agendar.
10. Acción WhatsApp en éxito:
    - cuando la cita quedó `CONFIRMED` o `SYNC_FAILED`, la UI realiza un intento automático único de redirección a `wa.me` al entrar al paso de éxito y mantiene el botón `Enviar confirmación por WhatsApp` como fallback manual visible;
    - cuando la cita quedó `PENDING`, la acción permanece explícita con `Enviar comprobante`.
    - En flujo público, cuando el mensaje requiere nombre de cliente, frontend usa siempre `name` canónico (no `alias`).
    - El frontend compone el texto final localizado.
    - El backend no debe devolver texto final de UX; solo códigos estables y payload estructurado.
11. El endpoint legacy `POST /api/reservar` queda deprecado y debe responder `410`.

Contratos de payload relevantes en flujo vigente:

- `POST /api/reservar/client-check-lock`:
  - respuesta puede incluir `futureAppointmentsInMonth[]` con `{ appointmentId, date, timeSlot }` cuando el teléfono tiene citas activas futuras en ese mes (`PENDING`, `CONFIRMED` o `SYNC_FAILED`, D95) que activan la sugerencia de UX por umbral `<15 días`.
  - respuesta puede incluir `canBookAsNewAppointment` (`boolean`) para indicar que, dentro de la vista de sugerencia, también está permitido continuar como cita nueva.
- `POST /api/reservar/confirm`:
  - admite `appointmentIdToReschedule` opcional para reprogramar una cita futura activa del mismo teléfono y mes al `date + timeSlot` seleccionado.
  - el frontend debe enviar `name` en forma canónica (trim) cuando aplique.
- `POST /api/reservar/lock/release-beacon`:
  - payload: `{ lockToken }`.
  - contrato idempotente (`200` con `{ released: boolean }`) para intentos best-effort al salir inesperadamente del flujo (`pagehide + sendBeacon`).
  - no reemplaza el TTL; funciona como liberación temprana adicional.

Si el usuario abandona en confirmación o expira el TTL, el lock deja de bloquear automáticamente.
En navegación tipo `reload`, el frontend debe revalidar disponibilidad inmediatamente con `cache: "no-store"` y ejecutar un reintento corto único para reducir desalineaciones temporales entre el render SSR y la liberación best-effort del lock.

### 7.1 Contrato de UI/UX del Wizard

- Enfoque mobile-first obligatorio (desktop muestra un contenedor tipo móvil).
- El flujo visual de reserva queda compuesto por 4 vistas:
  - Entrada global (`/`): branding + CTA primaria `Agendar cita` + CTA secundaria `Mis citas`.
  - Paso 1 (`/booking`): selección de día/hora + navegación de meses activos futuros + lock temporal al continuar.
    - Un button group `Por día` / `Por horario` define el orden de búsqueda (default `Por día`):
      - `Por día` (flujo original): mes -> día -> horario.
      - `Por horario`: mes -> horario -> día. Se listan los horarios con al menos un día disponible en el mes (con su número de días); al elegir uno, el calendario habilita solo los días que lo tienen.
    - Ambos modos producen el mismo `date + timeSlot`; el lock temporal y los pasos siguientes no cambian.
    - CTA secundaria `Volver` regresa al inicio público (`/`).
  - Paso 2 (`/booking`): identificación (`phone`) y `name` condicional (solo cliente nuevo).
    - `Volver` regresa al paso 1 y libera lock vigente.
  - Paso 3 (`/booking`): confirmación de datos con contador de lock temporal.
    - CTA principal condicional:
      - clienta fiel: `Confirmar cita`,
      - clienta no fiel: `Siguiente`.
    - `Editar información` regresa al paso 2 (identificación) sin liberar lock; el lock sigue vigente hasta confirmar, expirar o abandonar el flujo.
    - Título dinámico:
      - clienta nueva: `Hola {Nombre}, Bienvenida a La Nuit Nail Studio! ✨`.
      - clienta existente: saludo de retorno actual (`welcomeBack`) definido por i18n.
  - Éxito (`/booking`): estado final local.
    - Para clienta fiel (`CONFIRMED`) o cita `SYNC_FAILED`: intento automático único para abrir WhatsApp al entrar al paso + CTA visible de fallback para reenviar.
    - Para clienta no fiel: CTA principal `Enviar comprobante` y CTA secundario `Volver`.
    - CTA `Volver`/`Regresar al inicio` regresa al inicio público (`/`).
- El flujo de `/booking` usa transición horizontal entre pasos:
  - avance: slide hacia la izquierda,
  - retroceso: slide hacia la derecha.
- Las animaciones deben respetar `prefers-reduced-motion` (sin transición cuando aplique).
- La capa visual debe mantener un lenguaje consistente en las 4 vistas:
  - tema `light`,
  - paleta base con acento principal `#e49f53`,
  - tipografía `Montserrat`,
  - controles redondeados tipo pill,
  - prioridad a targets táctiles y jerarquía por espaciado.
- Requisitos mínimos de interacción:
  - touch targets >= 44px,
  - estados de foco visibles,
  - errores inline por campo/contexto.
- Requisito visual del selector de días en Paso 1:
  - debe renderizar un calendario mensual (grilla por semanas) con todos los días del mes,
  - el grid va de lunes a domingo (encabezados `LUN`…`DOM` en `es`, `MON`…`SUN` en `en`), con la regla general de la sección 2; aplica también al calendario modal,
  - los días sin disponibilidad deben mostrarse deshabilitados,
  - el día seleccionado debe mantenerse resaltado visualmente.
- Requisito visual del modo `Por horario` en Paso 1:
  - el button group se muestra encima de la navegación de meses y el modo activo expone `aria-pressed="true"`,
  - los chips de horario son solo los horarios con disponibilidad en el mes visible,
  - sin horario elegido, o si el horario elegido ya no existe al cambiar de mes, todos los días se muestran deshabilitados y `Siguiente` queda deshabilitado,
  - al elegir un horario, si el día seleccionado no lo tiene, se selecciona el primer día disponible con ese horario,
  - al cambiar de mes se conserva el horario elegido si existe en el mes nuevo; si no existe, los días y `Siguiente` se deshabilitan y, al volver a un mes que sí lo tiene, el horario vuelve a quedar activo,
  - el modo es estado local del paso 1: al volver desde identidad (`Regresar`/`Editar información`) o recargar, el modo se reinicia a `Por día` y se conserva el `date + timeSlot` ya elegido.
- Criterios de aceptación de la búsqueda por horario:
  - un cliente puede llegar a `date + timeSlot` desde `Por horario` sin tocar días intermedios,
  - el flujo `Por día` se comporta igual que antes,
  - la disponibilidad mostrada usa las mismas reglas (ocupación, locks, bloqueos, separación mínima, capacidad, horario futuro) que `Por día`; la validación definitiva sigue ocurriendo al crear el lock.

Mensaje base para cita `CONFIRMED`:

    ¡Cita agendada con éxito!
    🗓️ *{Fecha} a las {Hora}*

    Puedes revisar, editar o cancelar tu cita en el siguiente enlace {appurl}/my-appointments
    ⚠️ _Si no puedes asistir a tu cita y no avisas con al menos 24 horas de anticipación, se aplicará un cargo extra de $350 en tu próxima cita (el equivalente al depósito)._

El mensaje debe codificarse usando encodeURIComponent.
La plantilla se mantiene con `es` como fallback y la propiedad del texto final es del frontend.
`{Fecha}` usa el formato de fecha larga de la sección 14, regla 10.

Mensaje base para cita `PENDING`:

    Hola Pau! Soy {Nombre} ✨

    🧾 Adjunto el comprobante del depósito de mi cita (_*{Fecha} a las {Hora}*_).

    Espero tu confirmación. ¡Gracias!

---

## 8. Flujo de Mis Citas

1. Usuario ingresa a `/my-appointments`.
2. El sistema muestra un formulario para capturar teléfono.
   - La vista reutiliza el mismo sistema visual público de `/booking` y del flujo de cancelación:
     - `booking-mobile-shell`,
     - jerarquía por pasos,
     - tipografía, tarjetas y botones consistentes con el flujo público.
3. Usuario ingresa su teléfono.
4. Sistema busca citas futuras vinculadas al teléfono capturado.
5. El lookup:
   - normaliza el teléfono a 10 dígitos,
   - ignora el estado de `active_months` de la cita origen,
   - devuelve citas futuras aunque alguna ya no permita acciones por ventana de tiempo,
   - puede incluir citas en `PENDING`, `CONFIRMED` y `SYNC_FAILED`.
6. Usuario selecciona la cita que desea gestionar.
7. El sistema mantiene un área de acciones vinculada a la cita seleccionada con:
   - `Cancelar cita`
   - `Modificar cita`
   - cuando una acción no aplica para la cita seleccionada, debe mostrarse como no disponible sin ocultar el estado real de la cita.
   - cuando una cita ya no permita cambios ni cancelación por ventana de tiempo, debe mostrarse bloqueada con advertencia explícita.

### 8.1 Rama de Cancelación

1. Una cita es cancelable solo si cumple simultáneamente:
   - estado `CONFIRMED` o `SYNC_FAILED`,
   - fecha futura (`date > hoy` en `America/Mexico_City`),
   - al menos 24 horas de anticipación.
2. La cancelación pública en `/my-appointments` no depende de que el mes de la cita siga en `active_months`.
3. Si existen coincidencias cancelables, el usuario puede seleccionar una o varias y confirmar la acción.
4. Backend:
   - cambia estado a `CANCELLED` para cada cita seleccionada,
   - elimina evento en Google Calendar por cada cita seleccionada que tenga `google_event_id`.
5. UI muestra el mensaje final:
   - `Tu cita ha sido cancelada con exito`.
   - cuando existe `whatsappUrl`, la UI realiza un intento automático único de redirección a `https://wa.me/?text=...` al entrar al paso de éxito.
   - muestra CTA primaria `Notificar por WhatsApp` como fallback manual visible.
   - muestra CTA secundaria `Volver al inicio` con navegación a `/`.
6. Todos los horarios cancelados vuelven a estar disponibles automáticamente.

### 8.2 Rama de Modificación

1. Una cita es modificable solo si cumple simultáneamente:
   - estado `PENDING`, `CONFIRMED` o `SYNC_FAILED`,
   - fecha futura,
   - al menos 3 horas de anticipación.
2. El flujo visual de modificación es similar a `/booking` para elegir nueva fecha y nuevo horario. El selector de fecha usa el mismo grid mensual de lunes a domingo (sección 2).
3. En esta rama no aplican:
   - validaciones de `isLoyal`,
   - sugerencia o restricción UX por citas futuras activas dentro de 15 días.
4. El slot destino se valida con el mismo resolvedor de disponibilidad que la reserva pública (sección 4.3): horarios del día según reglas y excepciones, ocupación (incluidas citas `PENDING`), locks, bloqueos manuales y horario futuro. Un día sin horarios, o una hora que no se ofrece, responde `SLOT_NOT_AVAILABLE` (D46). Un lock vigente de otra clienta sobre el horario destino también responde `SLOT_NOT_AVAILABLE` (D87, D88); el lock del propio teléfono no bloquea. Un mes no reservable (inactivo, sin registro o pasado) responde `SLOT_NOT_AVAILABLE`. Un error de infraestructura o de transacción (deadlock, timeout, pool de conexiones) no se convierte en un código de dominio: responde 400 `UNKNOWN_ERROR` y revierte la transacción (D81). En Mi cita (`POST /api/my-appointments/reschedule`) la reprogramación pública no aplica la regla de 15 días ni `isLoyal`. El reagendar del wizard de reserva sí llega desde la sugerencia de 15 días con `appointmentIdToReschedule` (D95, sección 7 paso 5).
5. Backend:
   - preserva el mismo `appointments.id`,
   - actualiza `date`,
   - actualiza `timeSlot`,
   - si la cita origen está en `CONFIRMED` o `SYNC_FAILED`, intenta resincronizar Google Calendar y reemplaza `google_event_id` si cambia,
   - si la sincronización falla, conserva la reprogramación local y deja la cita en `SYNC_FAILED`,
   - si la cita origen está en `PENDING`, mantiene `google_event_id = null` y no intenta sincronización.
6. Una modificación exitosa registra un evento `Cita modificada` con actor `Cliente`.
   - El log persiste evidencia del horario vigente y, para modificaciones, del horario anterior y nuevo dentro de `appointment_logs.payload`.
7. UI muestra el mensaje final de reprogramación:
   - realiza un intento automático único de redirección a WhatsApp al entrar al paso de éxito,
   - usa `whatsapp.messageTemplate`,
   - muestra CTA visible `Enviar confirmación por WhatsApp` como fallback manual.

### 8.3 Compatibilidad de Rutas

- `/my-appointments` es la ruta pública canónica para consultar, modificar o cancelar citas.
- `/citas/cancelar` deja de ser flujo primario y redirige a `/my-appointments`.

Notas de contrato:

- Los errores backend deben devolverse como códigos estables (`errorCode`).
- El frontend traduce `errorCode` al idioma activo.
- El backend no retorna mensajes localizados de UX final.

---

## 9. Control de Concurrencia

Modelo: First-commit-wins.

Requisitos obligatorios:

- Transacciones MySQL.
- SELECT ... FOR UPDATE.
- Índice compuesto no único para rendimiento de consultas por slot:

  INDEX(date, time_slot)

Locking temporal adicional:

- Tabla `reservation_locks` para bloquear slot durante el flujo de reserva (desde el final del paso 1 hasta confirmación/expiración/salida).
- `TTL` fijo de 10 minutos por lock.
- El frontend debe intentar liberar lock en salida inesperada (`refresh`, cierre de pestaña o navegación fuera del flujo) usando `pagehide + sendBeacon` hacia `POST /api/reservar/lock/release-beacon`.
- Este envío es best-effort y no garantiza entrega; el TTL sigue siendo el respaldo obligatorio de liberación.
- Sin cron obligatorio: cleanup lazy en los endpoints de lock y confirmación, acotado a la fecha procesada (D88), y filtro por `expires_at > now` en disponibilidad.
- Existe un cron externo de producción que ejecuta `npm run locks:cleanup` cada minuto para borrar por lotes los locks expirados (`expires_at <= now`) de todas las fechas (D92; ver `docs/runbooks/reservation-lock-cleanup.md`).

Orden de locks en escrituras que tocan horarios (reserva pública, confirmación, bloqueo de horario del wizard, reprogramación pública, creación admin y reprogramación admin; los bloqueos manuales de horario siguen los pasos 2 a 6 sin el paso 1; decisiones D63, D77, D83, D87, D88 y D89, ADR `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`). Son seis las transacciones que toman `GET_LOCK` (paso 1).

1. Locks con nombre `booking:date:<fecha>` y `booking:phone:<teléfono>`, tomados en orden alfabético con `GET_LOCK` y espera de 5 segundos por cada uno. Si no se obtienen, responde `LOCK_TIMEOUT` (409 en las rutas que lo mapean; ver `docs/architecture/api.md`). Las transacciones que toman estos locks tienen un timeout de 30 segundos y las esperas de fila de InnoDB dentro de ellas se acotan a 5 segundos, para que una espera fallida termine con error antes de que la transacción expire y el lock se libere (F1, D82). Los bloqueos manuales de horario no toman estos locks (limitación F2, D83).
2. Lectura de las reglas del mes con `FOR SHARE` sobre la fila de `active_months`.
3. `FOR UPDATE` sobre las citas de la fecha o del teléfono (conflictos del día).
4. Locks de reserva (`reservation_locks`, D88 y D89). Después de los conflictos del paso 3, se limpian los expirados de la fecha procesada (`expires_at <= now`; no se limpian locks de otras fechas) y se leen los locks vigentes que el flujo necesita. Ninguna de estas rutas toma un lock de reserva antes que las citas. La reprogramación pública y la creación y reprogramación admin leen el lock vigente del horario destino con `FOR UPDATE`; un lock vigente de otra clienta rechaza la reprogramación pública con `SLOT_NOT_AVAILABLE` (D87). La reprogramación pública no limpia locks.
5. Lectura de ocupación. En la creación admin y la reprogramación admin es bloqueante (`FOR UPDATE` real, D77). En los bloqueos manuales, la lectura de citas es bloqueante, pero la de bloqueos de horario es plana. La lectura de bloqueos de horario (`listBlockedSlotsByDateForUpdate`), que usan también las rutas públicas, es una lectura plana sin bloqueo de filas (limitación F2).
6. Escritura de la cita o del bloqueo, y liberación de los locks con nombre en los flujos que los tomaron.

Excepción: el bloqueo de espacios (bloqueos manuales de horario y de día completo) no toma los locks con nombre del paso 1 (limitación F2, D83). Sí aplica los pasos 2 a 6, incluida la limpieza de `reservation_locks` de la fecha.

El editor de reglas toma `FOR UPDATE` sobre la misma fila de `active_months`: espera a las escrituras en curso y ninguna escritura mezcla reglas viejas con un cambio en curso.

Confirmar o rechazar una cita `PENDING` desde el admin toma `FOR UPDATE` sobre la fila de la cita y la de su cliente, y nada más: no toma los locks con nombre, ni `FOR SHARE` de reglas, ni los conflictos del día. Por eso esta transición no sigue el orden de seis pasos. Riesgo residual aceptado por el owner: un deadlock InnoDB (1213) raro entre esta confirmación y el reagendado público de otra `PENDING` del mismo cliente; preexistente; el admin recibe error y puede reintentar; no hay pérdida de datos (ADR 0006).

Orden de confirmación de una reserva pública:

1. Inicia transacción.
2. Toma los locks con nombre de fecha y teléfono (sección anterior).
3. Lee las reglas del mes con `FOR SHARE`.
4. Toma con `FOR UPDATE` los conflictos de citas del día y del teléfono (paso 3 de la sección anterior).
5. Limpia locks expirados de la fecha de la reserva (`expires_at <= now`), después de los conflictos (paso 4 de la sección anterior; D88 y D89).
6. Valida lock temporal vigente (`lock_token`) con bloqueo. Si no es válido o expiró, responde `LOCK_EXPIRED_OR_INVALID`.
7. Valida disponibilidad con las reglas vigentes (D39) con bloqueo de conflictos.
8. INSERT (siempre crea una nueva fila), o reprogramación si hay `appointmentIdToReschedule`.
9. Elimina el lock consumido.
10. Libera los locks con nombre. Hoy esto ocurre antes del COMMIT (riesgo F3).
11. COMMIT.
12. Crear evento Google.

Limitaciones conocidas de concurrencia (ADR 0006):

- **F1 (D82, corregida con riesgo residual aceptado por el owner).** El `GET_LOCK` de sesión no se libera si la transacción de Prisma expira antes. Antes de la corrección, con el timeout por defecto de 5 segundos, el lock quedó retenido en 7 de 10 expiraciones medidas por el Reviewer, y `LOCK_TIMEOUT` casi nunca se alcanzaba (la respuesta era `UNKNOWN_ERROR`, 400). Con el timeout de 30 segundos y la espera de fila de 5 segundos, una espera normal ya no expira la transacción y `LOCK_TIMEOUT` responde 409. La cifra de 15 segundos (2 esperas de 5 s por `GET_LOCK` más una espera de fila de 5 s) corresponde al caso de una sola espera de cada tipo; las cadenas de esperas exitosas casi al límite (10 + 5k segundos; k >= 4 llega a 30 segundos) no están cubiertas y son parte del riesgo residual.
  - Residual aceptado por el owner (ronda 26): una transacción que supera 30 segundos expira y su `GET_LOCK` de sesión puede quedar retenido en la conexión del pool hasta cerrarla. Mientras esa conexión viva, las reservas de la misma fecha o del mismo teléfono responden `LOCK_TIMEOUT` (409) tras 5 segundos. Es denegación de reservas por fecha o teléfono, no solo una fuga de lock. Si el pool reutiliza la conexión, el lock puede persistir (contador re-entrante, no medido).
  - No medido: la duración del lock huérfano y la respuesta de `GET_LOCK` desde otra sesión (solo se midió que `IS_USED_LOCK` devuelve la conexión que lo retiene). Medido: tras la expiración, la conexión conserva la espera de fila de 5 segundos, que afecta a flujos fuera de reserva que reutilicen esa conexión hasta que una transacción de reserva la restaure o la conexión se cierre. Revertir el código no limpia esos valores.
  - Sigue sin ser alcanzable por debajo de 30 segundos en uso normal. La corrección completa requiere rediseño (ADR 0006).
- **F2 (D83, aceptado por el owner).** La lectura de bloqueos `listBlockedSlotsByDateForUpdate` es una lectura plana, pese a su nombre. Medido en carrera simultánea: bloqueo admin frente a creación admin, 17 de 40 lotes con doble ocupación; frente a reserva pública, 10 de 40.
- **F3 (aceptado).** Los locks con nombre de la reserva pública se liberan antes del COMMIT. No se midió doble reserva atribuible después de la corrección de B-1.
- **F4 (corregido, D88 y D91).** En la validación de destino de la reprogramación pública, solo un mes no reservable (`MONTH_NOT_ALLOWED`) se convierte en `SLOT_NOT_AVAILABLE`. Los demás errores, incluidos los de base de datos, se propagan como `UNKNOWN_ERROR` (400) y revierten la transacción (D81).
- No hay restricción de base de datos que impida dos citas activas en el mismo horario. La protección es solo de aplicación (decisión de arquitectura del owner; ver `docs/architecture/data-model.md`).

Google Calendar no es fuente de verdad.

Histórico de cancelaciones:

- Re-reservar un slot previamente cancelado crea una nueva fila.
- Las filas CANCELLED se conservan como historial.
- La disponibilidad y conflictos se calculan sobre estados que bloquean ocupación (`PENDING`, `CONFIRMED`, `SYNC_FAILED`); `REJECTED` no bloquea ocupación.

---

## 10. Modelo de Datos

Tabla: clients

- id (PK)
- client_number INT UNIQUE
- name VARCHAR(100)
- phone VARCHAR(10) UNIQUE
- is_loyal BOOLEAN NOT NULL DEFAULT false
- created_at DATETIME
- updated_at DATETIME

Tabla: appointments

- id (PK)
- client_id (FK -> clients.id)
- date DATE
- time_slot TIME
- status ENUM('PENDING','CONFIRMED','REJECTED','CANCELLED','SYNC_FAILED')
- google_event_id VARCHAR(255)
- created_at DATETIME
- updated_at DATETIME

Regla de integridad referencial:

- FK `appointments.client_id -> clients.id` con `ON DELETE CASCADE` y `ON UPDATE CASCADE`.

Índices:

- INDEX(date, time_slot)
- INDEX(client_id, status)
- INDEX(date)

Tabla: reservation_locks

- id (PK)
- date DATE
- time_slot TIME
- phone VARCHAR(10)
- lock_token VARCHAR(191) UNIQUE
- expires_at DATETIME
- created_at DATETIME
- updated_at DATETIME

Índices:

- INDEX(date, time_slot, expires_at)
- INDEX(phone, expires_at)

Tabla: active_months

- id (PK)
- month CHAR(7) UNIQUE (`YYYY-MM`)
- status ENUM('ACTIVE','INACTIVE')
- slot_mode ENUM('BLOCK_MODE','SECOND_ONLY_MODE') DEFAULT 'BLOCK_MODE' (legado: el código no lo lee ni lo escribe; se elimina con la migración 0023, pendiente de despliegue; FR-033, D31)
- availability_version INT (versión de las reglas del mes; se compara con `expectedVersion` al guardar)
- created_at DATETIME
- updated_at DATETIME

Índices:

- UNIQUE(month)
- INDEX(status, month)

Tabla: blocked_slots

- id (PK)
- date DATE
- time_slot TIME
- reason ENUM('DESCANSO','PERSONAL','OTRO')
- created_by_admin_user_id INT NULL (FK -> admin_users.id)
- created_at DATETIME
- updated_at DATETIME

Índices:

- UNIQUE(date, time_slot)
- INDEX(date)
- INDEX(created_by_admin_user_id)

Tabla: admin_users

- id (PK)
- username VARCHAR(191) UNIQUE
- name VARCHAR(100)
- password_hash CHAR(64)
- password_salt VARCHAR(191)
- status ENUM('active','inactive')
- last_login_at DATETIME NULL
- created_at DATETIME
- updated_at DATETIME

Índices:

- UNIQUE(username)
- INDEX(status)

Tabla: appointment_logs

- id (PK)
- appointment_id INT FK -> appointments.id
- action_type ENUM('PENDING','CONFIRMED','CANCELLED','REJECTED','MODIFIED')
- payload JSON
- actor_type ENUM('SYSTEM','ADMIN','CLIENT')
- client_id INT FK -> clients.id
- created_at DATETIME

Reglas de integridad y auditoría:

- `appointment_logs` es append-only desde la aplicación.
- No existe edición ni borrado de eventos de log en v1.
- Se ejecuta un backfill histórico una sola vez para las citas existentes al momento de liberar el feature, usando un cutoff de despliegue para evitar duplicados.
- Los datos de cliente pueden resolverse por relación en tiempo de consulta.
- `payload` debe preservar el horario legible asociado al evento.
- En `MODIFIED`, `payload` debe incluir `appointment`, `previous` y `next` para no depender solo del estado actual de la cita.
- Si no existe actor identificable, se persiste `actor_type=SYSTEM`.

Índices:

- INDEX(created_at)
- INDEX(action_type)
- INDEX(actor_type)
- INDEX(client_id)
- INDEX(appointment_id)

### 10.1 Disponibilidad por mes (spec 003)

Tablas nuevas (detalle de columnas, claves, restricciones y migración en `docs/architecture/data-model.md`):

- `availability_rules`: reglas del mes (rango de fechas, `minGapMinutes`, `preserveCapacity`, `maxPerDay`).
- `availability_rule_weekdays` y `availability_rule_times`: días de la semana y horas de cada regla.
- `availability_exceptions`: excepciones por fecha con sus tres parámetros. Una fecha es única por mes.
- `availability_exception_times`: horas de cada excepción. Una lista vacía cierra el día.
- `availability_migration_runs`: control de la migración idempotente de `slot_mode` a reglas (FR-031). Se conserva tras `0023`; retirarla requiere decisión del owner.

Reglas de integridad y consistencia:

- Las reglas y excepciones pertenecen a un mes; se borran en cascada con su mes (`docs/architecture/data-model.md`).
- Un mes sin reglas se interpreta con el default D6 (D17, D31). La columna legada no interviene.
- Las horas de una regla o excepción siguen el formato `HH:mm`, sin duplicados y ordenadas (D37). `00:00` no es una hora de reglas: es el marcador de bloqueo de día completo en `blocked_slots` (D41, D55).
- `blocked_slots` mantiene su tabla y su restricción `UNIQUE(date, time_slot)`. Un bloqueo de horario puntual dura 1 hora en Calendar si fue creado desde el despliegue (D15, D30).
- `appointments` no tiene restricción `UNIQUE(date, time_slot)`. Dos citas activas en el mismo horario se evitan solo con la lógica de aplicación y los locks de la sección 9.
- Migración: el backfill desde `slot_mode` (D4) no modifica `appointments.date`, `time_slot`, `status` ni `google_event_id` (FR-032). El orden de migración, backfill, despliegue y limpieza está en `docs/architecture/data-model.md`.

---

## 11. Casos Edge

1. Acceso a mes no activo o mes pasado → Rechazar.
2. Doble confirmación simultánea → Solo una gana.
3. Fallo Google → Estado SYNC_FAILED.
4. Reserva mismo día → Permitida solo para horarios iguales o posteriores a la hora actual en `America/Mexico_City` (D50).
5. Usuario con cita activa intenta reservar → Bloquear.
6. Día con `maxPerDay` citas activas, o sin horarios que cumplan separación y capacidad → Día no ofrece horarios y no es visible en el flujo público (FR-011, FR-015).
7. Manipulación frontend → Backend recalcula.
8. Cancelación simultánea y nueva reserva → Resolver vía transacciones.
9. Cambio horario verano → Usar siempre America/Mexico_City.
10. Intento de cancelar una cita con menos de 24 horas de anticipación → Rechazar en flujo web de `/my-appointments`.
11. Intento de modificar una cita con menos de 3 horas de anticipación → Rechazar en flujo web de `/my-appointments`.
12. Lock temporal expirado durante confirmación → Rechazar (`LOCK_EXPIRED_OR_INVALID`) y pedir reselección.
13. Dos usuarios intentando lockear el mismo slot → Solo un lock vigente gana.
14. Cambio de mes (00:00 America/Mexico_City) con `active_months` desactualizada → el job de reconciliación debe reactivar ventana vigente y desactivar meses pasados.
15. Intento de acceso a `/admin/*` sin sesión válida → redirección obligatoria a `/admin/login`.
16. Acción de cita sin actor identificable → registrar evento de auditoría con actor `Sistema`.
17. Consulta de logs de citas sin sesión admin válida → rechazar acceso y no exponer datos.
18. Exportación PDF de logs sin resultados → generar PDF válido con filtros aplicados, fecha de generación y estado vacío.
19. Mes sin reglas → usa el default de lunes a viernes (`09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `240/true/3`) en los días que ninguna excepción cubre; sábados y domingos cerrados (D6, D28). Al eliminar la última regla, el mes vuelve a ese default (D17).
20. Primera regla de un mes sin reglas → los días que el default abría y que la nueva regla no cubre quedan cerrados (D28, D23). Se acepta sin advertencia extra (D42).
21. Día sin horarios ofrecibles (regla o excepción vacía, bloqueo de día completo, horas transcurridas) → `SLOT_NOT_AVAILABLE` al reservar, reprogramar o agendar (D46). Ya no existe `WEEKDAY_ONLY`.
22. Fecha de calendario inexistente o malformada (p. ej. `2026-02-30`) → `VALIDATION_ERROR` en reservas y reprogramaciones públicas (validación de calendario real de la fecha).
23. Lock vigente sobre un horario que una regla eliminó después → el lock sigue hasta su TTL de 10 minutos; la confirmación valida contra las reglas vigentes y responde `SLOT_NOT_AVAILABLE` (D39).
24. Cambio de reglas que deja citas activas fuera de la rejilla → las citas no cambian de fecha, hora ni estado (D5). Antes de guardar se listan las afectadas; las citas pasadas no se listan y los bloqueos manuales no entran en el cálculo (D18, D35, D40).
25. Reprogramación admin de una cita `PENDING` → no es editable desde la agenda admin; la lectura filtra por estado y responde `APPOINTMENT_NOT_FOUND` (D72).
26. Bloqueo admin sobre un horario con cita `PENDING` → `SLOT_NOT_AVAILABLE`: una cita `PENDING` ocupa horario también para bloqueos (D68, D71).
27. Mes pasado → no se crean, editan ni eliminan reglas o excepciones, ni se ejecuta `PATCH slot-mode` (`MONTH_IN_PAST`, D36).

---

## 12. Invariantes del Sistema

1. MySQL es fuente de verdad.
2. Google Calendar es sistema espejo.
3. No existen traslapes.
4. Separación mínima por regla o excepción (`minGapMinutes`, medida entre horas de inicio) y máximo `maxPerDay` citas activas por día (1 a 6). Con `preserveCapacity`, no se ofrece un horario que reduzca la capacidad alcanzable del día (sección 4.3).
5. En flujo público: se permiten múltiples citas activas futuras por teléfono en el mismo mes; cuando existen citas activas futuras del mismo mes dentro del umbral de 15 días naturales, el sistema muestra una sugerencia de UX para reagendar o continuar como nueva cita. Las citas activas para el umbral son `PENDING`, `CONFIRMED` y `SYNC_FAILED` (D95). En admin: se permiten múltiples citas futuras por cliente.
6. Los días válidos los determinan las reglas y excepciones del mes (sección 4.1); no hay días fijos. Un mes sin reglas aplica el default D6.
7. Mismo día permitido únicamente para horarios futuros (según hora actual en `America/Mexico_City`).
8. Solo meses `ACTIVE` y nunca meses pasados.
9. Confirmación atómica.
10. Cancelación libera horario.
11. Modificación pública preserva el mismo `appointments.id`.
12. Modificación pública no aplica `isLoyal` ni la sugerencia de 15 días.
13. Lock temporal expira automáticamente por `expires_at` y no bloquea fuera de su ventana.
14. Las rutas protegidas de admin requieren sesión NextAuth firmada y vigente.
15. Los eventos de auditoría de citas son inmutables y se generan prospectivamente solo después de liberar el feature.
16. Cambiar reglas o excepciones no modifica ni cancela citas ni eventos de Google Calendar (D5).
17. Una cita `PENDING` ocupa horario en el flujo público y en las escrituras admin (D68), pero no cuenta en los contadores del admin (D66).

## 13. Stack de tecnologías

- Next js
- Tailwind css
- Prisma ORM
- Docker para generar ambiente
- i18next
- react-i18next
- next-auth (credentials provider)
- Node crypto (hash de contraseña admin con salt + pepper)

## 14. Internacionalización y Contrato de Mensajes

Reglas obligatorias:

1. Idiomas soportados actuales:
   - `es`
   - `en`
2. Fallback obligatorio: `es`.
3. El selector de idioma está disponible en pantalla inicial y en todo el producto con este contrato de ubicación:
   - flujo público: FAB global fijo.
   - panel admin autenticado (`/admin/*` excepto `/admin/login`): control en `appHeader` (sin FAB flotante).
4. Persistencia de idioma:
   - `cookie` (`app_lang`) para SSR y navegación.
   - `localStorage` para continuidad del cliente.
5. Si el idioma del dispositivo no está soportado, usar `es`.
6. Si una clave de traducción falta en idioma activo, usar fallback `es`.
7. Propiedad de textos UX:
   - Frontend = dueño único de mensajes visibles al usuario.
   - Backend = solo códigos estables + payload de interpolación.
8. Contrato de error API:
   - `errorCode`: identificador estable para traducción en frontend.
   - `error`: alias legacy transitorio durante migración.
9. Regla obligatoria para Admin Panel:
   - Todo texto visible en rutas/componentes admin debe resolverse con `react-i18next`.
   - Quedan prohibidos literales de UX inline en `app/admin`, `components/admin` y `hooks/admin`.
   - Nuevos textos requieren clave en `es` y `en` antes de merge.
10. Formato de fecha larga (helper compartido `formatLongDate` en `lib/datetime/mexico-city.ts`):
    - `es`: `{Día de la semana} {d} de {Mes}` sin coma entre el día de la semana y la fecha, con día de la semana y mes capitalizados (ejemplo: `Lunes 13 de Abril`).
    - `en`: `{Weekday} {Month} {d}` (ejemplo: `Monday April 13`).
    - Aplica en todas las pantallas y en los mensajes de WhatsApp que usan la fecha larga, tanto de flujos públicos (reserva, pendiente, cancelación, `Mis citas`) como del admin (tarjeta de pendientes, detalle de clienta, modal de reserva admin).
    - Cambio de formato: antes `es` usaba coma (`Lunes, 13 de Abril`). Decisión de la dueña, aplicada de forma global; afecta por tanto a los flujos públicos, no solo al admin.
    - Excepción: los recordatorios de `Recordatorios` (`NEXT_DAY`/`NEXT_WEEK`) no usan este helper; arman día de la semana, día y mes por separado y conservan su plantilla propia.

## 15. Admin Panel

### 15.1 Alcance y aislamiento

- El admin panel es una superficie independiente del flujo público.
- Rutas UI base:
  - `/admin/login`
  - `/admin/`
- El sistema visual del admin usa exclusivamente `docs/ui/admin/*`, `components/admin/ui` y el shell de `components/admin/layout`.
- No debe reutilizar ni alterar el sistema visual del flujo público.

### 15.1.1 App Shell de navegación admin

- Todas las rutas autenticadas `/admin/*` (excepto `/admin/login`) deben usar un shell de navegación compuesto por:
  - `appHeader` superior minimalista,
  - `SideBar` de navegación principal.
- Comportamiento responsive obligatorio:
  - desktop (`lg+`): sidebar fijo lateral izquierdo,
  - mobile: sidebar en modo drawer, abierto mediante acción de menú en el header.
- Navegación mínima visible del shell:
  - `Dashboard` -> `/admin`
  - `Meses` -> `/admin/months` (activo también para `/admin/months/[month]`)
  - `Logs de citas` -> `/admin/appointment-logs`
  - `Clientes` visible como deshabilitado (sin navegación funcional en esta fase).
- Acción global `Cerrar sesión`:
  - visible al final del sidebar,
  - ejecuta `signOut` de NextAuth y redirige a `/admin/login`.
- El `appHeader` debe mostrar título de sección resuelto por ruta vía i18n (`react-i18next`), sin breadcrumbs en esta fase.
- El `appHeader` debe incluir el control de cambio de idioma (`es`/`en`) para rutas admin autenticadas.
- El `appHeader` debe incluir un buscador global de clientes para todas las rutas autenticadas del admin (`/admin/*` excepto `/admin/login`).
- El buscador global:
  - se acciona desde un botón en el extremo derecho del `appHeader`, ubicado a la izquierda del selector de idioma,
  - se renderiza dentro de un modal del shell admin,
  - permite buscar por nombre o teléfono,
  - usa debounce de `500ms`,
  - consulta `GET /api/admin/clients/search`,
  - muestra hasta `8` resultados,
  - al seleccionar un resultado navega a `/admin/clients/[clientId]`,
  - permite limpiar el término de búsqueda,
  - muestra estados de `loading`, `empty` y `error` sin abandonar el shell actual.

### 15.1.2 Logs de citas (`/admin/appointment-logs`)

- Alcance:
  - El apartado permite auditoría, trazabilidad interna, detección de abuso y validación de responsabilidades sobre acciones de citas.
  - Solo usuarios admin autenticados y activos pueden acceder a la ruta y a su API.
- Eventos registrados:
  - `PENDING` -> `Cita solicitada`.
  - `CONFIRMED` -> `Cita confirmada`.
  - `CANCELLED` -> `Cita cancelada`.
  - `MODIFIED` -> `Cita modificada`.
  - `REJECTED` -> `Cita rechazada`.
  - Registro:
    - Cada transición exitosa posterior a la liberación del feature genera exactamente un evento append-only.
    - El rechazo automático de citas `PENDING` vencidas también genera evento `REJECTED` con actor `Sistema`.
    - Las citas existentes al momento de liberar el feature reciben un evento histórico inicial generado por el backfill una sola vez, siempre que no tengan ya historial.
    - El backfill usa actor `Sistema` y se ejecuta con un cutoff de despliegue para delimitar el universo histórico.
  - Los contratos existentes de agendar, cancelar, modificar, aprobar y rechazar evolucionan solo donde el flujo lo requiere; el log se agrega como side effect interno tras una transición exitosa.
- El actor se clasifica como `Sistema`, `Admin` o `Cliente`.
- Si no hay actor identificable, el actor visible debe ser `Sistema`.
- El actor visible de la tabla es la categoría, no el nombre individual del usuario.
- Cuando la acción sea `Cita modificada`, el log debe conservar evidencia legible del horario anterior y del horario nuevo.
- Esa evidencia se persiste dentro de `appointment_logs.payload`, no en columnas snapshot separadas.
- Tabla:
  - columnas visibles:
    - `No. de cita`,
    - `cliente`,
    - `Acción`,
    - `Fecha/Hora de cita`,
    - `Fecha/Hora de acción`,
    - `Actor`.
  - Las columnas de fecha/hora se muestran en formato legible para admin: `DD-MMM-YYYY hh:mm am/pm` en zona `America/Mexico_City` (por ejemplo, `14-Ago-2026 06:00 pm`).
  - La columna de actor se muestra al final de la tabla.
  - Debe permitir paginación.
  - Debe permitir filtros por:
    - cliente por nombre o teléfono,
    - mes de la cita,
    - fecha de acción,
    - estado/tipo de acción.
- Debe permitir exportación PDF sobre el resultado filtrado.
- Contrato i18n/UI:
  - Todo texto visible del admin debe resolverse mediante `react-i18next`.
  - La vista debe componerse con `components/admin/ui/` y respetar `docs/ui/admin/*`.
  - El flujo público de booking/my-appointments no debe adoptar componentes ni tokens del admin.

### 15.1.3 API de logs de citas

- Endpoint global:
  - `GET /api/admin/appointment-logs`
- Acceso:
  - Requiere sesión admin autenticada y activa.
- Filtros soportados:
  - `client` (nombre o teléfono),
  - `actionType` (`PENDING`, `CONFIRMED`, `CANCELLED`, `MODIFIED`, `REJECTED`),
  - `month` (`YYYY-MM`, filtrado por mes de la cita),
  - `actionDateFrom`,
  - `actionDateTo`.
  - Paginación:
    - `page`,
    - `pageSize` con valor por defecto `20` y rango permitido `1..100`.
  - Exportación:
    - `format=pdf` genera un archivo PDF con los mismos filtros.
    - El PDF exporta hasta `1,000` filas filtradas.
    - Si los filtros coinciden con más de `1,000` filas, la API responde `EXPORT_LIMIT_EXCEEDED` con HTTP `422` y no genera PDF parcial.
    - Sin `format` o con `format=json`, devuelve JSON paginado.
  - Errores:
    - acceso sin sesión -> `ADMIN_UNAUTHORIZED`,
    - filtros inválidos -> `VALIDATION_ERROR`,
    - formato de exportación no soportado -> `UNSUPPORTED_EXPORT_FORMAT`,
    - exportación con más de `1,000` resultados -> `EXPORT_LIMIT_EXCEEDED` (`422`).

### 15.1.4 Dashboard (`/admin`) – bloque de ocupación semanal

- La parte superior del dashboard debe incluir una tarjeta `Ocupación semanal`.
- La parte superior del dashboard debe incluir un bloque destacado `Día más ocupado`.
- La parte superior del dashboard debe incluir una tarjeta `Ocupación del día`.
- La parte superior del dashboard debe incluir un bloque `Agenda de Hoy` en formato línea de tiempo.
- La parte superior del dashboard debe incluir un bloque `Pendientes de confirmación`.
- La parte superior del dashboard debe incluir un bloque `Recordatorios`.
- La parte superior del dashboard debe incluir una tarjeta `Tip del día`.
- La tarjeta muestra:
  - título `Ocupación semanal`,
  - indicador comparativo unificado `N% más|menos|similar Vs semana pasada`,
  - gráfico de barras con una columna por día de la semana actual, de `lunes` a `domingo` (D57), en una cuadrícula de 7 columnas (`grid-cols-7`) en móvil y escritorio,
  - tooltip por barra con la cantidad de citas activas del día.
  - en dispositivos táctiles, el tooltip se abre al tocar la barra y se cierra al perder foco de esa barra.
- Fuente de ocupación:
  - citas activas (`CONFIRMED`, `SYNC_FAILED`) del rango lunes a domingo de la semana actual en zona `America/Mexico_City`. Las citas `PENDING` no cuentan (D66).
- Cálculo de barras por día:
  - `% ocupación día = citas activas del día / capacidad del día * 100` (redondeado entero). La capacidad del día es su `maxPerDay` si está abierto y `0` si está cerrado o tiene bloqueo de día completo; con capacidad `0` el porcentaje es `0` (D44, D57).
- Cálculo comparativo semanal:
  - `% semana actual = citas activas de la semana / capacidad de la semana * 100`, donde la capacidad es la suma de `maxPerDay` de los días abiertos (D44, D53). Sin capacidad, el porcentaje es `0`. No tiene tope: puede superar 100 % (aceptado, sin tope).
  - `% semana anterior = citas activas de la semana anterior / capacidad de la semana anterior * 100`, con la misma regla,
  - `delta = semana actual - semana anterior` (puntos porcentuales).
- Semántica del indicador:
  - `delta > 0` -> `más`,
  - `delta < 0` -> `menos`,
  - `delta = 0` -> `similar`.
  - Iconografía obligatoria:
    - `delta > 0`: `ArrowCircleUp` verde,
    - `delta < 0`: `ArrowCircleDown` rojo,
    - `delta = 0`: `MinusCircle` gris.
- Contrato i18n:
  - título, badge y etiquetas semánticas (`más|menos|similar`) se resuelven por `react-i18next` en `admin`.
- Bloque `Día más ocupado`:
  - muestra título `Día más ocupado`,
  - muestra el nombre del día (lunes a domingo) con mayor número de citas activas de la semana actual,
  - muestra subtítulo `Máxima demanda de citas`,
  - usa iconografía de estrella en contenedor circular.
  - en empate de ocupación, debe elegirse el primer día en orden semanal (`lunes` a `domingo`).
  - si la semana actual no tiene citas activas, el bloque no debe renderizarse.
- Tarjeta `Ocupación del día`:
  - muestra título:
    - `Ocupación del día` en lunes-viernes,
    - `Ocupación para el Lunes` en sábado/domingo (cuando el dato visible corresponde al lunes),
  - muestra porcentaje de ocupación de hoy,
  - muestra barra de progreso horizontal asociada al porcentaje,
  - debajo de la barra muestra texto `N citas agendadas para hoy` acompañado por icono `InfoCircle`.
  - cálculo:
    - `% ocupación hoy = citas activas de la fecha de agenda / capacidad de esa fecha * 100` (redondeado entero, máximo visual 100%); la capacidad sigue la misma regla que la barra diaria (D44, D57, D58),
    - `citas activas de hoy` incluye estados `CONFIRMED`, `SYNC_FAILED`.
- Bloque `Agenda de Hoy`:
  - muestra título:
    - `Agenda de Hoy` en lunes-viernes,
    - `Agenda para el Lunes` en sábado/domingo,
  - incluye icono en el encabezado como enlace a `/admin/months/[currentMonth]`,
  - lista las citas activas del día de referencia en orden ascendente por `timeSlot`,
  - día de referencia:
    - lunes a viernes: el día actual,
    - sábado o domingo: el siguiente lunes.
  - cada item incluye:
    - hora (`HH:mm` + `AM/PM`),
    - nombre del cliente,
    - teléfono formateado,
    - tag de estado operativo.
  - estados del tag:
    - `Listo`: la cita ya finalizó,
    - `En curso`: la cita está dentro de su ventana de atención,
    - `Pendiente`: la cita aún no inicia.
  - para el estado `En curso`, la tag debe usar animación de parpadeo.
  - la lógica de estado usa duración operativa de 3 horas por cita.
  - si no hay citas activas para hoy, muestra estado vacío informativo.
- Bloque `Pendientes de confirmación`:
  - muestra las citas con estado `PENDING`,
  - por cada cita muestra nombre de la clienta, teléfono, número de clienta, fecha y hora,
  - permite acciones directas para `Confirmar` y `Rechazar`,
  - la acción `Confirmar` transiciona la cita localmente a `CONFIRMED` y luego intenta crear evento espejo en Google Calendar,
  - si la sincronización de Calendar falla, la cita queda en `SYNC_FAILED` (activa para reglas de ocupación y recuperable por job de reintento),
  - si la acción `Confirmar` termina en `CONFIRMED` o `SYNC_FAILED`, tras el toast de éxito muestra un toast de acción separado para avisar a la clienta por WhatsApp:
    - título: `¿Avisar a la clienta por WhatsApp?` (`es`) / `Notify the client on WhatsApp?` (`en`); botón: `Enviar por WhatsApp` (`es`) / `Send on WhatsApp` (`en`); sin descripción,
    - el toast no abre WhatsApp por sí mismo: la URL se abre solo cuando el admin pulsa el botón, en la misma pestaña,
    - URL final `https://wa.me/52{phone}?text={encodedMessage}` (`phone` son 10 dígitos), con plantilla `es`: `🗓️ *Nos vemos el {Fecha} a las {Hora}*!`; plantilla `en`: `🗓️ *See you on {Fecha} at {Hora}*!`,
    - `{Fecha}` y `{Hora}` son los mismos textos que muestra la tarjeta (fecha larga y hora con el formato del idioma activo),
    - el admin permanece en el dashboard: tras confirmar con éxito la tarjeta se actualiza y la cita deja de aparecer en `Pendientes de confirmación`; la URL del toast se construye antes de esa actualización, así que el botón sigue funcionando aunque la tarjeta se desmonte,
    - ofrecer el envío no cambia el estado de la cita ni registra nada adicional,
  - si la confirmación falla, muestra el toast de error, no ofrece WhatsApp y deja los botones disponibles,
  - la acción `Rechazar` transiciona la cita a `REJECTED`, no ofrece WhatsApp y refresca el dashboard,
  - el bloque solo lista citas aún no resueltas manualmente.
- Bloque `Recordatorios`:
  - muestra dos secciones:
    - `Citas para mañana` (`currentDate + 1`),
    - `Citas para la próxima semana` (`currentDate + 7`).
  - fuente de datos:
    - solo citas activas (`CONFIRMED`, `SYNC_FAILED`) en `America/Mexico_City`.
  - por cada cita muestra:
    - avatar de clienta (iniciales),
    - nombre de clienta,
    - número de clienta,
    - teléfono formateado,
    - hora de cita.
  - cada cita expone la acción `Enviar recordatorio` (icono).
  - al ejecutar la acción:
    - frontend construye `https://wa.me/52{phone}?text={encodedMessage}`,
    - frontend abre la URL final de WhatsApp de forma síncrona durante el click/tap para evitar bloqueo de popups en navegadores móviles y no debe abrir una pestaña intermedia en blanco.
  - plantilla de mensaje por tipo:
    - `NEXT_DAY`: `Hola *{Nombre}*!\nSolo para recordarte que tienes tu cita agendada el día de *mañana a las {Hora}*🗓️.\nNos vemos mañana✨`,
    - `NEXT_WEEK`: `Hola *{Nombre}*!\nSolo para recordarte que tienes tu cita agendada el próximo *{Día de la semana}, {Día} de {Mes} a las {Hora}*🗓️.\nNos vemos la próxima semana✨`.
  - reenvío:
    - se permite reenviar recordatorios sin límite para la misma cita y tipo.
- Bloque `Recordatorios de retoque`:
  - se muestra debajo de `Recordatorios` solo cuando existe al menos una clienta candidata.
  - objetivo: enfocar clientas sin cita confirmada futura para impulsar agendado de retoque.
  - fuente de candidatas:
    - punto de partida: clientas con cita hace exactamente 21 días (`currentDate - 21`) en estado `CONFIRMED` o `SYNC_FAILED`,
    - deduplicación por clienta (`clientId`),
    - ventana retrospectiva evaluada: citas entre `D-20` y `D` (la cita base de `D-21` no bloquea por sí misma),
    - ventana prospectiva evaluada: citas entre `D` y `D+31`.
  - criterio de omisión:
    - si existe al menos una cita `CONFIRMED` en retrospectiva o prospectiva, se omite.
  - criterio de candidatura:
    - si no existe ninguna `CONFIRMED` en ambas ventanas, la clienta es candidata,
    - incluye casos sin citas en ventanas o con citas únicamente en estados distintos de `CONFIRMED`.
  - por cada fila se muestra:
    - avatar de iniciales, nombre, número de clienta, teléfono y referencia de última cita (`D-21`).
  - acción por fila:
    - abre WhatsApp de forma síncrona con URL final `https://wa.me/52{phone}?text={encodedMessage}`.
  - mensaje fijo:
    - `Hola qué tal! ✨\nLa siguiente semana se cumple el mes de tus uñas, agendamos tu retoque? 😉`
  - reenvío:
    - se permite reenviar sin límite, igual que el bloque de recordatorios estándar.
- Tarjeta `Tip del día`:
  - muestra título `Tip del día`,
  - muestra un tip operativo diario resuelto desde catálogo CSV en `assets/`,
  - usa rotación determinista por fecha de negocio (`America/Mexico_City`).
  - algoritmo:
    - ancla: `2026-03-29` = tip #1,
    - `dayOffset = daysBetween(anchorDate, currentDate)`,
    - `tipIndex = ((dayOffset % totalTips) + totalTips) % totalTips`,
    - tip del día = fila `tipIndex`.
  - catálogo vigente:
    - ES: `assets/tips_operativos_salon_unas.csv`,
    - EN: `assets/tips_operativos_salon_unas_en.csv`.
  - contrato de catálogo CSV:
    - una fila = un tip,
    - sin encabezado,
    - el orden de filas define la secuencia diaria.
  - fallback:
    - si catálogo EN no existe o no está alineado en longitud con ES, se usa ES.

### 15.2 Flujo de autenticación admin

1. Usuario abre `/admin/login`.
2. Captura `username` y contraseña.
3. Frontend ejecuta `signIn("credentials")` de NextAuth.
4. Backend valida payload y credenciales contra `admin_users` usando `password_hash` + `password_salt` + `ADMIN_AUTH_PEPPER`.
   - algoritmo: `SHA-256(salt + password + pepper)`.
5. Si credenciales son válidas y la cuenta está activa:
   - genera sesión NextAuth firmada por `NEXTAUTH_SECRET`,
   - actualiza `last_login_at`,
   - redirige a `/admin/`.
6. Si formulario está incompleto:
   - responde `FORM_INCOMPLETE`.
7. Si credenciales inválidas:
   - responde `INVALID_CREDENTIALS`.
8. Si cuenta inactiva:
   - responde `ADMIN_USER_INACTIVE`.

### 15.3 Protección de rutas y redirecciones

- Cualquier acceso a `/admin/*` (excepto `/admin/login`) requiere sesión admin válida.
- Si no existe sesión válida:
  - redirección obligatoria a `/admin/login`.
- Si usuario ya autenticado abre `/admin/login`:
  - redirección obligatoria a `/admin/`.
- Logout:
  - `signOut` de NextAuth limpia cookie/sesión.

### 15.4 Contrato API admin auth

- NextAuth credentials callback:
  - `POST /api/auth/callback/credentials`
  - request: `{ username, password }`
  - errores funcionales: `FORM_INCOMPLETE`, `INVALID_CREDENTIALS`, `ADMIN_USER_INACTIVE`
- Bootstrap/admin user management:
  - script: `scripts/create-admin-user.ts` (flags + modo interactivo)
- NextAuth session endpoint:
  - `GET /api/auth/session`
- NextAuth logout endpoint:
  - `POST /api/auth/signout`

### 15.4.1 Contrato API recordatorios admin

- No aplica en el flujo actual del dashboard.
- El envío de recordatorio se resuelve en frontend mediante apertura directa de URL de WhatsApp.

### 15.5 Contrato i18n admin

- Namespaces del admin:
  - `admin`: etiquetas, placeholders, títulos y copy de dashboard/auth.
  - `adminErrors`: mensajes UX traducibles para códigos de error admin.
- Regla de propiedad de mensajes:
  - backend admin retorna códigos estables (`FORM_INCOMPLETE`, `INVALID_CREDENTIALS`, `ADMIN_USER_INACTIVE`),
  - frontend admin mapea código -> clave de traducción y resuelve texto final por idioma activo.
- Calidad obligatoria:
  - lint bloqueante para evitar literales UX inline en superficies admin.

### 15.6 Contrato de notificaciones UI admin

- El panel admin debe usar exclusivamente `sileo` para notificaciones de tipo:
  - `success`, `warning`, `error`, `info`,
  - notificaciones con acción,
  - notificaciones basadas en promesas.
- El punto de montaje del sistema de notificaciones debe existir en el layout raíz del admin (`app/admin/layout.tsx`) mediante `Toaster`.
- No se permite mezclar librerías alternativas de `toast`/`notification` en casos cubiertos por este contrato, salvo excepción explícita documentada.
- Todo texto mostrado por notificaciones del admin debe resolverse por `react-i18next` (mismo contrato de internacionalización del panel admin).

### 15.7 Catálogo de meses admin

Ruta UI:

- `/admin/months`

Ruta detalle:

- `/admin/months/[month]` (`YYYY-MM`)

Objetivo:

- Exponer un catálogo operativo de meses para monitoreo admin con métricas, filtros, listado navegable y creación controlada de nuevos meses futuros.

Estado de implementación de disponibilidad por mes (spec 003):

- Implementados: motor, reglas, excepciones, API y métricas de disponibilidad (sección 4.3 y `docs/architecture/api.md`); editor de reglas y excepciones, diálogo de citas afectadas, textos de `Bloquear espacios` y calendario.
- Esta sección describe el comportamiento vigente del código.

Flujo UI:

1. Admin autenticado abre `/admin/months`.
2. Visualiza grid de 6 métricas (3 columnas x 2 filas):
   - `Activos`: `active_months.status = ACTIVE` (por año seleccionado).
   - `Inactivos`: `active_months.status = INACTIVE` (por año seleccionado).
   - `Futuros`: `active_months.month > currentMonth` (por año seleccionado).
   - `Pasados`: `active_months.month < currentMonth` (por año seleccionado).
   - `Citas pasadas`: `appointments.date < currentDate` y status activo (`CONFIRMED`, `SYNC_FAILED`) en el año seleccionado.
   - `Citas futuras`: `appointments.date > currentDate` y status activo (`CONFIRMED`, `SYNC_FAILED`) en el año seleccionado.
3. Admin ajusta filtros:
   - `Año`: rango permitido = año actual + 5 años posteriores.
   - `Estado`: `ALL`, `ACTIVE`, `INACTIVE`.
   - `Mostrar meses anteriores` (switch, apagado por defecto): controla si la lista incluye meses pasados.
4. Sistema actualiza listado de meses filtrado por `Año + Estado`, y después por el switch `Mostrar meses anteriores`:
   - Por defecto (switch apagado) la lista muestra solo el mes actual y los meses futuros (`month >= currentMonth`); los meses pasados (`month < currentMonth`) se ocultan.
   - Con el switch encendido la lista muestra también los meses pasados.
   - El filtro de pasados es solo de presentación: las métricas (incluida `Pasados`) siguen calculadas sobre todo el año seleccionado y no cambian con el switch.
   - El contador de la lista (`N Reg.`) refleja la cantidad de meses visibles tras aplicar el switch.
   - Si el switch está apagado, la lista queda vacía y existen meses pasados para el filtro actual, el mensaje vacío sugiere activar `Mostrar meses anteriores`.
   - El estado del switch persiste en la URL como `past=1` (encendido) o sin el parámetro (apagado). Cualquier otro valor se trata como apagado. Cambiar el switch reemplaza la URL sin crear entrada en el historial y conserva `year` y `status`; cambiar `Año` o `Estado` conserva `past`.
   - El switch no realiza llamadas a `GET /api/admin/months/catalog`.
5. Admin puede navegar a `/admin/months/[month]` para consultar detalle operativo del mes seleccionado.
   - Vista de detalle:
     - grid de métricas 2x2 (`Confirmadas`, `Canceladas`, `Disponibles`, `Bloqueados`),
     - tarjeta de `Ocupación proyectada para este mes` (porcentaje + barra),
     - comparativa textual vs mes anterior en la misma tarjeta en formato `N% más/menos comparado con (mes) (año)`,
     - la comparativa muestra iconografía de tendencia:
       - `ArrowCircleUp` verde para `más`,
       - `ArrowCircleDown` rojo para `menos`,
       - `MinusCircle` neutro cuando no hay cambio + texto `Misma ocupación comparada con el mes anterior`,
     - calendario operativo mensual en grid de lunes a domingo (sección 2): encabezados `LUN`…`DOM` y huecos iniciales según el día de la semana del día 1.
   - Fórmula de `Disponibles` (métrica mensual, FR-027, D12, D56):
     - suma de `availableSpaces` de los días del mes, calculados con el resolvedor de la sección 4.3. Cada día aporta las citas adicionales alcanzables, acotadas por su `maxPerDay`.
     - los días anteriores a hoy aportan `0` y se pintan cerrados (D56).
     - los contadores no cuentan citas `PENDING` (D66). Una `PENDING` sí bloquea horario en el flujo público, así que `Disponibles` puede mostrar más espacios libres que los reservables. Es una consecuencia aceptada.
   - `espacios bloqueados` (FR-029, D14, D41): cada horario de la rejilla del día con bloqueo manual cuenta como `1`. Un bloqueo de día completo cuenta `1` por cada horario de la rejilla del día según la regla vigente; si la regla no produce horarios, cuenta `0`. No hay vista `Por bloque` ni pares direccionales.
   - Métricas de capacidad del dashboard: sección 15.1.4 (D44, D53).
   - En modal de agenda diaria, cada fila de cita muestra:
     - hora,
     - nombre del cliente,
     - teléfono como subtítulo,
     - acciones (`Editar`, `Eliminar`), donde `Eliminar` requiere confirmación previa.
     - `Editar` solo aplica a citas futuras; en citas pasadas la acción permanece deshabilitada con feedback de no editable.
     - `Eliminar` (cancelación lógica) aplica para citas activas pasadas y futuras en contexto admin.
   - El mismo modal diario incluye sección `Espacios bloqueados` con filas por bloqueo manual:
     - hora,
     - motivo (`DESCANSO|PERSONAL|OTRO`),
     - acciones (`Editar motivo`, `Eliminar bloqueo`).
   - El modal diario incluye bloque de acciones operativas:
     - CTA primaria `Agendar nueva cita` que abre el mismo `BottomSheetModal` de agendado del detalle mensual con la fecha del día preseleccionada.
     - CTA primaria `Bloquear espacios` que abre el mismo `BottomSheetModal` de bloqueo del detalle mensual con la fecha del día preseleccionada.
     - el bloque de acciones se oculta cuando el día no tiene espacios elegibles para operar.
   - Horarios de `Agendar nueva cita` y de reagendado: vienen de la agenda del día del servidor (`availableSlots`). Al cambiar de día, la lista se vacía hasta que llega la agenda del nuevo día. Si el horario elegido sigue ofrecido al recargar, se conserva; si no, se usa el valor por defecto. En reagendado, el valor por defecto es la hora actual de la cita si se ofrece, si no la primera (D103, D104). `Guardar` y `Agendar cita` quedan deshabilitados sin horario seleccionado. Mientras la agenda del día nuevo carga en reagendado, el selector de horario queda vacío, `Guardar` deshabilitado, el selector marca `aria-busy` y se muestra el texto `Cargando horarios…` (`Loading times…` en inglés, clave `monthsDetail.dayModal.edit.loadingTimeSlots`) con `role="status"`; el texto no aparece en recargas de la misma fecha, con la lista ya cargada, ni si la carga falla.
   - En reagendado, la agenda del día de la cita se pide con `excludeAppointmentId`: la hora actual de la cita aparece entre los horarios ofrecidos.
   - Restricción operativa para bloqueos manuales en modal diario:
     - editar motivo solo se permite en slots bloqueados futuros (no pasados).
     - eliminar bloqueo se permite en slots bloqueados pasados y futuros.
     - cuando el día está bloqueado completo, se presenta como una sola fila y debe poder desbloquearse en una sola acción.
   - En edición de cita del modal diario:
     - al confirmar `Guardar`, el formulario de edición se cierra inmediatamente,
     - las acciones de esa fila se sustituyen temporalmente por indicador de carga,
     - al terminar la operación, la agenda del día se refresca para reflejar el resultado persistido.
     - tras una reprogramación exitosa (respuesta `200`, con `status` `CONFIRMED` o `SYNC_FAILED`), además del toast de éxito, se muestra un toast con acción (`sileo.action`) con título `¿Avisar a la clienta por WhatsApp?` y botón `Enviar por WhatsApp`:
       - el botón abre WhatsApp en la misma pestaña (`window.location.assign`) con `https://wa.me/52{phone}?text={encodedMessage}`, donde `phone` es el teléfono de la cita (10 dígitos) y el mensaje es `🗓️ *Nos vemos el {date} a las {time}*!` (clave `monthsDetail.bookModal.success.whatsappMessage`, la misma del agendado admin),
       - `{date}` y `{time}` usan la fecha y horario nuevos confirmados por la respuesta del backend, con el mismo formato del agendado admin (fecha capitalizada, p. ej. `Miércoles, 18 de Marzo`; hora en minúsculas, p. ej. `10:00 am`),
       - la acción es solo de feedback de UI: no se abre WhatsApp automáticamente y no persiste ningún dato (ni estado de cita ni log),
       - si la reprogramación falla, no se ofrece ni se abre WhatsApp; solo se muestra el toast de error.
   - Semántica de color del calendario (FR-028, D13, D34): umbrales de `availableSpaces`: `>= 2` azul, `= 1` amarillo. Para `= 0` (día lleno), la regla es: día lleno con al menos una cita activa = verde; día lleno sin citas o cerrado = gris (decisión del owner, D105).
     - gris (`closed`): solo cuando, sin contar citas, no queda ningún horario de la rejilla del día tras quitar los horarios bloqueados y las horas transcurridas. Eso incluye un día sin regla o excepción que lo abra, un día con todos sus horarios bloqueados y un día con todas sus horas ya pasadas. También son grises los días anteriores a hoy (D56).
     - lleno (`full`): un día que no es gris y tiene `availableSpaces = 0`, por ejemplo porque sus horarios están ocupados por citas activas o porque la capacidad diaria o la separación mínima ya no dejan espacio. Un día con algunos horarios bloqueados y el resto ocupado por citas es `full`, no gris. Su color es verde si tiene al menos una cita activa; si no tiene citas, es gris (D105).
     - un sábado abierto por excepción usa el semáforo normal.
   - Editor de reglas y excepciones (botón `Reglas`):
     - visible solo cuando `isPastMonth=false`; en meses pasados no se renderiza, y la API responde `MONTH_IN_PAST` (D36),
     - permite listar, crear, editar y eliminar reglas y excepciones (sección 4.3),
     - al guardar envía la versión de reglas que el admin editó; si ya cambió, no guarda nada (FR-041),
     - si quedan citas activas futuras fuera de la rejilla vigente, muestra antes de guardar el listado de citas afectadas (FR-023, D18, D40); cancelar no guarda nada, y confirmar no cambia las citas,
     - la API conserva `PATCH slot-mode`, que reemplaza las reglas del mes por el preset de D4 (`Horario fijo` o `Bloques de horarios`) y conserva las excepciones (D16, D33, D69). La UI ya no lo usa,
     - los cambios aplican de inmediato a nuevas reservas, locks y reprogramaciones; no hay borrador ni publicación (D32),
     - las citas existentes fuera de la rejilla se conservan sin alteración (D5),
     - valores por defecto: regla nueva = mes completo, lunes a viernes, horario y parámetros de D6; excepción nueva = día 1 del mes, sin horas (día cerrado con aviso), `240` / `true` / `3` (D10, D99),
     - validación por ítem al editar (rango dentro del mes, horas `HH:mm` distintas de `00:00`, días, separación 0 a 1440, máximo 1 a 6, máximo 24 horas por día). Los traslapes de reglas y las fechas de excepción repetidas se validan con el conjunto completo. `Guardar` queda deshabilitado con errores o sin cambios,
     - cambios sin guardar: cancelar o cerrar pide confirmación `¿Descartar cambios?`, superpuesta al panel, con `Seguir editando` como acción por defecto (también con `Escape`). Tocar el fondo no descarta,
     - guardado: antes de escribir se previsualizan las citas activas futuras que quedarían fuera de la rejilla (D18). Si hay citas afectadas, se pide confirmación. Cancelar no escribe nada. Confirmar envía `confirmAffectedAppointments: true`; las citas no cambian de fecha, hora ni estado. Riesgo residual aceptado por el owner: una cita creada entre la previsualización y `Confirmar` puede quedar fuera de horario sin mostrarse y sin cancelarse,
     - conflicto de versión (`AVAILABILITY_VERSION_CONFLICT`): no se guarda nada y la UI indica cerrar y reabrir el editor,
     - notificaciones: la carga usa `sileo.show` de tipo `loading`, que se descarta al terminar; el resultado usa `sileo.success` o `sileo.error`. No se usa `sileo.promise`: su notificación de error no se puede silenciar y el 409 de confirmación no es un error (D102).
   - Cuando `isPastMonth=false`, debajo del calendario se muestra CTA secundaria `Compartir agenda`.
   - `Compartir agenda` permanece deshabilitado cuando `monthStatus=INACTIVE`.
   - `Agendar cita` (mes y día) permanece habilitado aunque `monthStatus=INACTIVE`; `POST /api/admin/months/[month]/appointments` ya no responde `MONTH_NOT_ACTIVE` (solo exige mes registrado). El flujo público sigue requiriendo `ACTIVE`.
   - `Compartir agenda` intenta copiar al portapapeles la URL pública completa del mes seleccionado (`<origen>/citas/[month]`, ej. `https://dominio.com/citas/2026-03`) y muestra notificación de éxito.
   - Compatibilidad cross-device obligatoria para `Compartir agenda`:
     - desktop: usa clipboard como comportamiento principal,
     - mobile o navegadores sin permisos de clipboard: usa fallback de copia legacy y, si aún falla, invoca Web Share API para compartir la misma URL.
   - Debajo de `Compartir agenda` se muestra CTA primaria `Agendar nueva cita`.
   - `Agendar nueva cita` abre `BottomSheetModal` para:
     - seleccionar día,
     - seleccionar horario,
     - seleccionar cliente existente o alta inline de cliente nuevo,
     - para cliente nuevo inline, sugerir `client_number` y permitir edición manual opcional,
     - confirmar `Agendar cita`.
   - Al completar `Agendar cita`, UI muestra vista local de éxito en el mismo modal con acción `Volver` (cerrar modal + refrescar detalle mensual).
   - Debajo de `Agendar nueva cita` se muestra CTA secundaria `Bloquear espacios`.
   - Debajo del título del mes se muestran tags de estado:
     - `Activo` cuando `monthStatus=ACTIVE`,
     - `Inactivo` cuando `monthStatus=INACTIVE`.
     - `Histórico` cuando `isPastMonth=true`.
   - Debajo de `Bloquear espacios` se muestra CTA contextual para cambio de estado:
     - `Desactivar mes` (estilo rojo) cuando `monthStatus=ACTIVE`,
     - `Activar mes` (estilo verde) cuando `monthStatus=INACTIVE`.
   - En meses pasados (`isPastMonth=true`) no se renderizan los 4 CTAs operativos del bloque inferior:
     - `Compartir agenda`,
     - `Agendar nueva cita`,
     - `Bloquear espacios`,
     - `Activar mes|Desactivar mes`.
   - Restricciones de cambio de estado:
     - requiere mes registrado,
     - no permite actualizar meses pasados (`MONTH_IN_PAST`, `422`).
   - Al confirmar estado:
     - frontend ejecuta `PATCH /api/admin/months/[month]/status` con el estado destino,
     - backend actualiza `active_months.status`,
     - frontend refresca detalle mensual.
   - Al abrir `Bloquear espacios`, UI muestra `BottomSheetModal` con:
     - selección horizontal de días bloqueables,
     - visualización por horario (no hay vista `Por bloque`, D14),
     - selección múltiple de horarios bloqueables (cada tarjeta es un horario),
     - acción `Día completo` para bloquear todo el día en una sola operación (solo se habilita si el día tiene al menos un horario bloqueable),
     - acción masiva `Seleccionar todo` para seleccionar todos los slots bloqueables del día activo,
     - acción `Limpiar selección` para resetear selección del día activo,
     - selección única de motivo (`DESCANSO`, `PERSONAL`, `OTRO`),
     - botón `Confirmar bloqueo`.
   - Restricciones del modal de bloqueo:
     - solo días `>= currentDate` dentro del `month`,
     - solo se listan días que tengan al menos un slot bloqueable,
     - slot bloqueable = horario que el resolvedor de la sección 4.3 ofrece ese día en ese momento. Quedan excluidos: horas pasadas (same-day), horas ocupadas por cita activa (incluida `PENDING`, D71), horas con lock temporal activo, horas ya bloqueadas manualmente, y horas que la separación mínima (`minGapMinutes`) o la capacidad diaria (`maxPerDay`, `preserveCapacity`) ya excluyen.
     - un bloqueo en un día sin horarios en las reglas responde `DATE_NOT_OPERATIONAL` (D76; código y HTTP en `docs/architecture/api.md`). Un día con horarios en la regla pero sin horario ofrecible responde `SLOT_NOT_AVAILABLE`.
   - Efecto de un bloqueo manual (FR-013, D2, D43): cada horario bloqueado sale de la rejilla del día antes de calcular separación y capacidad. No hay propagación direccional entre horarios; el efecto depende de la regla vigente.
     - bloquear día completo => sin horarios ofrecibles ese día. Reglas de la acción `Día completo`:
       - se rechaza con `SLOT_LOCKED` si un lock temporal vigente cae en un horario de la rejilla de la regla del día,
       - se rechaza con `DAY_ALREADY_BLOCKED` si el día ya tiene un bloqueo de día completo,
       - se rechaza con `SLOT_NOT_AVAILABLE` si, con las citas activas, los locks y los bloqueos puntuales existentes, no queda ningún horario ofrecible,
       - si se acepta, elimina los bloqueos puntuales que el día ya tenía (y sus eventos espejo en Google Calendar; los fallos de esa eliminación se devuelven como advertencias de sincronización) y crea el marcador único del día.
   - Al confirmar bloqueo:
     - durante la petición no se permite ninguna otra interacción del modal (incluyendo cerrar por `X`, overlay o `Escape`),
     - backend crea registro en `blocked_slots` por cada slot seleccionado,
     - cuando la acción es `Día completo`, backend crea un marcador de bloqueo diario sin generar una fila por cada hora base.
     - backend sincroniza evento espejo en Google Calendar por cada bloqueo creado (slot o día completo),
     - título de evento espejo:
       - bloqueo por slot => `No disponible - [Motivo]`,
       - bloqueo de día completo => `Día libre - [Motivo]`,
     - rango horario del evento espejo (FR-036, D15, D29, D30):
       - bloqueo de horario puntual creado desde el despliegue: evento de `1 hora`,
       - bloqueo de día completo: evento `06:00-23:00` del mismo día (`America/Mexico_City`),
       - los eventos ya creados en Calendar no cambian,
     - si la sincronización externa falla, el bloqueo local se conserva y la UI muestra advertencia operativa.
   - Persistencia: un bloqueo de día completo es un marcador único en `blocked_slots` (D41, D55), no una fila por hora.
6. Admin puede abrir modal `Registrar nuevo mes` desde CTA `Nuevo`:
   - Selector de año (`currentYear..currentYear+5`).
   - Grilla de meses del año seleccionado.
   - Solo permite selección de meses futuros (`month > currentMonth`) que aún no estén creados en `active_months`.
   - Selección múltiple.
7. Admin confirma `Guardar`.
8. Frontend ejecuta `POST /api/admin/months`.
9. Backend persiste nuevos meses con `status=INACTIVE` y sin reglas guardadas (D17, D31), omite existentes y retorna resumen `created/skipped`. El mes usa el default de la sección 4.1 hasta que el admin crea reglas.
10. UI cierra modal y refresca métricas/listado.

Reglas de módulo:

- Solo se pueden registrar meses futuros.
- En el modal, los meses ya creados (`ACTIVE` o `INACTIVE`) no deben mostrarse como opción seleccionable.
- El registro de meses es idempotente parcial:
  - meses existentes se omiten,
  - meses faltantes se crean con `INACTIVE` y sin reglas (D17).
- Agendado y reprogramación admin (D63, D68, D72, D73): el agendado y la reprogramación respetan las citas `PENDING` como ocupación; la reprogramación admin solo aplica a citas `CONFIRMED` o `SYNC_FAILED` (una `PENDING` responde `APPOINTMENT_NOT_FOUND`); una hora que no está en la rejilla del día responde `SLOT_NOT_AVAILABLE` (409); `LOCK_TIMEOUT` responde 409 (D78). Códigos completos en `docs/architecture/api.md`.
- El módulo es mobile-first con contenedor centrado `max-width: 412px`.
- Gaps visuales objetivo entre bloques/listas: `12px–16px`.
- Todos los textos admin del módulo deben resolverse por `react-i18next`.

Flujo UI: Catálogo de clientes admin (`/admin/clients`)

1. Admin navega desde sidebar (`Clients`) al catálogo.
2. Página server valida sesión y resuelve filtros iniciales (`query/status/sort/page/pageSize`).
3. UI renderiza:
   - métricas de clientes (`total`, `con futuras`, `sin futuras`, `clientes fieles`),
   - panel de filtros,
   - listado paginado,
   - número de cliente visible por fila (`client_number`),
   - tag por cliente con cantidad de citas acumuladas,
   - tag de fidelidad para clientes marcados como fieles.
   - las métricas se mantienen como snapshot analítico global durante cambios de filtros.
4. Cambios de filtros/página (reactivo, sin botón `Aplicar filtros`):
   - actualizan query params en URL,
   - refrescan datos vía `GET /api/admin/clients/catalog`.
   - el campo `query` usa debounce corto para reducir requests por tecla.
5. Si falla la carga, UI muestra estado de error con acción `Reintentar`.
6. Si no hay resultados para filtros, UI muestra estado vacío.
7. Seleccionar cliente navega a `/admin/clients/[clientId]`.

Flujo UI: Detalle y edición de cliente (`/admin/clients/[clientId]`)

1. Página server valida sesión y `clientId`; si no existe retorna `notFound`.
2. UI muestra ficha del cliente, resumen de citas (`total`, `pasadas`, `futuras`) y timeline.
   - ficha incluye `client_number`.
   - Las métricas de `total/pasadas/futuras` contabilizan únicamente citas `CONFIRMED`.
   - El timeline no debe listar citas con estado `PENDING` ni `REJECTED`.
3. UI muestra control dedicado para marcar/desmarcar `Cliente fiel` y persiste vía `PATCH /api/admin/clients/[clientId]`.
4. UI muestra identidad con prioridad visual en `alias` (si existe) y mantiene visible `name` canónico como referencia.
5. Acción `Editar cliente` abre modal para actualizar `name`, `phone` y `clientNumber`.
6. Validación local del modal:
   - `name` requerido,
   - largo mínimo `3`.
   - `phone` requerido en formato nacional de 10 dígitos (se normaliza removiendo separadores).
   - `clientNumber` requerido, entero positivo (`> 0`).
7. Guardar edición:
   - ejecuta `PATCH /api/admin/clients/[clientId]`,
   - incluye edición de `name`, `alias`, `phone` y `clientNumber`,
   - usa `sileo.promise` para notificaciones `loading/success/error`,
   - si backend responde `CLIENT_NUMBER_ALREADY_EXISTS`, UI muestra toast + error en campo `clientNumber`,
   - en éxito cierra modal y refresca detalle.
8. Cambios de fidelidad también usan `sileo.promise` para notificaciones `loading/success/error`.
9. Textos UX del módulo se resuelven por `react-i18next` (es/en).

Contrato API:

- Endpoint:
  - `GET /api/admin/months/catalog?year=YYYY&status=ALL|ACTIVE|INACTIVE`
  - `POST /api/admin/months`
  - `GET /api/admin/clients/search?query=<text>&limit=<n>`
  - `GET /api/admin/clients/next-number`
  - `GET /api/admin/clients/catalog?query=<text>&status=ALL|WITH_FUTURE_APPOINTMENTS|WITHOUT_FUTURE_APPOINTMENTS|LOYAL&sort=RECENT|NAME_ASC|NAME_DESC|APPOINTMENTS_DESC&page=<n>&pageSize=<n>`
  - `GET /api/admin/clients/[clientId]`
  - `PATCH /api/admin/clients/[clientId]`
  - `GET /api/admin/appointment-logs?client=<text>&actionType=PENDING|CONFIRMED|CANCELLED|MODIFIED|REJECTED&actionDateFrom=YYYY-MM-DD&actionDateTo=YYYY-MM-DD&page=<n>&pageSize=<n>&format=json|pdf`
  - `POST /api/my-appointments/lookup`
  - `POST /api/my-appointments/cancel`
  - `POST /api/my-appointments/reschedule`
  - `GET /api/admin/months/[month]` (`month` en formato `YYYY-MM`)
  - `POST /api/admin/months/[month]/appointments`
  - `PATCH /api/admin/months/[month]/status`
  - `PATCH /api/admin/months/[month]/slot-mode`
  - `GET /api/admin/months/[month]/availability`, `PUT /api/admin/months/[month]/availability` y `POST /api/admin/months/[month]/availability/preview` (reglas y excepciones; contrato en `docs/architecture/api.md`, sección "Disponibilidad mensual y reservas (spec 003)")
  - `GET /api/admin/months/[month]/days/[date]/agenda` (`date` en formato `YYYY-MM-DD`)
  - `GET /api/admin/months/[month]/blockable-slots?date=YYYY-MM-DD` (`date` opcional)
  - `POST /api/admin/months/[month]/blocked-slots`
  - `PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]`
  - `DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]`
  - `PATCH /api/admin/appointments/[appointmentId]/reschedule`
  - `POST /api/admin/appointments/[appointmentId]/confirm`
  - `POST /api/admin/appointments/[appointmentId]/reject`
  - `POST /api/admin/appointments/[appointmentId]/cancel`
- Auth:
  - requiere sesión admin válida.
  - sin sesión -> `401` con `ADMIN_UNAUTHORIZED`.
- Validación:
  - `year` debe estar dentro de `[currentYear..currentYear+5]`.
  - `status` permitido: `ALL|ACTIVE|INACTIVE`.
  - `GET /api/admin/months/[month]`:
    - `month` debe cumplir formato `YYYY-MM`,
    - el mes debe existir en `active_months`,
    - si no existe, responde `404` con `MONTH_NOT_REGISTERED`.
  - `PATCH /api/admin/months/[month]/slot-mode`:
    - payload `{ slotMode }` (entrada: preset D4; el mes no guarda este valor),
    - `slotMode` permitido: `BLOCK_MODE|SECOND_ONLY_MODE`,
    - reemplaza las reglas del mes por el preset del modo indicado, conserva las excepciones e incrementa la versión de reglas (D16, D33, D69),
    - requiere mes registrado,
    - no permite actualizar meses pasados (`MONTH_IN_PAST`, `422`).
  - `PATCH /api/admin/months/[month]/status`:
    - payload `{ status }`,
    - `status` permitido: `ACTIVE|INACTIVE`,
    - requiere mes registrado,
    - no permite actualizar meses pasados (`MONTH_IN_PAST`, `422`).
  - `GET /api/admin/months/[month]/days/[date]/agenda`:
    - `date` debe cumplir formato `YYYY-MM-DD`,
    - `date` debe pertenecer al `month` solicitado,
    - agenda devuelve solo citas activas (`CONFIRMED`, `SYNC_FAILED`) ordenadas por horario.
  - `GET /api/admin/clients/search`:
    - `query` obligatorio (mínimo 2 caracteres),
    - `limit` opcional, entero en rango permitido.
    - respuesta `clients[]` incluye `clientId`, `clientNumber`, `name`, `phone`, `isLoyal`.
  - `GET /api/admin/clients/next-number`:
    - retorna `{ nextClientNumber }` como siguiente número sugerido disponible.
  - `GET /api/admin/clients/catalog`:
    - `query` opcional (búsqueda por nombre o teléfono parcial),
    - `status` permitido: `ALL|WITH_FUTURE_APPOINTMENTS|WITHOUT_FUTURE_APPOINTMENTS|LOYAL`,
    - `sort` permitido: `RECENT|NAME_ASC|NAME_DESC|APPOINTMENTS_DESC`,
    - `page` entero positivo (base 1),
    - `pageSize` entero positivo en rango permitido.
  - `GET /api/admin/clients/[clientId]`:
    - `clientId` numérico positivo,
    - cliente inexistente responde `CLIENT_NOT_FOUND` (`404`).
  - `PATCH /api/admin/clients/[clientId]`:
    - `clientId` numérico positivo,
    - payload parcial `{ name?, phone?, clientNumber?, isLoyal? }`,
    - el payload no puede venir vacío,
    - `name`, cuando se envía, requiere mínimo de 3 caracteres,
    - `phone`, cuando se envía, se normaliza a 10 dígitos,
    - `clientNumber`, cuando se envía, debe ser entero positivo (`> 0`),
    - `phone` no puede colisionar con otro cliente (`CLIENT_PHONE_ALREADY_EXISTS`, `400`),
    - `clientNumber` no puede colisionar con otro cliente (`CLIENT_NUMBER_ALREADY_EXISTS`, `400`),
    - cliente inexistente responde `CLIENT_NOT_FOUND` (`404`).
  - `GET /api/admin/appointment-logs`:
    - requiere sesión admin autenticada y activa,
    - `client` opcional busca por nombre de cliente o teléfono normalizado/parcial,
    - `actionType` permitido: `PENDING|CONFIRMED|CANCELLED|MODIFIED|REJECTED`,
    - `actionDateFrom` y `actionDateTo`, cuando se envían, deben cumplir formato `YYYY-MM-DD` y se interpretan en zona `America/Mexico_City`,
    - `page` entero positivo (base 1),
    - `pageSize` entero positivo en rango `1..100`, default `20`,
    - `format` permitido: `json|pdf`,
    - formato no soportado responde `UNSUPPORTED_EXPORT_FORMAT`,
    - `format=pdf` exporta hasta `1,000` filas filtradas; si el resultado filtrado supera ese límite responde `EXPORT_LIMIT_EXCEEDED` (`422`).
  - `POST /api/my-appointments/lookup`:
    - payload `{ phone }`,
    - normaliza teléfono a 10 dígitos,
    - ignora `active_months` para la cita origen,
    - devuelve solo citas futuras elegibles para al menos una acción pública.
  - `POST /api/my-appointments/cancel`:
    - payload `{ phone, appointmentIds[] }`,
    - aplica la regla web de cancelación con ventana mínima de 24 horas,
    - no exige mes `ACTIVE` para la cita origen.
  - `POST /api/my-appointments/reschedule`:
    - payload `{ phone, appointmentId, month, date, timeSlot }`,
    - aplica la regla web de modificación con ventana mínima de 3 horas,
    - preserva el mismo `appointments.id`,
    - el slot destino debe cumplir reglas de disponibilidad del booking público,
    - no aplica `isLoyal` ni la sugerencia de 15 días.
  - `POST /api/admin/months/[month]/appointments`:
    - payload con cliente existente: `{ date, timeSlot, clientId }`,
    - payload con cliente nuevo inline: `{ date, timeSlot, client: { name, phone, clientNumber? } }`,
    - para cliente nuevo inline, frontend debe enviar `client.name` en forma canónica (trim),
    - exactamente una modalidad de cliente por request,
    - `month` debe estar registrado; no requiere `ACTIVE` (D17 y sección "Edición admin"),
    - aplica invariantes de disponibilidad (día con horarios según reglas y excepciones, hora ofrecida por el resolvedor, slot futuro, conflictos por lock/ocupación/bloqueo manual, separación y capacidad; D46, D68, D73),
    - permite múltiples citas activas futuras para el mismo cliente/teléfono cuando la creación la realiza admin,
    - `clientId` debe existir en modalidad de cliente existente,
    - en modalidad inline, nombre/teléfono deben cumplir validaciones de identidad del dominio,
    - `clientNumber`, cuando se envía, debe ser entero positivo y único.
  - `GET /api/admin/months/[month]/blockable-slots`:
    - `month` válido y registrado,
    - si `date` se envía, debe cumplir formato `YYYY-MM-DD` y pertenecer al `month`,
    - devuelve días/slots elegibles para bloqueo manual según reglas de disponibilidad admin.
  - `POST /api/admin/months/[month]/blocked-slots`:
    - payload por slots `{ date, slots[], reason }` o payload de día completo `{ date, fullDay: true, reason }`,
    - en payload por slots, `slots` no vacío y sin duplicados,
    - `reason` permitido: `DESCANSO|PERSONAL|OTRO`,
    - `date` no puede ser pasada y debe ser día operativo,
    - si algún slot tiene lock temporal activo -> `SLOT_LOCKED` (`409`),
    - si algún slot ya no está disponible -> `SLOT_NOT_AVAILABLE` (`409`),
    - colisión por duplicado persistido -> `BLOCKED_SLOT_ALREADY_EXISTS` (`409`),
    - bloqueo de día completo ya existente -> `DAY_ALREADY_BLOCKED` (`409`),
    - sincroniza eventos espejo en Google Calendar por cada bloqueo creado.
    - para `fullDay: true`, el evento espejo se registra el mismo día en rango `06:00-23:00` (`America/Mexico_City`).
    - los eventos espejo de bloqueos usan el calendario configurado en `BLOCKED_GOOGLE_CALENDAR_ID`.
    - si falla Calendar, el bloqueo local se mantiene y se devuelve `syncWarnings`.
  - `PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]`:
    - payload `{ reason }`,
    - `blockedSlotId` válido (>0),
    - registro debe existir dentro del `month`,
    - permite actualizar solo slots bloqueados futuros, de lo contrario `BLOCKED_SLOT_NOT_EDITABLE` (`409`).
    - intenta sincronizar cambio de motivo con Google Calendar; ante fallo no bloquea la actualización local y devuelve `syncWarnings`.
  - `DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]`:
    - `blockedSlotId` válido (>0),
    - registro debe existir dentro del `month`,
    - permite eliminar slots bloqueados pasados y futuros.
    - intenta eliminar evento espejo en Google Calendar; ante fallo no bloquea la eliminación local y devuelve `syncWarnings`.
  - `PATCH /api/admin/appointments/[appointmentId]/reschedule`:
    - payload `{ month, date, timeSlot }`,
    - `appointmentId` válido (>0),
    - cita activa debe existir dentro del `month`,
    - la cita origen debe ser futura; si ya pasó responde `APPOINTMENT_NOT_EDITABLE` (`409`),
    - destino debe cumplir reglas de disponibilidad (hora ofrecida por el resolvedor, no pasado, sin conflicto/lock); si no, `SLOT_NOT_AVAILABLE` (`409`, D73),
    - solo se reprograman citas `CONFIRMED` o `SYNC_FAILED` (D72); una cita `PENDING` responde `APPOINTMENT_NOT_FOUND`.
  - `POST /api/admin/appointments/[appointmentId]/confirm`:
    - `appointmentId` válido (>0),
    - solo permite transicionar una cita `PENDING`,
    - intenta sincronizar evento espejo en Google Calendar después de la transición local,
    - ante fallo de sincronización no revierte la transición local y responde estado `SYNC_FAILED` con motivo.
  - `POST /api/admin/appointments/[appointmentId]/reject`:
    - `appointmentId` válido (>0),
    - solo permite transicionar una cita `PENDING` a `REJECTED`.
  - `POST /api/admin/appointments/[appointmentId]/cancel`:
    - payload `{ month }`,
    - cancelación admin aplica override (sin restricción web de 24h ni restricción de cita pasada/futura),
    - transición lógica de estado a `CANCELLED` (sin borrado físico).
  - `POST /api/admin/months`:
    - payload `{ year: number, months: string[] }`,
    - `months` no vacío,
    - formato de mes obligatorio `YYYY-MM`,
    - todos los meses pertenecen al año enviado,
    - todos los meses deben ser futuros (`month > currentMonth`).
- Success `200`:
  - `filters`: `{ year, status, availableYears[] }`
  - `metrics`: `{ activeMonths, inactiveMonths, futureMonths, pastMonths, pastAppointments, futureAppointments }`
  - `months`: `[{ month, status }]` ordenado ascendente por `month`
  - `total`
  - `currentMonth`, `currentDate` (referencia de evaluación de reglas temporales)
- Success `POST /api/admin/months` (`200`):
  - `{ createdMonths, skippedMonths, totalCreated, totalSkipped }`
- Success `GET /api/admin/clients/search` (`200`):
  - `{ query, total, clients[] }`
  - `clients[]`: `{ clientId, clientNumber, name, phone, isLoyal }`
- Success `GET /api/admin/clients/catalog` (`200`):
  - `{ filters, metrics, pagination, clients[], currentDate }`
  - `filters`: `{ query, status, sort, page, pageSize }`
  - `metrics`: `{ totalClients, withFutureAppointments, withoutFutureAppointments, loyalClients, loyalClientsPercentage }`
  - `pagination`: `{ page, pageSize, total, totalPages }`
  - `clients[]`: `{ clientId, name, phone, isLoyal, createdAt, updatedAt, totalAppointments, hasFutureActiveAppointments, lastAppointmentDate, nextAppointmentDate, nextAppointmentTimeSlot }`
  - `totalAppointments` en catálogo cuenta únicamente citas `CONFIRMED`.
- Success `GET /api/admin/clients/[clientId]` (`200`):
  - `{ client, summary, appointments[], currentDate }`
  - `client`: `{ clientId, clientNumber, name, phone, isLoyal, createdAt, updatedAt }`
  - `summary`: `{ totalAppointments, activeAppointments, cancelledAppointments, futureActiveAppointments, lastAppointmentDate, nextAppointmentDate, nextAppointmentTimeSlot }`
  - `appointments[]`: `{ appointmentId, date, timeSlot, status }`
- Success `PATCH /api/admin/clients/[clientId]` (`200`):
  - `{ clientId, clientNumber, name, phone, isLoyal, updatedAt }`
- Success `GET /api/admin/appointment-logs` JSON (`200`):
  - `{ items, pagination, filters }`
  - `items[]`: `{ id, appointmentNumber, client, actionType, actionLabel, appointmentDateTime, previousAppointmentDateTime?, actor, actionDateTime }`
  - `client`: `{ name, alias, phone, clientNumber }`
  - `actor`: `{ type, label }`
  - `pagination`: `{ page, pageSize, totalItems, totalPages }`
  - `filters`: `{ client, actionType, month, actionDateFrom, actionDateTo }`
  - cuando `actionType=MODIFIED`, el resultado debe incluir evidencia legible del horario anterior y del horario nuevo.
- Success `GET /api/admin/appointment-logs?format=pdf` (`200`):
  - `Content-Type: application/pdf`
  - PDF con columnas visibles, filtros aplicados y fecha/hora de generación.
  - Si el resultado filtrado excede `1,000` filas, responde error `EXPORT_LIMIT_EXCEEDED` (`422`) en lugar de PDF parcial.
- Success `POST /api/my-appointments/lookup` (`200`):
  - `{ appointments[] }`
  - `appointments[]`: `{ appointmentId, name, phone, date, timeSlot, status, canCancel, canModify, isBlocked, blockedReason? }`
- Success `POST /api/my-appointments/cancel` (`200`):
  - `{ cancelledAppointments[] }`
  - `cancelledAppointments[]`: `{ appointmentId, status, syncReason? }`
- Success `POST /api/my-appointments/reschedule` (`200`):
  - `{ appointmentId, status, date, timeSlot, syncReason? }`
- Success `GET /api/admin/months/[month]` (`200`):
  - `month`, `monthStatus`, `currentMonth`, `currentDate`, `isPastMonth`
  - campos aditivos de la spec 003: `rules`, `exceptions`, `availabilityVersion` y `usesDefaultRule` (D16, D6). `slotMode` no se devuelve (retirado sin alias, D49).
  - `metrics`: `{ confirmedAppointments, cancelledAppointments, availableSpaces, blockedSpaces, occupiedSpaces }`
  - `projectedSaturationPercent`
  - `saturationComparison`: `{ previousMonth, previousProjectedSaturationPercent, deltaPercentPoints }`
  - `calendarDays`: `[{ date, day, isWeekend, availableSpaces, tone }]`
- Success `POST /api/admin/months/[month]/appointments` (`201`):
  - `{ appointmentId, date, timeSlot, status, client, syncReason? }`
  - `client`: `{ clientId, name, phone }`
- Success `PATCH /api/admin/months/[month]/slot-mode` (`200`):
  - `{ month, availabilityVersion }`
- Success `PATCH /api/admin/months/[month]/status` (`200`):
  - `{ month, status }`
- Success `GET /api/admin/months/[month]/days/[date]/agenda` (`200`):
  - `{ month, date, total, appointments[], blockedSlots[] }`
  - `appointments[]`: `{ appointmentId, date, timeSlot, status, name, phone }`
  - `blockedSlots[]`: `{ blockedSlotId, date, timeSlot, reason }`
  - bloqueo diario completo se representa como un único item en `blockedSlots[]` con marcador interno de día completo.
- Success `GET /api/admin/months/[month]/blockable-slots` (`200`):
  - `{ month, currentDate, days[] }`
  - `days[]`: `{ date, slots[] }`
- Success `POST /api/admin/months/[month]/blocked-slots` (`200`):
  - `{ month, date, fullDay, reason, totalCreated, blockedSlots[], syncSummary, syncWarnings[] }`
  - `blockedSlots[]`: `{ date, timeSlot, reason }`
  - `syncSummary`: `{ total, synced, failed }`
  - `syncWarnings[]`: `{ blockedSlotId|null, reason }`
- Success `PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]` (`200`):
  - `{ month, blockedSlotId, date, timeSlot, reason, syncSummary, syncWarnings[] }`
- Success `DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]` (`200`):
  - `{ month, blockedSlotId, status: "DELETED", syncSummary, syncWarnings[] }`
- Success `PATCH /api/admin/appointments/[appointmentId]/reschedule` (`200`):
  - `{ appointmentId, date, timeSlot, status, syncReason? }`
- Success `POST /api/admin/appointments/[appointmentId]/confirm` (`200`):
  - `{ appointmentId, status: "CONFIRMED" | "SYNC_FAILED", syncReason? }`
- Success `POST /api/admin/appointments/[appointmentId]/reject` (`200`):
  - `{ appointmentId, status: "REJECTED" }`
- Success `POST /api/admin/appointments/[appointmentId]/cancel` (`200`):
  - `{ appointmentId, status: "CANCELLED", syncReason? }`
