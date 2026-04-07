# Admin Months Catalog Flow

## Objetivo

Describir el flujo operativo del módulo `/admin/months` para catálogo de meses admin con creación de meses futuros.

## Prerrequisitos

- Usuario autenticado en panel admin.
- Sesión válida de NextAuth.
- Datos disponibles en `active_months` y `appointments`.

## Flujo principal

1. Admin abre `/admin/months`.
2. Sistema valida sesión:
   - si no hay sesión, redirige a `/admin/login`.
3. UI renderiza:
   - grid de métricas (3x2),
   - panel de filtros (`Año`, `Estado`),
   - botón `Nuevo` habilitado,
   - listado compacto de meses con contador.
4. Filtro `Año`:
   - opciones limitadas a año actual + 5 siguientes.
5. Filtro `Estado`:
   - opciones `Todos`, `Activo`, `Inactivo`.
6. Al cambiar filtros:
   - frontend llama `GET /api/admin/months/catalog?year=YYYY&status=...`,
   - se refrescan métricas y lista.
7. Al tocar una fila:
   - navega a `/admin/months/[month]` para consultar el detalle operativo del mes.

## Subflujo: Registrar nuevo mes

1. Admin pulsa `Nuevo`.
2. Se abre modal `Registrar nuevo mes`.
3. Admin selecciona año dentro de `[currentYear..currentYear+5]`.
4. UI muestra grilla de meses disponibles:
   - año actual: solo meses posteriores al mes actual,
   - años futuros: enero-diciembre,
   - excluir meses ya creados (`ACTIVE` o `INACTIVE`).
5. Admin selecciona uno o varios meses.
6. Al seleccionar un mes:
   - el chip cambia a fondo primario y texto blanco.
7. Admin pulsa `Guardar`.
8. Frontend ejecuta `POST /api/admin/months`.
9. Backend crea faltantes como `INACTIVE` con `slot_mode=SECOND_ONLY_MODE`, omite existentes, y devuelve resumen `created/skipped`.
10. UI refresca catálogo y cierra modal.

## Flujo alterno: error de carga

1. Si el endpoint falla, la vista muestra estado de error.
2. Admin puede ejecutar `Reintentar`.

## Contratos de validación

- `year` fuera de rango -> error de validación (`MONTHS_YEAR_OUT_OF_RANGE`).
- `status` inválido -> error de validación (`MONTHS_STATUS_INVALID`).
- sesión faltante en API -> `ADMIN_UNAUTHORIZED` con HTTP 401.
- `months` vacío en creación -> `MONTHS_EMPTY_SELECTION`.
- mes no futuro -> `MONTHS_MONTH_NOT_FUTURE`.
- formato inválido -> `MONTHS_INVALID_FORMAT`.

## Notas de MVP

- La creación solo registra meses y deja estado inicial `INACTIVE` con `slot_mode=SECOND_ONLY_MODE`.
- Edición de estado/activación queda fuera de este flujo.
- El detalle mensual consume `GET /api/admin/months/[month]`; si el mes no existe en catálogo responde `MONTH_NOT_REGISTERED` (404).
