# Admin Auth Flow

## Purpose
Describir el flujo inicial del panel administrativo para autenticación, protección de rutas y navegación base del dashboard.

## Routes
- `/admin/login`
- `/admin/`
- `POST /api/auth/callback/credentials` (NextAuth)
- `POST /api/auth/signout` (NextAuth)
- `GET /api/auth/session` (NextAuth)

## Preconditions
- Debe existir al menos un registro activo en `admin_users`.
- El backend debe tener configurado `NEXTAUTH_SECRET`.
- `ADMIN_AUTH_PEPPER` recomendado para producción (puede ser vacío en local).
- El usuario debe capturar `username` y contraseña válidos.

## High-Level Flow
1. Usuario abre `/admin/login`.
2. Captura `username` y contraseña:
   - `username`: ícono decorativo de usuario.
   - `password`: ícono decorativo de candado a la izquierda + acción mostrar/ocultar con botón de ojo a la derecha.
3. Frontend ejecuta `signIn("credentials")` de NextAuth.
   - Todos los textos del flujo (labels, placeholders, botones, alertas) se resuelven con `react-i18next` (`admin`, `adminErrors`).
4. Backend valida credenciales contra `admin_users` usando `password_hash` + `password_salt` + `ADMIN_AUTH_PEPPER`.
5. Si son válidas y el usuario está `active`, NextAuth crea sesión y redirige al dashboard.
6. Usuario autenticado accede a `/admin/` dentro del shell admin:
   - `appHeader` superior minimalista con título de sección + selector de idioma (`es`/`en`) + botón de buscador global de clientes,
   - `SideBar` principal.
   - en rutas autenticadas del admin no se usa selector flotante tipo FAB.
   - al accionar el botón del buscador, se abre un modal con la búsqueda global de clientes.
   - el buscador global permite buscar clientes por nombre o teléfono en todo el shell, usa debounce de `500ms`, muestra hasta 8 resultados y navega al detalle del cliente al seleccionarlo.
   - el dashboard incluye tarjeta `Ocupación semanal` con:
     - 5 barras (`lunes` a `viernes`) para ocupación diaria de la semana actual,
     - indicador `N% más|menos|similar` contra la semana anterior.
   - el dashboard incluye bloque destacado `Día más ocupado` con:
     - nombre del día con mayor demanda en la semana actual,
     - subtítulo de contexto operativo.
     - no se renderiza cuando la semana actual no tiene citas activas.
   - el dashboard incluye tarjeta `Ocupación del día` con:
     - título contextual (`Ocupación del día` o `Ocupación para el Lunes` en fin de semana),
     - porcentaje de ocupación del día actual,
     - barra de progreso,
     - texto `N citas agendadas para hoy` acompañado de icono informativo.
   - el dashboard incluye tarjeta `Tip del día` con:
     - título del bloque,
     - tip operativo diario obtenido por rotación determinista desde CSV según idioma.
   - el dashboard incluye bloque `Recordatorios` con:
     - dos secciones: `Citas para mañana` y `Citas para la próxima semana`,
     - lista de citas activas (`CONFIRMED`, `SYNC_FAILED`) por sección,
     - cada fila incluye `avatar`, `nombre`, `número de cliente`, `teléfono` y `hora`,
     - acción por fila `Enviar recordatorio` que abre la URL final de `wa.me` de forma síncrona durante el click/tap y registra tracking de envío después de la apertura,
     - control de duplicado por `appointmentId + reminderType` (si ya existe registro, la acción se muestra deshabilitada con tooltip de `ya enviado` y no debe reenviar).
   - el dashboard incluye bloque `Agenda de Hoy` en formato timeline con:
     - título `Agenda de Hoy` o `Agenda para el Lunes` si hoy es sábado/domingo,
     - icono en encabezado con enlace a `/admin/months/[currentMonth]`,
     - lista de citas activas del día de referencia (`hora`, `nombre`, `teléfono`),
     - en sábado/domingo usa como referencia el lunes siguiente,
     - tag de estado por cita (`Listo`, `En curso`, `Pendiente`),
     - animación de parpadeo para la tag `En curso`.
   - el dashboard incluye bloque `Pendientes de confirmación` con acciones:
     - `Confirmar`: transición de `PENDING` con intento de sync a Google Calendar (resultado final `CONFIRMED` o `SYNC_FAILED`),
     - `Rechazar`: transición de `PENDING` a `REJECTED`.
7. Navegación base visible en sidebar:
   - `Dashboard` (`/admin`),
   - `Meses` (`/admin/months` y detalle `/admin/months/[month]` como estado activo por prefijo),
   - `Clientes` visible como `disabled/coming soon` en esta fase.
8. Comportamiento responsive del shell:
   - desktop (`lg+`): sidebar fijo,
   - mobile: sidebar en drawer mediante botón menú del header.
9. Si no existe sesión válida y se intenta abrir `/admin/*`, middleware redirige a `/admin/login`.
10. Acción `Cerrar sesión` en sidebar ejecuta `signOut` de NextAuth y limpia sesión.

## Validation Points
- Username obligatorio.
- Contraseña mínima de 8 caracteres.
- El control mostrar/ocultar contraseña no cambia reglas de validación ni payload enviado a autenticación.
- Usuario admin debe existir y estar activo.
- Sesión JWT de NextAuth debe ser válida y no estar expirada.

## Error Scenarios
- `FORM_INCOMPLETE`: frontend muestra mensaje localizado vía `adminErrors.auth.FORM_INCOMPLETE`.
- `INVALID_CREDENTIALS`: frontend muestra mensaje localizado vía `adminErrors.auth.INVALID_CREDENTIALS`.
- `ADMIN_USER_INACTIVE`: frontend muestra mensaje localizado vía `adminErrors.auth.ADMIN_USER_INACTIVE`.
- `UNKNOWN_ERROR`: fallback de frontend si el código no está reconocido.

## State Changes
- Login exitoso: crea sesión NextAuth y actualiza `last_login_at`.
- Logout: invalida sesión removiendo cookie de NextAuth.

## Security Contract
- Cookie `httpOnly`, `sameSite=lax`, `secure` en producción.
- Token de sesión firmado con `NEXTAUTH_SECRET`.
- Hashing de contraseña con `SHA-256` sobre (`salt + password + pepper`), con `salt` por usuario de al menos 16 bytes.
- No se exponen `password_hash` ni `password_salt` al cliente.
