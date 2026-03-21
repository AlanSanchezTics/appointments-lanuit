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
2. Captura `username` y contraseña (campos con iconografía consistente del design system admin: usuario/candado).
3. Frontend ejecuta `signIn("credentials")` de NextAuth.
4. Backend valida credenciales contra `admin_users` usando `password_hash` + `password_salt` + `ADMIN_AUTH_PEPPER`.
5. Si son válidas y el usuario está `active`, NextAuth crea sesión y redirige al dashboard.
6. Usuario autenticado accede a `/admin/`.
7. Si no existe sesión válida y se intenta abrir `/admin/*`, middleware redirige a `/admin/login`.
8. Acción `Cerrar sesión` ejecuta `signOut` de NextAuth y limpia sesión.

## Validation Points
- Username obligatorio.
- Contraseña mínima de 8 caracteres.
- Usuario admin debe existir y estar activo.
- Sesión JWT de NextAuth debe ser válida y no estar expirada.

## Error Scenarios
- `FORM_INCOMPLETE`: formulario incompleto.
- `INVALID_CREDENTIALS`: credenciales inválidas.
- `ADMIN_USER_INACTIVE`: usuario inactivo.

## State Changes
- Login exitoso: crea sesión NextAuth y actualiza `last_login_at`.
- Logout: invalida sesión removiendo cookie de NextAuth.

## Security Contract
- Cookie `httpOnly`, `sameSite=lax`, `secure` en producción.
- Token de sesión firmado con `NEXTAUTH_SECRET`.
- Hashing de contraseña con `SHA-256` sobre (`salt + password + pepper`), con `salt` por usuario de al menos 16 bytes.
- No se exponen `password_hash` ni `password_salt` al cliente.
