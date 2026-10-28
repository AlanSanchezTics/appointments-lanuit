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
   - panel de filtros (`Año`, `Estado`, switch `Mostrar meses anteriores`),
   - botón `Nuevo` habilitado,
   - listado compacto de meses con contador.
4. Filtro `Año`:
   - opciones limitadas a año actual + 5 siguientes.
5. Filtro `Estado`:
   - opciones `Todos`, `Activo`, `Inactivo`.
6. Al cambiar `Año` o `Estado`:
   - frontend llama `GET /api/admin/months/catalog?year=YYYY&status=...`,
   - se refrescan métricas y lista.
   - conserva el parámetro `past` de la URL.
7. Switch `Mostrar meses anteriores` (apagado por defecto):
   - apagado: la lista muestra solo el mes actual y los futuros (`month >= currentMonth`),
   - encendido: la lista muestra también los meses pasados (`month < currentMonth`),
   - es un filtro de cliente: no llama al endpoint y no cambia las métricas (incluida `Pasados`, que sigue sobre todo el año),
   - el contador refleja los meses visibles tras el filtro.
8. Persistencia en URL del switch:
   - encendido: `?past=1`; apagado: sin `past`,
   - cualquier otro valor de `past` equivale a apagado,
   - el cambio usa `router.replace` (no crea entrada en el historial) y conserva `year` y `status`,
   - al cargar `/admin/months?past=1` el servidor inicializa el switch encendido, sin parpadeo.
9. Estado vacío:
   - si no hay meses visibles y el switch está apagado pero existen meses pasados para el filtro actual, el mensaje sugiere activar `Mostrar meses anteriores`,
   - en otro caso muestra el mensaje vacío general de filtros.
10. Al tocar una fila:
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
- `past` distinto de `1` (incluido `past` repetido) -> meses pasados ocultos; no es error de validación ni altera `year`/`status`.

## Notas de MVP

- El filtro `past` no cambia `GET /api/admin/months/catalog`, Prisma ni el service; se resuelve en UI (hook `useMonthsCatalog`).

- La creación solo registra meses y deja estado inicial `INACTIVE` con `slot_mode=SECOND_ONLY_MODE`.
- Edición de estado/activación queda fuera de este flujo.
- El detalle mensual consume `GET /api/admin/months/[month]`; si el mes no existe en catálogo responde `MONTH_NOT_REGISTERED` (404).
