## Refactor Integral del Flujo de Booking (Arquitectura por Capas)

### Resumen
- Se refactoriza `components/booking/` para dejar componentes presentacionales y mover orquestación a `hooks/booking/` y reglas/reutilizables no-UI a `lib/booking/`.
- No se cambia el flujo funcional definido en `docs/features/booking-flow.md`; se mantiene contrato `check + lock -> confirm -> success`.
- Se ejecuta incrementalmente por componente, con validación al cierre de cada fase.
- Decisiones ya cerradas:
1. `booking-form.tsx`, `day-selector.tsx`, `time-slot-selector.tsx`: **deprecar y mantener** para cleanup técnico.
2. Cliente HTTP de booking: **`lib/booking/api-client`**.

### Análisis Actual (components/booking)
| Componente | Responsabilidad actual | UI | Estado/interacción | Lógica de negocio/compleja |
|---|---|---|---|---|
| `booking-wizard.tsx` | Orquestación completa del wizard | Parcial | Alta (steps, lock, timer, transitions, submit, refresh) | Alta (validaciones locales, normalización, invalidación lock, fetch API) |
| `booking-wizard-step1.tsx` | Vista paso 1 | Alta | Media (handlers por props) | Media (highlighted days, timer format) |
| `booking-confirm-step.tsx` | Vista confirmación | Alta | Baja | Baja-media (phone/time formatting) |
| `booking-success-step.tsx` | Vista éxito | Alta | Media (CTA WhatsApp) | Media (compose URL + message de WhatsApp) |
| `calendar-modal.tsx` | Selector mensual modal | Alta | Media | Baja-media (`getMonthDates`, `getLeadingBlanks`) |
| `month-view.tsx` | Wrapper de wizard | Alta | Baja | Baja |
| `booking-form.tsx` (legado) | Form directo a endpoint legacy | Media | Media | Media (submit + mensajes) |
| `day-selector.tsx` (legado) | Selector simple día | Alta | Baja | Baja |
| `time-slot-selector.tsx` (legado) | Selector simple horario | Alta | Baja | Baja |

### Clasificación de Lógica a Extraer

#### A hooks/booking
- Estado del flujo: `step`, `clientState`, `draft`, `errors`, `activeLock`, `remainingSeconds`, `success`, `submitErrorCode`.
- Efectos y side effects de UI: cleanup lock on unmount, countdown lock, refresh availability after error, animación de transición de pasos.
- Interacciones del usuario: `handleContinue`, `handleBack`, `handleConfirm`, `onDraftChange`, `onOpenCalendar`.
- View-model derivado: `selectedDay`, `highlightedDays`, flags de lock y disponibilidad por paso.

#### A lib/booking
- Cliente HTTP de booking y disponibilidad (`fetch` a `/api/reservar/*` y `/api/availability/*`).
- Reglas reutilizables del flujo de UI que deben ser estables e independientes del render:
1. `validateDraft` (validación de requeridos y teléfono 10 dígitos).
2. `normalizePhone`.
3. `normalizeDraftByAvailability`.
4. `getTransitionDirection` y `STEP_ORDER`.
- Builders/formatters reutilizados entre componentes:
1. `formatRemainingTime`.
2. `formatPhoneForDisplay`.
3. `buildWhatsAppMessagePayload` (sin traducir texto; solo payload estructurado).

#### Permanece en componentes
- Render JSX.
- Wiring de props/eventos.
- Íconos, estilos, layout y composición visual.
- Traducción visual (`t(...)`) y accesibilidad (aria labels) en capa UI.

### Nueva Estructura Propuesta
- `hooks/booking/use-booking-wizard.ts`
- `hooks/booking/use-booking-step-transition.ts`
- `hooks/booking/use-booking-lock-timer.ts`
- `hooks/booking/use-booking-success.ts`
- `lib/booking/api-client.ts`
- `lib/booking/draft-rules.ts`
- `lib/booking/step-transition.ts`
- `lib/booking/formatters.ts`
- `lib/booking/types.ts`

### Fases por Componente (incrementales e independientes)

#### Fase: `booking-wizard.tsx` (núcleo)
- Descripción actual: componente monolítico con estado, efectos, API calls, validación y render de pasos.
- Problemas: alto acoplamiento UI+orquestación, testing más difícil, lógica duplicable.
- Lógica a extraer: estado/effects/actions completos del wizard.
- Hooks a crear: `useBookingWizard`, `useBookingStepTransition`, `useBookingLockTimer`.
- Funciones a mover a lib: API client (`check+lock`, `release`, `confirm`, `refreshAvailability`), `validateDraft`, `normalizeDraftByAvailability`, `normalizePhone`, `getTransitionDirection`.
- Cambios en componente: queda como shell presentacional que consume hook + renderiza panes.
- Riesgos específicos: regresión en expiración lock, dirección de transición y limpieza de lock al volver.
- Phase Validation esperado:
1. componente sin lógica compleja -> Yes
2. lógica movida a hooks -> Yes
3. lógica de negocio en lib -> Yes
4. flujo intacto -> Yes

#### Fase: `booking-wizard-step1.tsx`
- Descripción actual: vista paso 1 con helpers internos y decisiones de selección.
- Problemas: helpers de derivación mezclados con render.
- Lógica a extraer: `getHighlightedDays`, `formatRemainingTime` (si se comparte), payload de selección día/slot como helper puro.
- Hook(s): uso indirecto de `useBookingWizard` (props ya preprocesadas).
- Lib: `formatters` y helper de resaltado si se reutiliza.
- Cambios: componente solo renderiza datos y dispara callbacks.
- Riesgos: pérdida de comportamiento de selección automática de primer slot disponible.
- Phase Validation esperado: Yes/Yes/Yes/Yes.

#### Fase: `booking-confirm-step.tsx`
- Descripción actual: vista confirmación + utilidades de formato.
- Problemas: utilidades repetidas.
- Lógica a extraer: `formatPhoneForDisplay`, `formatRemainingTime`.
- Hook(s): no obligatorio; consume datos del hook principal.
- Lib: `formatters`.
- Cambios: componente puramente presentacional.
- Riesgos: formato de teléfono/hora visible en tests.
- Phase Validation esperado: Yes/Yes/Yes/Yes.

#### Fase: `booking-success-step.tsx`
- Descripción actual: render éxito + construcción de mensaje/URL WhatsApp.
- Problemas: side effect y composición de mensaje dentro del componente.
- Lógica a extraer: preparación de payload de WhatsApp y handler de CTA.
- Hook(s): `useBookingSuccess` para `handleWhatsAppClick`.
- Lib: utilidades de mensaje/formatters + uso de `lib/whatsapp/message`.
- Cambios: componente recibe `onSendWhatsApp`.
- Riesgos: mantener contrato “frontend dueño del texto final” y `encodeURIComponent`.
- Phase Validation esperado: Yes/Yes/Yes/Yes.

#### Fase: `calendar-modal.tsx`
- Descripción actual: modal de calendario con helpers internos.
- Problemas: utilidades de calendario acopladas al render.
- Lógica a extraer: `getMonthDates`, `getLeadingBlanks` (si se busca consistencia y test unitario).
- Hook(s): opcional `useBookingCalendar`.
- Lib: helper puro de calendario en `lib/booking`.
- Cambios: solo render.
- Riesgos: offsets del calendario mensual.
- Phase Validation esperado: Yes/Yes/Yes/Yes.

#### Fase: `month-view.tsx`
- Descripción actual: wrapper fino.
- Problemas: ninguno crítico.
- Lógica a extraer: no aplica.
- Hook(s): no aplica.
- Lib: no aplica.
- Cambios: mínimos para mantener composición.
- Riesgos: nulos.
- Phase Validation esperado: Yes/Yes/Yes/Yes.

#### Fase: Componentes legado (`booking-form.tsx`, `day-selector.tsx`, `time-slot-selector.tsx`)
- Descripción actual: no usados por rutas activas.
- Problemas: deuda y riesgo de confusión.
- Acción acordada: deprecar y mantener hasta cleanup.
- Cambios: anotación/aislamiento y opcional ajuste para evitar dependencia del endpoint deprecated en nuevas rutas.
- Riesgos: ninguno en runtime activo; sí riesgo de deuda si no se limpia.
- Phase Validation esperado: Yes/Yes/Yes/Yes.

### Orden de Ejecución y Dependencias
1. Crear base compartida en `lib/booking/*` (`types`, `api-client`, `draft-rules`, `formatters`, `step-transition`).
2. Implementar hooks core `hooks/booking/use-booking-wizard.ts` + hooks auxiliares.
3. Refactor `booking-wizard.tsx` para consumir hooks/lib.
4. Refactor `booking-wizard-step1.tsx`.
5. Refactor `booking-confirm-step.tsx`.
6. Refactor `booking-success-step.tsx`.
7. Refactor `calendar-modal.tsx`.
8. Ajuste final `month-view.tsx`.
9. Marcar legado y cleanup plan para `booking-form.tsx`, `day-selector.tsx`, `time-slot-selector.tsx`.

Dependencias críticas:
- `booking-wizard.tsx` depende de nuevos hooks/lib.
- `step1/confirm/success` dependen de contratos de props estabilizados por el hook principal.
- `month-view` depende solo de la API pública de `BookingWizard`.

### Ejecución con Subagentes (plan de coordinación)
1. **Analyzer** (read-only)
- Ownership: `components/booking/*`, `tests/app/*booking*`, docs de booking.
- Salida: mapa final de lógica por componente y riesgos.

2. **Hook Extractor**
- Ownership: `hooks/booking/*`.
- Restricción: no editar `lib/booking/*` ni tests.
- Salida: hooks listos + contratos de estado/acciones.

3. **Domain Extractor**
- Ownership: `lib/booking/*`.
- Restricción: no tocar JSX.
- Salida: reglas y cliente API puros, alineados con `business-rules.md`.

4. **Component Refactor**
- Ownership: `components/booking/*`.
- Restricción: consumir APIs de hooks/lib sin reintroducir lógica.
- Salida: componentes presentacionales limpios.

5. **Validator**
- Ownership: `tests/app/*booking*`, `tests/app/citas-month-page.test.tsx`, chequeo de contratos y docs.
- Salida: reporte de regresiones + checklist de cumplimiento arquitectónico.

### Riesgos Generales
- Acoplamientos ocultos entre `draft` y lock (invalidación al cambiar teléfono/fecha/slot).
- Temporizador de lock y cleanup en unmount con condiciones de carrera.
- Cambios de firmas de props en componentes de pasos.
- Regresiones de i18n/labels que rompan tests.
- Diferencia entre comportamiento activo vs componentes legado no usados.

### Plan por Fases Globales (obligatorio AGENTS)

#### Fase 1: Backend y migraciones
- No se requieren cambios de schema ni migraciones para este refactor.
- Solo extracción de cliente API y reglas de UI a `lib/booking` sin tocar dominio `lib/appointments`.

#### Fase 2: UI/UX flow
- Refactor incremental por componente manteniendo UX existente, transiciones y mensajes.
- Sin cambios de flujo funcional de booking.

#### Fase 3: Pruebas y rollout
- Ejecutar pruebas unitarias/RTL de booking existentes y ajustar mocks si cambian contratos internos.
- Validar manualmente: check+lock, cliente nuevo/existente, expiración lock, éxito + WhatsApp CTA.

#### Fase 4: Cleanup técnico
- Marcar/aislar componentes legado.
- Eliminar duplicaciones de formatters/helpers en componentes.
- Documentar deuda restante (si no se eliminan legados en este ciclo).

### Test Plan (aceptación)
1. `tests/app/booking-wizard.test.tsx` pasa (validaciones, transición, nombre para cliente nuevo).
2. `tests/app/booking-confirm-step.test.tsx` pasa (back, conflictos, expiración lock).
3. `tests/app/booking-success-step.test.tsx` pasa (render éxito y CTA WhatsApp).
4. `tests/app/citas-month-page.test.tsx` pasa (shell inicial del wizard).
5. Smoke manual:
- `/citas/YYYY-MM/booking` paso 1 -> check+lock.
- cliente nuevo pide nombre.
- confirmación consume lock.
- éxito muestra CTA WhatsApp y conserva texto localizado frontend.

### Documentation Impact
- Cambio de flujo funcional: **No** (refactor estructural).
- `docs/specification.md` requiere cambios: **No** (si el comportamiento se mantiene).
- `docs/features/booking-flow.md` requiere cambios: **No** (si el flujo y contratos no cambian).
- Nota de trazabilidad planificada:
  - Impacto de flujo: No.
  - Impacto documental: No obligatorio.
  - Si durante implementación cambia cualquier validación/paso/estado, actualizar:
1. `docs/specification.md` sección 7 (Flujo de Reserva) y 7.1 (Contrato UI/UX).
2. `docs/features/booking-flow.md` en `Step-by-Step Flow`, `Validation Points`, `Observations`.

Flow Contract Check (objetivo tras implementación):
- UI steps updated: No
- API contract updated: No
- Validation rules updated: No
- Acceptance criteria updated: No
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Yes
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: No

### Archivos Planificados (crear/modificar)
- Crear:
1. `hooks/booking/use-booking-wizard.ts`
2. `hooks/booking/use-booking-step-transition.ts`
3. `hooks/booking/use-booking-lock-timer.ts`
4. `hooks/booking/use-booking-success.ts`
5. `lib/booking/api-client.ts`
6. `lib/booking/draft-rules.ts`
7. `lib/booking/step-transition.ts`
8. `lib/booking/formatters.ts`
9. `lib/booking/types.ts`
- Modificar:
1. `components/booking/booking-wizard.tsx`
2. `components/booking/booking-wizard-step1.tsx`
3. `components/booking/booking-confirm-step.tsx`
4. `components/booking/booking-success-step.tsx`
5. `components/booking/calendar-modal.tsx`
6. `components/booking/month-view.tsx`
7. `components/booking/booking-form.tsx` (deprecación técnica)
8. `components/booking/day-selector.tsx` (deprecación técnica)
9. `components/booking/time-slot-selector.tsx` (deprecación técnica)

### Supuestos y defaults
- Se preserva contrato público de rutas y endpoints actuales (`/api/reservar/client-check-lock`, `/api/reservar/confirm`, `/api/reservar/lock`).
- No se altera UX visual ni copy funcional fuera de cambios mínimos por estructura.
- No se elimina código legado en esta iteración; se deja en cleanup fase 4.
