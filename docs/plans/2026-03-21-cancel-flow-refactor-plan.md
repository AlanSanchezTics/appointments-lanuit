# Refactor Integral del Flujo de Cancelación (Cancel)

## Summary
- Alcance real detectado: hoy existe un solo componente en la feature, [`components/cancel/cancel-form.tsx`](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/cancel/cancel-form.tsx), que concentra UI + estado + interacción + llamadas API.
- Objetivo del refactor: convertir la capa `components/cancel` en presentacional, mover orquestación a `hooks/cancel`, y encapsular contratos/funciones de dominio de cancelación en `lib/cancel` sin romper el flujo de 3 pasos documentado.
- Decisiones cerradas:
1. Revalidar regla de 24h también en ejecución de `/api/cancelar`.
2. Usar código único `APPOINTMENT_IS_COMING_SOON` sin alias legacy.

## Análisis Actual y Clasificación de Lógica
### Componentes actuales en `components/cancel/`
- [`components/cancel/cancel-form.tsx`](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/cancel/cancel-form.tsx): wizard completo (lookup/review/success), fetch a API, validación de teléfono, traducción de errores, control de estados async y render de UI por paso.

### Lógica detectada por tipo en el componente actual
- UI/composición:
1. Layout y estilos de los 3 pasos.
2. Render condicional por `step`.
3. Iconos y bloques visuales.
- Estado/interacción:
1. `step`, `phone`, `appointment`, errores, flags de carga.
2. Handlers `handleLookup`, `handleCancel`, `handleReset`.
3. Control de transición entre pasos.
- Lógica de negocio/flujo:
1. Normalización y validación de teléfono en cliente.
2. Contrato HTTP `/api/cancelar/buscar` y `/api/cancelar`.
3. Resolución de códigos de error para lookup/cancel.
4. Formateo de teléfono para presentación (utilitario reusable).

### Clasificación objetivo
- Va a `hooks/cancel`:
1. Estado completo del wizard.
2. Handlers de lookup/cancel/reset.
3. Derivación de mensajes de error consumibles por UI.
4. Estado async (`isSearching`, `isCancelling`) y transiciones de paso.
- Va a `lib/cancel`:
1. Cliente API de cancelación (lookup + cancel + parser de error code).
2. Tipos de DTO UI/API de cancelación.
3. Helpers reutilizables de formato de datos cancelación (teléfono para display).
4. Regla 24h compartida para dominio (reutilizable entre búsqueda y ejecución).
5. Normalización/alias de error codes de cancelación.
- Permanece en componentes:
1. Presentación y composición de vistas.
2. Wiring de props de UI hacia callbacks del hook.
3. No lógica de elegibilidad ni manejo de contratos HTTP.

## Nueva Estructura Propuesta
### hooks/cancel/
- `use-cancel-flow.ts`
1. API del hook: `state` + `actions`.
2. Responsabilidad: orquestar wizard de 3 pasos completo.
3. Consume `lib/cancel/api-client` y traductores de error.
4. Expone estado ya preparado para componentes presentacionales.

### lib/cancel/
- `api-client.ts`
1. `lookupCancelableAppointment(phone)` y `submitCancellation({ phone, appointmentId })`.
2. Parsing estable de `errorCode`.
- `types.ts`
1. `CancellationStep`, `CancelableAppointment`, respuestas API y payloads de error.
- `formatters.ts`
1. `formatPhoneForDisplay`.
- `rules.ts`
1. `isCancellationAtLeast24HoursAway(...)` en zona de negocio.
- `error-codes.ts`
1. Código de error unificado `APPOINTMENT_IS_COMING_SOON`.

### components/cancel/
- `cancel-form.tsx`
1. Contenedor de composición; consume `useCancelFlow`.
- `cancel-lookup-step.tsx`
1. UI paso 1 (sin fetch ni validación de negocio).
- `cancel-review-step.tsx`
1. UI paso 2 (sin lógica de cancelación).
- `cancel-success-step.tsx`
1. UI paso 3.
- `cancel-icons.tsx` opcional para íconos si se quiere reducir ruido en vistas.

## Fases de Ejecución Incrementales (por componente y capa)
### Fase 1: Backend y migraciones
#### Fase: `CancelDomainRules` (lib + API contract)
- Descripción actual: elegibilidad 24h existe en lookup pero no se revalida en ejecución.
- Problemas detectados: riesgo de inconsistencia con `business-rules.md` y `cancel-flow.md`.
- Lógica a extraer/mover: regla 24h a utilitario de dominio en `lib/cancel/rules.ts`.
- Hook(s): no aplica.
- Funciones de negocio a mover a lib: reuso en [`lib/appointments/find-cancelable-appointment.ts`](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/find-cancelable-appointment.ts) y [`lib/appointments/cancel-appointment.ts`](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/cancel-appointment.ts).
- Cambios en componente: ninguno.
- Riesgos específicos: cambio de momento de rechazo en confirmación; compatibilidad de error code.
- Phase Validation:
1. componente sin lógica compleja → N/A
2. lógica movida a hooks → N/A
3. lógica de negocio en lib → Yes
4. flujo intacto → Yes

### Fase 2: UI/UX flow
#### Fase: `CancelFormContainer`
- Descripción actual: componente monolítico con lógica + render.
- Problemas detectados: alta complejidad y bajo aislamiento de pruebas.
- Lógica a extraer: estado wizard, handlers, llamadas API, control de errores.
- Hook(s) a crear: `use-cancel-flow`.
- Funciones de negocio a mover a lib: API client y mapeo de error codes.
- Cambios en componente: convertir `cancel-form.tsx` en shell de composición por paso.
- Riesgos específicos: regresiones en transición de pasos y textos de error.
- Phase Validation:
1. componente sin lógica compleja → Yes
2. lógica movida a hooks → Yes
3. lógica de negocio en lib → Yes
4. flujo intacto → Yes

#### Fase: `CancelLookupStep`
- Descripción actual: integrado en `cancel-form.tsx`.
- Problemas detectados: mezcla input rendering + submit + validación.
- Lógica a extraer: submit y validación quedan en hook/lib.
- Hook(s) a usar: `use-cancel-flow` (props de estado/acciones).
- Funciones de negocio a mover a lib: normalización/validación consumida vía API client y dominio.
- Cambios en componente: crear componente presentacional controlado.
- Riesgos específicos: accesibilidad de label/input y disabled state.
- Phase Validation:
1. componente sin lógica compleja → Yes
2. lógica movida a hooks → Yes
3. lógica de negocio en lib → Yes
4. flujo intacto → Yes

#### Fase: `CancelReviewStep`
- Descripción actual: integrado en `cancel-form.tsx`.
- Problemas detectados: acción de cancelación acoplada a markup.
- Lógica a extraer: cancel action y manejo de errores.
- Hook(s) a usar: `use-cancel-flow`.
- Funciones de negocio a mover a lib: submit cancel API y traducción de error code.
- Cambios en componente: componente presentacional de revisión y CTA.
- Riesgos específicos: consistencia de datos mostrados y botonera.
- Phase Validation:
1. componente sin lógica compleja → Yes
2. lógica movida a hooks → Yes
3. lógica de negocio en lib → Yes
4. flujo intacto → Yes

#### Fase: `CancelSuccessStep`
- Descripción actual: integrado en `cancel-form.tsx`.
- Problemas detectados: bajo impacto técnico, pero extraíble por claridad.
- Lógica a extraer: ninguna de negocio.
- Hook(s) a usar: lectura de estado actual.
- Funciones de negocio a mover a lib: N/A.
- Cambios en componente: vista final presentacional aislada.
- Riesgos específicos: mínimos (texto y navegación).
- Phase Validation:
1. componente sin lógica compleja → Yes
2. lógica movida a hooks → Yes
3. lógica de negocio en lib → N/A
4. flujo intacto → Yes

### Fase 3: Pruebas y rollout
- Actualizar pruebas unitarias de wizard para nuevo contrato de componentes/hooks.
- Mantener pruebas API existentes y agregar casos de revalidación 24h en cancel confirm.
- Ejecutar E2E `cancellation.spec.ts` para validar flujo 3 pasos + endpoints.
- Validar que no hay cambios visuales innecesarios y que `/cancelar` conserva UX contractual.

### Fase 4: Cleanup técnico
- Eliminar helpers locales obsoletos del componente monolítico.
- Consolidar tipos/errores de cancelación en `lib/cancel`.
- Revisar imports legacy y deprecaciones internas.
- Verificar que `app/cancelar/page.tsx` permanezca thin route file.

## Orden de Ejecución y Dependencias
1. `CancelDomainRules` primero para fijar contrato backend correcto.
2. `CancelFormContainer` segundo para mover orquestación completa al hook.
3. `CancelLookupStep` tercero.
4. `CancelReviewStep` cuarto.
5. `CancelSuccessStep` quinto.
6. Pruebas/rollout y cleanup al final.
- Dependencias clave:
1. `CancelLookupStep` y `CancelReviewStep` dependen de `use-cancel-flow`.
2. `use-cancel-flow` depende de `lib/cancel/api-client` y tipos.
3. Validación final depende de API + UI + E2E consistentes.

## Riesgos Generales
- Acoplamientos ocultos entre tests y estructura exacta del componente monolítico.
- Diferencias de timing por `useTransition` al mover handlers a hook.
- Riesgo de romper mensajes por mapeo de `errorCode`.
- Riesgo de regresión en regla 24h al centralizarla si no se prueba en ambos endpoints.
- Riesgo de contrato si se elimina typo sin alias compatible.

## Cambios de APIs/Interfaces/Tipos públicos
- Nuevo contrato de hook `useCancelFlow` para capa UI.
- Nuevo módulo `lib/cancel/api-client` para contratos HTTP de cancelación.
- Nuevo mapeo de error code canonical + alias compatible.
- Sin cambios de endpoint path (`/api/cancelar`, `/api/cancelar/buscar`), solo endurecimiento de elegibilidad en ejecución.

## Test Plan
1. Unit/UI:
- Render inicial paso 1.
- Validación teléfono inválido.
- Avance a paso 2 con lookup exitoso.
- Reset de paso 2 a paso 1.
- Confirmación y paso 3.
- Error de cancelación mostrado correctamente.
2. API:
- `/api/cancelar/buscar` mantiene 200/404/400.
- `/api/cancelar` mantiene 200/404/400.
- Nuevo caso: rechazo por regla 24h también al confirmar cancelación.
- Código de error `APPOINTMENT_IS_COMING_SOON` aplicado de forma consistente.
3. E2E:
- Flujo `/cancelar` de 3 pasos intacto.
- Cancelación por endpoint libera disponibilidad.

## Documentation Impact
- Impacto de flujo funcional: No cambio de UX principal; sí corrección de enforcement backend para alinear regla ya documentada de 24h.
- `docs/specification.md`: No requiere cambio estructural (ya exige regla 24h); opcional aclarar “revalidada en ejecución de cancelación”.
- `docs/features/cancel-flow.md`: Sí requiere actualización en “Observations” para eliminar contradicción de no revalidación en `/api/cancelar`.
- `docs/architecture/business-rules.md`: No requiere cambio, ya contiene regla.
- Momento de actualización documental: durante Fase 1 y validación final.

Flow Contract Check:
- UI steps updated: No
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: No
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Yes
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes

Assumptions and Defaults:
1. Se mantiene la UI actual sin rediseño, solo refactor de responsabilidades.
2. Se respeta naming existente de rutas legacy en español (`/cancelar`).
3. Se implementa alias de error para no romper traducciones ni tests existentes.
4. No se introducen migraciones de base de datos en este refactor.
