# Ronda 2B (diálogo, detalle, bloqueos, textos y pruebas) - Developer

**Spec**: 003-flexible-month-availability | **Tareas**: T047-T056 | **Rama**: `003-flexible-month-availability` | **Commits**: ninguno
Raíz del repositorio: `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit`. Rutas relativas a esa raíz.

## 1. Resumen

- Diálogo de citas afectadas (`AffectedAppointmentsDialog`, T047) sustituye el bloque provisional de 2A.
- `MonthDetailView` (T048-T050): se retiran "Modalidad", "Por bloque" y los horarios base de navegador; se añade el botón "Reglas" que monta el editor de 2A a través de un hook contenedor.
- Horarios de reagendado y de creación vienen de la agenda diaria del servidor (`availableSlots`); los de bloqueo, de `blockable-slots`.
- Se cierra NB-7 en la UI: el guardado de disponibilidad envía `expectedVersion` y `confirmAffectedAppointments` (camino de 2A) y ya no queda ningún llamador de PATCH slot-mode en la UI.
- Estado: T047-T056 implementadas. Verificado por ejecución (pruebas dirigidas, tsc, eslint, lint i18n). Pendiente de aceptación visual del owner (sección 7). Sin cambios en `docs/` (T076).

## 2. Archivos

Nuevos:
- `hooks/admin/months/fetch-day-agenda-slots.ts`: única función que pide `availableSlots` de la agenda (contiene el cast provisional, sección 6, H1).
- `hooks/admin/months/useRescheduleTimeSlots.ts`: horarios para reagendar (efecto movido fuera de `MonthDetailView`).
- `hooks/admin/months/useMonthAvailabilityController.ts`: une `useAvailabilityEditor(month)` y `useAvailabilitySave({...})` para el contenedor.
- `components/admin/months/availability/AffectedAppointmentsDialog.tsx` (T047): sobre `components/admin/ui/Modal`, sin `sileo`.
- `tests/components/admin/months/availability-editor.test.tsx` (T054, 4 pruebas).
- `tests/components/admin/months/availability-affected-dialog.test.tsx` (T054, 3 pruebas).

Modificados:
- `components/admin/months/MonthDetailView.tsx` (T048-T050).
- `components/admin/months/BlockSpacesModal.tsx` (T051): reescrito completo; sin vista "Por bloque", sin `DIRECTIONAL_SLOT_PAIRS`, sin props `allowBlockView`, `slotViewMode`, `onToggleBlockSlots`, `onSlotViewModeChange`.
- `hooks/admin/months/useBlockSpacesModal.ts` (T051): sin `slotViewMode`, `setSlotViewMode`, `toggleBlockSlots`; `TimeSlot = string`.
- `components/admin/months/BookAppointmentModal.tsx` (T052): sin alias `BaseTimeSlot`.
- `hooks/admin/months/useBookAppointmentModal.ts` (T052): horarios del día desde la agenda (efecto con `fetchDayAgendaSlots`, recarga tras `refreshAvailability`); `selectDate` ya no usa `days`.
- `components/admin/months/availability/AvailabilityEditorModal.tsx` (2A, ajuste de T047): quita el bloque provisional, monta `AffectedAppointmentsDialog` como hermano de la hoja y usa `disableClose={isLocked || save.isConfirmOpen}`. Hubo un reindentado de 2 espacios en el fragmento (solo espacios).
- `locales/es/admin.json`, `locales/en/admin.json` (T053): solo inserciones (178 líneas, 0 eliminadas respecto a HEAD). Añadidas: `availability.openCta`, `affected.cancel`, `affected.fields.{date,time,status,client}`, `affected.statuses.{PENDING,CONFIRMED,SYNC_FAILED,unknown}`. Retirada: `affected.back` (ya no se usa). Las claves `slotMode.*` no se tocaron (T073).
- `tests/components/admin/months/month-detail-view.test.tsx` (T055): se quitan 2 pruebas de Modalidad; se añaden 3 (botón Reglas sin Modalidad, abre el editor, tono `closed`); reagendado con `availableSlots` en el mock y aserción positiva; mocks de agenda de la prueba de reserva con `availableSlots: ["10:00"]`; helper `buildMonthDetail`.
- `tests/components/admin/months/block-spaces-modal.test.tsx` (T055): se quitan 2 pruebas de vista por bloque; la tercera conserva la aserción "sin Por bloque" sin props retiradas.
- `specs/003-flexible-month-availability/tasks.md`: [X] en T047-T056.

No se tocó: `lib/**`, `app/**`, `prisma/**`, `.env`, BD, `docs/**`, `components/booking/**`, `WeeklyOccupancyCard`, `BottomSheetModal`, `tests/app/admin-month-detail-page.test.tsx` (no requiere cambios; pasa).

## 3. Qué cambió por tarea

- **T047**: `AffectedAppointmentsDialog` lista fecha, hora, estado y cliente de cada cita (`Modal` de `components/admin/ui`). Cancelar llama a `save.cancelConfirm` (no escribe). Confirmar llama a `save.confirmSave` (reenvía `confirmAffectedAppointments: true`). Con la modal ocupada, el overlay/Escape no cierran. No usa `sileo` (D18).
- **T048**: se retiran el botón de cabecera de Modalidad, su estado (`isUpdatingSlotMode`, `isSlotModeModalOpen`, `slotModeDraft`), `handleUpdateMonthSlotMode`, la modal inline, el efecto de sincronía y `slotModeHelperKey`. Nuevo botón "Reglas" en la lista de acciones (solo meses no pasados) que llama a `availability.editor.open()`. `AvailabilityEditorModal` recibe `editor` y `save` del hook contenedor; `onSaved` es `refresh` (no lanza).
- **T049**: se retiran `monthBaseSlots`, `resolveBaseSlotsByMonthMode`, `getAvailableStartSlotsWithManualBlocks` y el cálculo en navegador. Los horarios de reagendado llegan de `availableSlots` de la agenda del día (`useRescheduleTimeSlots`). `handleReschedule` envía el horario tal cual (sin `BASE_TIME_SLOTS`).
- **T050**: la clase `closed` ya existía en `getToneClasses`. El servidor marca `closed` cuando el día es pasado o no tiene horarios resueltos (`lib/admin/months/detail-service.ts:175`), así que no hizo falta cambiar el mapeo. Se quita `allowBlockView` al renderizar `BlockSpacesModal`. El botón de día sigue usando `!day.isWeekend` (H7).
- **T051**: `BlockSpacesModal` solo muestra la lista de horarios de `blockable-slots` (cada horario = 1 espacio, D14). `canSelectFullDay` pasa a `selectedDaySlots.length > 0` (H4).
- **T052**: `useBookAppointmentModal` toma los horarios del día de `availableSlots`. Al elegir día o refrescar, se pide la agenda; si el horario elegido sigue disponible se conserva; si no, se elige el primero. `isReadyToSubmit` espera a la carga de horarios.
- **T053**: claves listadas arriba. Verificado: 61 claves `monthsDetail.availability.*` usadas por los archivos del módulo, 0 faltantes en es y en.
- **T054**: pruebas de editor y de diálogo con los hooks reales y `api-client` mockeado (con `importOriginal` para conservar `AdminMonthApiError`).
- **T055**: pruebas de detalle y de `BlockSpacesModal` adaptadas (sección 5).
- **T056**: en `booking-confirm-step.tsx:87`, `booking-success-step.tsx:100` y `booking-pending-confirmation-step.tsx:217`, `"09:00"` aparece solo como valor por defecto de la etiqueta (`draft.timeSlot ?? "09:00"`). No se modificaron. eslint exit 0.

## 4. Diseño estático (revisado, no ejecutado)

- Lógica nueva fuera de componentes: efectos y estado en `hooks/admin/months/` (`useRescheduleTimeSlots`, `useMonthAvailabilityController`, efecto de horarios en `useBookAppointmentModal`).
- Sin reglas de dominio en UI: la validación espejo sigue siendo la de 2A (`normalizeAvailabilityConfig`). No hay validaciones nuevas.
- Sin colores hexadecimales nuevos; clases de tono `closed` existentes.
- Solo `components/admin/ui` para elementos visuales (Modal, Button, Card, BottomSheetModal, AdminIcon).
- Sin `sileo` nuevo; el único camino de notificación de disponibilidad sigue siendo el de 2A (`sileo.promise`, `sileo.error`).
- El botón "Reglas" reutiliza el icono `adminIcons.slotModeSettings` (H5).

## 5. Ejecutado

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin/months` (línea base, antes de editar) | 36 pruebas, 35 pasan, 1 falla: "MonthDetailView > disables schedule CTA when month is inactive" (preexistente) |
| `npx vitest run tests/components/admin/months` (después) | 42 pruebas, 41 pasan, 1 falla: la misma línea base (línea 375 de `month-detail-view.test.tsx`: el botón "Agendar nueva cita" no queda deshabilitado en mes inactivo) |
| `npx vitest run tests/components/admin/months tests/hooks/admin/months tests/app/admin-month-detail-page.test.tsx` (final) | 80 pruebas, 78 pasan, 2 fallan: la línea base anterior y "useRescheduleWhatsappAction > offers a sileo action..." (formato de fecha de WhatsApp: "Miércoles, 18" frente a "Miércoles 18"; línea base de fecha/formato del brief) |
| `npx vitest run tests/components/admin` (regresión amplia) | 3 fallos fuera de alcance: `ClientsCatalogView` ("Cannot redefine property: assign"), `AppointmentLogsView` (etiqueta sin control asociado), `ReminderAppointmentsCard` (aserción de URL/estado). Ninguno importa los archivos tocados (comprobado con grep de importaciones). No verificados contra HEAD. |
| `npx tsc --noEmit` | 32 errores, todos en `tests/` (línea base 32). Cuatro son de `month-detail-view.test.tsx` (líneas 1511-1513 y 1675-1677), código preexistente: HEAD tiene las mismas líneas. Ninguno en archivos de `components/` ni `hooks/`. |
| `npx eslint components/admin/months components/admin/months/availability hooks/admin/months components/admin/ui/TimeSlotChipInput.tsx` | exit 0 |
| `npx eslint` sobre las pruebas tocadas, `AffectedAppointmentsDialog.tsx` y los tres componentes de reserva (T056) | exit 0 |
| `npm run lint:admin-i18n` | exit 0; 1 warning preexistente de variable sin uso en `hooks/admin/useReminderAppointments.ts` (no tocado, ya indicado en 2A) |
| Búsqueda de llamadores de `updateAdminMonthSlotMode` en `components`, `hooks`, `app`, `lib` | Sin llamadores de UI. Quedan la definición en `lib/admin/months/api-client.ts`, el servicio, la ruta `slot-mode` y sus pruebas (D79: si se retira el botón, no queda llamador) |

Notas de ejecución:
- `{{test_commands}}` apunta a una sección "Commands" de `CLAUDE.md` que no existe (ya conocido). Usé `npx vitest run <ruta>`, equivalente a `npm test -- <ruta>` (`package.json`: `"test": "vitest run"`).
- `timeout` no existe en este macOS; los logs se guardaron en el directorio temporal de sesión.
- No se ejecutó la suite completa, ni integración ni e2e. No se ejecutó ninguna prueba contra la base de datos.

## 6. Hallazgos y decisiones (para el Orchestrator)

- **H1 (cast provisional, requiere autorización).** `AdminDayAgendaResponse` (`lib/admin/appointments/types.ts`) no declara `availableSlots`, aunque `getAdminDayAgenda` lo devuelve (`lib/admin/appointments/service.ts:190-224`). Para no tocar un archivo fuera de la lista, `fetch-day-agenda-slots.ts` hace un cast con comentario `shortcut:`. Al autorizar el tipo, se quita el cast.
- **H2 (reagendado sin `excludeAppointmentId`, requiere autorización).** El servidor acepta `excludeAppointmentId` (PD-09), pero `fetchAdminDayAgenda` (`lib/admin/appointments/api-client.ts`) no lo envía. Efecto: la hora actual de la cita no aparece en las opciones de reagendado. Reagendar a esa misma hora no cambia nada, pero la opción ya no se ve. Propuesta: parámetro opcional en el cliente.
- **H3 (decisión de producto).** Se retiró la agrupación "día completo" por heurístico de la rejilla base. El centinela `00:00` sigue agrupando. Si un admin bloquea a mano todas las horas base, ahora ve cada hora por separado (antes se agrupaban como "Día completo"). Confirmar.
- **H4 (decisión de producto).** `canSelectFullDay` pasó de "todas las horas base bloqueables" a "al menos un horario bloqueable", que es lo que exige el servidor (`lib/admin/blocked-spaces/service.ts`, `availableSlots.length === 0` → `SLOT_NOT_AVAILABLE`). Confirmar.
- **H5 (UI).** El botón "Reglas" está en la lista de acciones, con icono reutilizado. Confirmar texto y ubicación.
- **H6 (copy).** Textos de estado del diálogo: "Solicitada", "Confirmada", "Confirmada (sincronización fallida)". La descripción de 2A dice "Guardar no modifica las citas": confirmar con producto que sea exacta, porque el diálogo existe para decidir si se guarda con citas afuera del horario.
- **H7 (no cambiado, Fase 2 según STATE).** `!day.isWeekend` deshabilita el botón de día en `MonthDetailView`. Un sábado abierto por excepción se pinta con el semáforo normal, pero queda deshabilitado (`opacity-75`) y no se puede abrir. No cambié el comportamiento sin aviso.
- **H8 (no tocado).** `WeeklyOccupancyCard.tsx` usa `grid-cols-5` con 7 días.
- **H9 (apilado de modales).** El diálogo y la hoja usan `z-40`; el diálogo va después en el DOM, así que queda encima. Mientras confirma, la hoja tiene `disableClose`. No hay verificación visual: pendiente del owner.
- **H10 (línea base).** "disables schedule CTA when month is inactive" falla igual que en HEAD. No la arreglé (brief). El fallo afirma que "Agendar nueva cita" está deshabilitado en mes inactivo y no lo está.
- **H11 (limpieza, Fase 4).** `resolveBaseSlotsByMonthMode` (`lib/availability/month-slot-mode.ts`) ya no tiene llamadores de UI; solo lo usan pruebas. Candidato a limpieza junto con T073.
- **H12 (regresión fuera de alcance).** Los 3 fallos de `tests/components/admin` (ClientsCatalogView, AppointmentLogsView, ReminderAppointmentsCard) no están verificados contra HEAD.

## 7. Pendiente de aceptación del owner (manual, no verificado)

- Navegador con sesión admin: apilado de la hoja y del diálogo de citas afectadas en móvil y escritorio; botón "Reglas"; chips de horas; tono `closed`; bloqueo sin "Por bloque"; reagendado y creación con horarios de agenda.
- Flujo real contra la API con datos: citas afectadas (listar, cancelar sin escribir, confirmar), conflicto de versión (cerrar y reabrir), guardado sin citas afectadas.
- Textos es y en de H6.
- Decisiones H3, H4 y H5.
- Aceptación de diseño de tokens y de `design-system.md` (no leído en esta ronda).

## 8. Checks requeridos

Admin UI Check:
- Uses components/admin/ui: Yes (Modal, Button, Card, BottomSheetModal, AdminIcon)
- Reused existing components: Yes (`Modal` para el diálogo; no hay componente visual nuevo)
- New reusable components created: No (`AffectedAppointmentsDialog` es de la feature; no se promueve todavía)
- Tokens respected: Yes (solo `--admin-*`, `--error` y clases existentes)
- design-system.md aligned: No verificado (no leído en esta ronda; pendiente de T076)
- Public flow untouched: Yes (no se tocó `components/booking/**`; T056 solo verificado)

Notification Contract Check:
- Sileo used for success/warning/error/info: Yes (camino de guardado de 2A, sin cambios; el diálogo de afectadas no usa sileo por D18)
- Sileo action notifications used when applicable: No aplica
- Sileo promise notifications used when applicable: Yes (guardado de 2A, sin cambios)
- i18n applied in admin notifications: Yes (61 claves verificadas en es y en)
- Alternative notification systems introduced: No

Flow Contract Check:
- UI steps updated: Yes (Modalidad retirada; Reglas añadida; diálogo de afectadas; reagendado y creación con horarios de agenda)
- API contract updated: No (sin cambios de endpoints; el guardado usa el contrato de 2A; ya no hay llamador de PATCH slot-mode en la UI)
- Validation rules updated: No (sin reglas nuevas; se reutiliza la validación espejo de 2A)
- Acceptance criteria updated: Yes (T047-T056 marcadas en tasks.md, con evidencia de ejecución)
- docs/specification.md aligned: No (pendiente de T076)

Documentation Impact:
- Yes. `docs/specification.md` NO se actualizó en esta ronda (T076 reconcilia `docs/ui/**`, `docs/features/admin-month-detail-flow.md` y las secciones 15.1.4/15.7).
- Secciones a actualizar en T076: gestión del mes (Reglas sustituye a Modalidad); editor de disponibilidad y confirmación de citas afectadas (D18); reagendado y creación desde la agenda del servidor; bloqueos sin vista por bloque (D14); día completo (criterio de H4); tono `closed`.

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Yes, y se mantiene (el endpoint PATCH slot-mode sigue en el servidor; la UI ya no lo llama)
- Rollback strategy defined: No aplica (sin cambios de BD)
- Cleanup phase defined: Sí, T073 (claves `slotMode.*` y función de cliente sin llamadores)
- Integrity protections defined: No aplica en esta ronda (las protecciones de servidor son de Fase 1)

## 9. Handoff

- **Hecho:** T047-T056 (sección 3). Pruebas nuevas: 7 (T054) y 4 cambios en pruebas existentes (T055). Resultado: 78 de 80 en el conjunto de meses, hooks y página; los 2 fallos son línea base o de formato de fecha. tsc sin errores nuevos; eslint y lint i18n sin errores.
- **Pendiente en esta ronda:** aceptación visual y funcional del owner (sección 7); decisiones H3, H4, H5 y H6; autorización para H1 y H2 (`lib/admin/appointments/types.ts` y `api-client.ts`).
- **Fuera de alcance, reportado:** H7 (sábado abierto por excepción), H8 (`grid-cols-5`), H10 (línea base), H11 (limpieza Fase 4), H12 (regresión no verificada contra HEAD).
- **Archivos tocados:** los de la sección 2.
- **Esfuerzo:** ~80 llamadas de herramienta, cerca del límite de la ronda. No quedó ninguna tarea sin cerrar, pero no quedó margen para más iteraciones.
- **Siguiente paso:** el owner valida en navegador (sección 7) y decide H3-H6. Según STATE, después va `reviewer-high-risk`, porque la ronda cambia el flujo de disponibilidad. T076 reconcilia la documentación antes de la release combinada.
