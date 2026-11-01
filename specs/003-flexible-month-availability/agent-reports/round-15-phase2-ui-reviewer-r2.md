# Ronda 15: re-revisión (ciclo 3) de Fase 2 (UI admin), corrección de R14-1, Reviewer high-risk

**Spec**: 003-flexible-month-availability | **Modo**: auditoría (no se modificó código ni documentación; las pruebas temporales y las mutaciones se hicieron en una copia del árbol de trabajo en el scratchpad) | **Rama**: `003-flexible-month-availability`, sin commits | **Fecha**: 2026-10-31

**Alcance**: corrección de R14-1 (cambio de día durante la carga) según `round-13-review-fixes-developer.md`, sección 10: `hooks/admin/months/useRescheduleTimeSlots.ts` (`loadedDateRef`, vaciado al cambiar de día, `userChoiceRef` intacto), `components/admin/months/MonthDetailView.tsx` (Guardar con `disabled={!editTimeSlot}`) y sus pruebas. Decisiones del owner respetadas: D103 y D104. R14-2, R14-3, R14-5 y R14-6 quedan abiertos como `non-blocking` por decisión del owner y no se reportan de nuevo.

## 1. Veredicto

**Approved.** No hay hallazgos `blocking`.

La corrección de R14-1 resuelve el escenario: durante la carga del día nuevo, la lista y la selección quedan vacías, Guardar está deshabilitado y no sale PATCH. Al llegar la agenda, la elección explícita se restaura si el día nuevo la ofrece (D104). Las mutaciones propias fallan en las pruebas del Developer en los cinco casos previstos.

Quedan 4 hallazgos `non-blocking` nuevos (sección 4): accesibilidad del botón deshabilitado durante la carga (R15-1, pedido por el Orchestrator en el punto 4), un hueco de prueba del primer arranque en componente (R15-2), un detalle de un frame antes de limpiar (R15-3) y un error preexistente de `handleReschedule` (R15-4).

## 2. Comandos ejecutados

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx vitest run tests/components/admin tests/hooks/admin/months tests/lib/admin tests/app/admin-month-detail-page.test.tsx` | 52 archivos: 47 pasan, 5 fallan. 292 pruebas: 287 pasan, 5 fallan. Los 5 son la línea base exacta: AppointmentLogsView, ClientsCatalogView, MonthDetailView "disables schedule CTA when month is inactive", ReminderAppointmentsCard, useRescheduleWhatsappAction. Log: `.../scratchpad/r15-vitest.log` |
| 2 | `npx tsc --noEmit` | 32 errores, todos en `tests/` (0 fuera de `tests/`). |
| 3 | `npx eslint hooks/admin/months/useRescheduleTimeSlots.ts components/admin/months/MonthDetailView.tsx` y sus dos pruebas | exit 0 |
| 4 | `npm run lint:admin-i18n` | exit 0; 0 errores; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` |

Pruebas temporales (copia en `.../scratchpad/r15`, no en el repositorio):

| Prueba | Resultado |
|---|---|
| C (hook): cambio de día con la agenda pendiente. Durante la carga, lista `[]` y selección `""`; con la respuesta, la elección 14:00 se restaura si la ofrece | **Pasa** |
| C2 (hook): cambio rápido A→B→A con B pendiente. B se aborta; la lista de A se restaura sin datos de B; B tardía no sobrescribe | **Pasa** |
| D (hook): respuestas fuera de orden A→B→C; la respuesta tardía de B no sobrescribe C | **Pasa** |
| E (hook): cambio de cita con respuesta tardía de la cita anterior | **Pasa** |
| F (hook): error de carga del día nuevo deja la selección en `""` | **Pasa** |
| C2 (componente, tu prueba temporal): cambio de fecha con la agenda pendiente; select de hora sin opciones del día anterior; Guardar sin PATCH | **Pasa**. El select de hora muestra `[""]` (placeholder) durante la carga. |

Mutaciones propias (cada archivo restaurado y comparado con `cmp` contra el repositorio: idénticos):

| Mutación | Pruebas que fallan |
|---|---|
| MH1: no se vacía la lista ni la selección al cambiar de día | 1 de componente ("does not reschedule to a new date...") y 1 de hook ("empties the list and the selection...") |
| MH2: se vacía también en recarga de la misma fecha | 1 de hook ("keeps the list and the selection during a reload of the same date") |
| MH3: se descarta la elección al cambiar de día (rompe D104) | 2 de hook ("empties the list..." y "falls back to the current time...") |
| MH4: nunca se marca la fecha como cargada (`loadedDateRef`) | 2 de hook ("keeps the list..." y "returns to the current time...") |
| MC1: Guardar sin `disabled={!editTimeSlot}` | 1 de componente ("does not reschedule to a new date...") |

**No ejecuté**: suite completa; `next build`; integración y e2e; navegador real (la carga visual, el parpadeo de un frame y el comportamiento de `disabled` en pantalla); lector de pantalla; las mutaciones de la sección 4 de R15-4 (solo lectura de código).

Pruebas temporales: los archivos `tmp-r15-*` y `tmp-r14-*` están solo en la copia del scratchpad. En el repositorio `find tests -name 'tmp-r1*'` devuelve 0. El único archivo nuevo del Reviewer en el repositorio es este informe. `tsc` volvió a reescribir `tsconfig.tsbuildinfo`, que ya estaba modificado.

## 3. Verificaciones que pasan

- **R14-1, escenario original.** Cambio de fecha con la agenda pendiente: Guardar deshabilitado, sin PATCH, y al llegar la agenda del día nuevo el select muestra la hora confirmada (prueba de componente) y Guardar envía esa fecha y hora (prueba de componente).
- **D104.** La elección explícita se conserva al cambiar de día si el día nuevo la ofrece (C, C2); si no la ofrece, se usa el valor por defecto y la elección sigue viva para volver a un día que la ofrezca (prueba "falls back...").
- **D103.** Recarga de la misma fecha: lista y selección se conservan sin parpadeo durante la recarga (prueba "keeps the list and the selection during a reload..."); si la elección ya no se ofrece, se descarta y no vuelve.
- **Respuestas fuera de orden y cambio rápido.** D, E y C2 pasan; la guarda `aborted` es discriminante (en la ronda anterior, M8).
- **Cambio de cita y cierre del modal.** Reinician `loadedDateRef` y la elección; cubiertos por las pruebas "discards the user's choice when switching..." y "...when the edit is closed and reopened", y "clears the selection when editing stops". Pasan.
- **Error de carga.** `catch` vacía la lista, la selección y `loadedDateRef` (prueba F). El siguiente cambio de día o recarga trata la fecha como primera carga.
- **Guardar del reagendado.** `disabled={!editTimeSlot}` (`MonthDetailView.tsx:1276`) es el único uso relevante: `handleReschedule` solo se llama desde ese botón (`:1278`), y el handler ya comprobaba `!editTimeSlot` (`:497`). Los demás `disabled={!…}` del archivo (`:1009`, `:1223`, `:1362`) dependen de otras condiciones y no se ven afectados. Otras vías de creación o bloqueo usan otros estados y no pasan por este hook.

## 4. Hallazgos

Sin hallazgos `blocking`.

### R15-1 `non-blocking`. Accesibilidad: Guardar deshabilitado y select de hora sin texto de carga

- **Archivos**: `components/admin/months/MonthDetailView.tsx:1267-1276`. El select de hora usa `showPlaceholder={timeSlotOptions.length === 0}`, así que durante la carga muestra solo el placeholder "Seleccionar" (`common.selectPlaceholder`). El botón Guardar queda deshabilitado sin texto explicativo ni `aria-describedby`. La clave `monthsDetail.dayModal.loading` ("Cargando agenda...") existe, pero solo se usa para la agenda del día, no para la lista de horas del reagendado (`:1141`). No hay `aria-busy` ni región `role="status"` en el bloque.
- **Efecto**: un usuario de lector de pantalla o que no ve el cambio de estado no sabe por qué Guardar no responde durante la carga, ni que la lista de horas está pendiente.
- **Por qué no es blocking**: el Orchestrator indicó que un botón deshabilitado sin explicación es `non-blocking` si la lista no muestra su carga. Antes de esta corrección, el botón no estaba deshabilitado y Guardar no hacía nada (`handleReschedule` salía en silencio), así que esta corrección no empeora el caso.
- **Corrección sugerida**: mostrar un texto de carga junto al select de hora (la clave `monthsDetail.dayModal.loading` o una nueva para horarios), con `role="status"`, y mostrar el texto cuando `availableEditSlots` está vacía mientras `isEditing` es verdadero. Opcional: `aria-describedby` del botón apuntando a ese texto.

### R15-2 `non-blocking`. Hueco de prueba: el primer arranque no se afirma en componente

- **Archivo**: `tests/components/admin/months/month-detail-view.test.tsx`, prueba "does not reschedule to a new date before its agenda loads...". Cubre el cambio de día con la agenda pendiente. El primer arranque (abrir "Editar cita" con la agenda pendiente) solo se afirma a nivel de hook ("keeps the selection empty while loading...").
- **Corrección**: en la misma prueba o en una nueva, afirmar que Guardar está deshabilitado antes de que llegue la primera agenda.

### R15-3 `non-blocking`. Un frame con datos del día anterior en el cambio de día

- **Archivo**: `hooks/admin/months/useRescheduleTimeSlots.ts:66-69`. El vaciado ocurre en `useEffect`, que corre después del pintado. Durante un frame tras cambiar la fecha, el select de hora y su lista pueden mostrar todavía el día anterior. No lo medí en navegador. Mientras dura ese frame, Guardar sigue habilitado con la hora anterior, pero una pulsación en esa ventana es prácticamente imposible. Si se quiere evitar el frame, `useLayoutEffect` o derivar la lista visible comparando `loadedDateRef` durante el render. Se reporta para que quede registrado.

### R15-4 `non-blocking` (preexistente). `handleReschedule` deja un rechazo sin manejar en el error del servidor

- **Archivo**: `components/admin/months/MonthDetailView.tsx:496-535`. `sileo.promise` vuelve a lanzar el error, el bloque solo tiene `try/finally`, y el llamador lo invoca con `void` (`:1277`). Un 409 muestra el toast de error de sileo, pero la promesa queda rechazada sin captura. Lo confirmó el Developer en la sección 10 de su informe. Ya existía en HEAD. No afecta a la corrección de esta ronda.
- **Corrección sugerida**: añadir `catch` vacío tras el `sileo.promise` o capturar el rechazo en el llamador.

## 5. Riesgos residuales

- La ventana de un frame (R15-3) y el texto de carga (R15-1) solo se pueden comprobar en navegador o con un lector de pantalla. No se ejecutaron.
- El comportamiento de D104 (la elección explícita sobrevive al cambio de día) es una decisión del owner. Registrado en R14-4.
- R14-2, R14-3, R14-5 y R14-6: abiertos como `non-blocking` por decisión del owner.
- R12-3 y R12-9: aceptados por el owner (D103).
- Documentación: `docs/specification.md` sigue sin reflejar D103 y D104; lo indica el Developer en su sección 10. Pendiente de T076.

## 6. Qué NO ejecuté

- Suite completa, `next build`, integración, e2e.
- Navegador real: parpadeo de un frame, texto de carga, tap y layout.
- Lector de pantalla.
- Pruebas de regresión fuera de los archivos listados en el alcance.
