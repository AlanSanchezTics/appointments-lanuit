# Informe 04 - speckit-plan y speckit-tasks: Disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability`
**Etapa**: `speckit-plan` y `speckit-tasks` (solo estas dos). No se ejecutaron `speckit-analyze`, `speckit-converge` ni `speckit-implement`. Se detiene después de `tasks.md`.
**Fecha**: 2026-10-28
**Estado**: plan y tareas en borrador para `reviewer-docs` (Gate 3). Preguntas abiertas para el owner (ver sección 4).

## 1. Archivos generados o modificados

Dentro de `specs/003-flexible-month-availability/`:

- `plan.md` (generado por el script de setup a partir de la plantilla, después completado)
- `research.md`
- `data-model.md`
- `contracts/admin-availability-api.md`
- `contracts/availability-engine.md`
- `quickstart.md`
- `tasks.md`
- `agent-reports/04-plan-tasks.md` (este informe)

Fuera de la carpeta del feature (solo lo que indicó el brief):

- `specs/README.md`: añadido el registro de specs (tabla Number | Spec | Title | Status). 001 `Completed` y 002 `Implemented` leídos de sus `spec.md`; 003 `Draft`. Se conservó el texto introductorio.

No se tocaron `docs/`, código de aplicación, `AGENTS.md`, `CLAUDE.md`, `.specify/memory/*` ni el perfil `docs/standards/subagent-workflow.profile.md`.

Archivo temporal fuera del repositorio (scratchpad, verificación): `engine-variants.mjs`, port del experimento de equivalencia.

## 2. Verificación del motor (evidencia para el plan)

Se portó `lib/availability/rules.ts` (rama BLOCK_MODE y SECOND_ONLY) y el experimento `equiv.ts` a un script independiente. Resultados sobre 20 ocupaciones alcanzables y 432 combinaciones:

| Variante | Diferencias sin bloqueos | Diferencias con bloqueos |
|---|---|---|
| Experimento completo (grupos de pares + intersección) | 0 | 27 (reproduce D2) |
| Grid menos bloqueos (texto de FR-013) | 0 | 48 |
| Solo intersección, sin grupos de pares | 0 | 58 |
| Solo grupos de pares | 0 | 48 |

Conclusión: el gate sin bloqueos (SC-002) es alcanzable con el motor propuesto. La cifra de SC-003 (27) solo se reproduce con lógica de pares legados, que D1 elimina. Ver pregunta Q-P1.

## 3. Cobertura de decisiones D1-D42

Ubicación en `plan.md` (PD-xx = decisión técnica del plan; A-xx = supuesto), `research.md` (R-xx), `data-model.md`, `contracts/*` y `tasks.md` (T-xxx).

| ID | Decisión (resumen) | Dónde aterrizó | Tareas |
|---|---|---|---|
| D1 | `minGapMinutes` reemplaza pares direccionales | plan PD-01; research R-01; capacity engine en contracts/availability-engine.md | T008, T014, T015, T024 a T026, T058 |
| D2 | Bloqueos manuales usan el modelo nuevo; 27/432 | research R-02 (evidencia de 4 variantes); plan Q-P1; ADR | T015 (gate pendiente), T051 (BLOQUEADA), T071 |
| D3 | Regla: minGap, preserveCapacity, maxPerDay; 240/true/3 | data-model `availability_rules`; contracts (defaults) | T001, T002, T006 |
| D4 | Backfill BLOCK y SECOND_ONLY | data-model (tabla de mapeo); PD-12; contracts | T002, T005 |
| D5 | Citas intactas al editar | plan PD-05, Migration Compatibility Check; contracts (no escriben citas) | T005, T027, T029, T057 (S-03) |
| D6 | Mes sin reglas usa default L-V 09/10/13/14/17/18 240/true | PD-02 paso 3; contracts/availability-engine.md (tabla de ejemplos) | T007, T014 |
| D7 | Nuevo `docs/architecture/data-model.md` | data-model.md (documento de trabajo); doc final | T071 |
| D8 | Docs nuevos en español | Todo el paquete en español; templates de Spec Kit en inglés (D26) | Aplicado en todos los archivos; T071 indica idioma |
| D9 | Casos de aceptación dic 2026 y ene 2027 | contracts/availability-engine.md (ejemplos); quickstart S-04, S-05 | T021, T052, T057 |
| D10 | Excepciones con sus propios parámetros (240/true/3) | data-model `availability_exceptions`; contracts (AvailabilityException) | T007, T041, T014 |
| D11 | Regla 14-23 dic: 0/false/4 | contracts (ejemplos, 67 espacios); quickstart S-04 | T021, T052 |
| D12 | "Slots restantes" = adicionales alcanzables con tope | plan PD-13; contracts engine paso 6 | T008, T019 |
| D13 | Día cerrado gris; sábado habilitado usa semáforo | plan PD-13 (tono `closed`) | T019, T045 |
| D14 | Cada horario bloqueado cuenta 1; sin "Por bloque" | plan PD-13; `day-block.ts` | T020, T046 |
| D15 | Bloqueos puntuales crean evento de 1 h | plan PD-10; research R-15 | T031, T032, T071 |
| D16 | `PATCH slot-mode` reemplaza reglas por preset; `GET` añade `rules` | contracts/admin-availability-api.md (PATCH, GET); PD-11 | T029, T034, T035 |
| D17 | `POST /api/admin/months` no crea reglas | contracts (POST); PD-11 | T004, T029, T035 |
| D18 | Diálogo de citas fuera de horario antes de guardar | PD-06; contracts (preview y 409); quickstart S-06 | T039, T044, T055 |
| D19 | `slot_mode` derivado de reglas; si no, último valor | PD-11; data-model (derivación); research R-10 | T011, T018, T029 |
| D20 | minGap 0-1440; maxPerDay 1-6 | data-model y contracts (códigos); PD-03 | T010, T016 |
| D21 | Máximo 24 horarios por día | PD-03; códigos `AVAILABILITY_TIMES_LIMIT_EXCEEDED` | T010, T016 |
| D22 | Horas pasadas del día actual fuera antes de capacidad | contracts/availability-engine.md paso 2; ejemplo "hora actual" | T008, T014 |
| D23 | Día sin regla ni excepción cerrado | PD-02 paso 2; contracts (ejemplo mes con regla) | T007, T014 |
| D24 | Sin auditoría de citas por reglas; concurrencia rechaza guardado desactualizado | PD-07; research R-16; contracts (409 versión) | T003, T027, T029, quickstart S-08 |
| D25 | Separación medida entre horas de inicio | contracts/availability-engine.md paso 5 | T008, T014 |
| D26 | Encabezados de plantilla en inglés, contenido en español | Formato de todos los archivos del paquete | Aplicado; T075 verifica |
| D27 | Enero 2027 con excepciones de sábados y lunes | contracts (ejemplos); quickstart S-05 | T021, T052 |
| D28 | Mes con excepciones y sin reglas: default D6 en días no cubiertos | PD-02 paso 3; contracts (tabla) | T007, T014 |
| D29 | Día completo mantiene `06:00-23:00` | PD-10; research R-15; data-model (marcador) | T032 |
| D30 | Solo bloqueos nuevos a 1 h; eventos existentes intactos | PD-10; research R-15 | T031, T032, quickstart S-11 |
| D31 | Meses nuevos y sin reglas: `slot_mode = BLOCK_MODE` | PD-11; data-model (`slot_mode` default); contracts (POST) | T004, T011, T018, T029, T035 |
| D32 | Cambios visibles de inmediato; sin borrador | PD-05 (sin borrador); PD-08 (lectura en tiempo real) | T022 |
| D33 | Diálogo aplica a crear, editar, eliminar y `PATCH`; `PATCH` conserva excepciones | PD-06; PD-11; contracts (PATCH) | T018, T029, T034 |
| D34 | Día sin horarios resueltos (incl. horas pasadas) gris | contracts engine paso 1 y 2; PD-13 | T008, T019, T045 |
| D35 | "Fuera de horario": cita activa futura cuya hora ya no resuelve el motor | PD-06; A-03 y A-04; contracts (preview) | T012, T017 |
| D36 | Edición solo en meses no pasados (`MONTH_IN_PAST`, 422) | contracts (PUT, PATCH, estados) | T029, T033, T035 |
| D37 | Horas repetidas normalizadas al guardar | PD-03; contracts engine (ejemplo) | T010, T016 |
| D38 | Regla inválida se rechaza (día, hora, rango) | PD-03; códigos `AVAILABILITY_RULE_*_REQUIRED` | T010, T016 |
| D39 | Lock sobre horario eliminado: TTL, confirmación contra reglas vigentes | PD-08; research R-06; quickstart S-10 | T024, T025, T027 |
| D40 | Diálogo solo con reglas y excepciones; bloqueos fuera del cálculo | PD-06; A-04; contracts (preview) | T012, T017 |
| D41 | Día completo cuenta por horario de la rejilla vigente | PD-13; data-model (marcador); quickstart S-12 | T020, T021 |
| D42 | Primera regla de mes sin reglas cierra días no cubiertos (sin advertencia extra) | PD-02; contracts (`usesDefaultRule`, sin advertencia de producto) | T007, T014 |

Cobertura: 42/42 decisiones aparecen en el plan o en las tareas. D2 y D15 necesitan cifra o confirmación del owner para cerrarse en `docs/`. D26 y D8 son de formato y no tienen tarea propia de implementación (se verifican en la entrega).

## 4. Supuestos y preguntas

### 4.1 Supuestos del plan ([ASSUMPTION], sin decisión del owner)

Los supuestos están en `plan.md`, sección *Assumptions*.

- A-01 `expectedVersion` opcional en `PATCH slot-mode` (compatibilidad de fase 1-2).
- A-02 El editor guarda el conjunto completo en una sola escritura. FR-020 se cumple en la UI.
- A-03 "Citas que quedan fuera" = diferencia entre horario vigente y propuesto (no todas las citas fuera del horario nuevo).
- A-04 "Horarios que resuelve el motor" (D35) = rejilla de horas de la regla o excepción del día, sin ocupación, separación ni capacidad. Relacionado con Q-P2.
- A-05 Locks activos cuentan como ocupados en el flujo público y no en métricas admin (como hoy).
- A-06 Saturación y comparación con el mes anterior conservan su fórmula y usan las reglas de ese mes. Relacionado con Q-P4.
- A-07 `availableSlots` y `excludeAppointmentId` en la agenda son campos nuevos aditivos.
- A-08 La hora actual se compara con `>=` (legado), no con "posteriores" de D22. Diferencia de un minuto.
- A-09 `deriveSlotMode` coincide con un preset solo si la regla cubre el mes completo (default técnico FR-033).
- A-10 Días ISO 1 a 7, lunes = 1.
- A-11 "Espacios bloqueados" cuenta solo horas de la rejilla vigente (FR-029 literal).

### 4.2 Preguntas para el Orchestrator (producto)

Estas preguntas no se decidieron. Cada una tiene opciones y, cuando aplica, el efecto en las tareas.

- **Q-P1 (bloquea T051; afecta SC-003 y D2)**: la cifra de 27 diferencias con bloqueos se reproduce solo con la lógica de grupos de pares legados, que D1 elimina. La semántica literal de FR-013 da 48. Opciones: (A) aceptar la semántica literal y actualizar SC-003 y D2 a la cifra que resulte (48); (B) conservar una regla de pares dentro del motor nuevo para mantener 27 (contradice D1, requiere justificación); (C) otra. Pregunta: ¿qué cifra y semántica aprueba el owner?
- **Q-P2 (D35, FR-024)**: confirmar A-04 (rejilla de la regla o excepción, sin ocupación) y A-03 (solo citas que quedan fuera por el cambio).
- **Q-P3 (contrato de error)**: al reservar en un día sin horarios, ¿qué código devuelve la API? Hoy `WEEKDAY_ONLY`, que deja de tener sentido (FR-017). Propuesta del plan: `SLOT_NOT_AVAILABLE` para reservas y reprogramaciones; `DATE_NOT_OPERATIONAL` se mantiene en bloqueos. Afecta T023, T024 y T026.
- **Q-P4 (métricas)**: ¿saturación y comparación con el mes anterior siguen con la misma fórmula y con las reglas del mes anterior (A-06)?
- **Q-P5 (dashboard, bloquea T060 y T061)**: `lib/admin/dashboard/service.ts` usa `MAX_APPOINTMENTS_PER_DAY` (3) en capacidad semanal (15) y ocupación diaria. FR-011 prohíbe la constante 3 en "ninguna capacidad ni métrica", pero el dashboard no está en FR-016. Opciones: (A) capacidad = suma de `maxPerDay` de días resueltos; (B) mantener 3 y documentar la excepción; (C) otra.
- **Q-P6 (rollout)**: ¿el editor se habilita con bandera de configuración o con la fase 2? Afecta el rollback y la compatibilidad de `PATCH slot-mode` (409 con citas afectadas para clientes que no envían confirmación).
- **Q-P7 (contrato fase 4, bloquea T068)**: ¿se retira `slotMode` de `GET` y se elimina `PATCH slot-mode`, o se mantiene un alias calculado durante una versión? Recomendación del plan: alias calculado una versión y retirarlo después.

### 4.3 Preguntas y hallazgos técnicos para el Orchestrator

- **Q-T1 (perfil)**: `{{test_commands}}` apunta a `CLAUDE.md`, sección "Commands", que no existe (`CLAUDE.md` solo contiene `@AGENTS.md`). El plan usa los scripts de `package.json`. Pedir al owner corregir la clave o añadir la sección.
- **Q-T2 (técnico)**: versión de MySQL para `CHECK` constraints (MySQL 8.0.16 o superior). Si no está disponible, las validaciones quedan en aplicación.
- **Q-T3 (perfil)**: `{{data_model_doc}}` sigue en `none`. Actualizar a `docs/architecture/data-model.md` después de T071. No se edita el perfil en esta etapa.
- **Q-T4 (carpeta)**: `docs/decisions/` no existe. Se crea en T071.
- **Q-T5 (AGENTS.md)**: el paso 4 de `speckit-plan` (marcadores SPECKIT de `AGENTS.md`) no se ejecutó porque el brief limita los archivos a la carpeta del feature y `specs/README.md`. La extensión opcional `agent-context` (`after_plan`) tampoco se ejecutó (opcional; el brief no la pidió). `after_tasks` no tiene hooks registrados.

### 4.4 Hallazgos de código que el spec no cubre (ya incorporados en el plan)

- **Validación pública de horarios**: `lib/validation/appointment.ts`, `lib/validation/my-appointments.ts` y varias validaciones admin usan `z.enum(BASE_TIME_SLOTS)`. Con reglas de D9 (07:30, 14:30), las reservas se rechazarían. Incorporado (FR-006): T023, T030, T031.
- **Cálculo en el navegador**: `MonthDetailView.tsx` calcula horarios de reagendado en cliente con el motor legado. Incorporado (PD-09, A-07): T030, T034, T045.
- **Eventos de bloqueo en actualización**: `syncBlockedSlotUpdate` crea un evento nuevo cuando no hay `googleEventId`; debe usar 1 h. Incorporado: T032.
- **Lecturas de configuración fuera de la transacción de reserva**: riesgo de carrera con cambios de reglas. Incorporado (PD-08, R-06): T024 a T027; revisión de `reviewer-high-risk`.
- **Dashboard**: ver Q-P5.

## 5. Estructura de fases y rondas (tasks.md)

- Total: **75 tareas** (T001 a T075), numeradas en orden de ejecución y sin huecos.
- Fase 1 (backend y migraciones, alto riesgo): 36 tareas en 5 rondas (1A 5, 1B 10, 1C 6, 1D 6, 1E 9). Cumple la regla de rondas de 10 o menos.
- Fase 2 (UI/UX): 14 tareas en 2 rondas (2A 7, 2B 7).
- Fase 3 (pruebas y rollout): 7 tareas en 2 rondas (3A 4, 3B 3). T051 bloqueada por Q-P1.
- Fase 4 (cleanup, alto riesgo): 13 tareas en 2 rondas (4A 7, 4B 6). 4B requiere autorización del owner y Q-P7. Varias tareas de 4A bloqueadas por Q-P5.
- Reconciliación documental: 4 tareas por fase (T071 a T074) y verificación final (T075), con el contenido indicado en `plan.md`, *Documentation Impact*.
- Tareas con [P]: 19.
- Etiquetas [US1] a [US4] usadas como trazabilidad; las fases son las de AGENTS (desviación de la plantilla por instrucción del brief; se indica en el encabezado de `tasks.md`).

Formato validado: las 75 líneas de tarea siguen `- [ ] Txxx [P?] [USn?] descripción con ruta`. Las tareas de fases 1 a 4 llevan etiqueta de historia; las de reconciliación y cierre no.

## 6. Verificaciones de la entrega

- Flow Contract Check (plan): UI steps Yes (plan); API contract Yes (plan); Validation rules Yes (plan); Acceptance criteria Yes; `docs/specification.md` aligned No (pendiente de fases 2 y 4).
- Migration Compatibility Check (plan): Schema changes Yes; Backfill Yes; Legacy compatibility Yes; Rollback Yes; Cleanup Yes (fase 4); Integrity protections Yes.
- Admin UI Check (plan): usa `components/admin/ui/`; componentes reutilizables: `TimeSlotChipInput` (promoción justificada); tokens sin cambio; `docs/ui/admin/design-system.md` sin nuevos valores; flujo público sin cambio de UI (FR-018).
- Notification Contract Check (plan): `sileo` para guardado (`sileo.promise`) y errores; diálogo de afectadas no es notificación; textos con `react-i18next`.
- Documentation Impact (plan): Sí. `docs/*` no se tocó en esta etapa (brief). Lista completa en `plan.md` y en las tareas T071 a T074.
- Dependencias de `specs/README.md`: registro añadido (001 Completed, 002 Implemented, 003 Draft).

## 7. Siguiente paso recomendado (no ejecutado)

1. Responder Q-P1 a Q-P7 y Q-T1 a Q-T5 (el Orchestrator relaya al owner).
2. Lanzar `reviewer-docs` sobre el paquete (plan, research, data-model, contratos, quickstart, tasks, este informe). Aplicar `speckit-analyze` solo si el Orchestrator lo pide en esa revisión.
3. Gate 3: aprobación del paquete.
4. Gate 4: autorización de la fase 1 por rondas.

## 8. Ronda 3: decisiones D43 a D49 (coverage block)

Esta sección aplica las decisiones D43 a D49 de `agent-reports/00-decisions.md` y resuelve Q-P1 a Q-P7. Donde las secciones 2, 3, 4.1, 4.2, 4.3 y 5 anteriores dicen "pendiente" o "Q-P", queda reemplazado por lo siguiente. Esas secciones se conservan como historial.

Cambios de estado: D2 y SC-003 pasan a **48 de 432**; T051 y T060/T061 quedan desbloqueadas; T068 queda sin alias; la compatibilidad de rollout se resuelve con un solo release.

| ID | Decisión | Dónde aterrizó (spec / plan / contratos / research / tareas / quickstart) |
|---|---|---|
| D43 (Q-P1) | Corrige D2: 48 de 432 con bloqueos; 27 vino de variante con pares | spec: FR-013 ("48 de 432 (D43). [D2, D43]"), edge "Bloqueo manual que combina horarios", SC-003, Ronda 3. plan: Summary punto 2, Q-P1 resuelta, Testing. contracts/availability-engine: "Gate con bloqueos". research: R-02 Decision, tabla de variantes, alternativa (A) elegida. tasks: T015, T051 (desbloqueada, constante 48), Decisiones cerradas. quickstart: S-criterios de salida. |
| D44 (Q-P5) | Capacidad del dashboard = suma de `maxPerDay` de días resueltos | spec: FR-011 (dashboard incluido, [D44]), Documentation Impact (lista de cambios de contrato), Ronda 3. plan: PD-16, tabla de consumidores (fase 4), estructura (`lib/admin/dashboard/service.ts`), Q-P5 resuelta. research: R-14 reescrito. tasks: T060 (desbloqueada), T061 (capacidad = suma de `maxPerDay`, sin división entre cero). |
| D45 (Q-P6) | Fases 1 y 2 en el mismo release, sin bandera; PATCH slot-mode sigue funcionando | spec: Ronda 3 (sin cambio de FR). plan: PD-17, Rollout (paso 4 y rollback reescritos), Migration Compatibility Check (rollback), Q-P6 resuelta, RQ-2. contracts/admin-availability-api: compatibilidad de PATCH (ruta, cuerpo y forma de respuesta; 409 sin confirmación queda, RQ-2). tasks: T034 y sección de compatibilidad. quickstart: S-14 (rollback del release completo). |
| D46 (Q-P3) | Día sin horarios responde `SLOT_NOT_AVAILABLE` (reemplaza `WEEKDAY_ONLY`) | spec: FR-017 (añadido, [D46]), Documentation Impact (lista de cambios de contrato). plan: Summary punto 5, tabla de consumidores (`validation/appointment.ts`), docs/features/booking-flow (tarea de fase 4), Q-P3 resuelta. research: R-13 (confirmada). contracts/admin-availability-api: fila `SLOT_NOT_AVAILABLE` en la tabla de códigos. tasks: T023, T024, T026, T073. quickstart: S-09 (esperado `SLOT_NOT_AVAILABLE`). |
| D47 (Q-P2) | Confirmados A-03 y A-04 | plan: sección Assumptions (A-03 y A-04 "Confirmado por D47"), Q-P2 resuelta. contracts/admin-availability-api: preview (diferencia y rejilla, sin cambio de texto). spec: sin cambio (FR-024 y la edge ya lo describen; Ronda 3 lo registra). |
| D48 (Q-P4) | `projectedSaturationPercent` conserva su fórmula; cada mes usa sus reglas | plan: A-06 "Confirmado por D48", Q-P4 resuelta. research: R-12 (resuelto). tasks: T062 (leer reglas del mes anterior, sin cambio de fórmula). spec: Ronda 3 (sin cambio de texto). |
| D49 (Q-P7) | `slotMode` se retira de las respuestas de la API en fase 4, sin alias | spec: GET (`slotMode` legado, retiro en fase 4), Fases (fase 4), Ronda 3. plan: fase 4 (cleanup) con campo `slotMode` de las respuestas, PD-17, Q-P7 resuelta. contracts/admin-availability-api: nota de `slotMode` en GET, nota de PATCH en fase 4 (la respuesta pierde `slotMode`). tasks: T068 reescrita (sin alias, selector de entrada de PATCH se conserva), Decisiones cerradas, RQ-1. |

Residuales (para confirmar en Gate 3, no son decisiones pendientes del owner):
- RQ-1 (D49): el cuerpo de entrada de `PATCH slot-mode` conserva `slotMode` como selector de preset en fase 4; solo se retira de las respuestas. Es la interpretación del plan.
- RQ-2 (D45): sin `confirmAffectedAppointments` y con citas afectadas, `PATCH slot-mode` responde 409 sin escribir. Se conserva porque el editor del mismo release siempre confirma. Falta confirmar que no hay clientes externos que dependan de la respuesta anterior.
- Q-T1 a Q-T5: sin cambio. Son ítems técnicos de Gate 3 (perfil `{{test_commands}}`, versión de MySQL para CHECK, `data_model_doc`, `docs/decisions/`, marcadores de AGENTS.md).

Archivos tocados en esta ronda (solo dentro de `specs/003-flexible-month-availability/`): `spec.md`, `plan.md`, `research.md`, `contracts/admin-availability-api.md`, `contracts/availability-engine.md`, `quickstart.md`, `tasks.md`, `agent-reports/04-plan-tasks.md`. Fuera del feature no se tocó nada en esta ronda. `agent-reports/00-decisions.md` no se editó (lo mantiene el Orchestrator).

## 9. Ciclo 1 de revisión documental: D50 a D53 y correcciones (Assistant)

Aplica D50 a D53 y los hallazgos de `agent-reports/05-docs-review.md` (veredicto Rejected, ciclo 1). Los números de tarea de esta sección son los de `tasks.md` reescrito (78 tareas). Las tablas de las secciones 3 a 5 usan los números anteriores y quedan como historial.

Decisiones:
- D50 (A-08): se conserva `>=`. Corregido en `spec.md` (edge "Mismo día", FR-014) y en `contracts/availability-engine.md` (paso 2). Test: T014.
- D51: A-01, A-02, A-05, A-07, A-09, A-10 y A-11 marcados `[ASSUMPTION] default técnico (D51)` en `plan.md`, listados para Gate 3 (sección *Open Questions* y `spec.md`, Defaults técnicos).
- D52: conciliación por fases. `specification.md` y `business-rules.md` en T075 (cierre Fase 1); features y `ui/admin/components.md` en T076 (cierre Fase 2); verificación cruzada en T077 (cierre Fase 3, antes del release combinado, D45); cierre final en T078.
- D53: dashboard en Fase 1 (T022 y T023, después de T009). Borrado de `MAX_APPOINTMENTS_PER_DAY` en T066 (Fase 4A).

Correcciones de la revisión:
- B1: supuestos tageados y listados (ver D51); A-08 resuelto por D50.
- B2: `spec.md` (Documentation Impact) y `plan.md` (orden de actualización) alineados con `tasks.md`. Se reemplazó "antes de implementar" por el calendario de D52. Confirmación con el Orchestrator en RQ-3.
- B3: dashboard movido a Fase 1 (T022 y T023). T066 solo borra constantes en Fase 4A.
- N1: `plan.md` (High-risk and round split) describe las rondas reales: Fase 1 en 5 rondas (39 tareas), Fase 2 en 2 (17), Fase 3 en 2 (7), Fase 4 en 2 (11), cierre documental (4); total 78.
- N2: T002 incluye el paso `availability_version = 1` para meses con regla del backfill; T005 verifica que la segunda ejecución no lo cambia.
- N3: `plan.md` (línea de entrada y árbol) y `spec.md` mencionan D1-D53. `agent-reports/00-decisions.md` no se editó (lo mantiene el Orchestrator; D2 ya dice que la supera D43).
- N4: `STATE.md` no se tocó (responsabilidad del Orchestrator).
- N5: T036 (10 archivos de prueba) dividido en T037 (API), T038 (servicios A) y T039 (servicios B). T045 (MonthDetailView, 1826 líneas) dividido en T048, T049 y T050. T062 (duplicado de T019) absorbido en T019.
- N6: sin cambio (conocidos: `data_model_doc` en T075 y Acciones del Orquestador; `docs/decisions/` en T075).
- N7: D32 en T060 (integración: cambio visible en la siguiente lectura pública sin publicación); D42 en T014 (caso de primera regla) y en T060 (lectura pública). Añadidos a `plan.md` (Testing) y `quickstart.md` (S-09 y S-13).
- N8: `specs/README.md` sin cambio; 003 sigue en `Draft`; T078 la pasa a `Implemented`.
- N9: sin acción.

Mapa de números anteriores a nuevos (solo para lectura de las secciones 3 a 5):
- T051 (gate con bloqueos) → T057. T060 (constantes) → T066. T061 (dashboard) → T022/T023. T062 → absorbido en T019. T068 (slotMode) → T072. T071 a T074 (documentación) → T075 a T078. T036 (consumidores) → T038/T039. T045 (MonthDetailView) → T048 a T050.

Preguntas restantes para Gate 3:
- RQ-1 (D49): `slotMode` como selector de entrada de `PATCH slot-mode` en Fase 4 (T072).
- RQ-2 (D45): respuesta 409 de `PATCH slot-mode` sin confirmación (T036).
- RQ-3 (D52 frente a AGENTS): la conciliación por fases cumple "actualizar antes de implementar".
- D51: defaults técnicos A-01, A-02, A-05, A-07, A-09, A-10 y A-11 para revisar en Gate 3.
- Q-T1 a Q-T5: ítems técnicos de Gate 3, sin cambio.
