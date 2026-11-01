# Informe 01 - speckit-specify: Disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability`
**Etapa**: `speckit-specify` únicamente. Se detiene en Gate 2. No se ejecutaron clarify, plan, tasks, analyze, converge ni implement.
**Fecha**: 2026-10-28
**Estado**: spec.md en Draft; pendiente de respuestas del owner a Q1 a Q18.

## Archivos creados o modificados

- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/spec.md` (nuevo, en español, sobre la plantilla override)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/checklists/requirements.md` (nuevo, lista de calidad de `speckit-specify`)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/agent-reports/01-specify.md` (este informe)
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/.specify/feature.json` (actualizado a `specs/003-flexible-month-availability`, paso de `speckit-specify`)

No se crearon `STATE.md` ni `00-decisions.md`. No se tocó `specs/README.md`, ningún archivo de `docs/` ni código de la aplicación. No se creó rama ni commit. El hook opcional `agent-context` (`after_specify`) no se ejecutó porque no fue solicitado.

## Resumen

1. Se creó `specs/003-flexible-month-availability/` con la spec en Draft: 4 historias de usuario, 40 requisitos (FR-001 a FR-040), 7 criterios de éxito (SC-001 a SC-007) y la sección Documentation Impact.
2. Las historias cubren reglas por rango, días y horas; excepciones por fecha; el motor con separación mínima, capacidad preservada y máximo diario; y los dos meses de referencia de D9.
3. Edge cases pedidos por el brief incluidos: traslape, excepción vacía, citas fuera de horario, mes sin reglas y mismo día. Migración y compatibilidad incluidas (backfill D4, `slot_mode` legado hasta la fase 4). Cuatro fases descritas.
4. Se detectaron 5 conflictos con documentación vigente (C1 a C5, sección abajo). Dos de ellos son reemplazos directos de reglas actuales: lunes a viernes fijo y pares direccionales.
5. Hay 18 preguntas abiertas (Q1 a Q18). Bloquean el plan: Q1, Q7, Q8, Q9 y Q10. Q2, Q3 y Q18 bloquean solo las pruebas de los casos D9 (valores esperados y enero 2027). El resto puede resolverse en Gate 2 o durante el plan.

## Tabla de cobertura

| ID | Decisión / supuesto | Dónde aterrizó |
|---|---|---|
| D1 | `minGapMinutes` reemplaza el par direccional | FR-009, FR-010; US3; Key Entities (Regla); Documentation Impact (business-rules, decisions) |
| D2 | Bloqueos manuales en el nuevo modelo; 27/432 aceptado | FR-010, FR-013; SC-002, SC-003; Edge "Bloqueo manual que combina horarios"; Documentation Impact (decisions) |
| D3 | Tres parámetros por regla; defaults 240 / true / 3 | FR-001, FR-002, FR-011, FR-012; US1; Key Entities; Assumptions |
| D4 | Backfill: BLOCK_MODE y SECOND_ONLY_MODE; `slot_mode` legado | FR-030, FR-031, FR-032, FR-033; SC-004; Migration Compatibility Check; Fase 1 |
| D5 | Edición con aviso; citas intactas | FR-022, FR-023, FR-024; US1 escenario 2; Edge "Citas existentes fuera del nuevo horario"; Q9 |
| D6 | Mes sin reglas = regla por defecto | FR-008; Edge "Mes sin reglas"; Q8 |
| D7 | Nuevo `docs/architecture/data-model.md` | FR-040; Documentation Impact (data-model.md); acción del Orchestrator (`data_model_doc`) |
| D8 | Docs nuevos en español | Cuerpo de spec.md, checklist e informe en español; encabezados de plantilla en inglés (Q17) |
| D9 | Casos de uso de diciembre 2026 y enero 2027 | US4 escenario 1 (dic. 2026, 47 espacios, SC-007); US4 escenario 2 (ene. 2027, pendiente Q18) |
| A1 | Sin traslape de fechas; excepción tiene prioridad | FR-003, FR-004; US2 escenarios 1 y 3; Edge "Traslape de reglas" y "Excepción dentro de una regla" |
| A2 | Excepción con lista vacía cierra el día | FR-005; US2 escenario 2; Edge "Excepción con lista vacía" |
| A3 | Horas `HH:mm` sin restricción de granularidad | FR-006 |
| A4 | `availableSpaces` redefinido como suma de días resueltos | FR-026, FR-027; SC-007; Q3 |
| A5 | Duración de eventos espejo de bloqueos manuales | FR-036; Documentation Impact (cambios de contrato); Q6 |
| Contrato | `GET /api/admin/months/[month]` y `PATCH slot-mode` siguen funcionando | FR-034; Q7 |
| Contrato | Citas, `timeSlot`, locks, Google Calendar, auditoría y zona horaria sin cambios | FR-032, FR-035, FR-037; SC-004 |
| Fuera de alcance | Duraciones por cita, reglas entre meses, flujo público, eliminar `slot_mode` | Nota de alcance en spec.md; FR-018, FR-019, FR-033 |
| Mandato AGENTS.md | Documentación en el mismo flujo; i18n y sileo; `components/admin/ui/` | FR-038, FR-039, FR-040; Documentation Impact (checks previstos) |

## Preguntas abiertas para el Orchestrator

Cada pregunta necesita decisión del owner. Las opciones están desarrolladas en la sección *Preguntas abiertas* de spec.md. Aquí va el resumen para relayarlas.

- **Q1 - Parámetros de excepciones (FR-004)**: ¿propios con defaults (recomendada), heredados de la regla que cubre la fecha, o propios sin defaults?
- **Q2 - Parámetros de la regla de 14-23 de dic. (SC-007)**: ¿`240/true/3` (2 espacios por día, recomendada), `0/false/3` (3 espacios por día) u otros?
- **Q3 - "Remaining feasible slots" (FR-026)**: ¿máximo de citas adicionales alcanzables con tope en `maxPerDay` (recomendada) o horarios libres restantes?
- **Q4 - Tono del calendario (FR-028)**: ¿día cerrado en gris como hoy, tono propio, o semáforo por causa?
- **Q5 - Espacios bloqueados y vista "Por bloque" (FR-029, FR-036)**: ¿cada horario bloqueado cuenta 1, o la reducción de capacidad? ¿Se elimina "Por bloque" o se mantiene como agrupación visual?
- **Q6 - "Modalidad fija" y duración GCal (FR-036, A5)**: ¿`preserveCapacity=false` = 3 h y el resto 1 h (recomendada), campo explícito, o todo 1 h?
- **Q7 - `PATCH slot-mode` y `GET` (FR-034)**: ¿reemplaza las reglas por el preset D4 y mantiene `slot_mode` (recomendada), solo escribe `slot_mode`, o se depreca? ¿`GET` añade `rules` de forma aditiva?
- **Q8 - Meses nuevos y mes sin reglas (FR-008)**: el `POST` actual crea meses con `SECOND_ONLY`. ¿Crea el preset `10/14/18` (recomendada) o no crea reglas (y cambia el default a `BLOCK`)? ¿Qué pasa si el admin elimina todas las reglas?
- **Q9 - Citas fuera de horario (FR-023, FR-024)**: ¿"fuera de horario" = fecha u hora ya no ofrecida (recomendada) o también separación/capacidad? ¿Confirmación previa (recomendada) o aviso posterior?
- **Q10 - Rollback (Migration Compatibility Check)**: ¿aceptar la pérdida de cambios de reglas al revertir, derivar `slot_mode` de las reglas, o bloquear la edición hasta la fase 4?
- **Q11 - Rangos de validación (FR-025)**: propuesta `minGapMinutes` 0 a 1440 y `maxPerDay` 1 a 3. ¿Puede `maxPerDay` superar 3?
- **Q12 - Costo de cálculo (FR-010)**: ¿límite de horas por día (propuesta 24) o tiempo máximo de respuesta?
- **Q13 - Mismo día (FR-014)**: ¿los horarios pasados se retiran de la rejilla antes de calcular capacidad (recomendada) o cuentan como ocupados?
- **Q14 - Días sin regla (FR-007)**: ¿quedan cerrados (recomendada)?
- **Q15 - Auditoría y concurrencia**: ¿los cambios de reglas generan evento de auditoría (recomendada: no)? ¿Gana el último guardado o se rechaza un guardado obsoleto?
- **Q16 - Medición de la separación (FR-009)**: ¿entre horas de inicio (recomendada, como en el experimento) o entre fin e inicio?
- **Q17 - Encabezados**: ¿se aceptan los encabezados de la plantilla en inglés con contenido en español?
- **Q18 - Enero 2027 (US4)**: ¿qué sábados y qué horas por día aplican? D9 no lo indica. Bloquea la prueba de ese caso.

## Asunciones marcadas como [ASSUMPTION]

Todas están en spec.md con su referencia. Resumen:

- Parámetros propios en excepciones (FR-004, Q1).
- Regla D9 de 14-23 dic. con defaults `240/true/3` (Q2).
- Separación medida entre horas de inicio (FR-009, Q16).
- Días sin regla ni excepción cerrados (FR-007, Q14).
- `maxPerDay=3` en el backfill (FR-030).
- Idempotencia de la migración (FR-031).
- Edición de reglas (CRUD) solo en meses no pasados (FR-020, FR-021).
- Validación de horas repetidas, días vacíos y reglas fuera del mes (Edge Cases, FR-025).
- Lock sobre horario eliminado: la confirmación se rechaza (Edge Cases).
- Mismo día: horarios pasados fuera de la rejilla (FR-014, Q13).
- Cambios de reglas sin auditoría de citas (Q15).

## Conflictos con documentación vigente

- **C1**: "solo lunes a viernes" en `docs/specification.md` (4.1 y invariante 6) y en `docs/architecture/business-rules.md` (*Operating calendar*, *Validation Rules*). D9 la contradice; la feature la reemplaza. Requiere actualización de docs en la misma entrega.
- **C2**: pares direccionales en `docs/specification.md` (4.3) y en `business-rules.md` (*Slot pair model*, *Availability Rules*, invariante 4). D1 la reemplaza.
- **C3**: fórmula `(días hábiles × 3)` en `docs/specification.md` (15.7) y `business-rules.md` (*Admin Month Detail Rules*). A4 la reemplaza.
- **C4**: la feature 002 (`Implemented`) referencia "slot-mode rules" en `business-rules.md` (destino de reprogramación). La spec 002 no se reescribe: su FR-016 sigue siendo válido porque el resolvedor es el mismo. Se corrige solo la redacción de `business-rules.md`.
- **C5**: la feature 001 (`Completed`) no tiene conflicto con esta feature.

## Chequeos realizados

- Lectura de estándares (`spec-authoring-workflow.md`, perfil), constitución, `docs/specification.md`, `business-rules.md`, features, `components.md`, specs 001 y 002, `lib/availability/*`, `lib/constants/slots.ts`, `prisma/schema.prisma` y el script de equivalencia.
- Consumidores de la lógica legada encontrados: `lib/availability/*`, `lib/appointments/book-appointment.ts`, `lib/appointments/lock-reservation-slot.ts`, `lib/my-appointments/service.ts`, `lib/admin/appointments/service.ts`, `lib/admin/blocked-spaces/*`, `lib/admin/months/*`, `lib/db/active-months.ts`, `lib/db/admin-months.ts`, `app/api/admin/months/[month]/slot-mode/route.ts`, `components/admin/months/MonthDetailView.tsx`.
- Verificación de calendario: 1 de dic. de 2026 es martes. Días 1 a 13: 9 días lunes a viernes. Días 14 a 23: 10 días.
- Verificación de la regla de 14-23 de dic. (`07:30, 11:00, 14:30, 18:00`, 240 min): el grafo de conflictos es un camino de 4 nodos, así que el máximo son 2 citas por día. Un día vacío ofrece los 4 horarios. Con 2 espacios por día, el total es 20. Con la regla A: 9 × 3 = 27. Total 47.
- Verificación de la regla A con una cita a las `10:00`: `17:00` se excluye por capacidad (el máximo baja de 3 a 2). Con una cita a las `09:00`: se ofrecen `13:00`, `14:00`, `17:00`, `18:00`. Ambos casos están en US3.
- Checklist de calidad: 3 ítems pendientes, marcados como tales (criterios de aceptación de FR-020 a FR-024 y FR-029, y Q18).

## Acciones para el Orchestrator (no son decisiones de producto)

- `specs/README.md` no tiene tabla de registro. La fila de la feature debe agregarse con `tasks.md`; falta decidir el formato de la tabla.
- `data_model_doc` del perfil está en `none`. Actualizarlo a `docs/architecture/data-model.md` cuando se cree el archivo.
- Guardar `00-decisions.md` y `STATE.md` (responsabilidad del Orchestrator). Esta etapa no los creó.
- Gate 2: revisar spec.md con la tabla de cobertura y las preguntas Q1 a Q18.
