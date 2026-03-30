# Admin Clients Catalog Flow

## Objetivo

Describir el flujo operativo del módulo de catálogo de clientes admin para consulta, detalle 360 y actualización de identidad canónica de cliente.

## Prerrequisitos

- Usuario autenticado en panel admin.
- Sesión válida de NextAuth.
- Datos disponibles en `clients` y `appointments`.

## Alcance de esta fase

- UI admin:
  - `GET /admin/clients`
  - `GET /admin/clients/[clientId]`
- Endpoints cubiertos:
  - `GET /api/admin/clients/catalog`
  - `GET /api/admin/clients/[clientId]`
  - `PATCH /api/admin/clients/[clientId]`

## Flujo principal UI: catálogo (`/admin/clients`)

1. Admin ingresa a `/admin/clients` desde sidebar (`Clients`).
2. Página server valida sesión y precarga catálogo con filtros iniciales.
3. Vista cliente muestra:
   - métricas (`total`, `con futuras`, `sin futuras`),
   - panel de filtros (`query`, `status`, `sort`),
   - listado paginado.
4. Al aplicar filtros o paginar:
   - se actualizan query params de la URL,
   - se refresca el catálogo vía `GET /api/admin/clients/catalog`.
5. Si no hay resultados, se muestra estado vacío.
6. Si falla la carga, se muestra bloque de error con acción `Reintentar`.
7. Al tocar un cliente, navega a `/admin/clients/[clientId]`.

## Flujo principal UI: detalle (`/admin/clients/[clientId]`)

1. Página server valida sesión y `clientId`; si no existe cliente, responde `notFound`.
2. Vista detalle muestra:
   - identidad (nombre + teléfono),
   - resumen de citas (`total`, `activas`, `canceladas`, `futuras`),
   - timeline de citas.
3. Acción `Volver al catálogo` regresa a `/admin/clients`.
4. Acción `Editar cliente` abre modal de edición.

## Flujo principal UI: edición de nombre

1. Admin abre modal `Editar cliente`.
2. Form valida nombre mínimo (`>= 3` caracteres).
3. Al guardar:
   - dispara `PATCH /api/admin/clients/[clientId]`,
   - muestra notificación con `sileo.promise` (`loading/success/error`),
   - en éxito cierra modal y refresca detalle.
4. Mensajes UX del módulo se resuelven por `react-i18next` (`locales/es|en/admin.json`).

## Flujo principal: catálogo

1. Admin solicita `GET /api/admin/clients/catalog`.
2. Backend valida sesión:
   - si no hay sesión, responde `401 ADMIN_UNAUTHORIZED`.
3. Backend valida query params:
   - `query` opcional,
   - `status`: `ALL|WITH_FUTURE_APPOINTMENTS|WITHOUT_FUTURE_APPOINTMENTS`,
   - `sort`: `RECENT|NAME_ASC|NAME_DESC`,
   - `page` y `pageSize` positivos en rango permitido.
4. Backend calcula y responde:
   - `filters`,
   - `metrics` (`totalClients`, `withFutureAppointments`, `withoutFutureAppointments`),
   - `pagination`,
   - `clients[]` con resumen operativo por cliente,
   - `currentDate` (zona `America/Mexico_City`).

## Flujo principal: detalle de cliente

1. Admin solicita `GET /api/admin/clients/[clientId]`.
2. Backend valida sesión y `clientId` numérico positivo.
3. Backend consulta cliente y citas asociadas.
4. Backend responde:
   - bloque `client`,
   - bloque `summary`,
   - `appointments[]` cronológico,
   - `currentDate`.

## Flujo principal: actualización de cliente

1. Admin solicita `PATCH /api/admin/clients/[clientId]` con payload `{ name }`.
2. Backend valida sesión, `clientId` y `name`.
3. Backend actualiza nombre canónico del cliente.
4. Backend responde payload actualizado `{ clientId, name, phone, updatedAt }`.

## Reglas de negocio aplicables

- Cliente se identifica por `phone` (canónico por fila en `clients`).
- Cita futura para filtros de catálogo: `date > currentDate`.
- Estados activos para reglas de citas futuras: `CONFIRMED`, `SYNC_FAILED`.
- Validaciones deben retornar `errorCode` estable y no texto UX localizado.

## Flujos alternos y errores

- Sesión faltante: `401 ADMIN_UNAUTHORIZED`.
- `clientId` inválido: `400 CLIENT_ID_INVALID`.
- Cliente no encontrado: `404 CLIENT_NOT_FOUND`.
- Payload inválido (`name` corto o ausente): `400 VALIDATION_ERROR`.
- Error de red/UI en catálogo o detalle: bloque de error local con `Reintentar`.
