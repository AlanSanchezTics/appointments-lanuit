# Admin Clients Catalog Flow

## Objetivo

Describir el flujo operativo del módulo de catálogo de clientes admin para consulta, detalle 360, segmentación por fidelidad y actualización de identidad canónica del cliente.

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
   - métricas (`total`, `con futuras`, `sin futuras`, `clientes fieles`, `% fidelidad`),
   - panel de filtros (`query`, `status`, `sort`),
   - listado paginado,
   - tag por cliente con total de citas históricas.
   - indicador de `Cliente fiel` en filas marcadas.
   - las métricas se mantienen estables como analítica global durante el uso de filtros.
4. Al cambiar cualquier filtro (`query`, `status`, `sort`) o al paginar:
   - se actualizan query params de la URL,
   - se refresca el catálogo vía `GET /api/admin/clients/catalog`.
   - no existe botón de confirmación (`Aplicar filtros`); el comportamiento es reactivo.
   - `query` aplica debounce corto para evitar una petición por cada tecla.
5. Si no hay resultados, se muestra estado vacío.
6. Si falla la carga, se muestra bloque de error con acción `Reintentar`.
7. Al tocar un cliente, navega a `/admin/clients/[clientId]`.

## Flujo principal UI: detalle (`/admin/clients/[clientId]`)

1. Página server valida sesión y `clientId`; si no existe cliente, responde `notFound`.
2. Vista detalle muestra:
   - identidad (nombre + teléfono),
   - estado de fidelidad (`Cliente fiel`: activo/inactivo),
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

## Flujo principal UI: marcación de cliente fiel

1. Admin ingresa al detalle de cliente (`/admin/clients/[clientId]`).
2. Admin usa el control `Cliente fiel` para marcar o desmarcar.
3. UI dispara `PATCH /api/admin/clients/[clientId]` con payload parcial `{ isLoyal }`.
4. UI muestra notificación con `sileo.promise` (`loading/success/error`).
5. En éxito:
   - se refresca el detalle,
   - el estado de fidelidad queda persistido y visible en detalle y catálogo.

## Flujo principal: catálogo

1. Admin solicita `GET /api/admin/clients/catalog`.
2. Backend valida sesión:
   - si no hay sesión, responde `401 ADMIN_UNAUTHORIZED`.
3. Backend valida query params:
   - `query` opcional,
   - `status`: `ALL|WITH_FUTURE_APPOINTMENTS|WITHOUT_FUTURE_APPOINTMENTS|LOYAL`,
   - `sort`: `RECENT|NAME_ASC|NAME_DESC|APPOINTMENTS_DESC`,
   - `page` y `pageSize` positivos en rango permitido.
4. Backend calcula y responde:
   - `filters`,
   - `metrics` (`totalClients`, `withFutureAppointments`, `withoutFutureAppointments`, `loyalClients`, `loyalClientsPercentage`),
   - `pagination`,
   - `clients[]` con resumen operativo por cliente,
   - `currentDate` (zona `America/Mexico_City`).
5. Si `status = LOYAL`, la lista retorna solo clientes con `isLoyal = true`.

## Flujo principal: detalle de cliente

1. Admin solicita `GET /api/admin/clients/[clientId]`.
2. Backend valida sesión y `clientId` numérico positivo.
3. Backend consulta cliente y citas asociadas.
4. Backend responde:
   - bloque `client` (incluye `isLoyal`),
   - bloque `summary`,
   - `appointments[]` cronológico,
   - `currentDate`.

## Flujo principal: actualización de cliente

1. Admin solicita `PATCH /api/admin/clients/[clientId]` con payload parcial `{ name?, isLoyal? }`.
2. Backend valida sesión y `clientId`.
3. Backend valida payload:
   - no puede estar vacío,
   - `name` (si viene) debe cumplir mínimo de longitud.
4. Backend actualiza los campos enviados (`name` y/o `isLoyal`).
5. Backend responde payload actualizado `{ clientId, name, phone, isLoyal, updatedAt }`.

## Reglas de negocio aplicables

- Cliente se identifica por `phone` (canónico por fila en `clients`).
- Fidelidad es una marca administrativa manual persistida en `clients.is_loyal`.
- Cita futura para filtros de catálogo: `date > currentDate`.
- Estados activos para reglas de citas futuras: `CONFIRMED`, `SYNC_FAILED`.
- `% fidelidad` se calcula como `round(loyalClients / totalClients * 100)`; si `totalClients = 0`, el valor es `0`.
- Validaciones deben retornar `errorCode` estable y no texto UX localizado.

## Flujos alternos y errores

- Sesión faltante: `401 ADMIN_UNAUTHORIZED`.
- `clientId` inválido: `400 CLIENT_ID_INVALID`.
- Cliente no encontrado: `404 CLIENT_NOT_FOUND`.
- Payload inválido (`name` corto o payload vacío): `400 VALIDATION_ERROR`.
- Error de red/UI en catálogo o detalle: bloque de error local con `Reintentar`.
