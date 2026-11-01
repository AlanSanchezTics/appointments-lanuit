# ADR 0003: Bloqueos puntuales de una hora en Google Calendar

- Estado: Accepted
- Fecha: 2026-10-30
- Spec: [003 Disponibilidad flexible por mes](../../specs/003-flexible-month-availability/spec.md)
- Decisiones de origen: D15, D29, D30

## Contexto

Un bloqueo manual de horario se refleja como evento en Google Calendar. La duración del evento dependía del modo del mes: una hora en `BLOCK_MODE` y tres horas por defecto en `SECOND_ONLY_MODE`. Con reglas configurables, el modo ya no describe la duración de un horario.

## Decisión

- Un bloqueo de horario puntual crea un evento de **una hora**, siempre, sin importar el modo o la regla (D15, D29). El código lo fija con `durationHours: 1` en `createAdminBlockedSlots` (`lib/admin/blocked-spaces/service.ts`, línea 352) y en la rama de `syncBlockedSlotUpdate` que crea un evento nuevo cuando no hay `googleEventId` (`lib/calendar/sync-blocked-slot.ts`, línea 96).
- El bloqueo de día completo (`00:00`) no cambia: su evento va de 06:00 a 23:00 (`lib/calendar/google.ts`, D29).
- Los eventos existentes no se modifican en la migración ni en el despliegue (D30). Al actualizar un bloqueo solo se actualiza el resumen del evento.

## Consecuencias

- Los bloqueos creados antes del despliegue conservan la duración anterior (eventos de tres horas en `SECOND_ONLY_MODE`). Es un residuo aceptado (D30).
- Positivo: la duración del evento deja de depender del modo, que ya es un valor legado.
- La prueba de duración (puntual 1 h, día completo `06:00-23:00`, evento existente solo cambia su resumen) está prevista en T034 de la spec. Esta ADR no afirma que esa prueba se haya ejecutado en esta ronda.
