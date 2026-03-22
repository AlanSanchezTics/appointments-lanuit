## Plan Feature: Modal de Detalle Diario desde Calendario Mensual Admin

### Resumen ejecutivo

- Se agregará interacción al calendario de `/admin/months/[month]`: al hacer click en un día abrirá un **bottom-sheet modal** con agenda cronológica del día y acciones directas (`Editar`, `Eliminar`).
- Alcance funcional confirmado:
  - acciones **funcionales**,
  - `Editar` = mover cita de **fecha+hora** dentro del **mismo mes**,
  - `Eliminar` = cancelación lógica (`status=CANCELLED`) con **override admin** (sin restricción de 24h),
  - agenda muestra solo citas activas (`CONFIRMED`, `SYNC_FAILED`).
- Skills aplicadas explícitamente:
  - `ui-ux-pro-max`: define patrón de bottom sheet táctil (`rounded-t-3xl`), animaciones `SlideFromBottom/SlideToBottom`, jerarquía cronológica y targets de acción claros.
  - `next-best-practices`: separa RSC/Client boundaries (page server, modal client), route handlers delgados, servicios de dominio reutilizables, contratos API estables con errores machine-readable.

### Supuestos y ambigüedades

- Supuesto cerrado: el día puede abrir modal aunque no tenga citas; en ese caso se mostrará empty state.
- Supuesto cerrado: `Editar` no permite mover fuera del mes actual ni a slots inválidos/no disponibles.
- Supuesto cerrado: `Eliminar` aplica solo a citas futuras o del mes en contexto, pero no requiere ventana de 24h.
- Ambigüedad menor asumida: la edición se resolverá con un subflujo simple en el mismo modal (selección fecha+slot), sin crear página nueva.

### Alcance funcional (in/out)

- In:
  - click en celda de día abre modal detalle diario.
  - encabezado modal (título + cerrar), rounded top 32px.
  - listado agenda con fila min 72px: hora | nombre | acciones.
  - gap de 8px entre íconos `edit` y `delete`.
  - `Editar`: reprogramar cita (fecha+slot) dentro del mismo mes con validaciones de disponibilidad.
  - `Eliminar`: cancelar cita desde admin (status `CANCELLED`) y refrescar UI.
- Out:
  - edición de nombre/teléfono del cliente.
  - mover cita a otro mes.
  - borrado físico de registros.
  - cambios en flujo público booking/cancelación.

### Arquitectura propuesta (frontend/backend/API/datos)

- Frontend:
  - `MonthDetailView` convierte celdas de calendario en botones accionables.
  - nuevo componente reusable admin tipo `DayAgendaBottomSheet` (en `components/admin/ui/` o `components/admin/months/` con promoción a reusable documentada).
  - nuevo hook `useDayAgendaModal` para estado modal, carga agenda y mutaciones edit/cancel.
- Backend/API:
  - `GET /api/admin/months/[month]/days/[date]/agenda` (lista citas activas del día, orden cronológico).
  - `PATCH /api/admin/appointments/[appointmentId]/reschedule` (date+timeSlot destino, validación disponibilidad).
  - `POST /api/admin/appointments/[appointmentId]/cancel` (cancelación lógica admin).
  - handlers delgados -> servicios en `lib/admin/appointments/*`.
- Datos:
  - sin cambios de esquema.
  - reuso de tablas actuales (`appointments`, `clients`, `active_months`).
  - transacciones + locks para reprogramación y consistencia de concurrencia.

### Plan por fases

#### Fase 1: backend y migraciones

- Crear servicios admin de agenda diaria, reprogramación y cancelación.
- Implementar endpoints admin con auth obligatoria y códigos estables.
- Validaciones:
  - `month/date` válidos y consistentes (`date` pertenece a `month`),
  - slot válido base,
  - disponibilidad destino (regla pares + máximo diario + locks activos + no pasado en same-day),
  - edición solo dentro del mismo mes.
- Migraciones: no requeridas.

#### Fase 2: UI/UX flow

- Hacer celdas de calendario interactivas con `aria-label`.
- Implementar bottom-sheet modal:
  - header simplificado + close,
  - animación entrada/salida desde abajo,
  - lista cronológica de citas con fila min 72px.
- Integrar acciones:
  - editar abre subflujo en modal (selector fecha/slot),
  - eliminar con confirmación y refresh.
- i18n completo (`admin.json` es/en) para textos nuevos.
- Iconografía outline vía `AdminIcon` (`edit`, `trash`, `close`).

#### Fase 3: pruebas y rollout

- Unit:
  - validaciones de agenda diaria y reschedule.
  - reglas de negocio de cancelación admin y disponibilidad.
- Integration/API:
  - auth 401,
  - agenda diaria 200/empty,
  - reschedule conflict 409,
  - cancel success 200.
- E2E:
  - `/admin/months/[month]` click día -> modal visible.
  - editar cita refleja nuevo día/slot.
  - eliminar cita remueve de agenda del día.
- Runbook:
  - staging checklist, smoke de producción, rollback.

#### Fase 4: cleanup técnico

- Consolidar utilidades compartidas de agenda/calendario.
- Documentar componente modal y patrón de interacción en docs UI.
- Reducir duplicaciones de validación entre servicios admin/public donde aplique.
- Cerrar deuda técnica de accesibilidad/animación (`prefers-reduced-motion`).

### Matriz de reglas de negocio y validaciones

- `Agenda diaria`:
  - incluye solo `CONFIRMED` y `SYNC_FAILED`,
  - orden ascendente por `timeSlot`.
- `Editar cita`:
  - destino dentro del mismo mes,
  - fecha hábil (lunes-viernes),
  - slot oficial,
  - no slot pasado en same-day,
  - no conflicto por ocupación/lock/regla direccional/máximo diario.
- `Eliminar cita`:
  - transición a `CANCELLED`,
  - no borrado físico,
  - override admin sin regla 24h.
- `Auth`:
  - todo endpoint admin requiere sesión válida.

### Riesgos + mitigaciones

- Riesgo de conflictos de concurrencia en reprogramación.
  - Mitigación: transacción + locks equivalentes al flujo de booking.
- Riesgo de inconsistencias UI tras mutación.
  - Mitigación: invalidación/refresh inmediato de agenda día y resumen mensual.
- Riesgo de romper semántica visual del admin.
  - Mitigación: usar tokens y documentar nuevas variantes en docs UI.
- Riesgo de regresión en reglas de disponibilidad.
  - Mitigación: reutilizar funciones de dominio existentes y cubrir con tests de regresión.

### Dependencias técnicas

- Next.js App Router + Route Handlers.
- Prisma/MySQL.
- `react-i18next`.
- Componentes admin base (`AdminIcon`, `Card`, `Button`, `Modal`/BottomSheet).
- Reglas de disponibilidad existentes en `lib/availability/*`.

### Criterios de aceptación (DoD)

- Click en día abre modal con animación bottom-sheet y encabezado correcto.
- Agenda del día muestra citas activas en orden cronológico.
- Acciones edit/delete funcionan y actualizan vista sin recargar manual.
- `Editar` bloquea destinos inválidos/conflictivos.
- `Eliminar` cambia a `CANCELLED` y deja de mostrar la cita en agenda operativa.
- Cobertura de pruebas unit/integration/e2e en verde.
- Documentación (`specification`, `business-rules`, `features`, `ui`) alineada al flujo nuevo.

### Checklist de pruebas (unit, integration, e2e, QA manual)

- Unit:
  - parser `month/date`,
  - servicio agenda diaria,
  - servicio reschedule con conflictos,
  - cancelación admin estado final.
- Integration:
  - contratos y status codes de 3 endpoints nuevos.
- E2E:
  - open/close modal,
  - editar cita (fecha+slot),
  - eliminar cita.
- QA manual:
  - accesibilidad de foco/teclado en modal,
  - targets táctiles >=44px,
  - animación y `prefers-reduced-motion`,
  - i18n es/en en modal y errores.

### Documentation Impact

- Sí requiere cambios.
- Actualizar:
  - `docs/specification.md` (flujo mensual con detalle diario y acciones edit/delete).
  - `docs/architecture/business-rules.md` (reglas admin de agenda diaria, reschedule y cancel).
  - `docs/features/admin-month-detail-flow.md` (subflujo modal diario).
  - `docs/ui/admin/design-system.md`, `docs/ui/admin/components.md`, `docs/ui/admin/tokens.md` (patrón bottom-sheet, spacing, motion).
- Momento:
  - contrato funcional antes/durante Fase 1,
  - alineación final en Fase 4.

### Flow Contract Check

- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes

### Migration Compatibility Check

- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes
