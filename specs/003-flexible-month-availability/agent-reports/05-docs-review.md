# 05 - Revisión documental (Docs Reviewer) - 003 Disponibilidad flexible por mes

Fecha: 2026-10-28. Modo auditoría (solo lectura; este es el único archivo creado). Paquete revisado: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, tasks.md, checklists/, agent-reports/00-decisions.md.

## Veredicto: Rejected (3 hallazgos bloqueantes, todos de corrección menor)

## Alcance de la comprobación

- `speckit-analyze` (lectura): cruce spec/plan/tasks. Cifras revisadas: 75 tareas (36+14+7+13+5) coinciden con la tabla; SC-007 = 67 y enero 2027 = 63 verificados contra el calendario (1 dic 2026 martes; 1 ene 2027 viernes); 48/432 (D43) consistente en spec, plan, research, contracts y tasks; `SLOT_NOT_AVAILABLE` (D46) consistente.
- Constitución (I a V) y AGENTS.md: sin conflicto de fondo; ver B2/B3.
- Specs previas: 001 (logs solo de citas) y 002 (FR-016 mismas reglas de disponibilidad; FR-017 sin regla de 15 días en reprogramación) sin conflicto; T026 conserva la ausencia de la regla de 15 días (T025 la mantiene solo en el lock público).

## Cobertura de decisiones D1-D49

Todas aterrizan en spec/plan/tasks. Mapa abreviado: D1 FR-009/T008/ADR T071; D3 FR-002/T006; D4 FR-030/T002; D5 FR-022/T005; D6 FR-008/T007; D7 T071; D8 (idioma) sin tarea, aplica por perfil; D9 US4/T021/T052; D10 FR-004/T041; D11 SC-007/T021; D12 FR-026/T008; D13/D34 FR-028/T019; D14/D41 FR-029/T020/T046; D15/D29/D30 FR-036/T031/T032; D16/D33 FR-034/T029; D17/D31 T004/T029; D18/D40/D35 T012/T044; D19 T011; D20/D21 T006/T010; D22 T008; D23/D28 T007; D24 T029/T016; D25 T008; D26 n/a; D27 T052; D32 sin tarea ni prueba (comportamiento natural de leer BD; ver N7); D36 T029; D37/D38 T010; D39 T027; D42 aceptado sin tarea; D43 T051; D44 T061; D45 plan Rollout/T034; D46 T023-T026; D47/D48 sin tarea; D49 T068.
Supersesiones correctamente reflejadas: D2 por D43 (48/432), A5 por D15, A4 por D12. Nada contradice el registro.

## Hallazgos bloqueantes

**B1. Supuestos del plan no marcados `[ASSUMPTION]` ni elevados como preguntas abiertas** (regla de revisión 2).
- `plan.md`, sección *Assumptions*: A-01, A-02, A-05, A-07, A-08, A-09, A-10, A-11 son supuestos sin la etiqueta `[ASSUMPTION]`; solo A-01 aparece indirectamente (RQ-2). *Open Questions* no los lista. El registro dice "Preguntas abiertas: Ninguna" mientras RQ-1/RQ-2 siguen abiertas.
- Con efecto visible para el producto: A-08 (la hora actual se compara con `>=`, es decir, un horario igual a la hora actual se conserva) contradice el texto de la spec, edge "Mismo día" ("solo cuentan los horarios posteriores") y D22; FR-014 dice "anteriores" (compatible con `>=`), pero la edge case dice "posteriores". A-11 (bloqueos de horas fuera de la rejilla no suman a "Espacios bloqueados"). A-09 (el preset solo coincide con rango de mes completo) añade una condición a FR-033.
- Corrección requerida (Assistant): etiquetar cada ítem `[ASSUMPTION]` y listar en *Open Questions* los de efecto de producto (A-08, A-09, A-11; A-01 ya cubierto por RQ-2). Alinear la edge case "Mismo día" con FR-014/A-08 en la redacción. Decidir el resultado es del Orchestrator/owner (cambia comportamiento observable), no del Assistant.

**B2. Contradicción sobre el momento de reconciliar `docs/specification.md` y `business-rules.md`.**
- `spec.md` (Documentation Impact): "Actualizar antes de implementar". `plan.md` (*Orden de actualización*): `specification.md`, `business-rules.md`, `booking-flow.md`, `my-appointments-flow.md`, `admin-months-catalog-flow.md` en **fase 4**. `tasks.md`: T073 las actualiza al cierre de **fase 3**, y T074 (fase 4) solo `my-appointments-flow.md` y `admin-months-catalog-flow.md`. Las tres fuentes no coinciden.
- Impacto: AGENTS.md exige revisar y actualizar `specification.md` como parte del trabajo y la constitución III pide docs en el mismo cambio. Con D45 (fases 1+2 en un mismo release), la fase 3 es la última antes de salir a producción, por lo que T073 es el único alineamiento defendible; el plan (fase 4) permitiría liberar con `specification.md` desalineado.
- Corrección requerida: alinear spec y plan con tasks (T073 en cierre de fase 3 para `specification.md`, `business-rules.md`, `booking-flow.md`; fase 4 solo los demás), y reemplazar "antes de implementar" por el calendario real. Confirmar con el Orchestrator que la reconciliación a cierre de fase 3 es aceptable frente a AGENTS (actualizar antes de implementar).

**B3. FR-011 incumplido en el release de fases 1+2 por el dashboard.**
- FR-011 (MUST): ninguna capacidad ni métrica usa la constante 3, "incluido el dashboard de `/admin`" (D44). `tasks.md` T060/T061 y `plan.md` PD-14 colocan el cambio del dashboard en la **fase 4** (con autorización posterior y después de liberar fases 1+2 según D45). Con una regla 0/false/4 (diciembre 2026) el dashboard mostraría capacidad 3 por día tras el release.
- Además T060 (quitar `MAX_APPOINTMENTS_PER_DAY`) precede numéricamente a T061 pero depende de él.
- Corrección requerida: mover el cambio del dashboard (T061 con su prueba) a la fase 1 (nueva ronda o ronda 1C), dejar en fase 4 solo el borrado de constantes, o bien declarar explícitamente la excepción temporal en spec FR-011 (decisión de alcance: Orchestrator).

## Hallazgos no bloqueantes

- N1. `plan.md` *High-risk areas and round split* describe Fase 1 en dos rondas (1a/1b) y Fase 4 con tabla de registro eliminada; `tasks.md` usa cinco rondas 1A-1E (todas <= 10 tareas, cumple el criterio) y deja `availability_migration_runs` condicionada al owner (T065). Actualizar el plan a las rondas reales.
- N2. `data-model.md` (migración, paso 5) pone `availability_version = 1` en meses con regla del backfill; T002/T005 no lo mencionan y T005 verifica que una segunda ejecución no cambie la versión. Alinear (agregar el paso a T002 o quitarlo).
- N3. `agent-reports/00-decisions.md`: D2 aún dice 27/432; D43 pide "Actualizar D2". Acción del Orchestrator (anotar "reemplazada por D43"). También `plan.md` línea 5 y `research.md` listan "D1-D42" como entrada; mencionar D43-D49.
- N4. `agent-reports/STATE.md` está desactualizado (dice Gate 2 pendiente y sin plan/tasks). Actualizar antes de Gate 3 (T-orquestador ya lo indica).
- N5. Tamaño de tareas: T036 agrupa 10 archivos de prueba y T045 reescribe un componente de 1826 líneas; considerar dividirlas aunque las rondas no excedan 10 tareas. T062 duplica en parte T019 (comparación con mes anterior).
- N6. `data_model_doc` sigue en `none` (Q-T3 conocido, no es hallazgo). `{{data_model_doc}}` se declara correctamente en T071 y en Acciones del Orquestador; `docs/decisions/` por crear (Q-T4 conocido).
- N7. D32 (cambios visibles de inmediato) y D42 (primera regla cierra días) no tienen prueba explícita; añadir un caso en T014/T054.
- N8. `specs/README.md` tiene la fila 003 (`Draft`), correcta para esta etapa; T074 la pasa a `Implemented` tras implementar.
- N9. El *Flow Contract Check* de la spec marca "API contract: Parcial"; el plan ya lo marca Yes. Sin acción (se consolida en T075).

## Documentation impact (verificación)

Declarado completo: `specification.md` (4.1, 4.2, 4.3, 7, 10, 12, 15.7), `business-rules.md`, `features/*` (4 archivos), `api.md`, `ui/admin/components.md`, nuevo `docs/architecture/data-model.md` (T071), `docs/decisions/*`. Flow Contract Check, Migration Compatibility Check, 4 fases AGENTS, Admin UI Check y Notification Contract Check presentes (spec y plan; T075 al cierre). Reglas de admin (`components/admin/ui/`, `sileo`, `react-i18next`, promoción de `TimeSlotChipInput`) cumplidas en el diseño.

## Siguiente paso

Assistant corrige B1 (etiquetas y redacción), B2 y N1/N2 de redacción; Orchestrator decide B3 (mover dashboard o excepción) y las respuestas de A-08/A-09/A-11. Repetir revisión (ciclo 2 de 3).
