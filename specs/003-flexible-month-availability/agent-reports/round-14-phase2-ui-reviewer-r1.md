# Ronda 14: re-revisión (ciclo 2) de Fase 2 (UI admin), Reviewer high-risk

**Spec**: 003-flexible-month-availability | **Modo**: auditoría (no se modificó código ni documentación; las pruebas temporales se hicieron en una copia del árbol de trabajo en el scratchpad) | **Rama**: `003-flexible-month-availability`, sin commits | **Fecha**: 2026-10-31

**Alcance**: correcciones de R12-1 (con el refinamiento D103), R12-2, R12-5 (D102) y R12-6, según `round-13-review-fixes-developer.md`. Archivos: `hooks/admin/months/useRescheduleTimeSlots.ts`, `components/admin/months/MonthDetailView.tsx` (selección movida al hook), `components/admin/ui/Tooltip.tsx`, `hooks/admin/months/useAvailabilitySave.ts` y sus pruebas. Fuera de alcance: R12-3, R12-4, R12-7 a R12-12.

## 1. Veredicto

**Rejected.** Hay 1 hallazgo `blocking` (R14-1): cuando cambia el día mientras se carga la agenda de reagendado, la hora y la lista del día anterior se conservan visibles, y Guardar reagenda con esa hora a la fecha nueva antes de que el servidor confirme los horarios. Esto contradice la regla de D103 ("Guardar no reagenda sin horarios del servidor") y el alcance pedido para esta pasada (cambio de día durante la carga). La corrección es pequeña y está acotada en la sección 4.

Las correcciones de R12-1 (caso original y refinamiento), R12-2, R12-5 y R12-6 resuelven sus escenarios. Las mutaciones muestran que las pruebas del Developer discriminan en 6 de 7 casos; la excepción es un hueco de prueba (R14-2, `non-blocking`).

## 2. Comandos ejecutados

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx vitest run tests/components/admin tests/hooks/admin/months tests/lib/admin tests/app/admin-month-detail-page.test.tsx` | 52 archivos: 47 pasan, 5 fallan. 288 pruebas: 283 pasan, 5 fallan. Los 5 fallos son la línea base exacta: AppointmentLogsView, ClientsCatalogView, MonthDetailView "disables schedule CTA when month is inactive", ReminderAppointmentsCard, useRescheduleWhatsappAction. Log: `.../scratchpad/r14-vitest.log` |
| 2 | `npx tsc --noEmit` | 32 errores, todos en `tests/` (línea base). Ninguno en código de producción. |
| 3 | `npx eslint` sobre los 9 archivos tocados (código y pruebas) | exit 0 |
| 4 | `npm run lint:admin-i18n` | exit 0; 0 errores; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` |
| 5 | Prueba temporal A (componente, copia): cita a las 10:00 con 09:00/10:00/14:00 ofrecidos; Editar cita; Guardar | **Pasa.** El select queda en 10:00 y el PATCH de reagendado envía `timeSlot: "10:00"`. |
| 6 | Prueba temporal B (componente/unidad, copia): Escape con tooltip abierto dentro de `BottomSheetModal` | **Pasa.** Primer Escape: `onClose` 0 veces, el tooltip se oculta. Segundo Escape: `onClose` 1 vez. Escape con tooltip cerrado cierra la hoja. |
| 7 | Prueba temporal C (hook, copia): cambio de día con la respuesta del día nuevo pendiente | **Falla (reproduce R14-1).** Durante la carga: lista del día A y selección "10:00". |
| 8 | Prueba temporal C2 (componente, copia): cambio de fecha con la agenda del día nuevo pendiente; Guardar | **Falla (reproduce R14-1).** Select de fecha 2099-03-03; select de hora 10:00 con las opciones del día A; PATCH `{"date":"2099-03-03","timeSlot":"10:00"}` enviado sin respuesta del servidor. En HEAD (copia) el mismo escenario también envía PATCH, con 09:00 de la rejilla base. |
| 9 | Prueba temporal D (hook, copia): respuestas fuera de orden (A, luego B, luego C; C responde primero, B después) | **Pasa.** Resultado final: lista y selección del día C. |
| 10 | Prueba temporal E (hook, copia): cambio de cita con la respuesta de la cita anterior llegando tarde | **Pasa.** Resultado final: lista y selección de la cita nueva. |
| 11 | Prueba temporal F (hook, copia): ciclo de vida de los toasts y estado ocupado (5 casos) | **Pasa.** Éxito: 1 `show` de carga, 1 `dismiss`, 1 `success`, 0 `error`, cierre del editor. 409 de confirmación: `dismiss` de la carga, 0 `error`, diálogo abierto. Cancelar el diálogo: ningún toast, ocupado liberado. Error del PUT (no 409): `dismiss`, 1 `error`, ocupado liberado, editor abierto. `onSaved` lanza: ocupado liberado, `onClose` no se llama. |
| 12 | Mutaciones sobre código de producción, en la copia del scratchpad (cada una se restauró y se comparó con `cmp` contra el repositorio) | Ver sección 5. |

Pruebas temporales: los archivos `tmp-r14-*` se crearon solo en la copia del scratchpad. En el repositorio `find tests -name 'tmp-r1*'` devuelve 0. El único archivo nuevo del Reviewer en el repositorio es este informe. `tsc` volvió a reescribir `tsconfig.tsbuildinfo`, que ya estaba modificado.

**No ejecuté**: suite completa (la fase no cierra en esta pasada); `next build`; navegador real (toast de sileo, tap y layout); lector de pantalla; las mutaciones del Modal de citas afectadas con tooltip abierto (solo razonamiento estático, ver R14-5).

## 3. Verificaciones que pasan

- **R12-1, caso original (escenario A).** La hora actual de la cita se preselecciona si el servidor la ofrece. Guardar envía esa hora (componente y hook).
- **R12-1, refinamiento D103 (recarga de la misma fecha).** La elección explícita se conserva si sigue ofrecida; si no, vuelve a la hora actual; si tampoco, a la primera; si no hay ninguna, "". La elección descartada no vuelve en una recarga posterior. Cambiar de cita o cerrar reinicia la elección (prueba temporal E y pruebas del Developer).
- **Respuestas fuera de orden.** El `AbortController` cancela la carga anterior; la guarda `signal.aborted` impide que la respuesta tardía sobrescriba (escenarios D y E). La guarda es discriminante: sin ella, la prueba D falla (mutación M8).
- **R12-2.** El listener de captura de `document` solo existe mientras el globo está abierto (`Tooltip.tsx:29-46`, `useEffect` con dependencia `[isOpen]` y limpieza). Escape con el globo abierto lo consume; con el globo cerrado, Escape llega a la hoja. Las mutaciones M3 y M4 lo confirman.
- **R12-5 (D102).** Ningún `sileo.error` en el 409 de confirmación; el toast de carga se cierra en todos los caminos de `persist` (éxito, error, 409) y la cancelación del diálogo no muestra toast. Notificaciones solo con sileo (`show`, `dismiss`, `success`, `error`) y textos con `t()`. La API de sileo 0.1.5 coincide (`show` devuelve `string`, `dismiss(id)`, `loading` es un estado válido; `node_modules/sileo/dist/index.d.ts`).
- **R12-6.** Guardar sigue deshabilitado hasta que `onSaved` y `onClose` terminan (`finally`). Si `onSaved` lanza, `isSaving` se libera igualmente (escenario F5). Con la versión a `null` tras cerrar, un segundo guardado no envía PUT.

## 4. Hallazgos

### R14-1 `blocking`. Cambio de día durante la carga: se conserva la hora y la lista del día anterior, y Guardar envía una hora no confirmada

- **Archivos**: `hooks/admin/months/useRescheduleTimeSlots.ts:52-57` (el efecto de carga no vacía la lista ni la selección cuando cambia `editDate`; solo las vacía con `!isEditing || !editDate`) y `:70` (la selección de la respuesta anterior sigue activa). `components/admin/months/MonthDetailView.tsx:1258` (`onChange={setEditDate}`), `:1269` (`onChange={setEditTimeSlot}`), `:1274-1280` (el botón Guardar no tiene `disabled` durante la carga) y `:497` (`handleReschedule` solo comprueba que `editTimeSlot` no esté vacío).
- **Escenario reproducido**: el admin abre "Editar cita" de una cita a las 10:00. La agenda de 2099-03-02 ofrece 09:00, 10:00 y 14:00. Cambia la fecha a 2099-03-03 y pulsa Guardar antes de que llegue la agenda del 03. El select de fecha muestra 03, el de hora sigue en 10:00 con las opciones del día 02, y el PATCH envía `{"date":"2099-03-03","timeSlot":"10:00"}`. Prueba C2 (componente) y prueba C (hook).
- **Por qué es blocking**: D103 dice que la primera carga deja la selección vacía porque "Guardar no reagenda sin horarios del servidor". La selección que se muestra en la carga de un día nuevo no está confirmada por el servidor para ese día, así que incumple esa regla. El Developer afirma en la sección 2 de su informe que "al iniciar cada carga la selección queda vacía", y eso es falso para el cambio de día. Las pruebas de la sección 9 del Developer solo cubren recargas de la misma fecha.
- **Contexto**: HEAD tiene el mismo hueco (prueba C2 en la copia de HEAD envía 09:00 de la rejilla base). No lo introdujo esta ronda, pero esta ronda tenía que cubrirlo (cambio de día durante la carga) y el informe lo da por resuelto. Si el owner decide que un cambio de día puede mostrar y guardar la selección anterior hasta la respuesta, pasa a `non-blocking`. Esa decisión es del owner, no del Reviewer.
- **Corrección requerida**:
  1. En el efecto de carga de `useRescheduleTimeSlots`, cuando `editDate` sea distinto del día cuya lista se muestra (guardar ese día en una ref que se actualiza en la respuesta válida), vaciar `availableEditSlots` y `editTimeSlot` al empezar la carga. No tocar `userChoiceRef`: si el día nuevo ofrece la elección explícita, debe restaurarse al llegar la lista (D103). Las recargas de la misma fecha conservan el comportamiento actual.
  2. Opcional, recomendable: deshabilitar Guardar del reagendado mientras la lista carga (requiere exponer `isLoading` desde el hook).
  3. Pruebas: hook (cambio de día con respuesta pendiente: selección y lista vacías durante la carga; tras la carga, la elección se restaura solo si se ofrece) y componente (Guardar no envía PATCH mientras carga el día nuevo). Las pruebas temporales C y C2 de la copia sirven de base.

### R14-2 `non-blocking`. Hueco de pruebas: el toast de carga del 409 y el ciclo del éxito no se afirman

- **Archivo**: `tests/hooks/admin/months/use-availability-save.test.ts`, prueba "opens the confirmation ... after the preview" (líneas 161-177) y pruebas de guardado directo.
- **Escenario**: mutación M5 (se quita el `sileo.dismiss(loadingToastId)` del camino del 409 y se añade solo al camino de error no 409). Las 8 pruebas pasan. Un toast de carga que no se cierra en el 409 quedaría huérfano sin que el test lo detecte. El código actual sí lo cierra (prueba F2).
- **Corrección**: en la prueba del 409, afirmar `expect(sileoMock.dismiss).toHaveBeenCalledWith("loading-toast")`; en la prueba de guardado directo, afirmar `show` 1, `dismiss` con el id, `success` 1.

### R14-3 `non-blocking`. Si `onSaved` lanza tras un guardado correcto, el error sale sin control

- **Archivo**: `hooks/admin/months/useAvailabilitySave.ts:102-107`. El `try/finally` libera `isSaving`, pero no captura el error: se propaga a `requestSave`/`confirmSave`, que el botón llama sin `catch` (`AvailabilityEditorModal.tsx:172`). Tras el toast de éxito, el editor queda abierto con la versión vieja y el siguiente guardado recibe `AVAILABILITY_VERSION_CONFLICT`. Hoy `refresh` (`useMonthDetail.ts:20-35`) captura sus errores, así que no ocurre en la práctica (prueba F5).
- **Corrección sugerida**: capturar el error de `onSaved` dentro de `persist` y cerrar el editor igualmente, o documentar que `onSaved` no debe lanzar.

### R14-4 `non-blocking` (pregunta para el Orchestrator). Interpretación de D103 al cambiar de día

- **Archivo**: `useRescheduleTimeSlots.ts:70`. Tras un cambio de día, la hora actual de la cita se prefiere en el día nuevo si se ofrece (la regla literal de D103 es "vuelve a la hora actual de la cita si se ofrece"), aunque la hora actual solo tiene sentido en el día de la cita. Además, una elección explícita hecha en el día A se conserva en el día B si B la ofrece, porque la ref no se reinicia al cambiar de día.
- No es un error de datos: el servidor valida cada reagendado. Pero es una decisión que conviene dejar escrita en la spec. Ver también R14-1, que cambia qué se muestra durante la carga del día nuevo.

### R14-5 `non-blocking` (inalcanzable hoy; documentar). Con el globo abierto, Escape no llega a otros listeners de `document` en burbuja

- **Archivo**: `components/admin/ui/Tooltip.tsx:34-39` (`stopPropagation` en captura sobre `document`). Con el globo abierto, el primer Escape no llega al listener de burbuja del hook de descarte (`useDiscardConfirmDialog.ts:37-49`) ni al de `Modal` (`components/admin/ui/Modal.tsx:46`). Lo confirma la prueba B (contador de listeners de burbuja: 0 en el primer Escape).
- Hoy no ocurre en la interfaz: abrir el diálogo de descarte o el de citas afectadas mueve el foco y el globo se cierra por `blur`, y el ratón no puede pulsar Guardar o Cancelar mientras está sobre el icono. Si en el futuro se abre otro diálogo con el globo abierto, revisar este punto.

### R14-6 `non-blocking`. Pruebas temporales de respuestas fuera de orden y de cambio de cita: incorporarlas al repositorio

- Las pruebas D y E pasan con el código actual y discriminan la guarda de `aborted` (mutación M8). Conviene incorporarlas a `tests/hooks/admin/months/use-reschedule-time-slots.test.ts` junto con la corrección de R14-1.

## 5. Mutaciones (copia del scratchpad, cada archivo restaurado y comparado con `cmp`)

| Mutación | Código alterado | Resultado de las pruebas |
|---|---|---|
| M1 | `pickDefaultEditTimeSlot` devuelve siempre la primera hora | FALLA: 6 pruebas de `use-reschedule-time-slots` |
| M2 | Se descarta la elección explícita (`keptChoice = null`) | FALLA: 1 prueba ("keeps the user's explicit choice...") |
| M3 | El listener de captura del Tooltip se registra siempre (sin `if (!isOpen)`) | FALLA: 1 prueba de `bottom-sheet-modal` (Escape con tooltip) |
| M4 | El listener del Tooltip pasa a fase de burbuja | FALLA: 1 prueba de `bottom-sheet-modal` |
| M5 | Se quita `dismiss` de la carga en el camino del 409 | **PASA (8/8)**: hueco de prueba, R14-2 |
| M6 | Se elimina el `finally` que libera `isSaving` en el éxito | FALLA: 1 prueba ("keeps busy until the close completes...") |
| M7 | Se elimina `setIsSaving(false)` en el camino de error | FALLA: 2 pruebas (version conflict y 409) |
| M8 | Se quita la guarda `signal.aborted` de la respuesta del hook | FALLA: prueba temporal D (fuera de orden) |

## 6. Correcciones requeridas

1. **R14-1 (blocking)**: vaciar la lista y la selección visible al cambiar de día durante la carga, conservando la elección para restaurarla si el día nuevo la ofrece. Añadir pruebas de hook y de componente. Opcional: deshabilitar Guardar mientras carga.
2. **Recomendadas en la misma pasada**: R14-2 (aserciones de toast en el 409 y en el éxito) y R14-6 (incorporar las pruebas D y E).
3. **Decisiones del Orchestrator o del owner**: R14-4 (interpretación de D103 al cambiar de día). Si el owner acepta que un cambio de día muestre la selección anterior durante la carga, R14-1 pasa a `non-blocking`.
4. Pendiente de la pasada anterior y fuera de esta: R12-3 y R12-9 aceptados por el owner (D103); R12-4, R12-7 y R12-8 a R12-12 quedan abiertos según el alcance.

## 7. Riesgos residuales

- Toast de carga de sileo y transiciones: verificados con la API y con las pruebas de su ciclo de vida, no en navegador.
- Layout, tap y lector de pantalla del globo y del diálogo de descarte: no medidos.
- R14-3 y R14-5 (ver arriba). R12-3 aceptado por el owner.
- `refresh` del detalle del mes no lanza hoy (R14-3).

## 8. Qué NO ejecuté

- Suite completa, `next build`, pruebas de integración y e2e (no pedidas o no aplican a esta pasada).
- Navegador real, toast visible de sileo, lector de pantalla y tap en móvil.
- Mutaciones del Modal de citas afectadas con el globo abierto (solo razonamiento, R14-5).
- No verifiqué si `sileo.show` con `type: "loading"` cierra o persiste sin `dismiss` (solo que el código lo cierra en todos los caminos).
