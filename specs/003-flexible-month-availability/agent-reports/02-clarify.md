# Informe 02 - speckit-clarify: Disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability`
**Etapa**: `speckit-clarify` únicamente, codificando las respuestas del owner (D10 a D27, Gate 2). Se detiene en Gate 2. No se ejecutaron plan, tasks, analyze, converge ni implement.
**Fecha**: 2026-10-28
**Estado**: `spec.md` en Draft, con las decisiones encodadas. Pendiente de confirmación del owner: A6, supuestos heredados y CF1 a CF7.

## Archivos creados o modificados

- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/spec.md` (reescrito: sección `## Clarifications` con `### Session 2026-10-28`, FR, SC, historias, edge cases, Documentation Impact y Fases actualizados).
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/checklists/requirements.md` (ítems resueltos cerrados; ver conteo abajo).
- `/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/specs/003-flexible-month-availability/agent-reports/02-clarify.md` (este informe).

No se tocó `agent-reports/00-decisions.md` ni `STATE.md` (responsabilidad del Orchestrator), `specs/README.md`, `.specify/feature.json`, `docs/` ni código de la aplicación.

## Resumen

1. Q1 a Q18 quedan registradas en `## Clarifications` como una viñeta por respuesta (`Q → A: Dxx`), con su decisión y el FR, SC o historia que cambió. La sección "Preguntas abiertas" se eliminó.
2. Las supersesiones quedan explícitas: D15 reemplaza A5; D12 fija A4; D17 reemplaza el comportamiento de POST; D11 cambia SC-007 de 47 a **67**.
3. El escenario de enero 2027 (D27) está escrito como configuración concreta: regla L-V para todo el mes, excepciones de sábados 16 y 23 abiertos, lunes 18 y 25 cerrados, y el resto de días sin regla ni excepción cerrado (D23).
4. Quedan 7 consecuencias nuevas (CF1 a CF7) para confirmar en Gate 2. Las más importantes son el conflicto D6 vs D23 en meses con solo excepciones (CF1), el tratamiento del bloqueo de día completo (CF2) y la visibilidad pública inmediata de cada regla (CF5).
5. Checklist: 14/16 antes, 16/17 después. Queda abierto solo el ítem de FR-024 (A6).

## Verificación de calendario y cifras

Verificado con cálculo de calendario (script de fechas):

- **Diciembre 2026**: el día 1 es martes. Días 1 a 13 con lunes a viernes: 1, 2, 3, 4, 7, 8, 9, 10, 11 (9 días). Sábados y domingos cerrados: 5, 6, 12, 13. Días 14 a 23: 10 días, incluidos sábado 19 y domingo 20.
- **SC-007 recalculado**: regla A (240/true/3, 6 horarios) aporta 3 espacios por día; regla B (0/false/4, 4 horarios) aporta 4 espacios por día. Total: 9 × 3 + 10 × 4 = **67**. La versión anterior daba 47 con 240/true/3 para 14-23 (2 espacios por día). Cambio causado por D11.
- **Enero 2027**: el día 1 es viernes. Lunes a viernes: 21 días. Sábados: 2, 9, 16, 23, 30. Con D27, los lunes 18 y 25 quedan cerrados y los sábados 16 y 23 abiertos. Días abiertos: 19 de lunes a viernes + 2 sábados = 21. Espacios de un mes vacío: 21 × 3 = 63. Este número es derivado de D27 con D3 y D6; no es una cifra del owner y no se usa como SC.

## Cambios por decisión

| Cambio | Dónde |
|---|---|
| Q1 a Q18 registradas, una viñeta por respuesta | `spec.md`, `## Clarifications` / `### Session 2026-10-28` |
| Supersesiones (A5, A4, POST de meses nuevos, SC-007) | `spec.md`, bloque "Supersesiones y efectos" |
| Consecuencias nuevas CF1 a CF7 | `spec.md`, bloque "Consequences to confirm" |
| Lista abierta: A6 y supuestos heredados | `spec.md`, bloque "Open" |
| Constante 3 de capacidad parametrizada por `maxPerDay` | FR-010, FR-011, FR-026; US3 escenario 3; Fases fase 1 |
| Diálogo de confirmación antes de guardar (no aviso posterior) | FR-023; Edge "Citas existentes fuera del nuevo horario"; US1 escenario 2; Fases fase 2 |
| Guardado desactualizado rechazado | FR-041 (nuevo); Edge "Guardado desactualizado"; Fases fase 1 |

Notas sobre la codificación:

- Los encabezados de plantilla se mantienen en inglés (`Clarifications`, `User Scenarios & Testing`, `Requirements`, `Success Criteria`, `Assumptions`, `Documentation Impact`). El contenido está en español (D26).
- El stage `speckit-clarify` normalmente hace preguntas al usuario. Aquí no se hizo porque las respuestas ya fueron dadas por el owner a través del Orchestrator. Las dudas nuevas no se resolvieron por el Assistant: van a CF1 a CF7 como preguntas con opciones.
- En `spec.md`, las consecuencias y los puntos abiertos usan etiquetas en negrita, no encabezados nuevos, para respetar la regla de `speckit-clarify` de no añadir encabezados fuera de `## Clarifications` y `### Session`.

## Tabla de cobertura (D10-D27, A6)

| ID | Decisión | Dónde aterrizó en `spec.md` | Estado |
|---|---|---|---|
| D10 | Excepciones con parámetros propios, defaults 240/true/3, también en fechas sin regla | FR-004; Key Entities (Excepción); US2 escenarios 1 y 4; Edge "Excepción sin regla"; Clarifications Q1 | Encodada |
| D11 | Regla 14-23 dic. 2026 = 0/false/4; SC-007 = 67 | US4 escenario 1; FR-011; FR-026; SC-007; Supersesiones; Documentation Impact (4.3 máximo diario por regla) | Encodada. Cambia SC-007 de 47 a 67 |
| D12 | "Slots restantes" = citas adicionales alcanzables con tope en `maxPerDay`; fija A4 | FR-026; FR-027; Assumptions (A4); Clarifications Q3 | Encodada |
| D13 | Día cerrado gris como hoy; día abierto con semáforo normal | FR-028; Documentation Impact (15.7 tono de calendario); CF7 (caso de día sin horarios por hora pasada) | Encodada |
| D14 | Cada horario bloqueado = 1 espacio; se elimina "Por bloque" | FR-029; Documentation Impact (`BlockSpacesModal`, 15.7); Fases fase 2; CF2 (día completo) | Encodada. Día completo pendiente (CF2) |
| D15 | Todos los bloqueos manuales = evento de 1 h; reemplaza A5 | FR-036; Supersesiones; Assumptions (A5 reemplazada); Documentation Impact (cambios de contrato, decisions); CF2 y CF3 | Encodada. Día completo y eventos existentes pendientes (CF2, CF3) |
| D16 | `PATCH slot-mode` reemplaza reglas por preset D4 y sincroniza `slot_mode`; `GET` añade `rules` | FR-034; Documentation Impact (api.md, cambios de contrato); Flow Contract Check (API parcial); CF6 | Encodada. Alcance de excepciones y diálogo pendiente (CF6) |
| D17 | `POST /api/admin/months` no crea reglas; mes nuevo usa D6; eliminar todas las reglas vuelve a D6 | FR-008; Edge "Mes sin reglas"; Documentation Impact (admin-months-catalog-flow paso 9, cambios de contrato); Supersesiones; CF1, CF4, CF5 | Encodada. Efecto en `slot_mode` y visibilidad pública pendiente (CF4, CF5) |
| D18 | Citas fuera de horario: diálogo de confirmación antes de guardar | FR-023; Edge "Citas existentes fuera del nuevo horario"; US1 escenario 2; Fases fase 2; Documentation Impact (components.md); CF6 | Encodada. Alcance pendiente (CF6) |
| D19 | `slot_mode` derivado de reglas si coinciden con preset; si no, último valor (rollback) | FR-033; Migration Compatibility Check (rollback: Yes); data-model.md en Documentation Impact; CF4 | Encodada |
| D20 | `minGapMinutes` 0 a 1440; `maxPerDay` 1 a 6 | FR-025; FR-011; FR-026; Key Entities (Regla); Cambios de contrato | Encodada |
| D21 | Máximo 24 horarios por día, validado al guardar | FR-025; Edge "Costo de cálculo" | Encodada |
| D22 | Horarios pasados del día actual se retiran antes de calcular capacidad | FR-014; FR-010; Edge "Mismo día"; CF7 | Encodada |
| D23 | Día sin regla ni excepción queda cerrado | FR-007; Edge "Días no cubiertos"; US1 escenario 1; US4 escenarios 1 y 2; supuesto eliminado de Assumptions. CF1 (mes con solo excepciones) | Encodada. Caso de mes con solo excepciones pendiente (CF1) |
| D24 | Cambios de reglas sin auditoría de citas; guardado desactualizado se rechaza | FR-035; FR-041 (nuevo); Edge "Guardado desactualizado"; Assumptions (auditoría); Fases fase 1 | Encodada |
| D25 | Separación medida entre horas de inicio | FR-009; US3 (encabezado); Assumptions (supuesto eliminado) | Encodada |
| D26 | Encabezados de plantilla en inglés, contenido en español | Encabezados de la plantilla en `spec.md`; Checklist, Notas | Encodada |
| D27 | Enero 2027: sábados 16 y 23 abiertos, lunes 18 y 25 cerrados, resto L-V con mismas horas (240/true/3) | US4 escenario 2 (escenario completo y cálculo derivado de 63 espacios); Clarifications Q18; Fases fase 3 | Encodada |
| A6 | "Fuera de horario" = fecha u hora ya no ofrecida; no incluye separación ni capacidad | FR-024 (marcado `[ASSUMPTION, por confirmar]`); bloque "Open" | Pendiente de confirmación del owner en Gate 2 |

Supuestos no registrados que se mantienen como `[ASSUMPTION]` y van en el bloque "Open" para confirmar en bloque en Gate 2: FR-020, FR-021, FR-024 (citas pasadas), FR-025 (al menos un día de la semana por regla), FR-030 (`maxPerDay=3` en el backfill), FR-031, Edge "Hora repetida", Edge "Regla sin días de la semana, horas o rango", Edge "Lock activo sobre un horario que se elimina". Se mantienen como `[ASSUMPTION]` para no decidirlos en esta etapa, aunque la instrucción de la etapa pedía dejar solo A6 y las nuevas consecuencias como abiertas.

## Consequences to confirm (CF1 a CF7)

Resumen. Texto completo con opciones en `spec.md`, bloque "Consequences to confirm".

- **CF1**: mes con solo excepciones y sin reglas. D6 (default del mes) y D23 (día no cubierto cerrado) se contradicen. Opciones: A) D6 aplica a los días no cubiertos; B) D23 literal, días no cubiertos cerrados.
- **CF2**: bloqueo de día completo. D15 dice "todos" los bloqueos manuales a 1 h; FR-036 mantenía `06:00-23:00`. También falta definir cómo cuenta en "Espacios bloqueados" (D14). Opciones: A) 1 h también; B) 06:00-23:00 y solo horarios a 1 h.
- **CF3**: bloqueos ya existentes en meses `SECOND_ONLY` (cambio de comportamiento por D15, Google Calendar). Opciones: A) solo bloqueos nuevos; B) actualizar existentes a 1 h.
- **CF4**: `slot_mode` de meses nuevos y sin reglas (D17 + D19). Opciones: A) `BLOCK_MODE` (coincide con D6); B) `SECOND_ONLY_MODE` sin reglas, como hoy.
- **CF5**: visibilidad pública inmediata (D17, D11). Un mes nuevo se abre con L-V 09:00-18:00 al crearse y cada regla cambia el público al guardar, incluidos sábado 19 y domingo 20 de diciembre 2026. Opciones: A) cambios inmediatos; B) estado de borrador o publicación (feature nueva, fuera de alcance).
- **CF6**: alcance de D18 y de `PATCH slot-mode` (D16). (a) ¿El diálogo aplica a eliminar y a `PATCH slot-mode`? (b) ¿`PATCH slot-mode` borra excepciones o solo reglas? Opciones para (b): A) solo reglas (lectura literal de D16); B) reglas y excepciones.
- **CF7**: día cuyas horas ya pasaron (D13 + D22). Opciones: A) gris, como cerrado; B) semáforo `full`, como abierto sin espacios.

## Checklist (before/after)

- Antes: 14/16 ítems marcados (Preparación 2/4).
- Después: 16/17 ítems marcados (Preparación 4/5). Se añadió un ítem para SC-007 (67, verificado). Queda abierto el ítem de FR-024 por A6.

## Chequeos realizados

- Lectura de `spec-authoring-workflow.md`, `subagent-workflow.profile.md` (claves `{{...}}` resueltas), `spec.md` previo, `00-decisions.md` (D1-D27, A1-A6), `01-specify.md`, `checklists/requirements.md`, y `.agents/skills/speckit-clarify/SKILL.md` (formato del registro).
- Búsqueda de referencias a Q1-Q18, "Preguntas abiertas" y "NEEDS CLARIFICATION" en `spec.md`: sin referencias obsoletas fuera de `## Clarifications`. Las apariciones de "47" y "Por bloque" que quedan son notas de supersesión o de eliminación (FR-029, Documentation Impact, Clarifications), no texto vigente.
- Encabezados de `spec.md` revisados: solo los de plantilla y los dos permitidos por `speckit-clarify` (`## Clarifications`, `### Session 2026-10-28`) se agregaron. Ningún encabezado nuevo.

## Acciones para el Orchestrator (no son decisiones de producto)

- Gate 2: el owner debe responder CF1 a CF7, confirmar A6 y los supuestos heredados. Cada respuesta se añade a `00-decisions.md` con su ID nuevo (por ejemplo D28 y siguientes) antes de un nuevo clarify.
- Idioma: el informe y la spec están en español porque así lo fija D8, aplicado también en 01-specify.md. La instrucción general del Assistant pide documentación en inglés. Confirmar con el owner si D8 sigue vigente para este paquete; si no, se traducen en un paso aparte.
- `specs/README.md` no tiene tabla de registro. Pendiente de la fila de la feature con `tasks.md` (sin cambio en esta etapa).
- `data_model_doc` del perfil sigue en `none`. Actualizar a `docs/architecture/data-model.md` cuando se cree el archivo (fase de documentación).
- La constante `3` de capacidad y métricas en el código (`lib/availability`, `blocked-spaces`, métricas de meses) debe parametrizarse por `maxPerDay`. Es trabajo de plan y fase 1, no una pregunta al owner.
