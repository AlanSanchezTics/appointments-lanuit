# Home pública con meses disponibles + redirect a booking por mes

## Resumen
Implementar el nuevo entrypoint público en `/` para mostrar logo, `home.welcome`, `home.title`, `home.subtitle`, una lista dinámica de botones por mes disponible y botón de cancelación.  
Reglas del feature: solo mostrar meses `ACTIVE` que además tengan espacios disponibles; ocultar meses inactivos o sin cupo.  
Decisiones cerradas: `button:cancel` apunta a `/citas/cancelar` con estrategia **migrar + redirect** desde `/cancelar`; cuando no haya meses disponibles, se conserva el layout de home con aviso de no disponibilidad y se mantiene botón de cancelar.

## Cambios de contrato (UI/API/rutas/tipos)
- UI pública:
  - `/` deja de redirigir automáticamente y se vuelve pantalla de selección de mes.
  - Se renderiza `N` botones `button:month` con destino `/citas/[month]/booking`.
  - Estado sin meses: aviso de no disponibilidad + botón cancelar visible.
- Routing:
  - `/citas/[month]` deja de renderizar pantalla propia y hace `redirect("/citas/[month]/booking")`.
  - Se crea `/citas/cancelar` como ruta canónica.
  - `/cancelar` queda en compatibilidad con redirect a `/citas/cancelar`.
- API:
  - Sin cambios de endpoints/payloads.
- Tipos/servicios:
  - Añadir función de dominio para “meses reservables para home” (`ACTIVE` + disponibilidad real de slots).
  - Mantener server-side data fetching en RSC (`app/page.tsx`) y patrones async de Next (`params`/`cookies` await).

## Fase 1: Requerimientos
1. Confirmar alcance funcional final contra docs actuales:
   - `docs/specification.md` (secciones de `/`, flujo reserva, flujo cancelación).
   - `docs/architecture/business-rules.md` (root-entry behavior).
   - `docs/features/booking-flow.md` y `docs/features/cancel-flow.md`.
2. Cerrar criterios de aceptación:
   - `/` muestra meses válidos únicamente (`ACTIVE` + con espacios).
   - click mes => `/citas/[month]/booking`.
   - click cancelar => `/citas/cancelar`.
   - `/citas/[month]` redirige a `/citas/[month]/booking`.
3. Definir matriz de casos:
   - meses activos con cupo,
   - activos sin cupo,
   - inactivos,
   - sin meses renderizables.

## Fase 2: Diseño
1. Diseño de datos para home (server-side):
   - Obtener `listBookableMonths()` y filtrar por disponibilidad real (`getMonthAvailability(month).length > 0`).
   - Ejecutar evaluación por mes en paralelo (`Promise.all`) para evitar waterfalls.
2. Diseño de UI en `/`:
   - Reusar estructura visual actual del home y textos i18n.
   - `home.title` pasa de copy por mes único a copy para “meses disponibles” (ajuste de llaves i18n).
   - Botones `Link` estilizados con `buttonVariants` (evitar anidado `button > a`).
3. Diseño de routing:
   - `app/citas/[month]/page.tsx`: solo redirect server-side.
   - `app/citas/cancelar/page.tsx`: renderiza `CancelForm`.
   - `app/cancelar/page.tsx`: redirect a ruta canónica para compatibilidad.
4. Diseño de documentación (primero/temprano):
   - Actualizar contratos de flujo y rutas antes o en paralelo al cambio de código para evitar desfase.

## Fase 3: Lista de tareas
1. Añadir pruebas unitarias de servicio para filtro de meses con disponibilidad.
2. Añadir/ajustar pruebas de página home (`/`) para:
   - render de botones de mes,
   - ocultar meses sin cupo,
   - estado sin meses + aviso + cancelar.
3. Refactor de `app/page.tsx` a nueva home pública (sin redirect automático).
4. Cambiar `app/citas/[month]/page.tsx` a redirect directo a `/booking`.
5. Crear `app/citas/cancelar/page.tsx` y compatibilidad de `/cancelar`.
6. Actualizar traducciones `locales/es/common.json` y `locales/en/common.json` para nuevos textos de home.
7. Ajustar pruebas e2e (`tests/e2e/booking.spec.ts`, `tests/e2e/cancellation.spec.ts`) para nuevo entrypoint y nueva ruta de cancelación.
8. Actualizar documentación funcional/arquitectónica afectada.
9. Ejecutar suite objetivo (unit + app + e2e smoke) y documentar resultados.

## Fase 4: Desarrollo
1. Implementar helper de dominio (ej. en `lib/active-months/service.ts` o servicio público dedicado) para devolver meses “mostrables en home”.
2. Implementar nueva composición de `app/page.tsx` como RSC:
   - carga i18n server-side,
   - render de lista de meses como CTAs,
   - fallback sin meses con aviso y CTA cancelar.
3. Implementar redirect de `app/citas/[month]/page.tsx`.
4. Implementar `app/citas/cancelar/page.tsx` y redirect legacy en `app/cancelar/page.tsx`.
5. Ajustar copy i18n de `home.title` (mensaje de invitación a reservar en meses disponibles), manteniendo `home.subtitle` actual.
6. Revisar impacto en links internos del flujo (`volver`, CTA cancelar, not-found/back home si aplica).

## Fase 5: Pruebas
1. Unit tests:
   - servicio de meses para home filtra por estado + slots.
2. App/component tests:
   - `/` renderiza estructura esperada y enlaces correctos.
   - `/citas/[month]` hace redirect correcto.
   - `/cancelar` redirige a `/citas/cancelar`.
3. E2E:
   - Home muestra `button:month` y `button:cancel`.
   - Click en mes entra a `/citas/[month]/booking`.
   - Cancelación inicia desde `/citas/cancelar`.
4. Regresión:
   - `POST /api/reservar` sigue `410`.
   - Flujo booking/cancel actual permanece funcional.
5. Validaciones de calidad:
   - `npm run test` (o subset por archivos tocados),
   - `npm run lint`.

## Fase 6: Despliegue
1. Rollout por PR único con checklist de compatibilidad de rutas:
   - ruta canónica nueva + redirect legacy activo.
2. Verificación post-deploy:
   - navegación `/`, `/citas/[month]`, `/citas/[month]/booking`, `/citas/cancelar`, `/cancelar`.
3. Monitoreo inicial:
   - errores 404/422 en rutas públicas y métricas de acceso a rutas legacy.
4. Plan de rollback:
   - revertir commit de routing/home y restaurar comportamiento previo de `/`.

## Documentation Impact
- `docs/specification.md`: **Sí requiere cambios**.
  - Secciones afectadas: Regla de meses activos (comportamiento de `/`), Flujo de reserva (paso inicial), contrato UI/UX de entrada, flujo de cancelación (ruta canónica).
  - Momento: **antes o durante implementación** (no al final) para evitar desalineación.
- `docs/architecture/business-rules.md`: **Sí requiere cambios**.
  - Ajustar edge case de root-entry y ruta de cancelación pública.
- `docs/features/booking-flow.md`: **Sí requiere cambios**.
  - Entrada desde `/` con listado de meses y sin redirect automático.
- `docs/features/cancel-flow.md`: **Sí requiere cambios**.
  - Ruta canónica `/citas/cancelar` + compatibilidad legacy.
- Ambigüedad resuelta en esta planificación:
  - sin meses disponibles: mantener layout home con aviso + botón cancelar.

## Flow Contract Check
- UI steps updated: Yes  
- API contract updated: No  
- Validation rules updated: Yes  
- Acceptance criteria updated: Yes  
- docs/specification.md aligned: Yes (planificado como parte obligatoria)

## Migration Compatibility Check
- Schema changes required: No  
- Data backfill required: No  
- Legacy compatibility required: Yes (`/cancelar` -> `/citas/cancelar`)  
- Rollback strategy defined: Yes  
- Cleanup phase defined: Yes (retiro futuro de ruta legacy cuando se confirme adopción)  
- Integrity protections defined: Yes (sin cambios de datos; solo compatibilidad de navegación)

## Supuestos y defaults
- “Mes disponible” = mes `ACTIVE` con al menos un slot retornado por `getMonthAvailability`.
- Se mantiene el texto actual de `home.subtitle`.
- El formato visual de botón de mes mostrará label de mes localizado (ej. `Abril 2026` / `April 2026`).
- No se introducen cambios de base de datos ni nuevos endpoints.
