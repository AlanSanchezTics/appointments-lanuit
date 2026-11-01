# Informe 03 - speckit-clarify, ronda 2: Disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability`
**Etapa**: segunda pasada de `speckit-clarify`, solo para codificar D28 a D39 (CF1 a CF7, A6 y supuestos heredados). Se detiene en Gate 2. No se ejecutaron plan, tasks, analyze, converge ni implement.
**Fecha**: 2026-10-28
**Estado**: `spec.md` en Draft. Quedan 3 consecuencias nuevas para el owner (CF8 a CF10) y 4 defaults técnicos para Gate 3.

## Archivos modificados

- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/spec.md` (reescrito con D28 a D39 encodadas).
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/checklists/requirements.md` (texto actualizado; estados de los ítems sin cambio).
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/agent-reports/03-clarify-r2.md` (este informe).

No se tocó `00-decisions.md`, `STATE.md`, `specs/README.md`, `.specify/`, `docs/` ni código de la aplicación.

## Resumen

1. CF1 a CF7 quedan resueltos por D28 a D34 y se conservan en *Clarifications* (Ronda 2) con su decisión y los FR afectados. A6 queda resuelta por D35. FR-021, "Hora repetida", "Regla sin días" y "Lock sobre horario eliminado" quedan resueltos por D36 a D39, y sus marcadores `[ASSUMPTION]` se retiraron.
2. FR-020, FR-030, FR-031 y FR-033 (la coincidencia con preset ignora excepciones) quedan como **defaults técnicos** para Gate 3, no como decisiones del owner. FR-025 pierde su marcador porque D38 lo resuelve.
3. Consistencia verificada: D15/D29/D30 (bloqueos puntuales de 1 h, día completo 06:00-23:00, eventos existentes sin cambio), D17/D31 (mes nuevo sin reglas, `BLOCK_MODE`, default D6), D33 (diálogo y `PATCH` que reemplaza solo reglas), D34/D22 (día con todas las horas pasadas gris), y D28 frente a dic. 2026 (67 espacios) y ene. 2027 (63 espacios derivados). No aparece ninguna contradicción nueva; las dudas que quedan son de producto.
4. Quedan 3 consecuencias para Gate 2: CF8 (bloqueos manuales en "fuera de horario"), CF9 (conteo del día completo en "Espacios bloqueados"; CF2 quedó parcial) y CF10 (la primera regla de un mes sin reglas cierra los días que D6 abría).
5. Checklist: 16/17 antes y 16/17 después. FR-024 sigue pendiente por CF8. No se ejecutó ninguna etapa posterior a Gate 2.

## Verificación de calendario y cifras

- **Diciembre 2026** (sin cambio): 1 de diciembre es martes. Días 1 a 13 de lunes a viernes: 9 días (1, 2, 3, 4, 7, 8, 9, 10, 11), con 3 espacios cada uno. Días 14 a 23: 10 días, con 4 espacios cada uno. Total 9 × 3 + 10 × 4 = **67**. Con D28 y D23, los días 5, 6, 12, 13 y 24 a 31 quedan cerrados porque el mes tiene reglas y ninguna excepción los cubre. Esto se añadió explícitamente a US4 escenario 1 (no cambia la cifra).
- **Enero 2027** (re-verificado con D28): 1 de enero es viernes. Lunes a viernes: 21 días. Lunes 18 y 25 cerrados por excepción de lista vacía, así que quedan 19 días laborables. Sábados 16 y 23 abiertos por excepción: 2 días. Total 21 días abiertos × 3 = **63**. Sábados 2, 9 y 30 y domingos cerrados, porque el mes tiene una regla (D28 no aplica; D23 sí). Consistente.

## Cambios por decisión

| Decisión | Cambio en `spec.md` |
|---|---|
| D28 (CF1) | FR-007 y FR-008 separan los dos casos (con regla / sin regla). Edge "Mes sin reglas" y "Días no cubiertos". Supersesiones: precisa D6 y D23. |
| D29 (CF2) | FR-036: día completo `06:00-23:00`; solo puntuales a 1 h. Supersesiones: precisa D15. Documentation Impact: contrato de duración. |
| D30 (CF3) | FR-035 y FR-036: solo bloques creados desde el despliegue; eventos existentes sin cambio. Dependencia en Assumptions. |
| D31 (CF4) | FR-033, paso 1: sin reglas, `BLOCK_MODE`. Prevalece sobre la regla general de D19 (ver chequeo 2). Edge "Mes sin reglas". |
| D32 (CF5) | Edge "Visibilidad de cambios" (nuevo). Edge "Mes sin reglas": cierre total mediante estado inactivo. |
| D33 (CF6) | FR-023 (diálogo para crear, editar, eliminar y `PATCH slot-mode`). FR-034 (`PATCH` conserva excepciones). FR-021 (`PATCH` solo en meses no pasados). |
| D34 (CF7) | FR-028 (gris para día sin horarios resueltos, incluidos los de horas pasadas). Edge "Mismo día" y "Día sin horarios resultantes". |
| D35 (A6) | FR-024 redactado: cita activa (`PENDING`, `CONFIRMED`, `SYNC_FAILED`), futura, cuya fecha u hora ya no está entre los horarios del motor; sin separación ni capacidad; sin pasadas. Marcador retirado; CF8 pendiente. |
| D36 (FR-021) | FR-021 sin marcador. Edge "Mes pasado" con D36. |
| D37 (hora repetida) | Edge "Hora repetida": normalizar al guardar. FR-025: el conteo de 24 se hace después de normalizar (default técnico). |
| D38 (regla inválida) | Edge "Regla sin días...": rechazo. FR-025 con mínimo de un día, una hora y un rango válido. Excepción vacía sigue siendo válida (A2). |
| D39 (lock) | Edge "Lock activo sobre un horario que se elimina": TTL, validación contra reglas vigentes, error de horario no disponible. |

## Tabla de cobertura (D28-D39, A6 y supuestos heredados)

| ID | Decisión | Dónde aterrizó en `spec.md` | Estado |
|---|---|---|---|
| D28 | Mes sin reglas aplica D6 a los días que las excepciones no cubren; con al menos una regla, los no cubiertos quedan cerrados (D23) | FR-007, FR-008; Clarifications (Ronda 2, CF1); Edge "Mes sin reglas" y "Días no cubiertos"; US4 escenarios 1 y 2; Supersesiones; Documentation Impact (POST, `business-rules`, `admin-months-catalog-flow`) | Encodada |
| D29 | Bloqueo de día completo mantiene evento `06:00-23:00`; solo puntuales pasan a 1 h | FR-036; FR-035; Supersesiones; Fases (fase 1); Documentation Impact (contrato de duración, `decisions`) | Encodada. Conteo del día completo: CF9 |
| D30 | Solo bloqueos nuevos (desde el despliegue) usan 1 h; eventos existentes sin cambio | FR-035; FR-036; Assumptions (dependencia); Documentation Impact (contrato de duración) | Encodada |
| D31 | Meses nuevos o sin reglas guardan `slot_mode = BLOCK_MODE` | FR-033 (paso 1, con precedencia sobre D19); Edge "Mes sin reglas"; Migration Compatibility Check (rollback); Documentation Impact (`admin-months-catalog-flow`, `data-model`) | Encodada |
| D32 | Cambios de reglas visibles de inmediato; estado activo/inactivo controla reservas | Edge "Visibilidad de cambios"; Edge "Mes sin reglas" (cierre total con estado inactivo); Clarifications (CF5) | Encodada |
| D33 | Diálogo D18 para crear, editar, eliminar y `PATCH slot-mode`; `PATCH` reemplaza solo reglas | FR-023; FR-034; FR-021; Edge "Citas existentes fuera del nuevo horario"; US1 escenario 2; Documentation Impact (`api.md`); Fases (fase 2) | Encodada. Mecanismo de confirmación en la API: plan (FR-023) |
| D34 | Día sin horarios resueltos (incluido el día actual con horas pasadas) se pinta gris | FR-028; FR-015; Edge "Mismo día" y "Día sin horarios resultantes"; Documentation Impact (15.7) | Encodada |
| D35 (A6) | "Fuera de horario" = cita activa futura cuya fecha u hora ya no resuelve el motor; sin separación ni capacidad; sin pasadas | FR-024; Edge "Citas existentes fuera del nuevo horario"; Assumptions (A6 resuelta); checklist (FR-024) | Encodada. Bloqueos manuales: CF8 |
| D36 (FR-021) | Edición solo en meses no pasados (`MONTH_IN_PAST`, 422) | FR-021; Edge "Mes pasado"; Documentation Impact (`business-rules`, Edge Cases) | Encodada |
| D37 (hora repetida) | Se normaliza al guardar: sin duplicados y ordenadas | Edge "Hora repetida dentro de una regla"; FR-025; Key Entities (Regla) | Encodada |
| D38 (regla inválida) | Rechazo al guardar: mínimo un día, una hora y rango válido; cerrar un día con excepción vacía | Edge "Regla sin días de la semana, horas o rango"; FR-025 (incluye el supuesto de día mínimo); Documentation Impact (Validation Rules) | Encodada |
| D39 (lock) | El lock vive hasta su TTL; la confirmación valida contra reglas vigentes y rechaza como horario no disponible | Edge "Lock activo sobre un horario que se elimina"; Documentation Impact (sección 7, flujo de reserva) | Encodada |
| FR-020 | CRUD completo de reglas y excepciones (supuesto heredado) | FR-020 con marcador "Default técnico" | Default técnico para Gate 3 |
| FR-030 | Backfill con `maxPerDay=3` (supuesto heredado) | FR-030 con marcador "Default técnico" | Default técnico para Gate 3 |
| FR-031 | Migración idempotente (supuesto heredado) | FR-031 con marcador "Default técnico" | Default técnico para Gate 3 |
| FR-033 (nuevo) | La coincidencia con preset ignora excepciones | FR-033 con marcador "Default técnico" | Default técnico para Gate 3 |

## Chequeos de consistencia

1. **D15 / D29 / D30** (bloqueos puntuales a 1 h, día completo `06:00-23:00`, eventos existentes sin cambio): consistentes. D29 precisa D15 para el día completo y D30 limita el cambio a bloques nuevos. Ambas precisiones están en *Supersesiones* y en FR-035/FR-036. No hay contradicción con SC-004, que habla de citas y no de eventos de bloqueo.
2. **D17 / D31** (mes nuevo sin reglas, `BLOCK_MODE`, default D6): consistentes. El default D6 coincide con el preset `BLOCK`, así que el mes nuevo no cambia su visibilidad respecto al default. D31 aplica a "sin reglas", que cubre el caso general de D19. D19 dice "conservar el último valor" si no hay coincidencia; D31 es más específico y el owner lo decidió así. FR-033 lo expresa como precedencia, no como contradicción.
3. **D33** (diálogo; `PATCH` reemplaza solo reglas; conserva excepciones): consistente con D16 (precisado), D18 y D5. La conservación de excepciones en `PATCH` hace coherente el default de FR-033 (la coincidencia ignora excepciones): si las excepciones sobreviven al `PATCH`, no deben impedir reconocer un preset.
4. **D34 / D22 / D13** (día con todas las horas pasadas): consistente. D13 ya pinta de gris "un día sin horarios resueltos"; D34 aplica esa regla al caso de horas pasadas. FR-028 incluye también "todos sus horarios bloqueados", que es la misma lectura de D13 combinada con FR-013; no requiere decisión nueva.
5. **D28 frente a dic. 2026 y ene. 2027**: consistente. Ambos meses tienen reglas, así que los días no cubiertos quedan cerrados (D23). Esto no cambia la cifra de 67 ni la de 63.
6. **Implicación nueva de D28 + D23**: crear la primera regla de un mes sin reglas cierra los días que D6 abría y que la regla no cubre. Esto no es contradicción, pero tiene impacto de producto. Se lleva como CF10.
7. **Supuesto de A6 y bloqueos manuales**: D35 usa "horarios que resuelve el motor", y el motor retira los bloqueos (FR-013). D35 no dice si esa retirada cuenta para el diálogo. Se lleva como CF8.

## Consequences to confirm (nuevas, para Gate 2)

- **CF8 (A6, bloqueos manuales en "fuera de horario")**: si un bloqueo manual cae sobre una cita activa futura, ¿esa cita aparece en el diálogo de D18?
  - A) Sí, se lista: "horarios que resuelve el motor" incluye los bloqueos (lectura literal de D35).
  - B) No: solo cuentan reglas y excepciones; los bloqueos no hacen listar citas.
- **CF9 (D14 + D29, conteo del día completo en "Espacios bloqueados")**: D14 dice que cada horario bloqueado cuenta 1 espacio. El día completo se guarda hoy como un único marcador y cuenta 3 espacios (`docs/features/admin-month-detail-flow.md`, línea ~133; `docs/architecture/business-rules.md`, línea ~534).
  - A) Cuenta cada horario de la rejilla del día según la regla vigente (N espacios).
  - B) Cuenta 1 espacio, como un marcador.
- **CF10 (D28 + D23, primera regla de un mes sin reglas)**: al crear la primera regla, los días que D6 abría y que la regla no cubre quedan cerrados. Ejemplo: dic. 2026 con una regla solo para el 1 al 13 cierra del 14 al 31. Las citas afectadas aparecen en el diálogo de D18.
  - A) Así, como consecuencia de D28 y D23.
  - B) Así, y además el editor muestra un aviso antes de crear la primera regla (requisito de UI nuevo).

## Defaults técnicos para Gate 3 (no decididos por el owner)

- FR-020: CRUD completo de reglas y excepciones.
- FR-030: backfill con `maxPerDay=3`.
- FR-031: migración idempotente.
- FR-033: la coincidencia con preset ignora excepciones.
- FR-025: el límite de 24 horarios se cuenta después de normalizar (D37).
- FR-023: el mecanismo de confirmación en la API es decisión de plan (igual que FR-041).

## Cambios de precisión (sin decisión nueva)

- US2 escenario 4: decía "horas `09:00` a `18:00`", lo que podía leerse como rango. Se cambió a "horas `09:00` y `18:00`", porque el modelo guarda listas de horas (FR-001).
- Edge "Mes sin reglas": se explicita que un mes sin reglas no se cierra completo con reglas; el cierre total usa el estado inactivo del mes (D32). Es consecuencia de D28 y D38, no decisión nueva.
- FR-021: incluye `PATCH slot-mode` en el criterio de meses no pasados, como ya ocurre hoy (`MONTH_IN_PAST`).

## Checklist (before/after)

- Antes de la ronda 2: 16/17 ítems marcados.
- Después de la ronda 2: 16/17 ítems marcados. FR-024 sigue pendiente por CF8. Se actualizaron los textos de las notas y la referencia de la última revisión.

## Chequeos realizados

- Lectura de `spec.md`, `00-decisions.md` (D1-D39), `02-clarify.md`, `checklists/requirements.md`, `spec-authoring-workflow.md`, `subagent-workflow.profile.md` y `.agents/skills/speckit-clarify/SKILL.md` (formato del registro).
- Búsqueda de referencias en `docs/` para el día completo (`docs/specification.md` líneas ~1020, ~1131; `docs/architecture/business-rules.md` líneas ~534, ~620; `docs/features/admin-month-detail-flow.md` líneas ~83, ~133).
- Verificación de calendario: dic. 2026 (9 + 10 días, 67) y ene. 2027 (21 días abiertos, 63).
- Verificación de encabezados: solo los de la plantilla de Spec Kit y `## Clarifications` / `### Session 2026-10-28`. Ningún encabezado nuevo.
- Conteo de checkboxes: 16 marcados y 1 sin marcar en `checklists/requirements.md`.

## Acciones para el Orchestrator (no son decisiones de producto)

- Gate 2: el owner debe responder CF8, CF9 y CF10. Cada respuesta se añade a `00-decisions.md` con su ID nuevo (D40 y siguientes) antes de un nuevo clarify o de `speckit-plan`.
- Gate 3: revisar los defaults técnicos (FR-020, FR-030, FR-031, FR-033, FR-025 y la nota de FR-023).
- Actualizar `STATE.md` (Resume here) antes del gate.
- `specs/README.md` y `data_model_doc` siguen como en la ronda 1 (sin cambio en esta etapa).
- Idioma: el contenido de la spec sigue en español (D8, D26).

## Ronda 2b: D40 a D42 (CF8 a CF10)

Esta sección supera lo escrito arriba sobre CF8 a CF10, FR-024 y FR-029, que quedan resueltos. El resto del informe sigue vigente. Las decisiones vienen de `agent-reports/00-decisions.md` (D40 a D42).

Cambios en `spec.md`:

- D40 (CF8): FR-024 queda redactado con "considerando solo reglas y excepciones"; no se consideran bloqueos manuales, separación ni capacidad. El marcador de FR-024 se retira. Se añade la precisión a *Supersesiones*, a *Clarifications* (CF8) y a la edge case "Citas existentes fuera del nuevo horario".
- D41 (CF9): FR-029 precisa que un bloqueo de día completo cuenta 1 espacio por cada horario de la rejilla del día según la regla vigente; si la regla no produce horarios ese día, cuenta 0. Se actualizan Key Entities (Bloqueo manual), Documentation Impact (`specification.md` 15.7, `business-rules.md`, `admin-month-detail-flow.md`, `components.md`, contrato de "Espacios bloqueados") y el conflicto C6.
- D42 (CF10): la edge case "Primera regla de un mes sin reglas" queda como aceptada tal cual, sin advertencia extra en el editor. No se añade requisito de UI.

Coverage (D40-D42 y marcadores retirados):

| ID | Decisión | Dónde aterrizó en `spec.md` | Estado |
|---|---|---|---|
| D40 (CF8) | El diálogo D18 lista solo citas afectadas por cambios de reglas o excepciones; los bloqueos manuales no entran (se validan al crearse) | FR-024; Clarifications (Ronda 2, CF8; Supersesiones); Edge "Citas existentes fuera del nuevo horario"; Assumptions (A6); Documentation Impact (`business-rules`, `admin-month-detail-flow`, `components.md`); Fases fase 2 | Encodada |
| D41 (CF9) | El bloqueo de día completo cuenta 1 espacio por cada horario de la rejilla del día según la regla vigente (coherente con D14) | FR-029; Key Entities (Bloqueo manual); Clarifications (CF9; Supersesiones); Documentation Impact (`specification.md` 15.7, `business-rules`, `admin-month-detail-flow`, contrato de "Espacios bloqueados", C6); Fases fase 2 | Encodada |
| D42 (CF10) | La primera regla de un mes sin reglas cierra los días no cubiertos (D28 + D23); se acepta sin advertencia extra | Edge "Primera regla de un mes sin reglas"; Clarifications (CF10); Documentation Impact (`business-rules`, Edge Cases) | Encodada. Sin requisito de UI nuevo |
| FR-024 | Marcador "pendiente (CF8)" retirado | FR-024; checklist (ítem de criterios de aceptación marcado) | Resuelta |
| FR-029 | Marcador "pendiente (CF9)" retirado | FR-029 | Resuelta |

Chequeos de la ronda 2b:

1. **D40 frente a D35, FR-013 y FR-029**: D35 sigue vigente. D40 precisa el alcance del diálogo: solo reglas y excepciones. FR-013 (los bloqueos se retiran de la rejilla para la capacidad) y FR-029 (conteo de espacios bloqueados) no cambian. No hay contradicción.
2. **D41 frente a D14, D29 y FR-029**: consistente. El día completo cuenta por horario de la rejilla según la regla vigente, que es la misma regla de conteo por horario de D14. Un día sin horarios según la regla cuenta 0.
   - Interpretación literal, sin pregunta abierta: la rejilla es la de la regla vigente, sin quitar las horas ya pasadas del día actual. D22 se aplica a la capacidad, no a este conteo. Si el owner quiere otra cosa, sería un punto nuevo.
3. **D42 frente a D28 y D23**: consistente. Es la implicación ya señalada como CF10, aceptada por el owner.
4. **Documentos en `docs/`**: las referencias "pendiente de CF9" o "3 espacios" quedan redactadas como "según D41" o como "hoy 3 espacios, se reemplaza por D41". Los documentos de `docs/` no se tocaron en esta etapa.

Estado tras la ronda 2b:

- No quedan preguntas abiertas para el owner.
- Defaults técnicos para Gate 3 (no son decisiones de producto): FR-020, FR-030, FR-031, FR-033.
- Checklist: 17/17 ítems marcados (antes 16/17; FR-024 pasa a marcado).
- Gate 2: se detiene. No se ejecutaron `speckit-plan`, `speckit-tasks`, `speckit-analyze`, `speckit-converge` ni `speckit-implement`.
