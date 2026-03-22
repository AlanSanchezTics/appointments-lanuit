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

- Un número telefónico solo puede tener una cita activa futura.
- Debe cancelar antes de crear otra.
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

0. Usuario ingresa al inicio (`/`) y el sistema redirige automáticamente al mes actual (`/citas/YYYY-MM`).
   - No existe pantalla de bienvenida en `/`.
   - La selección de idioma (`es`/`en`) permanece disponible desde el selector global de UI.
   - Resolución de idioma: preferencia persistida (`cookie/localStorage`) -> idioma del dispositivo -> fallback `es`.
   - La preferencia manual del usuario tiene prioridad sobre el idioma del dispositivo.

1. Usuario accede a un mes habilitado (`/citas/YYYY-MM`) y visualiza pantalla de entrada del flujo.
2. Desde esa pantalla selecciona `Agendar cita` y avanza a `/citas/YYYY-MM/booking`.
3. En el paso 1 del wizard selecciona día y horario, e ingresa teléfono.
4. Al avanzar, backend valida teléfono y realiza `check + lock` temporal (`TTL = 10 minutos`):
   - Si el cliente existe por teléfono, se avanza directo a confirmación.
   - Si el cliente no existe, UI solicita nombre y luego avanza a confirmación usando el lock ya creado.
5. Si el lock no puede crearse (slot ocupado/lockeado), usuario debe elegir otro horario.
6. Usuario confirma cita (paso 2 del wizard).
7. Backend:
   - Inicia transacción.
   - Limpia locks expirados.
   - Valida lock temporal vigente (`lock_token`) para fecha/slot/teléfono.
   - Valida disponibilidad.
   - Resuelve cliente por teléfono (reutiliza si existe, crea si no existe).
   - Inserta cita CONFIRMED ligada a `client_id`.
   - Elimina lock temporal consumido.
   - Commit.
8. Crea evento en Google Calendar.
9. UI muestra pantalla local de éxito (paso 3 del wizard).
10. Usuario ejecuta acción explícita `Enviar confirmación por WhatsApp` para abrir `wa.me` con mensaje codificado.
    - El frontend compone el texto final localizado.
    - El backend no debe devolver texto final de UX; solo códigos estables y payload estructurado.
11. El endpoint legacy `POST /api/reservar` queda deprecado y debe responder `410`.

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
2. Sistema busca cita cancelable con estas condiciones simultáneas:
   - Estatus `CONFIRMED`.
   - Fecha futura (`date > hoy` en zona `America/Mexico_City`).
   - Dentro de un mes `ACTIVE` en `active_months`.
   - La cita debe estar al menos a 24 horas de distancia; si faltan menos de 24 horas, no se permite cancelación por este medio.
3. Si existe coincidencia, se muestran detalles de la cita y acciones:
   - `Cancelar cita`.
   - `Regresar al inicio`.
4. Usuario confirma cancelación.
5. Backend:
   - Cambia estado a `CANCELLED`.
   - Elimina evento en Google Calendar (si existe `google_event_id`).
6. UI muestra el mensaje final:
   - `Tu cita ha sido cancelada con exito`.
7. El horario vuelve a estar disponible automáticamente.

Notas de contrato:

- Los errores backend deben devolverse como códigos estables (`errorCode`).
- El frontend traduce `errorCode` al idioma activo.
- El backend no retorna mensajes localizados de UX final.

No se pueden cancelar citas pasadas.

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
- created_at DATETIME
- updated_at DATETIME

Índices:

- UNIQUE(month)
- INDEX(status, month)

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
5. Solo una cita activa por teléfono.
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
3. El selector de idioma está disponible en pantalla inicial y de forma global.
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
- El sistema visual del admin usa exclusivamente `docs/ui/admin/*` y `components/admin/ui`.
- No debe reutilizar ni alterar el sistema visual del flujo público.

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
