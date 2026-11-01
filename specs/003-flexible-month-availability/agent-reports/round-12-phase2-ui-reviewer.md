# Ronda 12: revisión independiente de la Fase 2 (UI admin), Reviewer high-risk

**Spec**: 003-flexible-month-availability | **Modo**: auditoría (no se modificó código ni documentación) | **Rama**: `003-flexible-month-availability`, sin commits | **Fecha**: 2026-10-31

Rondas revisadas: 2A (T040-T046), 2B (T047-T056), 2B-r1 (H1, H2, H7), ronda 10 (ajustes visuales del editor), ronda 11 (overlay de descarte) y ajustes directos del Orchestrator (botón "Seguir editando", textos de "Conservar capacidad").

## 1. Veredicto

**Approved.** No hay hallazgos `blocking`.

Hay 12 hallazgos `non-blocking`. Dos son defectos reales de comportamiento que conviene corregir antes de cerrar la fase: R12-1 (la hora por defecto del reagendado no es la hora actual de la cita) y R12-2 (Escape con el tooltip abierto cierra también el editor). Ninguno pierde datos, rompe un contrato ni bloquea un flujo, por eso no justifican `Rejected`. Decidir si se corrigen en esta fase o se aceptan como carry-forward es del Orchestrator.

## 2. Alcance y método

- Diff de Fase 2: cliente API (`lib/admin/months/api-client.ts`, `lib/admin/appointments/api-client.ts`), hooks (`useAvailabilityEditor`, `useAvailabilitySave`, `useMonthAvailabilityController`, `useRescheduleTimeSlots`, `fetch-day-agenda-slots`, `useDiscardConfirmDialog`, `useBookAppointmentModal`, `useBlockSpacesModal`), componentes del editor (`components/admin/months/availability/*`), `MonthDetailView`, `BlockSpacesModal`, `BookAppointmentModal`, UI compartida (`Input`, `Switch`, `Tooltip`, `TimeSlotChipInput`, `BottomSheetModal`) y locales.
- Fuera de Fase 2: `app/api/my-appointments/reschedule/route.ts` (`LOCK_TIMEOUT` a 409) aparece en el diff, pero es de Fase 1 (1D/1E).
- Lo leí todo en el repositorio y lo ejecuté donde se indica en la sección 3.

## 3. Comandos ejecutados

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx vitest run tests/components/admin tests/hooks/admin/months tests/lib/admin tests/app/admin-month-detail-page.test.tsx tests/lib/availability` | 61 archivos. 388 pruebas pasan, 5 fallan, 1 todo (394). Los 5 fallos son la línea base del brief: `AppointmentLogsView`, `ClientsCatalogView`, `MonthDetailView` "disables schedule CTA when month is inactive", `ReminderAppointmentsCard`, `useRescheduleWhatsappAction`. Log: `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/92ed9b47-cfd9-4d1b-b04d-b113455908c3/scratchpad/r12-vitest.log` |
| 2 | Los 5 archivos con fallo, contra una copia de HEAD (`git archive HEAD` en el scratchpad; el árbol de trabajo no se tocó) | 25 pruebas: 20 pasan, 5 fallan. Los mismos 5 fallos: preexistentes en HEAD. |
| 3 | `npx tsc --noEmit` | 32 errores, todos en `tests/` (igual que la línea base). Ninguno en código de producción. `tsc` reescribe `tsconfig.tsbuildinfo`, que ya estaba modificado antes de la revisión. |
| 4 | `npx eslint` sobre los componentes, hooks, UI, api-clients y pruebas de Fase 2 | exit 0 |
| 5 | `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` |
| 6 | Reproducción del ejemplo del tooltip de "Conservar capacidad" con `computeDayAvailability` (script en el scratchpad, `node --experimental-strip-types`; gap 120, máximo 3, horas 09:00, 11:00, 12:00, 13:00) | Con conservar capacidad se ofrecen 09:00, 11:00 y 13:00. Sin ella: 09:00, 11:00, 12:00 y 13:00. El texto es correcto en es y en. |
| 7 | Prueba temporal A: reagendado de una cita a las 10:00 (copia de la prueba existente), en el árbol de trabajo y en HEAD | En ambos, el select de hora queda en 09:00. Defecto preexistente (R12-1). |
| 8 | Prueba temporal B: Escape con el tooltip abierto dentro de `BottomSheetModal` | `onClose` se llama 1 vez; el tooltip se cierra. Defecto nuevo (R12-2). |
| 9 | Claves `monthsDetail.availability.*` usadas por la Fase 2, en es y en | Todas existen (literales y de plantilla: estados de citas afectadas y días de la semana). |

Pruebas temporales: se crearon dentro de `tests/components/admin/` y se borraron. `find tests -name 'tmp-r12*'` devuelve 0. El único archivo nuevo del Reviewer en el repositorio es este informe.

**No ejecuté**: suite completa (la fase no cierra en esta ronda); `next build` (opcional); integración y e2e (no aplican a UI); pruebas en navegador real, layout a 375 px, `inert` y tap en móvil; lector de pantalla.

## 4. Verificaciones que pasan

- **Contrato cliente-servidor.** `SaveAvailabilityPayload` y `PreviewAvailabilityPayload` coinciden con `parseSaveAvailabilityPayload` y `parseAvailabilityPreviewPayload` (`lib/admin/months/validation.ts`). El PUT envía `expectedVersion`; el preview no lo envía.
- **Errores.** `AdminMonthApiError` usa el código como `message` y lleva `affectedAppointments` en el 409. Los dos hooks leen el código con `readAvailabilityErrorCode`.
- **Validación espejo.** Un separador vacío (NaN) lo rechaza el motor con `Number.isInteger`, así que Guardar queda bloqueado. `00:00` se rechaza con `AVAILABILITY_TIME_INVALID`.
- **Mapeo de códigos.** `AVAILABILITY_VERSION_CONFLICT`, `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`, `MONTH_NOT_REGISTERED`, `MONTH_IN_PAST`, `VALIDATION_ERROR` y los `AVAILABILITY_*` de reglas y excepciones tienen clave i18n. `AVAILABILITY_TIMEZONE`, `AVAILABILITY_BODY_SHAPE`, `AVAILABILITY_RULE_SCHEMA` y `AVAILABILITY_EXCEPTION_SCHEMA` caen en `unknown`; solo aparecen con cuerpos malformados que la UI no envía.
- **NB-7 cerrado.** `updateAdminMonthSlotMode` no tiene llamadores de UI (solo definición, servicio, ruta y pruebas). El editor sí envía `expectedVersion` y `confirmAffectedAppointments`.
- **Horarios de servidor.** Reagendado y creación leen `availableSlots` de la agenda; `getAdminDayAgenda` usa `resolveDay` con `now` (horas pasadas fuera) y excluye ocupados, bloqueos y locks. Bloqueo lee `blockable-slots`. No quedan `BASE_TIME_SLOTS`, `monthBaseSlots` ni `getAvailableStartSlotsWithManualBlocks` en componentes, hooks, app ni lib de UI. `resolveBaseSlotsByMonthMode` solo lo usan pruebas (H11, Fase 4).
- **`excludeAppointmentId`.** El cliente lo envía como query; la ruta lo parsea (`agenda/route.ts:45-48`) y el servicio lo excluye de los ocupados.
- **Día completo.** `canSelectFullDay = selectedDaySlots.length > 0`, mismo criterio que el servidor (`SLOT_NOT_AVAILABLE` si no queda horario libre). Se envía `fullDay: true`.
- **Flujo público.** `git status` no muestra cambios en `components/booking/**`, `hooks/booking` ni rutas públicas de reserva.
- **Conversión 12/24 h.** `TimeSlotChipInput` emite siempre `HH:mm`. 12 AM a `00:00`, 12 PM a `12:xx`, orden por valor de 24 h y sin repetidos. Las pruebas cubren 1:30 PM a 13:30, 12:15 PM a 12:15 y 12 AM a 00:00.
- **Descarte.** La confirmación es `role="alertdialog"` con `aria-labelledby` y `aria-describedby`. El foco inicial va a "Seguir editando" (`data-initial-focus`). Escape equivale a seguir editando. `disableClose` cubre el modal mientras está abierta. El contenido queda `inert`. El scrim no tiene manejador de clic.
- **Doble envío.** Guardar y Confirmar se deshabilitan con `isBusy`; un botón deshabilitado no dispara clic.
- **Aditividad de componentes compartidos.** `BottomSheetModal.overlay` sin la prop renderiza `undefined`, así que el resto de modales no cambia. `Switch.labelAdornment` queda fuera de `<label>`, así que el adorno no alterna el switch. La otra consumidora de `Switch` (`MonthsCatalogView`) no pasa adorno y mantiene el marcado.
- **Sileo e i18n.** El guardado usa solo `sileo.promise` y `sileo.error`. El diálogo de citas afectadas no usa sileo (D18). No hay `toast` ni `window.confirm` nuevos en Fase 2; los dos `window.confirm` de `MonthDetailView` ya existían en HEAD.
- **Tokens.** No hay hexadecimales nuevos. El scrim reutiliza el literal `rgba(28,25,23,0.35)` de `Modal` y `BottomSheetModal`, como indicó el Orchestrator.

## 5. Hallazgos

Sin hallazgos `blocking`.

### R12-1 `non-blocking` (preexistente, reproducido en HEAD). La hora por defecto del reagendado no es la hora actual

- **Archivo**: `components/admin/months/MonthDetailView.tsx:443` (`setEditTimeSlot("")` mientras la lista está vacía) y `:448` (`setEditTimeSlot(availableEditSlots[0])`). `startEditing` (`:411`) fija la hora actual, pero el efecto la borra antes de que llegue la agenda.
- **Escenario**: el admin abre "Editar cita" de una cita a las 10:00 y el servidor ofrece 09:00, 10:00 y 14:00. Al abrir, `availableEditSlots` está vacía porque la carga está en vuelo; el efecto deja `editTimeSlot` en `""` y, cuando llega la agenda, lo fija en 09:00. El select muestra 09:00. Guardar sin cambios reagenda la cita a las 09:00.
- Verificado con la prueba temporal A en el árbol de trabajo y en HEAD: mismo resultado.
- Contradice H2 de 2B-r1 ("reagendar a esa misma hora no cambia nada"), que solo sería cierto si la hora por defecto fuera la actual.
- **Corrección sugerida**: no vaciar `editTimeSlot` mientras la agenda carga; al llegar la lista, conservar la hora de la cita si está ofrecida, y solo si no lo está usar la primera. Añadir una prueba discriminante: cita a las 10:00 con 09:00 ofrecida; el valor esperado es 10:00.
- **Por qué no es blocking**: el select muestra la hora elegida antes de guardar, así que no se pierde ningún dato sin que el admin lo vea. Es preexistente. Recomiendo corregirlo en esta fase, porque T049 reescribió este flujo.

### R12-2 `non-blocking` (nuevo). Escape con el tooltip abierto cierra también el editor

- **Archivos**: `components/admin/ui/Tooltip.tsx:28-32` (cierra el tooltip) y `components/admin/ui/BottomSheetModal.tsx:63-74` (listener de Escape en `document`, activo mientras no haya `disableClose`).
- **Escenario**: el foco está en el icono de ayuda de "Conservar capacidad" con el tooltip abierto y se pulsa Escape. El tooltip se cierra y el evento también llega al `onClose` del sheet. Verificado con la prueba temporal B: `onClose` se llama 1 vez. En el editor, sin cambios cierra el editor; con cambios abre "¿Descartar cambios?" sin que el usuario lo pidiera.
- **Corrección sugerida**: en `Tooltip.handleKeyDown`, si `isOpen` es verdadero, llamar `event.stopPropagation()` antes de cerrar. Añadir pruebas: con tooltip abierto, Escape no llama `onClose`; sin tooltip abierto, Escape sí lo llama.

### R12-3 `non-blocking` (nuevo; requiere decisión de producto o de contrato). La confirmación de citas afectadas no está vinculada a la lista mostrada

- **Archivos**: servidor `lib/admin/months/service.ts:255` y `:308` (con `confirmAffectedAppointments: true` guarda sin recalcular ni comparar con la lista que vio el admin). Cliente: `hooks/admin/months/useAvailabilitySave.ts` (`confirmSave` reenvía el mismo `expectedVersion`).
- **Escenario**: el diálogo muestra 2 citas. Entre el preview y "Confirmar" se crea una tercera cita que quedaría fuera del horario. Se guarda y la tercera queda fuera sin que el admin la haya visto.
- No es regresión de Fase 2: D18 y D79 definen la confirmación como booleano. Decisión del owner o del Orchestrator: aceptar el riesgo como residual, o cambiar el contrato para que la confirmación envíe los `appointmentId` mostrados y el servidor compare.

### R12-4 `non-blocking` (nuevo; verificación pendiente). Otro consumidor de `Input` afectado por el cambio de contención

- `components/admin/ui/Input.tsx` cambió para `date`, `time` y `datetime-local`. También afecta a `components/admin/appointment-logs/AppointmentLogsView.tsx:115` y `:123` (filtros de fecha de registros). Ese flujo no está en la validación del owner y ningún informe de Fase 2 lo menciona.
- No hay evidencia de regresión; la prueba `input-date-time` solo comprueba clases. Riesgo: `appearance-none` puede quitar el indicador de calendario en escritorio.
- **Corrección**: verificar la pantalla de registros en navegador (escritorio y 375 px) antes del cierre, o documentar la aceptación. Anotar el cambio en `docs/ui/admin/components.md`.

### R12-5 `non-blocking` (nuevo). Toast de error de sileo al mismo tiempo que el diálogo de citas afectadas

- `hooks/admin/months/useAvailabilitySave.ts:70-94`: en la carrera del 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`, `sileo.promise` ya muestra el error "No se pudo guardar la disponibilidad" con la descripción de confirmación, mientras se abre el diálogo.
- **Corrección**: no mostrar error en esa rama, o usar un texto neutro. No hay pérdida de datos.

### R12-6 `non-blocking` (nuevo). Segundo guardado posible durante la ventana antes de cerrar

- `hooks/admin/months/useAvailabilitySave.ts:96-99`: tras un PUT correcto se pone `isSaving=false` y se espera `onSaved` (`refresh`) antes de `onClose`. Mientras espera, Guardar está habilitado porque el borrador sigue sucio. Un segundo clic envía el `expectedVersion` antiguo y recibe `AVAILABILITY_VERSION_CONFLICT`.
- **Corrección**: mantener `isBusy` hasta `onClose`, o cerrar antes de `await onSaved`.

### R12-7 `non-blocking` (nuevo). El foco no vuelve al disparador "Reglas"

- `hooks/admin/months/useDiscardConfirmDialog.ts:17-30` devuelve el foco al elemento que lo tenía antes de la confirmación (por ejemplo "Cancelar", o el X ya deshabilitado). Tras "Descartar", el editor se cierra y el foco cae en `body`.
- **Corrección**: devolver el foco al botón "Reglas" al cerrar el editor, en `MonthDetailView`. `BottomSheetModal` no devuelve el foco en ningún modal (preexistente).

### R12-8 `non-blocking` (preexistente). Comparación de abort que no coincide con el error real

- `hooks/admin/months/useBlockSpacesModal.ts:79` y `hooks/admin/months/useBookAppointmentModal.ts:181`, `:300`, `:338`: `error.message === "AbortError"`. El error real de un fetch abortado tiene otro mensaje, así que una apertura solapada registra un error. En `useBlockSpacesModal`, `errorCode` se muestra tal cual (`components/admin/months/BlockSpacesModal.tsx:147`, sin i18n). Puede persistir aunque la segunda carga tenga éxito, porque el `finally` del abortado pone `isLoadingDays=false` durante la carga nueva.
- **Corrección**: `if (controller.signal.aborted) return;` en lugar de comparar el mensaje, y mapear el error a una clave i18n.
- Preexistente en HEAD. Fuera de la lista de Fase 2, pero toca el flujo de bloqueo que T051 reescribió.

### R12-9 `non-blocking` (AGENTS; decisión del Orchestrator). Estado local en primitivas de UI

- `components/admin/ui/TimeSlotChipInput.tsx:42` (`useState` del borrador) y `components/admin/ui/Tooltip.tsx:26` (`useState` de abierto). AGENTS dice: "Toda lógica de estado ... abstraerse en hooks". Es el mismo patrón que usa `BottomSheetModal`, y el Developer lo declaró.
- **Decisión**: aceptarlo como excepción documentada en AGENTS, o moverlo a `hooks/shared/`.

### R12-10 `non-blocking` (huecos de prueba)

- `tests/components/admin/ui/input-date-time.test.tsx` y la prueba de rejilla de `time-slot-chip-input` afirman clases CSS. No demuestran contención ni layout.
- Faltan pruebas para: el valor por defecto del reagendado (R12-1); Escape con tooltip abierto (R12-2); que un 409 `AVAILABILITY_VERSION_CONFLICT` deje el borrador intacto y el editor abierto (hoy solo se prueba el mensaje); doble clic en Guardar; la ventana de R12-6.
- **Corrección**: añadir las pruebas discriminantes de R12-1 y R12-2. El resto es cobertura adicional.

### R12-11 `non-blocking` (UX). Reagendado sin horarios sin explicación

- `hooks/admin/months/useRescheduleTimeSlots.ts:41-44`: un error de agenda deja la lista vacía sin mensaje. `components/admin/months/MonthDetailView.tsx:512` (`handleReschedule`) sale en silencio si `editTimeSlot` es `""`. Escenario: el admin pulsa Guardar y no ocurre nada, sin explicación.
- **Corrección**: mostrar un aviso breve (i18n, `sileo.warning`) cuando la lista está vacía o falla la carga.

### R12-12 `non-blocking` (documentación y limpieza)

- **Documentación pendiente (T076)**: `docs/specification.md` (de Modalidad a Reglas, confirmación de citas afectadas, descarte, horario de reagendado y creación desde la agenda); `docs/ui/admin/components.md` (`Tooltip`, `TimeSlotChipInput`, `BottomSheetModal.overlay`, `Input` date/time, `Switch.labelAdornment`). `design-system.md` no fue verificado por los Developers. Según AGENTS, la fase no se considera terminada hasta que `docs/specification.md` refleje el flujo.
- **Tokens**: `--error` (usado en Fase 2 y ya en 4 archivos de HEAD) no aparece en `docs/ui/admin/tokens.md`. El scrim usa el literal de `Modal`. Decidir si se documentan.
- **Cosmético**: `hooks/admin/months/useBookAppointmentModal.ts:18` tiene un comentario obsoleto ("Mínimo para tsc (T030-T039) ... T052 rehace el tipo"); T052 ya lo hizo.

## 6. Correcciones requeridas

- Ninguna `blocking`.
- Recomendadas antes de cerrar la Fase 2: R12-1 con su prueba, R12-2 con su prueba, R12-6 (cambio pequeño) y R12-5.
- R12-3 requiere decisión de producto o de contrato. R12-4 requiere verificación en navegador.

## 7. Riesgos residuales

- Layout real a 375 px, `inert` en navegadores, `appearance-none` en escritorio, tap en móvil y foco del tooltip: no medidos (jsdom).
- Lector de pantalla con el `alertdialog`: no verificado.
- R12-3 (confirmación no vinculada a la lista) y R12-4 (pantalla de registros).
- Pendientes de Fase 4 ya anotados por los Developers: H11 (`resolveBaseSlotsByMonthMode`), `aria-label` duplicado en el overlay y la X de `BottomSheetModal`, y el uso de `--accent` y `--surface` en `Button.tsx` (preexistente, no tocado).

## 8. Qué no ejecuté

- Suite completa, integración, e2e, `next build`, navegador real, lector de pantalla y pruebas contra base de datos (no aplican a esta fase o no estaban pedidos).
- No re-ejecuté las rondas de Fase 1 ni verifiqué `design-system.md`.

## 9. Notas de entrega

- Copia de HEAD, scripts de reproducción y logs en el scratchpad (`/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/92ed9b47-cfd9-4d1b-b04d-b113455908c3/scratchpad/`). El repositorio no se modificó salvo por el informe; `tsconfig.tsbuildinfo` lo reescribió `tsc`.
- Sin commits, sin BD, sin `.env`, sin `prisma db execute`.
