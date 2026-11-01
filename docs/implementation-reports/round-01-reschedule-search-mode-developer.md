# Ronda 01: selector Por día / Por horario en el reagendado de /my-appointments (Developer)

Fecha: 2026-11-01
Rol: Developer (ronda única, riesgo bajo, solo UI pública)
Estado: implementado y verificado con tests y tipado; pendiente de validación visual del owner antes del Reviewer.

## Resumen

En `/my-appointments`, paso `step === "reschedule"`, la clienta ahora tiene el mismo selector `Por día` / `Por horario` que `/booking` paso 1 (default `Por día`). En `Por horario` aparecen los chips de horarios con conteo de días y, al elegir uno, solo se habilitan los días que lo ofrecen. Al cambiar de mes se conserva el horario si existe en el mes nuevo; si no, se deshabilitan días y `Confirmar cambio` hasta elegir otro horario.

No hay cambios de API, schema, reglas de negocio ni i18n (todas las claves ya existían en `es` y `en`). `hooks/booking/use-booking-schedule-search.ts` y el flujo público de booking no se tocaron.

## Archivos modificados

- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/hooks/my-appointments/use-my-appointments-flow.ts`
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/components/my-appointments/my-appointments-flow.tsx`
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/docs/specification.md`
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/docs/features/my-appointments-flow.md`
- Nuevo: `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/app/my-appointments-reschedule-search.test.tsx`
- Este reporte: `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/docs/implementation-reports/round-01-reschedule-search-mode-developer.md`

No se modificó ningún otro archivo. `tsconfig.tsbuildinfo` lo cambió `tsc` como efecto colateral y se restauró con `git checkout`.

## Diseño estático

- **Hook reutilizado sin cambios.** `useBookingScheduleSearch` se llama desde `useMyAppointmentsFlow`. El hook solo lee `draft.date` y `draft.timeSlot`, así que el flujo pasa un adaptador memoizado `{ date, timeSlot, name: "", phone: "" }`. Los campos `name` y `phone` van vacíos solo para cumplir el tipo `BookingDraft`; el hook no los usa. `onDraftChange` escribe de vuelta en `selectedDate` y `selectedTimeSlot`.
- **Estado en hook, UI en componente.** El modo, los slots activos y los días habilitados viven en el hook de flujo y se exponen como `scheduleSearch`. El componente solo renderiza.
- **Reinicio del modo.** `handleStartModify` llama `scheduleSearch.changeMode("day")`. El hook de flujo no se desmonta al volver a resultados, así que sin esta llamada el modo quedaría en `Por horario`. Recargar la página reinicia el estado de forma natural.
- **Día en `Por día`.** `handleSelectDate` (nuevo, en el hook) asigna el primer horario del día, igual que antes. En `Por horario` solo asigna la fecha y conserva el horario, porque el día habilitado ya lo ofrece.
- **Confirmar.** El botón y `handleRescheduleConfirm` exigen `scheduleSearch.canContinue`. En día siempre es `true`; en horario es `true` solo si hay un horario activo.
- **Calendario.** Un día es seleccionable si tiene horarios y, cuando hay `enabledDates`, pertenece al conjunto. El día seleccionado solo se resalta si es seleccionable (igual que booking).
- **Horarios por día.** La lista de horarios del día se oculta en `Por horario` con la clase `hidden`, como en booking.
- **Mes.** El efecto existente de carga de disponibilidad y la alineación del hook resuelven el cambio de mes. Se verificó en el test que el horario revive al volver a un mes que lo tiene.
- Patrón visual del button group copiado de `booking-wizard-step-schedule.tsx` (`role="group"`, `aria-pressed`, `min-h-11`, mismo `aria-label` `booking.searchBy`). Los chips usan `booking.selectTimeSlot` y `booking.daysCount`. Las claves `booking.searchBy`, `searchByDay`, `searchByTime`, `noSlotsInMonth`, `selectTimeFirst`, `selectTimeSlot` y `daysCount` ya existían en `es` y `en`.

## Ejecutado

Comandos y resultados (ejecutados en esta ronda):

1. Línea base antes de editar:
   - `npx tsc --noEmit`: salida 2, 32 errores preexistentes en otros archivos (por ejemplo `tests/scripts/backfill-appointment-logs.test.ts`, tipos de Prisma en scripts).
   - `npm run lint`: salida 1, 1 error y 8 warnings preexistentes, fuera de mis archivos.
   - `npx vitest run tests/app/booking-schedule-search.test.tsx`: 4/4.
2. Después de editar:
   - `npx tsc --noEmit`: 32 errores, los mismos que la línea base (diff de líneas `error TS` sin números de línea: sin líneas nuevas).
   - `npm run lint`: mismo conjunto de hallazgos que la línea base. Un warning nuevo que yo introduje (`setSelectedDate` sin uso) se corrigió; no quedan hallazgos nuevos.
   - `npx vitest run tests/app/my-appointments-reschedule-search.test.tsx`: 5/5 pasan. Casos: arranca en `Por día` sin chips; `Por horario` habilita solo los días del horario; cambio de mes sin el horario deshabilita días y confirmar, y al volver revive; confirmar envía la fecha que lleva el horario elegido (`2026-03-05`, `10:00`); reingresar al paso reinicia en `Por día`.
   - Repetición: 4 corridas de `my-appointments-reschedule-search` + `booking-schedule-search`, 9/9 en cada una.
   - `npx vitest run tests/app/booking-schedule-search.test.tsx tests/app/citas-cancelar-page.test.tsx tests/app/cancelar-page.test.tsx` (junto con el nuevo): pasan. Los dos de redirección pasan.
3. Fallos preexistentes, no causados por esta ronda:
   - `npx vitest run tests/app/booking-wizard.test.tsx`: 4 fallos de 7 (`Confirmar detalles` no encontrado). Verificado con `git stash` de mis dos archivos modificados: el resultado es idéntico sin mis cambios (4 fallos, 3 pasan). El archivo no importa código de my-appointments ni el hook modificado. No se corrigió: está fuera de alcance.

Notas del test: el test mockea `@/lib/my-appointments/api-client` y `@/lib/booking/api-client` (solo `fetchMonthAvailability`) y monta el `MyAppointmentsFlow` real con `onWhatsAppRedirect` mockeado para no navegar en jsdom. No cubre el paso de éxito ni la rama de cancelación.

## Pendiente de validación humana

No se ejecutó en navegador ni hubo prueba e2e (Playwright). Esto queda para el owner:

- Aspecto visual del selector y de los chips en mobile (`booking-mobile-shell`) y en desktop, en light y dark (`hover`, foco, estados deshabilitados).
- Lectura con lector de pantalla: anuncio del grupo `Por día`/`Por horario` y de los chips con su conteo.
- Comportamiento con la API real y datos reales de disponibilidad, incluido el cambio de mes con latencia de red.
- Que el test nuevo falle sobre el código original. No ejecuté esa comprobación negativa; la afirmación se basa en que el original no tiene el group ni los chips.

## Decisiones y ambigüedades para el Orchestrator

No las resolví; requieren decisión del owner o del Orchestrator:

1. **"Conservando date + timeSlot" al volver.** El brief dice que el modo se reinicia al volver o recargar conservando fecha y horario. En my-appointments, entrar al paso de reagendado ya limpia fecha y horario (comportamiento existente de `handleStartModify`), y lo mantuve. Si el owner quiere conservar la selección al volver a resultados y reingresar, hay que cambiar `handleStartModify`, y eso implica decidir qué pasa si la clienta eligió otra cita entre medio.
2. **Día en `Por día`.** En reagendado, elegir un día asigna siempre el primer horario de ese día. En `/booking`, se conserva el horario si el día lo ofrece. Mantuve el comportamiento existente del reagendado para no cambiar el modo `Por día`. Si el owner quiere alinearlo con booking, es un cambio pequeño en `handleSelectDate`.
3. **Botones deshabilitados durante la carga.** El button group y los chips se deshabilitan mientras carga la disponibilidad. Booking los deshabilita durante `isPending`. Es una elección mía, sin requisito explícito.

## Documentation Impact

- Sí hay impacto en flujo (UI del paso de reagendado).
- Actualizado `docs/specification.md`, sección 8.2 "Rama de Modificación", punto 2 (nuevos sub-bullets: selector, chips, cambio de mes, día en `Por día`, reinicio del modo).
- Actualizado `docs/features/my-appointments-flow.md`: "Reschedule Branch" paso 2, "Validation Points" (condición de `Confirmar cambio`) y "Acceptance Criteria".
- No se modificó `docs/architecture/business-rules.md`: no cambia ninguna regla de negocio; la disponibilidad es la misma.
- No se modificó `docs/features/booking-flow.md` ni la sección 7 de la spec: el flujo de booking no cambia.
- Sin ambigüedad documental nueva más allá de las decisiones 1 a 3 de arriba.

## Flow Contract Check

- UI steps updated: Sí
- API contract updated: No (no hay cambio de API)
- Validation rules updated: Sí (condición de `Confirmar cambio` en `Por horario`)
- Acceptance criteria updated: Sí
- docs/specification.md aligned: Sí

## Migration Compatibility Check

- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Sí, trivial: revertir el commit. Es solo UI; no hay estado persistido ni contratos cambiados.
- Cleanup phase defined: No aplica
- Integrity protections defined: No aplica (sin cambios de datos; la validación del servidor de reagendado no cambió)

## Otros checks

- Admin UI Check: No aplica (solo UI pública; no se tocó `components/admin/ui/` ni tokens del admin).
- Notification Contract Check: No aplica (no se añadieron notificaciones).
- Flujo público de booking: sin cambios en archivos ni en comportamiento. El hook `use-booking-schedule-search.ts` se usa como estaba.

## Limitaciones

- Ninguna comprobación en navegador real ni e2e.
- Los tests usan mocks de API y jsdom; no validan la respuesta real del backend.
- No hubo ejecución de la comprobación negativa del test nuevo.
- No se corrió la suite completa (`npm test`); solo los tests relacionados con el flujo.
- El Reviewer no se lanzó, por instrucción del brief; el owner valida antes.

## Corrección r1

Decisión del owner (comunicada por el coordinador): alinear `Por día` con `/booking`. Supera la decisión 2 de arriba, que ya no aplica.

Cambio:
- `handleSelectDate` en `hooks/my-appointments/use-my-appointments-flow.ts`: en `Por día`, al elegir un día conserva el `selectedTimeSlot` actual si ese día lo ofrece; si no, asigna el primer horario del día. En `Por horario` no cambia el horario (los días habilitados ya lo ofrecen).
- Componente `RescheduleCalendar` (`components/my-appointments/my-appointments-flow.tsx`): no requirió cambio. Desde la ronda 1 el clic de día solo llama `onSelectDate(date)`; ya no fuerza el primer horario. La regla vive en el hook.
- Docs: `docs/specification.md` sección 8.2, punto 2 (sub-bullets de `Por día` y `Por horario`), y `docs/features/my-appointments-flow.md` (Reschedule Branch, paso 2).
- Test: `tests/app/my-appointments-reschedule-search.test.tsx` con dos casos nuevos y un fixture propio (`keepDays`: 04 con 09:00/14:00, 05 con 10:00/14:00, 06 con 10:00), donde 14:00 no es el primer horario de 04 ni de 05, para distinguir "conservar" de "primer horario":
  - Conserva: elegir 14:00 en 04, luego el día 05 → confirmar envía `2026-03-05` / `14:00`.
  - Respaldo: elegir 14:00 en 04, luego el día 06 (solo 10:00) → confirmar envía `2026-03-06` / `10:00`.

Ejecutado en la corrección:
- `npx vitest run` de `my-appointments-reschedule-search`, `booking-schedule-search`, `citas-cancelar-page` y `cancelar-page`: 13/13 pasan.
- `my-appointments-reschedule-search` repetido 3 veces: 7/7 en cada corrida.
- `npx tsc --noEmit`: 32 errores, las mismas líneas que la línea base (sin líneas nuevas).
- `npm run lint`: mismo conjunto de hallazgos que la línea base.
- `tsconfig.tsbuildinfo` restaurado tras `tsc`.

No ejecutado: la comprobación negativa del caso "conserva" contra la regla anterior. Razonamiento: con la regla anterior el día 05 asignaría 10:00 y el test esperaría 14:00, así que fallaría. No lo corrí.

Actualización de totales: el archivo de test pasa de 5 a 7 casos. Los números de la sección "Ejecutado" de arriba corresponden a la ronda 1 y se mantienen como registro histórico.

Documentation Impact (corrección): Sí. Actualizados `docs/specification.md` sección 8.2 punto 2 y `docs/features/my-appointments-flow.md` Reschedule Branch paso 2. Sin cambios en `business-rules.md` ni en `booking-flow.md`.

Flow Contract Check (corrección):
- UI steps updated: Sí
- API contract updated: No
- Validation rules updated: No (la validación de confirmar no cambió)
- Acceptance criteria updated: No (los criterios de aceptación no mencionan el horario al elegir día)
- docs/specification.md aligned: Sí
