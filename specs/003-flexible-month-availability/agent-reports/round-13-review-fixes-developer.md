# Ronda 13: corrección de hallazgos R12-1, R12-2, R12-5 y R12-6 (Developer)

Spec 003-flexible-month-availability, Fase 2 UI admin. Alcance: solo los cuatro hallazgos indicados. No se usó speckit-implement, no hubo commits, no se tocó la BD ni `.env`.

## 1. Archivos modificados

Código:
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/hooks/admin/months/useRescheduleTimeSlots.ts` (R12-1)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/admin/months/MonthDetailView.tsx` (R12-1: se quitan `useState`/`useEffect` de selección y se consume el hook)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/admin/ui/Tooltip.tsx` (R12-2)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/hooks/admin/months/useAvailabilitySave.ts` (R12-5 y R12-6)

Pruebas:
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/hooks/admin/months/use-reschedule-time-slots.test.ts` (nuevo, 4 pruebas)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/hooks/admin/months/use-availability-save.test.ts` (mock de sileo, aserciones adaptadas, 2 pruebas nuevas/reescritas)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/components/admin/ui/bottom-sheet-modal.test.tsx` (1 prueba nueva de Escape con Tooltip)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/components/admin/months/availability-affected-dialog.test.tsx` (mock de sileo: `show`/`dismiss`/`success`/`error`)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/components/admin/months/availability-editor.test.tsx` (mock de sileo: mismo cambio)

`BottomSheetModal.tsx` no se modificó: la corrección de R12-2 vive en Tooltip, así que el comportamiento de BottomSheetModal sin tooltip es idéntico por construcción (sus 4 pruebas previas siguen en verde).

Nota sobre el diff: `git diff` de `MonthDetailView.tsx` (50 inserciones, 304 eliminaciones) incluye trabajo previo no commiteado de la ronda; mi cambio en ese archivo son unas pocas líneas. Tooltip.tsx, useAvailabilitySave.ts y useRescheduleTimeSlots.ts no aparecen en `git diff` porque no están trackeados en HEAD.

## 2. Cambios por hallazgo

### R12-1: la hora actual de la cita se perdía al reagendar

Causa: el estado `editTimeSlot` vivía en el componente. Al empezar a editar, un efecto lo vaciaba mientras la lista estaba vacía y, al llegar la lista, lo fijaba a la primera hora ofrecida.

Corrección:
- `useRescheduleTimeSlots` ahora posee la selección: devuelve `{ availableEditSlots, editTimeSlot, setEditTimeSlot }` y recibe `currentTimeSlot` (hora actual de la cita en edición, "HH:mm").
- Al iniciar cada carga la selección queda vacía (igual que hoy: Guardar no reagenda mientras no hay horarios del servidor).
- Al llegar la lista: `pickEditTimeSlot(slots, currentTimeSlot)` devuelve la hora actual si el servidor la ofrece; si no, la primera; si no hay ninguna, "".
- Al dejar de editar, la selección y la lista se vacían.
- En `MonthDetailView.tsx`: se eliminaron el `useState` de `editTimeSlot`, el `useEffect` de reconciliación y la línea `setEditTimeSlot(normalizedTimeSlot)` de `startEditing`. La llamada al hook va debajo de la memo `editingAppointment` que ya existía (evita duplicar la búsqueda).
- Contrato de API sin cambios.

### R12-2: Escape con el tooltip abierto cerraba también el editor

Corrección: el Tooltip registra un `keydown` en fase de captura sobre `document` solo mientras está abierto. Si la tecla es Escape, hace `stopPropagation()` y cierra el globo. Así el listener de bubble de BottomSheetModal no recibe el evento. Con el globo cerrado, Escape vuelve a llegar a BottomSheetModal y cierra la hoja. Se eliminó el `onKeyDown` del botón (queda cubierto también el caso de apertura por puntero con foco en otro elemento).

### R12-5: el 409 de confirmación mostraba error y diálogo a la vez

Causa: `sileo.promise` muestra su notificación de error ante cualquier rechazo, y su API no permite silenciar un rechazo concreto (`SileoPromiseOptions.error` siempre muestra).

Corrección (desviación consciente del patrón `sileo.promise`): `persist` usa `sileo.show({ type: "loading" })` para la carga, `sileo.dismiss` al terminar, `sileo.success` si guarda, y `sileo.error` solo para errores que no son la confirmación. Ante `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` abre el diálogo y no emite notificación. Las claves i18n no cambian (`saveLoading`, `saveSuccess`, `saveError`, y la descripción por código con `resolveAvailabilityErrorKey`). Todo sigue en sileo.

Si el Orchestrator prefiere mantener `sileo.promise` a costa de que el 409 muestre error, eso es una decisión de producto, no la tomé.

### R12-6: Guardar se volvía a habilitar entre el PUT exitoso y el cierre

Corrección: en el camino de éxito, `setIsSaving(false)` ya no se llama antes de `onSaved`. Se hace en un `finally` después de `await onSaved(response)` y `onClose()`. En error, `isSaving` se libera antes de mostrar el error o abrir el diálogo, como antes.

Verificado en código: `close` del editor (`useAvailabilityEditor.ts` ~251-258) pone `availabilityVersion` a `null` de forma síncrona. Durante la animación de salida de 260 ms, `requestSave` no envía PUT porque `expectedVersion` es `null`, así que no queda una ventana con versión vieja.

## 3. Comandos y resultados

| Comando | Resultado |
|---|---|
| `npx vitest run` sobre los 9 archivos tocados y nuevos (reschedule, save, bottom-sheet, tooltip, month-detail-view, affected-dialog, editor-modal, discard-confirm, admin-month-detail-page) | Tras las correcciones, el único fallo fue la línea base "disables schedule CTA when month is inactive". |
| `npx vitest run tests/components/admin tests/hooks/admin/months tests/lib/admin tests/app/admin-month-detail-page.test.tsx` (final) | **5 failed | 279 passed (284)**. Los 5 fallos son la línea base: AppointmentLogsView, ClientsCatalogView, ReminderAppointmentsCard, MonthDetailView "disables schedule CTA when month is inactive", useRescheduleWhatsappAction. Sin fallos nuevos. |
| `npx tsc --noEmit` | 32 errores, todos en `tests/` (línea base). Ninguno en código de la app. |
| `npx eslint` sobre los 9 archivos tocados (código y pruebas) | exit 0. |
| `npm run lint:admin-i18n` | 0 errores. 1 aviso preexistente en `hooks/admin/useReminderAppointments.ts` (`DashboardReminderType` sin usar), archivo no tocado. |

Durante el trabajo aparecieron dos fallos intermedios que corregí antes de la ejecución final: (a) MonthDetailView ya tenía una memo `editingAppointment` y yo había duplicado la variable (error de esbuild, el archivo no cargaba); (b) los mocks de sileo de tres pruebas no tenían `show`/`dismiss`/`success`. Ambos quedaron corregidos.

## 4. Evidencia de mutación (cada prueba falla sin la corrección)

Método: copia de seguridad de los tres archivos de código en el scratchpad, reversión temporal de la corrección con un reemplazo exacto (el script aborta si el ancla no es única), ejecución de la prueba discriminante y restauración desde la copia. Tras las cuatro mutaciones, `cmp` confirmó que los archivos quedaron idénticos a la versión corregida.

| Hallazgo | Mutación (comportamiento previo) | Prueba discriminante | Resultado |
|---|---|---|---|
| R12-1 | `pickEditTimeSlot` devuelve siempre `slots[0]` | `use-reschedule-time-slots.test.ts` > "preselects the appointment's current time..." | **FALLA** (`09:00` en lugar de `10:00`). Un segundo caso ("clears the selection when editing stops") también falla por la misma dependencia. |
| R12-2 | Se elimina `event.stopPropagation()` del listener del Tooltip | `bottom-sheet-modal.test.tsx` > "lets Escape close only an open tooltip..." | **FALLA** (onClose se llama en el primer Escape). Las 4 pruebas previas de BottomSheetModal siguen en verde. |
| R12-5 | Se emite `sileo.error` antes de comprobar la confirmación (comportamiento previo) | `use-availability-save.test.ts` > "opens the confirmation... after the preview" y "maps a version conflict..." | **FALLA** (2 pruebas). |
| R12-6 | `setIsSaving(false)` antes de `onSaved` (comportamiento previo) | `use-availability-save.test.ts` > "keeps busy until the close completes..." | **FALLA** (un segundo `requestSave` llama a preview otra vez). |

Las cuatro correcciones están activas en la versión final; las pruebas pasan con ellas (ver sección 3).

## 5. Estático, ejecutado y pendiente

Verificado estáticamente (lectura de código, sin ejecución):
- Causa de R12-1 y de R12-5 (el diseño de `sileo.promise` y su error option).
- Cierre del editor pone la versión a `null` (ventana de R12-6 cubierta).
- Ningún cambio en rutas, shapes de API, ni en el flujo público (D18/D79 intactos: cancelar sigue sin escribir, confirmar reenvía `confirmAffectedAppointments: true`, comprobado en la prueba de confirmación del diálogo afectado).

Verificado ejecutando:
- Pruebas de los archivos listados en la sección 3 y mutaciones de la sección 4.
- tsc, eslint, lint:admin-i18n (sección 3).

Pendiente o no verificado:
- R12-1 se verificó a nivel de hook (la selección que se envía en Guardar). No hay prueba de componente que haga clic en Guardar sobre MonthDetailView. Verificación manual pendiente: abrir una cita a las 10:00 con la agenda que ofrece 09:00/10:00/14:00 y pulsar Guardar sin tocar.
- R12-2 en navegador real (Escape con el foco en el icono de ayuda y con apertura por puntero) queda pendiente de verificación manual.
- R12-5 y R12-6 en UI real: que el toast de carga aparezca y desaparezca correctamente con `sileo.show`/`dismiss` (sileo no se ejecutó en un navegador) queda pendiente de verificación manual.

## 6. Documentation Impact

- `docs/specification.md`: NO se actualizó (fuera de los archivos autorizados). Requiere actualización por el Orchestrator o en otra ronda. Secciones afectadas: flujo de reagendado desde la agenda del día (preselección de la hora actual, carga sin selección), comportamiento de Escape en tooltips dentro de modales, y guardado de disponibilidad (409 de confirmación sin notificación de error, ocupado hasta el cierre).
- `docs/features/*.md` y `docs/architecture/business-rules.md`: sin cambio de reglas de negocio; el reagendado y el guardado cambian solo en la UI de conflicto y selección. Revisar si la documentación del flujo menciona la notificación de error del 409.

Flow Contract Check (cambio de comportamiento UI, no de pasos del flujo):
- UI steps updated: No (no cambia el orden de pasos; solo la selección por defecto y las notificaciones).
- API contract updated: No (sin cambios).
- Validation rules updated: No.
- Acceptance criteria updated: No (pendiente en la spec).
- docs/specification.md aligned: No (pendiente, ver arriba).

Migration Compatibility Check: no aplica (sin cambios de modelo ni de datos).

## 7. Admin UI Check

- Uses components/admin/ui: Yes (Tooltip y BottomSheetModal existentes; sin componentes nuevos).
- Reused existing components: Yes.
- New reusable components created: No.
- Tokens respected: Yes (sin estilos nuevos; solo cambia lógica).
- design-system.md aligned: Yes (sin cambios visuales).
- Public flow untouched: Yes (sin archivos de `components/booking/**`, `hooks/booking` ni rutas públicas).

Notification Contract Check:
- Sileo used for success/warning/error/info: Yes.
- Sileo action notifications used when applicable: N/A.
- Sileo promise notifications used when applicable: No en este hook. Desviación justificada en la sección 2 (R12-5): `sileo.promise` no puede suprimir el error del 409 de confirmación. Se usan `sileo.show` (tipo loading), `dismiss`, `success` y `error`.
- i18n applied in admin notifications: Yes (`t(...)` en todos los textos).
- Alternative notification systems introduced: No.

## 8. Limitaciones y decisiones para el Orchestrator

1. R12-1: el comportamiento de recargas de la primera versión de esta sección queda reemplazado por la decisión del owner D103 (ver sección 9).
2. R12-5: la desviación de `sileo.promise` es consecuencia de la API de sileo 0.1.5 (ver sección 2).
3. R12-2: al abrirse por puntero sin foco en el icono, Escape también cierra solo el tooltip (el listener es de document). Es el comportamiento que documenta el componente ("cierra con blur, Escape o salida del puntero").
4. No se tocaron R12-3, R12-4 ni R12-7 a R12-12.

## 9. Refinamiento de R12-1 por decisión del owner (D103)

Decisión del owner (D103), comunicada por el Orchestrator tras la entrega de la sección 1-8: al recargarse la agenda mientras se reagenda, se conserva la elección explícita del usuario si el servidor sigue ofreciéndola; si ya no está, vuelve a la hora actual de la cita (si se ofrece), si no a la primera, si no a "". La preselección de la primera carga sigue siendo la hora actual. Cambiar de cita o cerrar el modal reinicia la elección.

Implementación (solo `hooks/admin/months/useRescheduleTimeSlots.ts` y `tests/hooks/admin/months/use-reschedule-time-slots.test.ts`; `MonthDetailView.tsx` no cambió):
- La elección explícita se guarda en una ref. Solo la escribe el setter devuelto `setEditTimeSlot`, que es el que usa el `onChange` del select. Los valores por defecto del efecto no la escriben, así que se distingue "el usuario eligió" de "valor por defecto".
- Al llegar cada lista: si la elección existe y sigue ofrecida, se conserva; si no, se descarta (la ref pasa a `null`, para que una recarga posterior no la restaure) y se aplica el valor por defecto (hora actual si se ofrece, si no la primera, si no "").
- Un efecto con dependencias `[excludeAppointmentId, isEditing]` descarta la elección, la lista y la selección al cambiar de cita o al cerrar.
- El efecto de carga ya no vacía la selección al empezar una recarga, así la selección visible no parpadea mientras se recarga. Sigue vacía durante la primera carga porque el reinicio la vacía al abrir.

Pruebas (tests/hooks/admin/months/use-reschedule-time-slots.test.ts, 8 pruebas en verde):
- (a) elección sigue ofrecida tras recarga -> se conserva (14:00).
- (b) elección ya no ofrecida -> vuelve a la hora actual (10:00), y una recarga posterior que la vuelve a ofrecer no la restaura.
- (c) cambio de cita -> se reinicia (09:00, la hora actual de la otra cita).
- (d) cerrar y reabrir -> se reinicia (10:00).
- Las 4 pruebas previas (preselección, primera hora, vacío en carga, limpieza al cerrar) siguen en verde.

Evidencia de mutación (la corrección se revierte temporalmente, se ejecuta el archivo de pruebas, se restaura y `cmp` confirma la copia exacta):

| Mutación | Prueba que falla |
|---|---|
| (a) la recarga ignora la elección (`keptChoice = null`) | "keeps the user's explicit choice after an agenda reload..." (1 fallo) |
| (b) elección no ofrecida se conserva (`keptChoice = choice`) | "returns to the current time when the chosen time is no longer offered..." (1 fallo) |
| (b2) elección no ofrecida no se descarta (`userChoiceRef.current = choice`) | la misma prueba de (b), en el tercer paso de recarga (1 fallo) |
| (c,d) sin reinicio al cambiar de cita o cerrar | "discards the user's choice when switching to another appointment" y "...when the edit is closed and reopened" (2 fallos) |

Tras restaurar: 8/8 en verde.

Ejecutado en este refinamiento:
- `npx vitest run tests/components/admin tests/hooks/admin/months tests/lib/admin tests/app/admin-month-detail-page.test.tsx`: 5 fallos, 283 pasan (288). Los 5 son la línea base (AppointmentLogsView, ClientsCatalogView, MonthDetailView "disables schedule CTA when month is inactive", ReminderAppointmentsCard, useRescheduleWhatsappAction). Sin fallos nuevos.
- `npx tsc --noEmit`: 32 errores, todos en tests/ (línea base).
- `npx eslint` sobre el hook, su prueba y MonthDetailView: exit 0.
- `npm run lint:admin-i18n`: 0 errores, 1 aviso preexistente en `hooks/admin/useReminderAppointments.ts`.

Pendiente: la verificación manual del reagendado en navegador (recarga de la agenda con elección del usuario) no se ha ejecutado. No hay prueba de componente que haga clic en Guardar tras una recarga.

Documentation Impact (actualizado): la decisión D103 añade a `docs/specification.md` (flujo de reagendado) que la elección del usuario se conserva en recargas mientras siga ofrecida. Sigue pendiente la actualización de la spec, fuera de los archivos autorizados.

## 10. Corrección R14-1 (cambio de día durante la carga de la agenda)

Hallazgo del Reviewer (ciclo 2 de 3, `round-14-phase2-ui-reviewer-r1.md`, sección 3 / R14-1, blocking): al cambiar la fecha mientras carga la agenda del día nuevo, la hora y la lista del día anterior seguían visibles y Guardar enviaba una hora no confirmada por el servidor para el día nuevo (PATCH `{"date":"2099-03-03","timeSlot":"10:00"}` antes de que llegara la agenda). Contradice D103.

Decisión del owner D104 (comunicada por el Orchestrator): al cambiar de día, la lista y la selección visible se vacían; la elección explícita NO se descarta, y se restaura al llegar la lista del día nuevo si lo ofrece. Si no, hora actual de la cita si se ofrece, si no la primera, si no "". Las recargas de la misma fecha siguen sin parpadeo (D103).

Cambios (solo los autorizados):
- `hooks/admin/months/useRescheduleTimeSlots.ts`: un ref `loadedDateRef` guarda la fecha de la última lista válida mostrada.
  - Al empezar una carga con una fecha distinta de esa, se vacían la lista y la selección. No se toca `userChoiceRef` (D104).
  - Al llegar la lista, una recarga de la misma fecha aplica D103 (descarta la elección si ya no se ofrece). Un cambio de día no la descarta: si el día nuevo no la ofrece, se usa el valor por defecto, y la elección sigue viva para cuando se vuelva a un día que la ofrezca.
  - El efecto de reinicio por cita o cierre también vacía `loadedDateRef`.
  - Errores de carga vacían `loadedDateRef`.
- `components/admin/months/MonthDetailView.tsx` (mínimo): el botón Guardar del reagendado recibe `disabled={!editTimeSlot}`. Ya no hace falta exponer `isLoadingSlots`, porque una selección vacía equivale a "sin horario confirmado". El handler ya no enviaba con selección vacía (`if (!editDate || !editTimeSlot) return;`), así que el `disabled` es solo estado visible del botón.

Pruebas añadidas:
- Hook (`tests/hooks/admin/months/use-reschedule-time-slots.test.ts`, 11 pruebas en verde):
  - cambio de día con la agenda pendiente: lista y selección vacías hasta que llega; la elección 14:00 se restaura si el día nuevo la ofrece.
  - el día nuevo no la ofrece: vuelve a la hora actual (10:00); al volver al día original, la elección 14:00 se restaura.
  - recarga de la misma fecha con respuesta pendiente: lista y selección se conservan.
- Componente (`tests/components/admin/months/month-detail-view.test.tsx`, prueba "does not reschedule to a new date before its agenda loads, and sends the confirmed time afterwards"):
  - tras cambiar la fecha, Guardar está deshabilitado y pulsarlo no envía PATCH;
  - al llegar la agenda del día nuevo (09:00 y 14:00, sin 10:00), el select muestra 09:00 y Guardar envía `{"month":"2099-03","date":"2099-03-03","timeSlot":"09:00"}`.
  - Los selects de fecha y hora se localizan por rol `combobox`, porque el `<label>` de "Fecha" en MonthDetailView no está asociado a su select.

Evidencia de mutación (corrección revertida temporalmente sobre una copia de seguridad, prueba ejecutada, archivo restaurado; `cmp` confirmó la copia exacta):

| Mutación | Prueba que falla |
|---|---|
| MH1: sin vaciado al cambiar de día | "empties the list and the selection while a new day loads..." (hook) |
| MC1: la misma mutación, ejecutada con la prueba de componente | "does not reschedule to a new date before its agenda loads..." (1 fallo; la salida no desglosa en qué aserción) |
| MH2: vaciado también en recarga de la misma fecha | "keeps the list and the selection during a reload of the same date" (hook) |
| MH3: la elección se descarta al cambiar de día (rompe D104) | "empties the list..." y "falls back to the current time..." (hook, 2 fallos) |

Tras restaurar el hook, las 11 pruebas del hook y la prueba de componente pasan (la suite completa está en el punto siguiente).

Ejecutado en esta corrección:
- `npx vitest run tests/components/admin tests/hooks/admin/months tests/lib/admin tests/app/admin-month-detail-page.test.tsx`: 5 fallos, 287 pasan (292). Los 5 son la línea base (AppointmentLogsView, ClientsCatalogView, MonthDetailView "disables schedule CTA when month is inactive", ReminderAppointmentsCard, useRescheduleWhatsappAction). Sin fallos nuevos.
- `npx tsc --noEmit`: 32 errores, todos en tests/ (línea base).
- `npx eslint` sobre el hook, su prueba, MonthDetailView y su prueba: exit 0.
- `npm run lint:admin-i18n`: 0 errores, 1 aviso preexistente en `hooks/admin/useReminderAppointments.ts`.

Hallazgo preexistente observado, no corregido (fuera de alcance): `handleReschedule` en MonthDetailView no captura el error de `rescheduleAdminAppointmentById` (solo `try/finally`), y se llama con `void`, así que un 409 deja una promesa rechazada sin manejar. El usuario ve el toast de error de sileo; la consola muestra el rechazo no manejado. Lo reporto para decisión del Orchestrator.

Pendiente: verificación manual en navegador del cambio de día durante la carga. No se ha ejecutado. docs/specification.md sigue sin actualizar (D104 y D103 deben figurar en el flujo de reagendado).
