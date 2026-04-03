# Buscador Global de Clientes en `appHeader` (Admin) — Plan de Implementación (Subagent-Driven)

## Resumen
Implementar un buscador global en el `appHeader` para todas las rutas autenticadas `/admin/*` (excepto login), con búsqueda por nombre/teléfono, debounce de `500ms`, resultados clicables y navegación a `/admin/clients/[clientId]`.  
Se reutiliza el endpoint `GET /api/admin/clients/search`, ampliando su contrato para soportar el tag de fidelidad en resultados.  
Modo de ejecución acordado: **Subagent-Driven** con ownership por bloques y write sets disjuntos.

## Cambios clave de contrato (API/UI/Tipos)
- API `GET /api/admin/clients/search`:
  - Mantener filtros actuales (`query`, `limit`, min query 2).
  - Extender `clients[]` con `isLoyal` para renderizar tag de fidelidad en header.
- Tipos frontend/backend:
  - `AdminClientSearchItem` incorpora `isLoyal: boolean`.
- UI global admin:
  - `AppHeader` incluye input de búsqueda + dropdown de resultados (máx. 8).
  - Item de resultado muestra: avatar (iniciales), nombre, `#clientNumber`, teléfono formateado, tag `Fiel/Loyal` cuando aplique.
  - Click en resultado: navega, cierra dropdown y limpia estado de búsqueda.

## Fase 1: Requerimientos
- Validar alineación con fuentes de verdad: `docs/specification.md`, `docs/architecture/business-rules.md`, `docs/features/admin-auth-flow.md`, `docs/features/admin-clients-catalog-flow.md`, `docs/ui/admin/components.md`.
- Confirmar alcance funcional cerrado:
  - visible en todo shell admin autenticado,
  - debounce fijo `500ms`,
  - 8 resultados,
  - limpieza post-navegación.
- Definir criterios de aceptación:
  - loading/empty/error/clear state cubiertos,
  - accesibilidad básica (focus, teclado, `aria-*`),
  - i18n completo (`es/en`).

## Fase 2: Diseño
- Diseño técnico (Next + React best practices):
  - Crear hook dedicado `hooks/admin/layout/useGlobalClientSearch.ts` para estado/efectos/debounce/abort/navigation.
  - Mantener `AppHeader` como componente de presentación (sin lógica compleja interna).
  - Evitar waterfalls y race conditions con `AbortController` + request sequencing.
- Diseño visual (admin design system):
  - Reusar tokens/admin styles existentes.
  - Reusar patrones de lista de clientes del módulo `clients` (avatar/tag/phone formatting).
- Diseño UX:
  - Estado inicial sin resultados.
  - `query.length < 2` no dispara fetch.
  - Mensaje de “buscando…”, “sin resultados”, “error de búsqueda”.
  - Botón/acción para limpiar input.

## Fase 3: Lista de tareas (Subagent-Driven con ownership por bloques)
- **Bloque A (Backend/API, owner único):**
  - `lib/admin/clients/types.ts`
  - `lib/admin/clients/service.ts`
  - `tests/app/api-admin-clients-search-route.test.ts`
  - `tests/lib/admin/clients.validation.test.ts` (si aplica por contrato)
- **Bloque B (Frontend Header + Hook + i18n, owner único):**
  - `hooks/admin/layout/useGlobalClientSearch.ts` (nuevo)
  - `components/admin/layout/AppHeader.tsx`
  - `components/admin/layout/AdminLayout.tsx` (wire-up)
  - `locales/es/admin.json`
  - `locales/en/admin.json`
  - `tests/components/admin/layout/admin-layout-shell.test.tsx`
- **Bloque C (Documentación + pruebas integradas, owner único):**
  - `docs/specification.md`
  - `docs/architecture/business-rules.md`
  - `docs/features/admin-auth-flow.md`
  - `docs/features/admin-clients-catalog-flow.md`
  - `docs/ui/admin/components.md`
  - pruebas E2E/integ adicionales para flujo global search (archivo nuevo o extensión de tests admin layout/e2e)

## Fase 4: Desarrollo
- **Subfase 4.1 Backend y migraciones**
  - Implementar ampliación de payload de búsqueda (`isLoyal`) sin cambios de schema.
  - Verificar compatibilidad hacia atrás para consumidores actuales.
- **Subfase 4.2 UI/UX flow**
  - Implementar hook global de búsqueda con debounce `500ms`, abort y clear.
  - Integrar UI en `AppHeader` y navegación a detalle.
  - Asegurar consistencia mobile/desktop dentro del shell.
- **Subfase 4.3 Pruebas y rollout**
  - Ejecutar suite focal (unit + route + component + e2e smoke).
  - Validar estados de error/no resultados/carga y navegación.
- **Subfase 4.4 Cleanup técnico**
  - Normalizar textos i18n y eliminar duplicación.
  - Revisar límites de responsabilidad (hook vs presentational component).

## Fase 5: Pruebas
- Unit/backend:
  - ranking + shape de `searchAdminClients`.
  - contrato route `/api/admin/clients/search` con sesión y validaciones.
- Component/hook:
  - debounce 500ms (timers fake),
  - cancelación de requests anteriores,
  - render de 8 resultados máximo,
  - clear state y cierre de dropdown.
- Integración UI:
  - click en cliente => `router.push('/admin/clients/:id')`.
- E2E (admin shell):
  - búsqueda real en header + selección + redirección a detalle.
- No funcional:
  - i18n `es/en`,
  - navegación por teclado y foco básico.

## Fase 6: Despliegue
- Rollout gradual en admin (sin feature flag requerido salvo que se pida).
- Verificación post-deploy:
  - logs de errores en `/api/admin/clients/search`,
  - latencia percibida en header search,
  - tasa de navegación exitosa a detalle de cliente.
- Plan de rollback:
  - revertir integración del header manteniendo endpoint previo compatible.

## Documentation Impact
- `docs/specification.md`: **sí requiere cambios**.
  - Secciones: `15.1.1 App Shell de navegación admin`, contrato API `GET /api/admin/clients/search`, estados UI del buscador global.
- `docs/architecture/business-rules.md`: **sí requiere cambios**.
  - Nueva regla de buscador global en header admin (alcance, debounce, navegación, estados UI).
- `docs/features/admin-auth-flow.md`: **sí requiere cambios**.
  - Actualizar composición de `appHeader` para incluir buscador global.
- `docs/features/admin-clients-catalog-flow.md`: **sí requiere cambios**.
  - Añadir interacción transversal “búsqueda global desde header” hacia detalle de cliente.
- `docs/ui/admin/components.md`: **sí requiere cambios**.
  - Extender contrato de `AppHeader` con patrón de global search.
- Momento de actualización:
  - Borrador antes de implementar,
  - cierre definitivo durante/final de implementación (misma PR).

## Flow Contract Check (objetivo del entregable)
- UI steps updated: **Yes**
- API contract updated: **Yes**
- Validation rules updated: **Yes** (mantener min query + límites)
- Acceptance criteria updated: **Yes**
- docs/specification.md aligned: **Yes**

## Migration Compatibility Check
- Schema changes required: **No**
- Data backfill required: **No**
- Legacy compatibility required: **Yes** (consumidores previos del search endpoint)
- Rollback strategy defined: **Yes**
- Cleanup phase defined: **Yes**
- Integrity protections defined: **Yes** (validación + auth + abort/race safety)

## Supuestos explícitos
- Avatar en resultados se genera en UI (iniciales), no requiere campo persistido.
- Tag de fidelidad se basa en `clients.is_loyal` expuesto como `isLoyal` en search endpoint.
- No se incorpora notificación `sileo` para cada búsqueda; feedback será inline en dropdown.
