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
  - WhatsApp (notificación manual vía redirección).
- Enfoque Mobile-first.

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
- La entrada raíz (`/`) debe resolver el **primer mes activo disponible** (orden ascendente por `YYYY-MM`) para redirigir a `/citas/YYYY-MM`.
- Si no existe ningún mes activo elegible (`>= currentMonth`), `/` no redirige y muestra una vista de indisponibilidad con CTA de contacto por WhatsApp.

---

## 4. Reglas de Disponibilidad

### 4.1 Días válidos

- Solo lunes a viernes.
- Se permiten citas el mismo día **solo** si el horario seleccionado aún no ha pasado en la zona `America/Mexico_City`.
- Horarios del mismo día ya transcurridos no deben mostrarse como disponibles.
- Si todos los horarios de un día están ocupados, el día no debe mostrarse disponible.
- Los horarios con lock temporal vigente tampoco deben mostrarse como disponibles.

### 4.2 Horarios Base

- 09:00
- 10:00
- 13:00
- 14:00
- 17:00
- 18:00

### 4.3 Regla Direccional por Pares + Máximo Diario

- Duración del evento en Google Calendar: 3 horas.
- Pares oficiales de horarios:
  - (09:00, 10:00)
  - (13:00, 14:00)
  - (17:00, 18:00)
- Límite diario: máximo 3 citas activas por día.
- Restricción estructural: máximo 1 cita activa por par.

Regla direccional formal:

- Si existe una cita en la primera hora de un par $i$, se bloquea la segunda hora de todos los pares anteriores ($j < i$).
- Si existe una cita en la segunda hora de un par $i$, se bloquea la primera hora de todos los pares posteriores ($j > i$).
- Un slot candidato es válido solo si cumple simultáneamente todas las restricciones inducidas por todas las citas activas del día (composición global).

---

## 5. Restricciones por Teléfono

- Flujo público (`/citas/*`): un número telefónico puede tener más de una cita activa futura en el mismo mes, siempre que exista una separación mínima de 15 días naturales entre cada cita activa del mes.
- Flujo público (`/citas/*`): puede tener citas activas futuras en meses distintos.
- Flujo admin (`/admin/months/[month]`): puede crear múltiples citas activas futuras para el mismo cliente/teléfono.
- En flujo público, si la nueva cita viola la separación mínima de 15 días naturales con alguna cita activa del mes, no puede crearse como cita adicional y debe resolverse mediante reagendado.
- Formato persistido obligatorio: 10 dígitos numéricos.
- En UI se permite captura con separadores (espacios/guiones/paréntesis), pero backend normaliza a 10 dígitos antes de validar y persistir.
- Nombre mínimo: 3 caracteres.
- El cliente se identifica por teléfono.
- Un teléfono no puede estar asociado a más de un nombre.

---

## 6. Estados de Cita

- CONFIRMED
- CANCELLED
- SYNC_FAILED

No existe estado PENDING persistente.

---

## 7. Flujo de Reserva

0. Usuario ingresa al inicio (`/`) y el sistema intenta redirigir automáticamente al primer mes activo elegible (`/citas/YYYY-MM`).
   - Si el mes actual está inactivo pero existe un mes futuro activo, debe redirigir al mes futuro activo más cercano.
   - Si no existe ningún mes activo elegible, `/` muestra una vista de indisponibilidad con mensaje y CTA para contactar por WhatsApp.
   - No existe pantalla de bienvenida en `/`.
   - La selección de idioma (`es`/`en`) permanece disponible en todo el producto:
     - flujo público: selector tipo FAB global,
     - panel admin autenticado (`/admin/*` excepto `/admin/login`): selector integrado al `appHeader`.
   - Resolución de idioma: preferencia persistida (`cookie/localStorage`) -> idioma del dispositivo -> fallback `es`.
   - La preferencia manual del usuario tiene prioridad sobre el idioma del dispositivo.

1. Usuario accede a un mes habilitado (`/citas/YYYY-MM`) y visualiza pantalla de entrada del flujo.
2. Desde esa pantalla selecciona `Agendar cita` y avanza a `/citas/YYYY-MM/booking`.
3. En el paso 1 del wizard selecciona día y horario, e ingresa teléfono.
4. Al avanzar, backend valida teléfono y realiza `check + lock` temporal (`TTL = 10 minutos`):
   - Si el cliente existe por teléfono y no tiene citas futuras activas en el mismo mes, se avanza directo a confirmación.
   - Si el cliente tiene citas futuras activas en el mismo mes, UI entra a la vista de `Detalles de tu nueva cita` + `Ya tienes citas activas` para decidir cómo continuar.
   - Si la nueva fecha mantiene al menos 15 días naturales de separación con todas las citas activas del mes, esa vista incluye separador `O` + acción `Agendar como nueva cita` para continuar sin reagendar.
   - Si la nueva fecha rompe la separación mínima de 15 días naturales con alguna cita activa del mes, esa vista exige seleccionar una cita activa para reagendar al nuevo `date + timeSlot`.
   - Si hay una sola cita activa elegible en ese estado, puede preseleccionarse para reagendar.
   - Mientras UI está en selección de cita a reagendar, se muestra un bloque resumen con `name`, `phone`, `date` y `timeSlot` actualmente seleccionados, antes de la lista de citas activas del mes.
   - En este estado se ocultan los controles del paso 1 para cambiar `date`, `timeSlot` y `phone`.
   - Si el cliente no existe, UI solicita nombre y luego avanza a confirmación usando el lock ya creado.
5. Si el lock no puede crearse (slot ocupado/lockeado), usuario debe elegir otro horario.
6. Usuario confirma cita (paso 2 del wizard).
7. Backend:
   - Inicia transacción.
   - Limpia locks expirados.
   - Valida lock temporal vigente (`lock_token`) para fecha/slot/teléfono.
   - Valida disponibilidad.
   - Resuelve cliente por teléfono (reutiliza si existe, crea si no existe).
   - Si se envía `appointmentIdToReschedule`, reprograma esa cita del cliente al nuevo `date + timeSlot`.
   - Si no se envía `appointmentIdToReschedule`, inserta cita `CONFIRMED` ligada a `client_id`.
   - Elimina lock temporal consumido.
   - Commit.
8. Crea evento en Google Calendar.
9. UI muestra pantalla local de éxito (paso 3 del wizard).
10. Usuario ejecuta acción explícita `Enviar confirmación por WhatsApp` para abrir `wa.me` con mensaje codificado.
    - El frontend compone el texto final localizado.
    - El backend no debe devolver texto final de UX; solo códigos estables y payload estructurado.
11. El endpoint legacy `POST /api/reservar` queda deprecado y debe responder `410`.

Contratos de payload relevantes en flujo vigente:
- `POST /api/reservar/client-check-lock`:
  - respuesta puede incluir `futureAppointmentsInMonth[]` con `{ appointmentId, date, timeSlot }` cuando el teléfono tiene citas activas futuras en ese mes.
  - respuesta puede incluir `canBookAsNewAppointment` (`boolean`) para indicar si, además de reagendar, está permitido `Agendar como nueva cita` bajo la regla de 15 días naturales.
- `POST /api/reservar/confirm`:
  - admite `appointmentIdToReschedule` opcional para reprogramar una cita futura activa del mismo teléfono y mes al `date + timeSlot` seleccionado.

Si el usuario abandona en confirmación o expira el TTL, el lock deja de bloquear automáticamente.

### 7.1 Contrato de UI/UX del Wizard

- Enfoque mobile-first obligatorio (desktop muestra un contenedor tipo móvil).
- El flujo visual de reserva queda compuesto por 4 vistas:
  - Entrada del mes (`/citas/YYYY-MM`): branding + CTA principal `Agendar cita` + CTA secundaria `Cancelar cita`.
  - Paso 1 (`/citas/YYYY-MM/booking`): selección de día/hora y captura de teléfono (nombre inline solo para cliente nuevo tras `check + lock`).
  - Paso 2 (`/citas/YYYY-MM/booking`): confirmación de datos con contador de lock temporal.
  - Paso 3 (`/citas/YYYY-MM/booking`): éxito local con CTA explícito para abrir WhatsApp.
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

Mensaje base:

    Hola Pau ✨
    soy {Nombre} ✌️.
    Ya te agendé para el día {Fecha} a las {Hora}.
    Muchas gracias y bonito día 😊

    (Para cancelar tu cita accede a https://dominio.com/cancelar)

El mensaje debe codificarse usando encodeURIComponent.
La plantilla se mantiene con `es` como fallback y la propiedad del texto final es del frontend.

---

## 8. Flujo de Cancelación

1. Usuario ingresa teléfono.
2. Sistema busca citas cancelables con estas condiciones simultáneas:
   - Estatus `CONFIRMED`.
   - Fecha futura (`date > hoy` en zona `America/Mexico_City`).
   - Dentro de un mes `ACTIVE` en `active_months`.
   - La cita debe estar al menos a 24 horas de distancia; si faltan menos de 24 horas, no se permite cancelación por este medio.
3. Si existen coincidencias, se muestra la lista de citas futuras cancelables vinculadas al teléfono para que el cliente elija una o varias.
   - `Cancelar cita` (sobre la selección).
   - `Regresar al inicio`.
4. Usuario confirma cancelación de la selección.
5. Backend:
   - Cambia estado a `CANCELLED` para cada cita seleccionada.
   - Elimina evento en Google Calendar por cada cita seleccionada que tenga `google_event_id`.
6. UI muestra el mensaje final:
   - `Tu cita ha sido cancelada con exito`.
7. Todos los horarios cancelados vuelven a estar disponibles automáticamente.

Notas de contrato:

- Los errores backend deben devolverse como códigos estables (`errorCode`).
- El frontend traduce `errorCode` al idioma activo.
- El backend no retorna mensajes localizados de UX final.

No se pueden cancelar citas pasadas en el flujo público (`/cancelar`).

---

## 9. Control de Concurrencia

Modelo: First-commit-wins.

Requisitos obligatorios:

- Transacciones MySQL.
- SELECT ... FOR UPDATE.
- Índice compuesto no único para rendimiento de consultas por slot:

  INDEX(date, time_slot)

Locking temporal adicional:

- Tabla `reservation_locks` para bloquear slot durante el paso de confirmación.
- `TTL` fijo de 10 minutos por lock.
- Sin cron obligatorio: cleanup lazy en endpoints de lock/confirm y filtro por `expires_at > now` en disponibilidad.
- Opcionalmente puede ejecutarse un cron externo frecuente para borrar locks expirados (`expires_at <= now`) por lotes.

Orden de confirmación:

1. START TRANSACTION
2. Limpiar locks expirados (`expires_at <= now`)
3. Validar lock temporal vigente (`lock_token`) con bloqueo
4. Validar disponibilidad con bloqueo
5. INSERT (siempre crea una nueva fila)
6. Eliminar lock consumido
7. COMMIT
8. Crear evento Google

Google Calendar no es fuente de verdad.

Histórico de cancelaciones:

- Re-reservar un slot previamente cancelado crea una nueva fila.
- Las filas CANCELLED se conservan como historial.
- La disponibilidad y conflictos se calculan solo sobre estados activos (CONFIRMED, SYNC_FAILED).

---

## 10. Modelo de Datos

Tabla: clients

- id (PK)
- name VARCHAR(100)
- phone VARCHAR(10) UNIQUE
- created_at DATETIME
- updated_at DATETIME

Tabla: appointments

- id (PK)
- client_id (FK -> clients.id)
- date DATE
- time_slot TIME
- status ENUM('CONFIRMED','CANCELLED','SYNC_FAILED')
- google_event_id VARCHAR(255)
- created_at DATETIME
- updated_at DATETIME

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
- slot_mode ENUM('BLOCK_MODE','SECOND_ONLY_MODE') DEFAULT 'BLOCK_MODE'
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

---

## 11. Casos Edge

1. Acceso a mes no activo o mes pasado → Rechazar.
2. Doble confirmación simultánea → Solo una gana.
3. Fallo Google → Estado SYNC_FAILED.
4. Reserva mismo día → Permitida solo para horarios futuros en `America/Mexico_City`.
5. Usuario con cita activa intenta reservar → Bloquear.
6. Día con 3 citas activas válidas (una por par) → Día no visible.
7. Manipulación frontend → Backend recalcula.
8. Cancelación simultánea y nueva reserva → Resolver vía transacciones.
9. Cambio horario verano → Usar siempre America/Mexico_City.
10. Intento de cancelar una cita con menos de 24 horas de anticipación → Rechazar en flujo web de cancelación.
11. Lock temporal expirado durante confirmación → Rechazar (`LOCK_EXPIRED_OR_INVALID`) y pedir reselección.
12. Dos usuarios intentando lockear el mismo slot → Solo un lock vigente gana.
13. Cambio de mes (00:00 America/Mexico_City) con `active_months` desactualizada → el job de reconciliación debe reactivar ventana vigente y desactivar meses pasados.
14. Intento de acceso a `/admin/*` sin sesión válida → redirección obligatoria a `/admin/login`.

---

## 12. Invariantes del Sistema

1. MySQL es fuente de verdad.
2. Google Calendar es sistema espejo.
3. No existen traslapes.
4. Regla direccional por pares y máximo 3 citas activas por día.
5. En flujo público: máximo una cita activa futura por teléfono en el mismo mes (se permiten citas futuras en meses distintos). En admin: se permiten múltiples citas futuras por cliente.
6. Solo lunes a viernes.
7. Mismo día permitido únicamente para horarios futuros (según hora actual en `America/Mexico_City`).
8. Solo meses `ACTIVE` y nunca meses pasados.
9. Confirmación atómica.
10. Cancelación libera horario.
11. Lock temporal expira automáticamente por `expires_at` y no bloquea fuera de su ventana.
12. Las rutas protegidas de admin requieren sesión NextAuth firmada y vigente.

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
  - `Clientes` visible como deshabilitado (sin navegación funcional en esta fase).
- Acción global `Cerrar sesión`:
  - visible al final del sidebar,
  - ejecuta `signOut` de NextAuth y redirige a `/admin/login`.
- El `appHeader` debe mostrar título de sección resuelto por ruta vía i18n (`react-i18next`), sin breadcrumbs en esta fase.
- El `appHeader` debe incluir el control de cambio de idioma (`es`/`en`) para rutas admin autenticadas.

### 15.1.2 Dashboard (`/admin`) – bloque de ocupación semanal

- La parte superior del dashboard debe incluir una tarjeta `Ocupación semanal`.
- La parte superior del dashboard debe incluir un bloque destacado `Día más ocupado`.
- La parte superior del dashboard debe incluir una tarjeta `Ocupación del día`.
- La parte superior del dashboard debe incluir un bloque `Agenda de Hoy` en formato línea de tiempo.
- La parte superior del dashboard debe incluir una tarjeta `Tip del día`.
- La tarjeta muestra:
  - título `Ocupación semanal`,
  - indicador comparativo unificado `N% más|menos|similar Vs semana pasada`,
  - gráfico de barras con 5 columnas (`lunes` a `viernes`) para la semana de negocio actual,
  - tooltip por barra con la cantidad de citas activas del día.
  - en dispositivos táctiles, el tooltip se abre al tocar la barra y se cierra al perder foco de esa barra.
- Fuente de ocupación:
  - citas activas (`CONFIRMED`, `SYNC_FAILED`) del rango lunes-viernes de la semana actual en zona `America/Mexico_City`.
- Cálculo de barras por día:
  - `% ocupación día = citas activas del día / 3 * 100` (redondeado entero).
- Cálculo comparativo semanal:
  - `% semana actual = citas activas lunes-viernes / 15 * 100`,
  - `% semana anterior = citas activas lunes-viernes / 15 * 100`,
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
  - muestra el nombre del día (lunes-viernes) con mayor número de citas activas de la semana actual,
  - muestra subtítulo `Máxima demanda de citas`,
  - usa iconografía de estrella en contenedor circular.
  - en empate de ocupación, debe elegirse el primer día en orden semanal (`lunes` a `viernes`).
  - si la semana actual no tiene citas activas, el bloque no debe renderizarse.
- Tarjeta `Ocupación del día`:
  - muestra título:
    - `Ocupación del día` en lunes-viernes,
    - `Ocupación para el Lunes` en sábado/domingo (cuando el dato visible corresponde al lunes),
  - muestra porcentaje de ocupación de hoy,
  - muestra barra de progreso horizontal asociada al porcentaje,
  - debajo de la barra muestra texto `N citas agendadas para hoy` acompañado por icono `InfoCircle`.
  - cálculo:
    - `% ocupación hoy = citas activas de hoy / 3 * 100` (redondeado entero, máximo visual 100%),
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
4. Sistema actualiza listado de meses filtrado por `Año + Estado`.
5. Admin puede navegar a `/admin/months/[month]` para consultar detalle operativo del mes seleccionado.
   - Vista de detalle:
     - grid de métricas 2x2 (`Confirmadas`, `Canceladas`, `Disponibles`, `Bloqueados`),
     - tarjeta de `Ocupación proyectada para este mes` (porcentaje + barra),
     - comparativa textual vs mes anterior en la misma tarjeta en formato `N% más/menos comparado con (mes) (año)`,
     - la comparativa muestra iconografía de tendencia:
       - `ArrowCircleUp` verde para `más`,
       - `ArrowCircleDown` rojo para `menos`,
       - `MinusCircle` neutro cuando no hay cambio + texto `Misma ocupación comparada con el mes anterior`,
     - calendario operativo mensual.
   - Fórmula de `Disponibles` (métrica mensual):
     - `(días hábiles del mes * 3) - (citas activas + espacios bloqueados)`.
     - `espacios bloqueados` se calcula desde `blocked_slots` (bloqueo manual admin).
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
   - Restricción operativa para bloqueos manuales en modal diario:
     - editar motivo solo se permite en slots bloqueados futuros (no pasados).
     - eliminar bloqueo se permite en slots bloqueados pasados y futuros.
   - En edición de cita del modal diario:
     - al confirmar `Guardar`, el formulario de edición se cierra inmediatamente,
     - las acciones de esa fila se sustituyen temporalmente por indicador de carga,
     - al terminar la operación, la agenda del día se refresca para reflejar el resultado persistido.
   - Semántica de color del calendario:
     - verde (`availableSpaces >= 2`),
     - amarillo (`availableSpaces = 1`),
     - rojo (`availableSpaces = 0`),
     - gris en fines de semana (no operativos).
   - A la derecha del encabezado del mes existe botón de acción `Modalidad` que abre `BottomSheetModal` únicamente cuando `isPastMonth=false`.
   - En meses pasados (`isPastMonth=true`) el botón `Modalidad` no se renderiza.
   - En el modal de modalidad:
     - `Bloques de horarios` (`BLOCK_MODE`): base de slots `09:00,10:00,13:00,14:00,17:00,18:00`.
     - `Horario fijo` (`SECOND_ONLY_MODE`): base de slots `10:00,14:00,18:00`.
     - muestra texto de ayuda contextual según la modalidad seleccionada para anticipar cómo se verán los horarios en el flujo público.
     - el cambio aplica a nuevas reservas, locks y reprogramaciones del mes.
     - citas existentes en `09:00/13:00/17:00` se conservan sin alteración.
   - Cuando `isPastMonth=false`, debajo del calendario se muestra CTA secundaria `Compartir agenda`.
   - `Compartir agenda` permanece deshabilitado cuando `monthStatus=INACTIVE`.
   - `Compartir agenda` intenta copiar al portapapeles la URL pública completa del mes seleccionado (`<origen>/citas/[month]`, ej. `https://dominio.com/citas/2026-03`) y muestra notificación de éxito.
   - Compatibilidad cross-device obligatoria para `Compartir agenda`:
     - desktop: usa clipboard como comportamiento principal,
     - mobile o navegadores sin permisos de clipboard: usa fallback de copia legacy y, si aún falla, invoca Web Share API para compartir la misma URL.
   - Debajo de `Compartir agenda` se muestra CTA primaria `Agendar nueva cita`.
   - `Agendar nueva cita` abre `BottomSheetModal` para:
     - seleccionar día,
     - seleccionar horario,
     - seleccionar cliente existente o alta inline de cliente nuevo,
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
     - selector de visualización de espacios: `Por hora` y `Por bloque` solo en `Modalidad 1`,
     - en `Modalidad 2` se fuerza visualización `Por hora`,
     - selección múltiple de slots bloqueables (en `Por bloque`, cada tarjeta representa y selecciona el par direccional completo),
     - acción masiva `Seleccionar todo` para seleccionar todos los slots bloqueables del día activo,
     - acción `Limpiar selección` para resetear selección del día activo,
     - selección única de motivo (`DESCANSO`, `PERSONAL`, `OTRO`),
     - botón `Confirmar bloqueo`.
   - Restricciones del modal de bloqueo:
     - solo días `>= currentDate` dentro del `month`,
     - solo se listan días que tengan al menos un slot bloqueable,
     - slot bloqueable = no pasado (same-day), no ocupado por cita activa, sin lock temporal activo y no bloqueado manualmente.
   - Regla direccional para bloqueos manuales:
     - si se bloquea **una sola hora** dentro de un par direccional, se aplica propagación direccional en slots homólogos de pares posteriores/anteriores;
     - si se bloquea el **par completo** (ej. `09:00` y `10:00`), no se propaga restricción direccional adicional y solo ese par queda fuera;
     - si se bloquean los 6 slots del día, el día queda sin disponibilidad para reserva.
   - Ejemplos normativos:
     - bloquear `09:00` => disponibles `10:00`, `14:00`, `18:00`;
     - bloquear `09:00` + `10:00` => disponibles `13:00`, `14:00`, `17:00`, `18:00`;
     - bloquear día completo => sin slots disponibles.
   - Al confirmar bloqueo:
     - durante la petición no se permite ninguna otra interacción del modal (incluyendo cerrar por `X`, overlay o `Escape`),
     - backend crea registro en `blocked_slots` por cada slot seleccionado.
   - Persistencia de vista por bloque:
     - la selección en vista `Por bloque` solo afecta UX; en backend se registran los mismos slots unitarios de siempre.
6. Admin puede abrir modal `Registrar nuevo mes` desde CTA `Nuevo`:
   - Selector de año (`currentYear..currentYear+5`).
   - Grilla de meses del año seleccionado.
   - Solo permite selección de meses futuros (`month > currentMonth`) que aún no estén creados en `active_months`.
   - Selección múltiple.
7. Admin confirma `Guardar`.
8. Frontend ejecuta `POST /api/admin/months`.
9. Backend persiste nuevos meses con `status=INACTIVE`, omite existentes y retorna resumen `created/skipped`.
10. UI cierra modal y refresca métricas/listado.

Reglas de módulo:

- Solo se pueden registrar meses futuros.
- En el modal, los meses ya creados (`ACTIVE` o `INACTIVE`) no deben mostrarse como opción seleccionable.
- El registro de meses es idempotente parcial:
  - meses existentes se omiten,
  - meses faltantes se crean con `INACTIVE`.
- El módulo es mobile-first con contenedor centrado `max-width: 412px`.
- Gaps visuales objetivo entre bloques/listas: `12px–16px`.
- Todos los textos admin del módulo deben resolverse por `react-i18next`.

Flujo UI: Catálogo de clientes admin (`/admin/clients`)

1. Admin navega desde sidebar (`Clients`) al catálogo.
2. Página server valida sesión y resuelve filtros iniciales (`query/status/sort/page/pageSize`).
3. UI renderiza:
   - métricas de clientes (`total`, `con futuras`, `sin futuras`),
   - panel de filtros,
   - listado paginado.
4. Cambios de filtros/página:
   - actualizan query params en URL,
   - refrescan datos vía `GET /api/admin/clients/catalog`.
5. Si falla la carga, UI muestra estado de error con acción `Reintentar`.
6. Si no hay resultados para filtros, UI muestra estado vacío.
7. Seleccionar cliente navega a `/admin/clients/[clientId]`.

Flujo UI: Detalle y edición de cliente (`/admin/clients/[clientId]`)

1. Página server valida sesión y `clientId`; si no existe retorna `notFound`.
2. UI muestra ficha del cliente, resumen de citas y timeline.
3. Acción `Editar cliente` abre modal para actualizar `name`.
4. Validación local del modal:
   - `name` requerido,
   - largo mínimo `3`.
5. Guardar edición:
   - ejecuta `PATCH /api/admin/clients/[clientId]`,
   - usa `sileo.promise` para notificaciones `loading/success/error`,
   - en éxito cierra modal y refresca detalle.
6. Textos UX del módulo se resuelven por `react-i18next` (es/en).

Contrato API:

- Endpoint:
  - `GET /api/admin/months/catalog?year=YYYY&status=ALL|ACTIVE|INACTIVE`
  - `POST /api/admin/months`
  - `GET /api/admin/clients/search?query=<text>&limit=<n>`
  - `GET /api/admin/clients/catalog?query=<text>&status=ALL|WITH_FUTURE_APPOINTMENTS|WITHOUT_FUTURE_APPOINTMENTS&sort=RECENT|NAME_ASC|NAME_DESC&page=<n>&pageSize=<n>`
  - `GET /api/admin/clients/[clientId]`
  - `PATCH /api/admin/clients/[clientId]`
  - `GET /api/admin/months/[month]` (`month` en formato `YYYY-MM`)
  - `POST /api/admin/months/[month]/appointments`
  - `PATCH /api/admin/months/[month]/status`
  - `PATCH /api/admin/months/[month]/slot-mode`
  - `GET /api/admin/months/[month]/days/[date]/agenda` (`date` en formato `YYYY-MM-DD`)
  - `GET /api/admin/months/[month]/blockable-slots?date=YYYY-MM-DD` (`date` opcional)
  - `POST /api/admin/months/[month]/blocked-slots`
  - `PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]`
  - `DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]`
  - `PATCH /api/admin/appointments/[appointmentId]/reschedule`
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
    - payload `{ slotMode }`,
    - `slotMode` permitido: `BLOCK_MODE|SECOND_ONLY_MODE`,
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
  - `GET /api/admin/clients/catalog`:
    - `query` opcional (búsqueda por nombre o teléfono parcial),
    - `status` permitido: `ALL|WITH_FUTURE_APPOINTMENTS|WITHOUT_FUTURE_APPOINTMENTS`,
    - `sort` permitido: `RECENT|NAME_ASC|NAME_DESC`,
    - `page` entero positivo (base 1),
    - `pageSize` entero positivo en rango permitido.
  - `GET /api/admin/clients/[clientId]`:
    - `clientId` numérico positivo,
    - cliente inexistente responde `CLIENT_NOT_FOUND` (`404`).
  - `PATCH /api/admin/clients/[clientId]`:
    - `clientId` numérico positivo,
    - payload `{ name }`,
    - `name` requerido y con mínimo de 3 caracteres,
    - cliente inexistente responde `CLIENT_NOT_FOUND` (`404`).
  - `POST /api/admin/months/[month]/appointments`:
    - payload con cliente existente: `{ date, timeSlot, clientId }`,
    - payload con cliente nuevo inline: `{ date, timeSlot, client: { name, phone } }`,
    - exactamente una modalidad de cliente por request,
    - `month` debe existir y estar `ACTIVE`,
    - aplica invariantes de disponibilidad (weekday, slot válido por modalidad, slot futuro, conflictos por lock/ocupación/bloqueo manual y reglas direccionales),
    - permite múltiples citas activas futuras para el mismo cliente/teléfono cuando la creación la realiza admin,
    - `clientId` debe existir en modalidad de cliente existente,
    - en modalidad inline, nombre/teléfono deben cumplir validaciones de identidad del dominio.
  - `GET /api/admin/months/[month]/blockable-slots`:
    - `month` válido y registrado,
    - si `date` se envía, debe cumplir formato `YYYY-MM-DD` y pertenecer al `month`,
    - devuelve días/slots elegibles para bloqueo manual según reglas de disponibilidad admin.
  - `POST /api/admin/months/[month]/blocked-slots`:
    - payload `{ date, slots[], reason }`,
    - `slots` no vacío y sin duplicados,
    - `reason` permitido: `DESCANSO|PERSONAL|OTRO`,
    - `date` no puede ser pasada y debe ser día operativo,
    - si algún slot tiene lock temporal activo -> `SLOT_LOCKED` (`409`),
    - si algún slot ya no está disponible -> `SLOT_NOT_AVAILABLE` (`409`),
    - colisión por duplicado persistido -> `BLOCKED_SLOT_ALREADY_EXISTS` (`409`),
    - no dispara integraciones externas (Google Calendar) en este flujo.
  - `PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]`:
    - payload `{ reason }`,
    - `blockedSlotId` válido (>0),
    - registro debe existir dentro del `month`,
    - permite actualizar solo slots bloqueados futuros, de lo contrario `BLOCKED_SLOT_NOT_EDITABLE` (`409`).
  - `DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]`:
    - `blockedSlotId` válido (>0),
    - registro debe existir dentro del `month`,
    - permite eliminar slots bloqueados pasados y futuros.
  - `PATCH /api/admin/appointments/[appointmentId]/reschedule`:
    - payload `{ month, date, timeSlot }`,
    - `appointmentId` válido (>0),
    - cita activa debe existir dentro del `month`,
    - la cita origen debe ser futura; si ya pasó responde `APPOINTMENT_NOT_EDITABLE` (`409`),
    - destino debe cumplir reglas de disponibilidad (weekday, slot válido, no pasado, sin conflicto/lock).
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
  - `clients[]`: `{ clientId, name, phone }`
- Success `GET /api/admin/clients/catalog` (`200`):
  - `{ filters, metrics, pagination, clients[], currentDate }`
  - `filters`: `{ query, status, sort, page, pageSize }`
  - `metrics`: `{ totalClients, withFutureAppointments, withoutFutureAppointments }`
  - `pagination`: `{ page, pageSize, total, totalPages }`
  - `clients[]`: `{ clientId, name, phone, createdAt, updatedAt, totalAppointments, hasFutureActiveAppointments, lastAppointmentDate, nextAppointmentDate, nextAppointmentTimeSlot }`
- Success `GET /api/admin/clients/[clientId]` (`200`):
  - `{ client, summary, appointments[], currentDate }`
  - `client`: `{ clientId, name, phone, createdAt, updatedAt }`
  - `summary`: `{ totalAppointments, activeAppointments, cancelledAppointments, futureActiveAppointments, lastAppointmentDate, nextAppointmentDate, nextAppointmentTimeSlot }`
  - `appointments[]`: `{ appointmentId, date, timeSlot, status }`
- Success `PATCH /api/admin/clients/[clientId]` (`200`):
  - `{ clientId, name, phone, updatedAt }`
- Success `GET /api/admin/months/[month]` (`200`):
  - `month`, `monthStatus`, `slotMode`, `currentMonth`, `currentDate`, `isPastMonth`
  - `metrics`: `{ confirmedAppointments, cancelledAppointments, availableSpaces, blockedSpaces, occupiedSpaces }`
  - `projectedSaturationPercent`
  - `saturationComparison`: `{ previousMonth, previousProjectedSaturationPercent, deltaPercentPoints }`
  - `calendarDays`: `[{ date, day, isWeekend, availableSpaces, tone }]`
- Success `POST /api/admin/months/[month]/appointments` (`201`):
  - `{ appointmentId, date, timeSlot, status, client, syncReason? }`
  - `client`: `{ clientId, name, phone }`
- Success `PATCH /api/admin/months/[month]/slot-mode` (`200`):
  - `{ month, slotMode }`
- Success `PATCH /api/admin/months/[month]/status` (`200`):
  - `{ month, status }`
- Success `GET /api/admin/months/[month]/days/[date]/agenda` (`200`):
  - `{ month, date, total, appointments[], blockedSlots[] }`
  - `appointments[]`: `{ appointmentId, date, timeSlot, status, name, phone }`
  - `blockedSlots[]`: `{ blockedSlotId, date, timeSlot, reason }`
- Success `GET /api/admin/months/[month]/blockable-slots` (`200`):
  - `{ month, currentDate, days[] }`
  - `days[]`: `{ date, slots[] }`
- Success `POST /api/admin/months/[month]/blocked-slots` (`200`):
  - `{ month, date, reason, totalCreated, blockedSlots[] }`
  - `blockedSlots[]`: `{ date, timeSlot, reason }`
- Success `PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]` (`200`):
  - `{ month, blockedSlotId, date, timeSlot, reason }`
- Success `DELETE /api/admin/months/[month]/blocked-slots/[blockedSlotId]` (`200`):
  - `{ month, blockedSlotId, status: "DELETED" }`
- Success `PATCH /api/admin/appointments/[appointmentId]/reschedule` (`200`):
  - `{ appointmentId, date, timeSlot, status, syncReason? }`
- Success `POST /api/admin/appointments/[appointmentId]/cancel` (`200`):
  - `{ appointmentId, status: "CANCELLED", syncReason? }`
