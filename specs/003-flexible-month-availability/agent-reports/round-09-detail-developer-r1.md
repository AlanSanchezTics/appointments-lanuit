# Corrección 2B-r1 (H1, H2, H3/H4, H7) - Developer

**Spec**: 003-flexible-month-availability | **Ronda**: 2B-r1 | **Rama**: `003-flexible-month-availability` | **Commits**: ninguno
Base: `specs/003-flexible-month-availability/agent-reports/round-09-detail-developer.md` (H1-H7).

## 1. Resumen

- **H1 hecho**: `AdminDayAgendaResponse` declara `availableSlots: string[]`; se quitó el cast `shortcut` de `fetch-day-agenda-slots.ts`.
- **H2 hecho**: `fetchAdminDayAgenda` acepta `excludeAppointmentId` opcional y lo envía como query `?excludeAppointmentId=<id>`. `useRescheduleTimeSlots` lo recibe y `MonthDetailView` pasa la cita en edición. El servidor ya lo soportaba (ruta `agenda/route.ts` lee `excludeAppointmentId` con `parseAgendaExcludeAppointmentId`; servicio `getAdminDayAgenda` lo excluye de `occupiedSlots`). No se tocó servidor.
- **H7 hecho**: en `MonthDetailView` se quitó `!day.isWeekend` como bloqueo del filtro de fechas de reagendado y del botón de día. Un fin de semana con tono `closed` sigue sin ser seleccionable.
- **H3/H4 NO implementado (bloqueado por contrato, requiere decisión)**. Ver sección 4.

## 2. Archivos tocados

Modificados:
- `lib/admin/appointments/types.ts`: `availableSlots: string[]` en `AdminDayAgendaResponse` (H1).
- `lib/admin/appointments/api-client.ts`: `fetchAdminDayAgenda(month, date, signal?, excludeAppointmentId?)` (H2).
- `hooks/admin/months/fetch-day-agenda-slots.ts`: sin cast; parámetro `excludeAppointmentId` pasado al cliente (H1, H2).
- `hooks/admin/months/useRescheduleTimeSlots.ts`: input `excludeAppointmentId?`, dependencia del efecto, comentario actualizado (H2).
- `components/admin/months/MonthDetailView.tsx`: `excludeAppointmentId: dayAgendaModal.editingAppointmentId ?? undefined` en `useRescheduleTimeSlots` (H2); filtro `agendaDateOptions` sin `isWeekend` (H7); `isActionableDay = !(day.isWeekend && day.tone === "closed")` (H7).
- `tests/components/admin/months/month-detail-view.test.tsx`: aserción de `excludeAppointmentId=10` en la prueba de reagendado (H2); prueba nueva "opens the daily agenda for a weekend day the server marks open" (H7).
- `tests/lib/admin/appointments.api-client.test.ts`: prueba nueva de `fetchAdminDayAgenda` con y sin `excludeAppointmentId` (H2).

No tocados: `useBlockSpacesModal.ts`, `BlockSpacesModal.tsx` (H3/H4 pendientes), `WeeklyOccupancyCard`, `locales/**`, `docs/**`, `lib/**` servidor, `app/**`, `prisma/**`, BD, `.env`. Sin commits.

## 3. Cambios de comportamiento

- **Reagendado (H2)**: al reagendar, la agenda del día de la cita se pide con `excludeAppointmentId`, así que la hora actual de la cita aparece entre las opciones. Antes no aparecía.
- **Reagendado, fechas (H7)**: en el selector de fecha de reagendado, un fin de semana con `availableSpaces > 0` ahora aparece. Un fin de semana con `closed` no aparece (su `availableSpaces` es 0; y el día de la propia cita sigue apareciendo como antes).
- **Botón de día (H7)**: un fin de semana abierto por excepción (tono `available`/`low`/`full`) se puede abrir y muestra la agenda. Un fin de semana `closed` (incluidos los pasados) sigue deshabilitado.
- **Decisión de alcance H7 (anotar)**: un día entre semana con tono `closed` (pasado o sin horarios) sigue siendo seleccionable como antes. La regla nueva solo cambia el caso de fin de semana. Si el owner quiere que cualquier día `closed` sea no seleccionable, eso cambia el comportamiento de días pasados entre semana y es otra decisión.

## 4. H3/H4: bloqueado, requiere decisión

La regla de D100 ("día completo solo si TODOS los horarios de la rejilla del día son bloqueables") no se puede comprobar en la UI con el contrato actual:

- `GET /api/admin/months/{month}/blockable-slots` devuelve, por día, solo los horarios **ofrecibles** (`buildBlockableDays` en `lib/admin/blocked-spaces/service.ts` filtra ocupados, locks, bloqueos y pasado). No devuelve la rejilla base.
- Por tanto, un horario ocupado o bloqueado nunca aparece en la lista, y el cliente no puede saber si la rejilla del día tiene horarios fuera de ella.
- La suposición de D100 (que la lista de `blockable-slots` es la rejilla) no coincide con el servidor.
- Las dos salidas que sí cumplirían la regla están fuera de mandato: (a) recalcular la rejilla en navegador (lógica de dominio en UI, contra el criterio de `fetch-day-agenda-slots.ts`), o (b) cambiar el servidor.

Opciones para el Orchestrator/owner:
1. **Autorizar un cambio mínimo de servidor**: `getAdminBlockableSlots` añade por día un dato de elegibilidad de día completo (p. ej. `fullDayEligible: boolean` o `gridSlots: string[]`), con tipo en `lib/admin/blocked-spaces/types.ts` y prueba en `tests/lib/admin/blocked-spaces.service.test.ts`. Después `canSelectFullDay` lo usaría. Requiere autorizar archivos de servidor (`lib/admin/blocked-spaces/service.ts`, `types.ts`) y la prueba de servicio.
2. **Mantener la regla actual** (al menos un horario bloqueable, `canSelectFullDay = selectedDaySlots.length > 0`), que es la paridad con la validación del servidor (`createAdminBlockedSlots` solo rechaza con `SLOT_NOT_AVAILABLE` si no queda ningún horario libre). Documentar esa decisión como definitiva.

Sin cambios de código para H3/H4 en esta ronda. No se modificó `useBlockSpacesModal.ts` ni `BlockSpacesModal.tsx`.

## 5. Ejecutado

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin/months tests/hooks/admin/months tests/lib/admin` (final) | 214 pruebas: 212 pasan, 2 fallan. Ambas son línea base: `MonthDetailView > disables schedule CTA when month is inactive` (preexistente) y `useRescheduleWhatsappAction > offers a sileo action...` (formato de fecha de WhatsApp, preexistente). Sin fallos nuevos. |
| `npx vitest run tests/lib/admin/appointments.api-client.test.ts tests/components/admin/months/month-detail-view.test.tsx` | Prueba nueva de API cliente pasa; pruebas nuevas de H2 y H7 pasan (dentro de la suite final). |
| `npx tsc --noEmit` | 32 errores, todos en `tests/` (igual que la línea base). Mis dos primeros intentos añadieron 2 errores en `appointments.api-client.test.ts`; se corrigieron tipando el mock (`vi.fn<(url: string) => Promise<Response>>`). Los errores restantes de `month-detail-view.test.tsx` (líneas 1561-1563 y 1725-1727) y de `appointments.api-client.test.ts` línea 60 son preexistentes, desplazados por mis líneas nuevas. |
| `npx eslint` sobre los 7 archivos tocados | exit 0, sin warnings. |
| `npm run lint:admin-i18n` | exit 0; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` (no tocado). |

## 6. Estático (revisado, no ejecutado en navegador)

- H1: el tipo ya coincide con lo que devuelve `getAdminDayAgenda` (`lib/admin/appointments/service.ts`, tipo de retorno `AdminDayAgendaResponse & { availableSlots: string[] }`, ahora redundante; no se toca por estar fuera de alcance: candidato de limpieza).
- H2: el parámetro es opcional; si no se pasa, la URL es la de antes, así que `useDayAgendaModal` y `useBookAppointmentModal` no cambian.
- H7: el cambio es solo de selección; no cambia tonos ni `getToneClasses`.
- Sin colores ni tokens nuevos. Sin textos nuevos (no hay claves de i18n nuevas). Sin `sileo` nuevo.

## 7. Pendiente de aceptación del owner (manual, no verificado)

- Navegador: reagendar una cita y ver su hora actual entre las opciones (H2).
- Navegador: fin de semana abierto por excepción se abre; fin de semana cerrado no (H7).
- Decisión H3/H4 (sección 4).
- Decisión H7 entre semana `closed` (sección 3).

## 8. Checks requeridos

Admin UI Check:
- Uses components/admin/ui: Yes (sin componente visual nuevo; se reutilizan los existentes)
- Reused existing components: Yes
- New reusable components created: No
- Tokens respected: Yes (sin valores nuevos)
- design-system.md aligned: No verificado (no leído en esta ronda)
- Public flow untouched: Yes

Notification Contract Check:
- Sileo used for success/warning/error/info: No aplica (sin cambios de notificaciones)
- Sileo action notifications used when applicable: No aplica
- Sileo promise notifications used when applicable: No aplica
- i18n applied in admin notifications: No aplica
- Alternative notification systems introduced: No

Flow Contract Check:
- UI steps updated: Yes (reagendado con hora actual; fin de semana abierto seleccionable)
- API contract updated: No en servidor (sin cambios); el cliente envía `excludeAppointmentId`, que el servidor ya aceptaba
- Validation rules updated: No
- Acceptance criteria updated: No (no se tocó tasks.md)
- docs/specification.md aligned: No (T076)

Documentation Impact:
- Yes. `docs/specification.md` NO se actualizó (fuera de alcance de esta ronda).
- Secciones a actualizar en T076: reagendado (la agenda del servidor incluye la hora actual de la cita); selección de días (fin de semana abierto por excepción sí se abre; cerrado no); día completo (pendiente de H3/H4).

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: No aplica (solo cliente)
- Cleanup phase defined: No nueva (candidato: tipo de retorno redundante en `service.ts`, y `resolveBaseSlotsByMonthMode` de la ronda anterior, H11)
- Integrity protections defined: No aplica

## 9. Handoff

- **Hecho**: H1, H2, H7. Pruebas nuevas: 3 (2 de componente, 1 de API cliente). Criterios de salida cumplidos salvo los 2 fallos de línea base ya conocidos.
- **Pendiente**: H3/H4 (decisión del owner: autorizar cambio mínimo de servidor o mantener la regla actual). Ver sección 4.
- **Fuera de alcance, reportado**: tipo redundante en `lib/admin/appointments/service.ts` (limpieza); H5, H6, H8 y H9 de la ronda anterior sin cambios.
- **Archivos tocados**: los de la sección 2.
- **Siguiente paso**: el Orchestrator decide H3/H4. Si autoriza la opción 1, el Developer añade el dato de elegibilidad en servidor y su prueba. Después, validación en navegador (sección 7).
