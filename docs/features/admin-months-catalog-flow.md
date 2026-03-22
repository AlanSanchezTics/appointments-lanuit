# Admin Months Catalog Flow

## Objetivo

Describir el flujo operativo del módulo `/admin/months` para el MVP de catálogo de meses en modo lectura.

## Prerrequisitos

- Usuario autenticado en panel admin.
- Sesión válida de NextAuth.
- Datos disponibles en `active_months` y `appointments`.

## Flujo principal

1. Admin abre `/admin/months`.
2. Sistema valida sesión:
   - si no hay sesión, redirige a `/admin/login`.
3. UI renderiza:
   - barra superior de módulo,
   - grid de métricas (3x2),
   - panel de filtros (`Año`, `Estado`),
   - botón `Nuevo` deshabilitado,
   - listado compacto de meses con contador.
4. Filtro `Año`:
   - opciones limitadas a año actual + 5 siguientes.
5. Filtro `Estado`:
   - opciones `Todos`, `Activo`, `Inactivo`.
6. Al cambiar filtros:
   - frontend llama `GET /api/admin/months/catalog?year=YYYY&status=...`,
   - se refrescan métricas y lista.
7. Al tocar una fila:
   - navega a `/admin/months/[month]` (placeholder de detalle en MVP).

## Flujo alterno: error de carga

1. Si el endpoint falla, la vista muestra estado de error.
2. Admin puede ejecutar `Reintentar`.

## Contratos de validación

- `year` fuera de rango -> error de validación (`MONTHS_YEAR_OUT_OF_RANGE`).
- `status` inválido -> error de validación (`MONTHS_STATUS_INVALID`).
- sesión faltante en API -> `ADMIN_UNAUTHORIZED` con HTTP 401.

## Notas de MVP

- No existen mutaciones (`create/update/toggle`) en esta fase.
- `Nuevo` es visualmente visible y funcionalmente bloqueado.
