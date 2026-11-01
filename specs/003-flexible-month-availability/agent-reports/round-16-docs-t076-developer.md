# Ronda 16 (T076, cierre documental de Fase 2) - Developer

**Spec**: 003-flexible-month-availability | **Tarea**: T076 | **Rama**: `003-flexible-month-availability` | **Commits**: ninguno

Solo documentación. No se modificó código, pruebas, locales, BD, `.env` ni Prisma. No se ejecutó `speckit-implement`. No se ejecutaron pruebas (la ronda no cambia comportamiento). Rutas relativas a la raíz del repositorio.

## 1. Resumen

- Documentados el editor de reglas y excepciones, el diálogo de citas afectadas, el descarte con overlay, `Tooltip`, `TimeSlotChipInput`, las props aditivas de `Switch` y `BottomSheetModal`, la contención de `Input` para fecha y hora, y la retirada de `MonthSlotModeModal` y de la vista `Por bloque`.
- `admin-month-detail-flow.md` se reescribió por completo: pasos de `Modalidad` a `Reglas`, bloqueos sin `Por bloque`, reglas de cálculo, tonos, selección de días, horarios ofrecidos, reagendado y flujos alternos.
- Se corrigieron desalineaciones concretas que contradecían el código: horarios de reserva por `slotMode` (fijos), días solo lunes a viernes, regla direccional por pares, `POST /api/admin/months/[month]/appointments` que exigía `ACTIVE` (el código admite `INACTIVE`), catálogo de meses con `SECOND_ONLY_MODE` (el código crea `BLOCK_MODE` sin reglas), y el `data-model` que decía que la UI leía `slot_mode`.
- Se retiraron las referencias a rondas e informes en `data-model.md`, `0001` y `0005`, y en el texto de compatibilidad de `api.md`.
- Estado: los cinco documentos de T076 están completos. T076 marcado [X] en `tasks.md`.

## 2. Archivos modificados y secciones afectadas

| Archivo | Secciones afectadas |
|---|---|
| `docs/ui/admin/components.md` | `Switch` (prop `labelAdornment`); `BottomSheetModal` (prop `overlay`, `disableClose`); `BlockSpacesModal` (lista única, sin `Por bloque`, reglas de `Día completo`); `MonthSlotModeModal` sustituido por `Tooltip`, `TimeSlotChipInput`, `AvailabilityEditorModal` (con formularios, parámetros, valores por defecto, validación, estados, descarte, guardado y notificaciones), `AffectedAppointmentsDialog`; `Input` (contención date/time); `BookAppointmentModal` (reglas de meses `INACTIVE`, horarios de `availableSlots`) |
| `docs/features/admin-month-detail-flow.md` | Reescritura completa. Pasos 7 (`Reglas`), 11-23 (agendado, bloqueo sin `Por bloque`, efecto de bloqueos, día completo), nuevas secciones "Editor de reglas y excepciones", "Confirmación de citas afectadas", "Horarios ofrecidos", "Reagendado desde la agenda diaria", "Selección de días en el calendario", "Reglas de cálculo" (métricas, tonos, semáforo), "Flujos alternos" (códigos de bloqueo y disponibilidad), contrato de creación (mes `ACTIVE` o `INACTIVE`) |
| `docs/specification.md` | 15.7 (estado de implementación, editor con valores por defecto, validación, descarte, guardado y notificaciones, `Día completo` habilitado, horarios y reagendado D103/D104, semáforo de color); 7 paso 5 (regla objetivo D95 y nota de implementación pendiente); "Formato es" (quitada referencia temporal); 15.1.4 (quitada referencia a "Fase 2 (T076)"; queda la nota de 5 columnas como pendiente de Fase 4) |
| `docs/features/booking-flow.md` | Reglas de días y horarios (sin `slotMode`, sin lista fija); validación del horario (resolvedor, sin propagación direccional); umbral de 15 días con nota D95; errores `SLOT_NOT_AVAILABLE`/`SLOT_LOCKED`; casos borde sin "regla direccional" |
| `docs/features/my-appointments-flow.md` | Reprogramación pública: destino con el resolvedor, locks ajenos (D87/D88), mes `ACTIVE` y no pasado, `UNKNOWN_ERROR` (D81); validación del destino |
| `docs/features/admin-months-catalog-flow.md` | Pasos 9 y notas: meses creados `INACTIVE`, `slot_mode=BLOCK_MODE`, sin reglas, regla por defecto D6 (D17, D31) |
| `docs/architecture/business-rules.md` | Dos notas de pendiente de implementación del umbral de 15 días (D95) |
| `docs/architecture/api.md` | Compatibilidad de `PUT .../availability`: la UI envía `expectedVersion` y `confirmAffectedAppointments`; se quita "Fase 2 pendiente" y el texto de riesgo transitorio |
| `docs/architecture/data-model.md` | Quitada la referencia a "ronda 1A" (cabecera y bitácora de `0022`); la UI admin ya no lee `slot_mode` |
| `docs/decisions/0001-min-gap-reemplaza-pares-direccionales.md` | Quitada la referencia a "ronda 1B" |
| `docs/decisions/0005-capacidad-del-dashboard-y-contadores.md` | Quitada la referencia a "ronda 1C" (aceptación por el owner) |
| `specs/003-flexible-month-availability/tasks.md` | T076 marcado [X] |

## 3. Qué se verificó y cómo

Verificación estática por lectura y búsqueda (no hay ejecución de pruebas ni de navegador):

- Editor: `useAvailabilityEditor.ts` (valores por defecto `createEditorRule`/`createEditorException`, validación espejo, estados de carga y descarte, `resolveAvailabilityErrorKey`), `useAvailabilitySave.ts` (preview, `sileo.show`/`dismiss`/`success`/`error`, 409 de confirmación sin notificación), `AvailabilityEditorModal.tsx` (overlay, `inert`, `disableClose`, scrim), `AffectedAppointmentsDialog.tsx`, `AvailabilityRuleForm.tsx`, `AvailabilityExceptionForm.tsx`, `AvailabilityParamsFields.tsx`, `TimeSlotChipInput.tsx`, `Tooltip.tsx` (captura de Escape), `Switch.tsx` (`labelAdornment`), `BottomSheetModal.tsx` (`overlay`), `Input.tsx` (contención date/time), `useDiscardConfirmDialog.ts`.
- Servidor: `lib/admin/months/service.ts` (`saveAvailability`: `MONTH_IN_PAST`, `AVAILABILITY_VERSION_CONFLICT`, afectadas con `confirmAffectedAppointments`; sin escritura en citas), `lib/availability/affected-appointments.ts` (estados activos, citas futuras dentro de la rejilla vigente y fuera de la propuesta), `lib/admin/blocked-spaces/service.ts` (`createAdminBlockedSlots`: día completo con `DATE_NOT_OPERATIONAL`, `SLOT_LOCKED`, `DAY_ALREADY_BLOCKED`, `SLOT_NOT_AVAILABLE` si no queda horario libre; elimina bloqueos puntuales del día), `lib/admin/blocked-spaces/day-block.ts` (`countBlockedSpaces`), `lib/admin/months/detail-service.ts` (tonos `available|low|full|closed`, `hasNoResolvedTimes` sin citas, `availableSpaces` por días con pasados a 0, saturación con días pasados), `lib/db/admin-months.ts` (`COUNTED_APPOINTMENT_STATUSES = CONFIRMED, SYNC_FAILED, CANCELLED`: los contadores excluyen `PENDING`), `lib/admin/appointments/service.ts` (`getAdminDayAgenda`: `availableSlots`, `excludeAppointmentId`, `PENDING` ocupa), `lib/my-appointments/service.ts` (reprogramación pública: estados `PENDING|CONFIRMED|SYNC_FAILED`, lock de otra clienta, `UNKNOWN_ERROR`), `lib/active-months/service.ts` (`getBookableMonthConfig`: `ACTIVE` y no pasado), `lib/appointments/lock-reservation-slot.ts` (umbral de 15 días: solo `CONFIRMED` y `SYNC_FAILED`), `lib/availability/defaults.ts` (`DEFAULT_DAY_RULE`: 09:00 a 18:00 de seis horas, 240, true, 3), `lib/availability/month-slot-mode.ts` (`DEFAULT_MONTH_SLOT_MODE = BLOCK_MODE`), `lib/admin/appointments/service.ts` línea 257 (admin agenda en meses `INACTIVE`).
- Componentes: `MonthDetailView.tsx` (botón `Reglas` solo fuera de meses pasados; `closed` deshabilita solo fin de semana; selector de reagendado `availableSpaces > 0` más la fecha de la cita; `Guardar` de reagendado con `!editTimeSlot`; ya no hay lectura de `slotMode`), `BlockSpacesModal.tsx` (sin `allowBlockView`), `useBookAppointmentModal.ts` (`isReadyToSubmit` exige horario), `useRescheduleTimeSlots.ts` (preselección y conservación de elección, D103/D104 leídos en el código y en el informe de la ronda 13).
- Nombres citados: todos los archivos citados en `components.md` y en el feature doc existen (`ls`). `labelAdornment`, `overlay`, `align` y `addLabel` existen en el código. `useMonthAvailabilityController` lo usa `MonthDetailView.tsx`.
- Búsqueda de términos obsoletos en los documentos tocados: `Modalidad` solo aparece como nombre de la opción de clientes y como texto de historia, no como UI vigente; `Por bloque` no aparece en la UI vigente; `SECOND_ONLY_MODE` y `slot_mode` aparecen solo como campo legado y en los presets de la API.
- Búsqueda de referencias a rondas o informes en los documentos tocados: no quedan en `specification.md`, `components.md`, los features, `business-rules.md`, `api.md`, `data-model.md` ni los ADR 0001 y 0005. Quedan referencias a "Fase 4 (T078)" y a "Fase 4" (planes de limpieza, no informes).

## 4. Documentation Impact

- Impacto documental: Sí. Sin cambios de código.
- `docs/specification.md` actualizado: Sí. Secciones: 7 paso 5 (D95, nota de implementación pendiente), 15.1.4 (nota de 5 columnas, pendiente de Fase 4), 15.7 (estado de implementación, editor, bloqueo, reagendado y creación, semáforo), formato `es` (cita temporal quitada).
- Flow Contract Check:
  - UI steps updated: Yes
  - API contract updated: Yes (`api.md`, compatibilidad de `PUT .../availability`; contrato de creación admin en el feature doc)
  - Validation rules updated: Yes (editor por ítem y por conjunto, horarios, bloqueo de día completo, reagendado)
  - Acceptance criteria updated: No. Los documentos tocados no tienen una sección de criterios de aceptación y no se añadió una. Los criterios de Fase 2 siguen en `tasks.md`.
  - docs/specification.md aligned: Yes, para las secciones tocadas. Quedan pendientes listados en la sección 6.
- Migration Compatibility Check: esta ronda no cambia esquema, datos ni contratos persistidos. Schema changes: No. Data backfill: No. Legacy compatibility: No cambia (`slot_mode` sigue documentado como legado). Rollback strategy: N/A (solo documentación). Cleanup phase: sigue en Fase 4 (T078). Integrity protections: N/A.
- Admin UI Check (documentación de componentes): Uses components/admin/ui: Yes (se documentan los componentes existentes). Reused existing components: Yes. New reusable components created: No (se documentan los componentes ya creados). Tokens respected: Yes (no se inventan tokens; el scrim queda como literal pendiente). design-system.md aligned: No actualizado (ver sección 6). Public flow untouched: Yes.
- Notification Contract Check (lo documentado): Sileo used for success/error/loading: Yes. Sileo action notifications: No aplica en el editor. Sileo promise: No, excepción aceptada por el owner (D102) y documentada. i18n applied: Yes. Alternative notification systems introduced: No.

## 5. Ejecutado

- No se ejecutaron pruebas, `tsc`, `eslint` ni `lint:admin-i18n`. Razón: la ronda solo cambia documentación.
- Comandos de verificación: `ls` de rutas citadas, `grep` de nombres de props y componentes, `grep` de términos obsoletos y de referencias a rondas, lecturas de los archivos de código citados, `sed` de la línea corregida de la especificación, `git status` de los documentos.
- No se usó `python3 scripts/check-workflow-profile.py` (no aplica a documentación, según la ronda).

## 6. Huecos, ambigüedades y pendientes (sin decidir)

1. Color del día `full`: el código pinta verde solo si el día tiene más de una cita activa (`appointmentsCount > 1`, `MonthDetailView.tsx`, `getToneClasses`), y gris en otro caso. El umbral viene de la capacidad fija anterior. La spec (15.7) describe "verde por citas agendadas" sin umbral. Documentado como ambigüedad abierta. Decisión del owner.
2. D95 (umbral de 15 días con `PENDING`): documentado como regla objetivo con nota de implementación pendiente en spec 7 paso 5, `booking-flow.md`, `business-rules.md` (dos lugares). El código vigente (`lib/appointments/lock-reservation-slot.ts`, consulta de `CONFIRMED`/`SYNC_FAILED`) no cambia en esta ronda. Requiere ronda propia de código público.
3. R12-3 (cita creada entre previsualización y `Confirmar`): documentado como riesgo residual aceptado por el owner en la spec 15.7 y en el feature doc.
4. Scrim `rgba(28,25,23,0.35)`: literal sin token. Pendiente tokenizar (`tokens.md` y `design-system.md`). No se añadió token.
5. `design-system.md` no se actualizó. El patrón de confirmación superpuesta (overlay con scrim) y `Tooltip` están documentados en `components.md`. Si el Orchestrator quiere reglas visuales en `design-system.md`, falta esa decisión.
6. Claves i18n sin uso: `monthsDetail.slotMode.*` y `monthsDetail.blockSpaces.viewModes.*` (`locales/es/admin.json` y `en`). Comprobado con `grep` que ningún código las usa. No se tocaron los locales (fuera de alcance). Limpieza para Fase 4.
7. Comentario obsoleto en `lib/admin/months/detail-service.ts` (D59, dice que `PENDING` se cuenta) y en `lib/admin/dashboard/service.ts` (D61). El código real no cuenta `PENDING` (D66). Deuda ya registrada en ADR 0005. No se tocó código.
8. Verificación no hecha en esta ronda: contratos de reprogramación admin de citas `PENDING` (`api.md` y `business-rules.md` dicen `APPOINTMENT_NOT_FOUND`) y contratos de creación admin en `api.md` y `business-rules.md` (¿siguen diciendo que exigen `ACTIVE`?). El feature doc sí se corrigió con el código (`service.ts` línea 257). Revisar en la ronda de Fase 3 (T077).
9. Referencias a "informe de ronda" indicadas en la ronda que no encontré: `docs/architecture/data-model.md` L241 (no contiene referencia a rondas), `docs/decisions/0002-...` L25-26 (no contiene referencia a rondas). En `api.md` L384-385 sí había una referencia a hallazgos temporales (NB-6, NB-7, D79) y se reescribió.
10. Hallazgo no documentado como función: en `MonthDetailView.tsx`, `handleReschedule` no captura el rechazo de `rescheduleAdminAppointmentById` (solo `try/finally`). Ya señalado en el informe de la ronda 13. No es comportamiento de producto; queda para Fase 4 o para decisión del Orchestrator.
11. Spec 15.1.4 y `WeeklyOccupancyCard.tsx:100` (`grid-cols-5` con 7 días) siguen pendientes de Fase 4 (H8). Documentado como pendiente.
12. No se auditó toda la especificación para la expresión "lunes a viernes" fuera de las secciones tocadas. Se auditaron los feature docs y las secciones de 15.7 y 4. Pendiente para T077.
13. Comportamiento de UI verificado solo por lectura de código y por los informes de rondas anteriores. No se verificó en navegador ni en iOS. El owner validó lo visual en iPhone según el STATE (D99-D104).

## 7. Handoff

- Hecho: los cinco documentos de T076, las correcciones de desalineación listadas, la retirada de referencias a rondas en `docs/`, y T076 marcado en `tasks.md`.
- Pendiente (fuera de esta ronda): los puntos 2, 4, 5, 6, 7, 8 y 12 de la sección 6, y la ronda de código público para D95.
- Archivos tocados: los de la sección 2.
- Siguiente paso: Reviewer de documentación (`reviewer-docs`) sobre los cinco documentos y la spec, y después T077 (verificación de Fase 3).
- Nota de turnos: el trabajo se cerró cerca del umbral de 65 turnos. No queda trabajo de documentación abierto que no esté listado arriba.
