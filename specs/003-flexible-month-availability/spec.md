# Feature Specification: Disponibilidad flexible por mes

**Feature Branch**: `003-flexible-month-availability` (sin rama creada en esta etapa)

**Created**: 2026-10-28

**Status**: implemented at 2026-11-01

**Input**: User description: "Disponibilidad flexible por mes en /admin/months/[month]. Reemplaza el enum `slotMode` (BLOCK_MODE / SECOND_ONLY_MODE) por reglas de disponibilidad: rango de fechas + días de la semana + horas libres (HH:mm), más excepciones por fecha (p. ej. sábados sueltos). Cada regla tiene `minGapMinutes`, `preserveCapacity`, `maxPerDay`."

> Nota de alcance: este documento describe el comportamiento deseado para el cambio en curso. Es un artefacto de trabajo (constitución, principio II). Si contradice `docs/*`, prevalecen los documentos de `docs/*` hasta que se reconcilien (ver _Documentation Impact_). Las decisiones del registro (D1-D53) están aplicadas en el cuerpo del documento. Los supuestos A1-A6 están cerrados (A5 reemplazada por D15; A6 resuelta por D35 y D40). Los puntos que no decidió el owner se marcan como **default técnico** para revisión en Gate 3. No quedan consecuencias abiertas para el owner: CF1 a CF10 están resueltas (ver _Clarifications_).
>
> **Fuera de alcance**: duraciones por cita; reglas que cruzan meses (FR-019); cambios en el flujo público más allá de mostrar y aceptar los horarios resueltos (FR-018); eliminar `active_months.slot_mode` (FR-033, fase 4).

## Clarifications

### Session 2026-10-28

- Q1 (FR-004, parámetros de excepciones) → A: D10. Cada excepción lleva sus propios `minGapMinutes`, `preserveCapacity` y `maxPerDay`, con defaults 240/true/3; aplica también a fechas que no caen en ninguna regla.
- Q2 (US4, regla 14-23 dic. 2026) → A: D11. La regla usa `0 / false / 4`; cada día aporta 4 espacios. Supera el 3 histórico.
- Q3 (FR-026, "slots restantes") → A: D12. Son las citas adicionales alcanzables, con tope en `maxPerDay`. Fija A4.
- Q4 (FR-028, tono del calendario) → A: D13. Un día cerrado se pinta gris como hoy. Un día abierto, incluido un sábado habilitado, usa el semáforo normal.
- Q5 (FR-029, "espacio bloqueado") → A: D14. Cada horario bloqueado cuenta 1 espacio. Se elimina la vista "Por bloque". D41 precisa el bloqueo de día completo.
- Q6 (FR-036, duración de eventos espejo) → A: D15. Los bloqueos manuales crean evento espejo de 1 h. Reemplaza A5 y elimina "modalidad fija". D29 y D30 precisan el alcance (día completo y bloqueos existentes).
- Q7 (FR-034, `PATCH slot-mode` y `GET`) → A: D16. `PATCH slot-mode` reemplaza las reglas del mes por el preset D4 del modo indicado y mantiene `slot_mode` sincronizado. `GET` añade `rules` sin quitar `slotMode`. D33 precisa que se conservan las excepciones.
- Q8 (FR-008, meses nuevos) → A: D17. `POST /api/admin/months` no crea reglas: el mes nuevo recibe el default D6. Cambia el comportamiento actual, que crea `SECOND_ONLY`. Si se eliminan todas las reglas, el mes vuelve al default D6.
- Q9 (FR-023, citas fuera de horario) → A: D18. El mecanismo es un diálogo de confirmación con el listado antes de guardar. La definición de "fuera de horario" queda en D35 y D40.
- Q10 (rollback, Migration Compatibility Check) → A: D19. `slot_mode` se deriva de las reglas cuando coinciden con un preset de D4; si no coinciden, se conserva el último valor (FR-033). D31 precisa el caso sin reglas.
- Q11 (FR-025, rangos) → A: D20. `minGapMinutes` de 0 a 1440; `maxPerDay` de 1 a 6.
- Q12 (costo de cálculo, FR-010) → A: D21. Máximo 24 horarios por día, validado al guardar (FR-025).
- Q13 (FR-014, mismo día) → A: D22. Los horarios pasados del día actual se retiran de la rejilla antes de calcular capacidad.
- Q14 (FR-007, días sin regla) → A: D23. Un día sin regla ni excepción queda cerrado. D28 precisa el caso de un mes sin reglas.
- Q15 (auditoría y concurrencia) → A: D24. Los cambios de reglas no generan auditoría de citas. Un guardado desactualizado se rechaza (FR-041).
- Q16 (FR-009, medición de la separación) → A: D25. La separación se mide entre horas de inicio.
- Q17 (encabezados) → A: D26. Los encabezados de plantilla de Spec Kit van en inglés y el contenido en español (D8).
- Q18 (US4, enero 2027) → A: D27. Sábados 16 y 23 abiertos con `09:00, 10:00, 13:00, 14:00, 17:00, 18:00` y `240/true/3`. Lunes 18 y 25 cerrados. El resto de los lunes a viernes usa las mismas horas (ver US4, escenario 2).

**Supersesiones y efectos**

- D15 reemplaza A5 (FR-036): los bloqueos de horario puntual crean evento de 1 h, también en meses `SECOND_ONLY`. El bloqueo de día completo queda fuera de esta regla (D29).
- D12 fija A4 (FR-026, FR-027).
- D17 reemplaza el comportamiento de `POST /api/admin/months`: ya no crea reglas y el mes usa D6.
- D11 cambia la referencia de SC-007 de 47 a **67** (9 días × 3 + 10 días × 4). La constante 3 de capacidad y métricas se parametriza por el `maxPerDay` del día (FR-011, FR-026; D20 permite hasta 6).
- D28 precisa D6 y D23: D6 es el default de un mes sin reglas, también con excepciones, para los días que ninguna excepción cubre; D23 aplica desde que el mes tiene al menos una regla.
- D29 precisa D15 para el día completo (evento `06:00-23:00`). D30 limita D15 a los bloqueos creados desde el despliegue.
- D31 prevalece sobre la regla general de D19 para meses sin reglas: `slot_mode = BLOCK_MODE`, no "último valor".
- D33 precisa D16: `PATCH slot-mode` reemplaza solo las reglas y conserva las excepciones.
- D40 precisa D18 y D35: el diálogo lista solo citas afectadas por cambios de reglas o excepciones; los bloqueos manuales no entran en ese cálculo.
- D41 precisa D14 para el bloqueo de día completo: cuenta por cada horario de la rejilla del día según la regla vigente.

**Ronda 2 (segunda pasada de clarify, Gate 2)**

Las consecuencias CF1 a CF10 quedan resueltas y se conservan aquí con su decisión:

- CF1 (D6 vs D23, mes con excepciones y sin reglas) → A: D28. Un mes sin reglas aplica D6 a los días que ninguna excepción cubre. Con al menos una regla, los días no cubiertos por regla ni excepción están cerrados (D23). Afecta FR-007, FR-008 y las edge cases "Mes sin reglas" y "Días no cubiertos".
- CF2 (D15 vs FR-036, bloqueo de día completo) → A: D29. El bloqueo de día completo mantiene su evento espejo `06:00-23:00`; solo los bloqueos de horario puntual pasan a 1 h. Afecta FR-036. El conteo del día completo en "Espacios bloqueados" se resuelve en CF9 (D41).
- CF3 (D15, bloqueos existentes en meses `SECOND_ONLY`) → A: D30. Solo los bloqueos creados desde el despliegue usan 1 h; los eventos ya creados en Google Calendar no se modifican. Afecta FR-035, FR-036 y la dependencia de Assumptions.
- CF4 (D17 + D19, `slot_mode` en meses nuevos y sin reglas) → A: D31. Meses nuevos o sin reglas guardan `slot_mode = BLOCK_MODE`. Afecta FR-033.
- CF5 (D17 + D11, visibilidad pública inmediata) → A: D32. Los cambios de reglas son visibles de inmediato en el flujo público; no hay borrador ni publicación. El estado activo/inactivo del mes sigue controlando si se puede reservar. Afecta la edge case "Visibilidad de cambios".
- CF6 (D16 y D18, alcance del diálogo y de `PATCH slot-mode`) → (a) A: D33. El diálogo aplica a crear, editar y eliminar reglas o excepciones, y a `PATCH slot-mode`. (b) A: D33. `PATCH slot-mode` reemplaza solo las reglas; las excepciones se conservan. Afecta FR-023, FR-034 y la edge case "Citas existentes fuera del nuevo horario".
- CF7 (D13 + D22, día cuyas horas ya pasaron) → A: D34. Un día sin horarios resueltos, incluido el día actual con todas sus horas pasadas, se pinta gris como cerrado. Afecta FR-028 y la edge case "Mismo día".
- A6 (FR-024, "fuera de horario") → A: D35. Una cita activa futura está fuera del nuevo horario cuando su fecha u hora ya no están entre los horarios que resuelve el motor para ese día. No incluye incumplir separación ni capacidad. No se listan citas pasadas. Afecta FR-024. El alcance frente a bloqueos manuales se precisa en D40.
- FR-021 (edición en meses pasados) → A: D36. Crear, editar y eliminar reglas o excepciones, y `PATCH slot-mode`, solo en meses no pasados; responden `MONTH_IN_PAST` (422).
- Edge "Hora repetida" → A: D37. Se normaliza al guardar: sin duplicados y ordenadas.
- Edge "Regla sin días de la semana, horas o rango" → A: D38. Se rechaza al guardar. Cada regla exige al menos un día de la semana, al menos una hora y un rango válido dentro del mes. Cerrar un día se hace con una excepción de lista vacía. Afecta FR-025.
- Edge "Lock activo sobre un horario que se elimina" → A: D39. El lock sigue vigente hasta su TTL; la confirmación valida disponibilidad contra las reglas vigentes y rechaza con el mismo error que un horario no disponible.
- CF8 (A6, bloqueos manuales en "fuera de horario") → A: D40. El diálogo D18 lista solo citas afectadas por cambios en reglas o excepciones. Los bloqueos manuales no entran en el cálculo: se validan al crearse. Afecta FR-024 y la edge case "Citas existentes fuera del nuevo horario".
- CF9 (D14 + D29, conteo del día completo en "Espacios bloqueados") → A: D41. Un bloqueo de día completo cuenta un espacio bloqueado por cada horario de la rejilla del día según la regla vigente (coherente con D14). Afecta FR-029 y la entidad _Bloqueo manual_.
- CF10 (D28 + D23, primera regla de un mes sin reglas) → A: D42. Crear la primera regla cierra los días no cubiertos (D28 + D23). Se acepta tal cual, sin advertencia extra en el editor. Afecta la edge case "Primera regla de un mes sin reglas".

**Ronda 3 (decisiones D43 a D49, owner vía Orchestrator)**

- D43 (Q-P1) Corrige D2: sin pares, el modelo difiere de la regla legada en **48 de 432** combinaciones con bloqueos manuales. La cifra 27 salió de una variante que aún usaba pares y queda como nota histórica. Se acepta 48. Actualizados FR-013, la edge "Bloqueo manual que combina horarios" y SC-003. El registro `agent-reports/00-decisions.md` ya contiene D43.
- D44 (Q-P5) La capacidad del dashboard de `/admin` (diaria y semanal) es la suma de `maxPerDay` de los días resueltos. Precisa FR-011 y la lista de cambios de contrato.
- D45 (Q-P6) Fases 1 y 2 salen en el mismo release, sin bandera. `PATCH slot-mode` sigue funcionando para clientes existentes (misma ruta y misma forma de respuesta). Sin cambio de texto en FR; queda reflejado en el plan y en `contracts/admin-availability-api.md`.
- D46 (Q-P3) Reservar, reprogramar o agendar en un día sin horarios responde `SLOT_NOT_AVAILABLE`, en lugar de `WEEKDAY_ONLY`. Precisa FR-017.
- D47 (Q-P2) Confirmados A-03 (el aviso lista solo las citas que el cambio deja fuera) y A-04 (fuera = contra las horas de la regla o excepción del día, sin ocupación ni separación). Sin cambio de texto: FR-024 y la edge "Citas existentes fuera del nuevo horario" ya lo describen.
- D48 (Q-P4) `projectedSaturationPercent` conserva su fórmula; cada mes usa sus propias reglas (A-06). Sin cambio de texto.
- D49 (Q-P7) En fase 4, `slotMode` se retira de las respuestas de la API de inmediato, sin alias. Precisa la fase 4 y la lista de cambios de contrato.
- D50 (A-08) Se conserva la comparación `>=` del legado: el horario igual a la hora actual se ofrece. D22 se lee como "iguales o posteriores". Precisa la edge "Mismo día" y FR-014.
- D51 Los supuestos técnicos A-01, A-02, A-05, A-07, A-09, A-10 y A-11 del plan son defaults técnicos marcados [ASSUMPTION], a revisar en Gate 3. No son decisiones del owner.
- D52 Conciliación documental por fases: `specification.md` y `business-rules.md` al cierre de la Fase 1; features y UI admin al cierre de la Fase 2; antes del release combinado (D45).
- D53 El cambio del dashboard (D44) pasa a la Fase 1.
- D2 queda superada por D43 (48 de 432); el 27 de D2 es histórico.

**Defaults técnicos para Gate 3** (no decididos por el owner; el Docs Reviewer los revisa, no son decisiones de producto)

- FR-020: CRUD completo de reglas y excepciones desde `/admin/months/[month]`.
- FR-030: el backfill usa `maxPerDay=3`.
- FR-031: la migración es idempotente.
- FR-033: la coincidencia de reglas con un preset de D4 ignora las excepciones del mes (D33 conserva las excepciones en `PATCH slot-mode`, lo que hace coherente esta lectura).
- FR-025: el límite de 24 horarios se cuenta después de normalizar (D37).
- FR-023: el mecanismo de confirmación en la API es decisión de plan, igual que el de FR-041.
- Supuestos de plan marcados [ASSUMPTION] como default técnico (D51): A-01, A-02, A-05, A-07, A-09, A-10 y A-11; ver `plan.md`, sección _Assumptions_.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Definir reglas de disponibilidad por rango de fechas (Priority: P1)

Como admin, en el detalle de un mes puedo crear reglas que indican un rango de fechas, los días de la semana que aplican y las horas libres (HH:mm). Así el mes deja de depender de dos modalidades fijas.

**Why this priority**: Es el reemplazo del modelo actual y la base de todo lo demás. Sin reglas editables no existe la flexibilidad solicitada.

**Independent Test**: En un mes futuro sin excepciones, crear una regla con rango, días y horas; verificar que el flujo público y el detalle admin muestran exactamente los horarios que resuelve el motor.

**Acceptance Scenarios**:

1. **Given** un mes futuro sin reglas personalizadas, **When** el admin crea una regla con rango `2026-12-01` a `2026-12-13`, días lunes a viernes y horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, **Then** los días hábiles del rango ofrecen los horarios que resuelve el motor y los sábados y domingos del rango quedan cerrados (D23, D28: el mes ya tiene una regla).
2. **Given** una regla guardada, **When** el admin cambia sus horas y al guardar quedan citas activas futuras fuera del nuevo horario, **Then** el sistema muestra antes de guardar el diálogo de confirmación con el listado de citas afectadas (D18, D33, D40). Si el admin confirma, el nuevo conjunto aplica a nuevas reservas, locks y reprogramaciones; las citas existentes no cambian de fecha, hora ni estado (D5).
3. **Given** un rango de fechas que se traslapa con otra regla del mismo mes, **When** el admin intenta guardar, **Then** el sistema rechaza el guardado con un error estable y no modifica nada.

---

### User Story 2 - Excepciones por fecha (Priority: P2)

Como admin, puedo agregar excepciones por fecha (por ejemplo, un sábado suelto) con sus propias horas y sus propios parámetros. Una excepción tiene prioridad sobre cualquier regla para esa fecha, y también abre o cierra fechas que no caen en ninguna regla.

**Why this priority**: Permite abrir o cerrar días concretos sin modificar las reglas del mes, lo que cubre casos reales como sábados sueltos.

**Independent Test**: Con una regla lunes a viernes activa, agregar una excepción para un sábado con horas propias y un día cerrado con lista vacía; verificar que solo cambian esas fechas.

**Acceptance Scenarios**:

1. **Given** una regla lunes a viernes y una excepción para un sábado con horas `10:00` y `14:00` y los parámetros por defecto `240/true/3`, **When** se consulta ese sábado, **Then** se ofrecen `10:00` y `14:00` según los parámetros propios de la excepción (D10), y la regla no aplica a ese sábado.
2. **Given** una excepción con lista de horas vacía sobre un día que una regla cubre, **When** se consulta ese día, **Then** el día queda cerrado y no se ofrece ningún horario (A2).
3. **Given** una excepción sobre una fecha que también cae dentro del rango de una regla, **When** se consulta esa fecha, **Then** la excepción gana y la regla no se aplica a esa fecha (A1).
4. **Given** un sábado que ninguna regla cubre y una excepción con horas `09:00` y `18:00`, **When** se consulta ese sábado, **Then** se ofrecen esas dos horas con los parámetros de la excepción (D10, D23: el mes tiene al menos una regla).

---

### User Story 3 - El motor respeta separación mínima, capacidad y máximo diario (Priority: P1)

Como cliente o admin, los horarios que veo ya consideran la separación mínima entre citas (`minGapMinutes`), la capacidad preservada (`preserveCapacity`) y el máximo diario (`maxPerDay`). Así no se ofrecen horarios que dejen el día con menos citas posibles.

**Why this priority**: Es el comportamiento que reproduce la regla legada de pares con una sola regla genérica (D1), y es el núcleo que consumen todos los flujos.

**Independent Test**: Usar una regla con horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `minGapMinutes=240`, `preserveCapacity=true`, `maxPerDay=3`, y comprobar los conjuntos de horarios ofrecidos para los estados ocupados de los escenarios siguientes.

**Acceptance Scenarios** (distancias medidas entre horas de inicio, D25):

1. **Given** un día sin citas activas, bloqueos ni locks, **When** se consulta el día, **Then** se ofrecen los seis horarios.
2. **Given** una cita activa a las `09:00`, **When** se consulta el día, **Then** `10:00` no se ofrece (60 min < 240 min) y se ofrecen `13:00`, `14:00`, `17:00` y `18:00`.
3. **Given** una cita activa a las `10:00`, **When** se consulta el día, **Then** `17:00` no se ofrece aunque cumple la separación mínima, porque reservarla deja el día sin posibilidad de una tercera cita (la cantidad máxima alcanzable baja de 3 a 2, donde 3 es el `maxPerDay` de la regla, D11, D20); `14:00` y `18:00` sí se ofrecen.
4. **Given** una regla con `preserveCapacity=false`, **When** se consulta un día con citas activas, **Then** solo aplican la separación mínima y el máximo diario; la regla de capacidad preservada no se aplica.

---

### User Story 4 - Casos de referencia de aceptación (D9) (Priority: P2)

Como responsable de producto, puedo configurar los dos meses de referencia del owner y obtener los horarios esperados.

**Why this priority**: Son los casos de uso que validan el modelo completo (rangos, días, horas distintas por tramo y excepciones).

**Independent Test**: Crear las reglas de cada mes de referencia en un entorno de prueba y comparar los horarios resultantes con los esperados.

**Acceptance Scenarios**:

1. **Given** diciembre 2026 sin citas ni bloqueos, con regla A (días `1-13`, lunes a viernes, horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `240/true/3`) y regla B (días `14-23`, todos los días, horas `07:30, 11:00, 14:30, 18:00`, `0/false/4`, D11), **When** se consulta el mes, **Then**:
   - Los 9 días hábiles del 1 al 13 (martes 1, miércoles 2, jueves 3, viernes 4, lunes 7, martes 8, miércoles 9, jueves 10 y viernes 11) ofrecen 6 horarios cada uno y 3 espacios cada uno.
   - Los 10 días del 14 al 23 (incluidos sábado 19 y domingo 20) ofrecen 4 horarios cada uno y 4 espacios cada uno.
   - Los días 5, 6, 12 y 13 (sábados y domingos) de la regla A quedan cerrados (D23).
   - Los días 24 a 31 no tienen regla ni excepción y quedan cerrados (D23); no suman espacios.
   - El total es **67 espacios** (9 × 3 + 10 × 4). Es SC-007.
   - Con `minGapMinutes=0` y `preserveCapacity=false`, la regla B no aplica separación ni capacidad preservada: los 4 horarios son ofrecibles y el tope de 4 es el que limita. Sustituye el cálculo de la versión previa (240/true/3, 2 espacios por día, 47 en total).
2. **Given** enero 2027 configurado con: (a) una regla lunes a viernes para `2027-01-01` a `2027-01-31` con horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00` y `240/true/3`; (b) excepciones para los sábados `2027-01-16` y `2027-01-23` con las mismas horas y `240/true/3`; (c) excepciones con lista vacía para los lunes `2027-01-18` y `2027-01-25` (D27), **When** se consulta el mes, **Then**:
   - Los sábados 16 y 23 ofrecen las seis horas.
   - Los lunes 18 y 25 quedan cerrados.
   - Los lunes 4 y 11 y los martes a viernes ofrecen las seis horas, con 3 espacios cada día.
   - Los sábados 2, 9 y 30 y todos los domingos quedan cerrados, porque el mes tiene una regla y ninguna excepción los cubre (D23, D28).
   - Sin citas ni bloqueos, el mes suma 21 días abiertos × 3 espacios = 63 espacios. Es un cálculo derivado de (a) a (c) con D3 y D6; no es una cifra del owner.

---

### Edge Cases

- **Traslape de reglas**: dos reglas del mismo mes con fechas en común se rechazan al guardar (A1). Los traslapes se validan contra fechas, no contra días de la semana.
- **Excepción con lista vacía**: cierra el día aunque una regla lo cubra (A2).
- **Excepción dentro de una regla**: la excepción gana para esa fecha (A1).
- **Excepción sin regla**: una excepción con horas abre esa fecha aunque ninguna regla la cubra (D10).
- **Citas existentes fuera del nuevo horario**: al crear, editar o eliminar una regla o excepción, y al ejecutar `PATCH slot-mode`, si quedan citas activas futuras fuera del horario resultante, el sistema muestra antes de guardar un diálogo de confirmación con el listado de citas afectadas (D18, D33). Si el admin cancela, no se guarda nada. Si confirma, guarda y las citas no cambian (D5). Las citas pasadas no se listan (D35). Qué cuenta como "fuera de horario" está en FR-024. Los bloqueos manuales no entran en el diálogo (D40).
- **Mes sin reglas**: el mes usa la regla por defecto Lunes a viernes, `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `minGapMinutes=240`, `preserveCapacity=true`, `maxPerDay=3` (D6, equivalente a `BLOCK_MODE`), en los días que ninguna excepción cubre (D28). Un mes creado con `POST` recibe este default sin reglas guardadas (D17). Al eliminar la última regla, el mes vuelve a este default (D17). Un mes sin reglas no puede cerrarse completo con reglas; el cierre total se hace con el estado inactivo del mes (D32).
- **Primera regla de un mes sin reglas**: al crearla, los días que D6 abría y que la nueva regla no cubre quedan cerrados (D28, D23). Se acepta tal cual, sin advertencia extra en el editor (D42).
- **Mismo día**: en el día actual, solo cuentan los horarios iguales o posteriores a la hora actual en `America/Mexico_City` (D50); los horarios pasados se excluyen antes de calcular capacidad (D22). Si no queda ninguno, el día se pinta gris como cerrado (D34) y no se ofrece en el flujo público (FR-015).
- **Día sin horarios resultantes**: se trata como no disponible, no aparece en el flujo público (FR-015) y se pinta gris (D34).
- **Días no cubiertos**: si el mes tiene al menos una regla, un día que no cae en ninguna regla ni excepción queda cerrado (D23). Si el mes no tiene reglas, aplica el default de "Mes sin reglas" (D28).
- **Hora repetida dentro de una regla**: se normaliza al guardar: se eliminan los duplicados y se ordenan las horas (D37).
- **Regla sin días de la semana, horas o rango**: se rechaza al guardar (D38). Una excepción con lista de horas vacía sí es válida, porque cierra el día (A2).
- **Regla o excepción fuera del mes**: se rechaza al guardar; las reglas no cruzan meses (fuera de alcance).
- **Bloqueo manual que combina horarios**: la capacidad se calcula sobre la rejilla menos los bloqueos manuales (D2). Algunas combinaciones con bloqueos pueden diferir del comportamiento legado (48 de 432, D43; la cifra 27 de D2 salió de una variante con pares); esa diferencia se acepta.
- **Lock activo sobre un horario que se elimina**: el lock sigue vigente hasta su TTL (10 min), pero la confirmación valida disponibilidad contra las reglas vigentes y rechaza con el mismo error que un horario no disponible (D39).
- **Mes pasado**: no se pueden crear, editar ni eliminar reglas o excepciones, ni ejecutar `PATCH slot-mode` (D36, `MONTH_IN_PAST`).
- **Visibilidad de cambios**: los cambios de reglas y excepciones son visibles de inmediato en el flujo público, incluidos sábados y domingos. El estado activo/inactivo del mes sigue controlando si se puede reservar (D32).
- **Costo de cálculo**: máximo 24 horarios por día, validado al guardar (D21).
- **Compatibilidad de citas**: cambiar reglas nunca cancela ni reprograma citas; una cita existente puede quedar en un horario que ya no se ofrece, y eso no la invalida.
- **Guardado desactualizado**: si las reglas del mes cambiaron después de que el admin abrió el editor, el guardado se rechaza sin modificar nada (D24, FR-041).

## Requirements _(mandatory)_

### Functional Requirements

**Modelo de reglas**

- **FR-001**: El sistema MUST asociar a cada mes registrado un conjunto de reglas de disponibilidad. Cada regla define un rango de fechas dentro del mes, uno o más días de la semana, una o más horas `HH:mm`, y los valores `minGapMinutes`, `preserveCapacity` y `maxPerDay`. [D3]
- **FR-002**: Los valores por defecto al crear una regla MUST ser `minGapMinutes=240`, `preserveCapacity=true` y `maxPerDay=3`, salvo que el admin indique otros. [D3]
- **FR-003**: Dos reglas del mismo mes MUST NOT tener fechas en común. El guardado que genere un traslape MUST rechazarse con un código de error estable y no modificar datos. [A1]
- **FR-004**: Una excepción por fecha MUST tener prioridad sobre cualquier regla que cubra esa fecha. Cada excepción lleva su lista de horas y sus tres parámetros (`minGapMinutes`, `preserveCapacity`, `maxPerDay`), con los defaults de FR-002. Aplica también a fechas que no caen en ninguna regla. [A1, D10]
- **FR-005**: Una excepción con lista de horas vacía MUST cerrar ese día, aunque una regla lo cubra. [A2]
- **FR-006**: Las horas MUST aceptar cualquier valor `HH:mm` válido, sin restricción de granularidad. [A3]
- **FR-007**: Si el mes tiene al menos una regla, un día que no cae en ninguna regla ni excepción MUST quedar cerrado. Si el mes no tiene reglas, aplica FR-008. [D23, D28]
- **FR-008**: Un mes sin reglas MUST usar, en los días que ninguna excepción cubre, la regla por defecto: lunes a viernes, horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `minGapMinutes=240`, `preserveCapacity=true`, `maxPerDay=3`. Los fines de semana no cubiertos por excepción quedan cerrados. [D6, D28] Un mes creado con `POST /api/admin/months` MUST NOT recibir reglas guardadas; usa este default. [D17]

**Motor de disponibilidad**

- **FR-009**: Dos citas activas del mismo día MUST tener horas de inicio separadas por al menos `minGapMinutes`, medido entre horas de inicio. La separación aplica a cualquier par de horarios del día, no solo a pares oficiales. [D1, D25]
- **FR-010**: Si `preserveCapacity=true`, un horario candidato MUST ofrecerse solo si reservarlo no reduce la cantidad máxima total de citas alcanzable ese día, con tope en el `maxPerDay` del día. El cálculo se hace sobre la rejilla del día, sin los horarios con bloqueo manual (FR-013) ni los horarios pasados del día actual (FR-014). [D1, D2, D11]
- **FR-011**: El número total de citas activas de un día MUST NOT superar el `maxPerDay` de la regla o excepción que cubre ese día. Ninguna capacidad ni métrica MUST usar una constante fija de 3, incluido el dashboard de `/admin`, cuya capacidad es la suma de `maxPerDay` de los días resueltos (D44). [D3, D11, D20, D44]
- **FR-012**: Si `preserveCapacity=false`, FR-010 no aplica; siguen aplicando FR-009 y FR-011.
- **FR-013**: Los horarios con bloqueo manual MUST retirarse de la rejilla del día antes de calcular FR-010. Las combinaciones con bloqueos que difieran del legado se aceptan: 48 de 432 (D43). [D2, D43]
- **FR-014**: En el día actual, los horarios anteriores a la hora actual en `America/Mexico_City` MUST retirarse de la rejilla antes de calcular FR-010. Los horarios iguales a la hora actual se conservan (D50). [D22, D50]
- **FR-015**: Un día sin horarios ofrecibles MUST NOT mostrarse como disponible en el flujo público. [regla existente, sección 4.1; D34]

**Resolvedor único y consumidores**

- **FR-016**: Todas las validaciones de disponibilidad MUST usar un único resolvedor por día. Lo usan: lista de días y horarios del flujo público, creación de lock, confirmación, reprogramación pública, agendado admin, reprogramación admin, horarios bloqueables, métricas y detalle del mes, y la validación de día hábil. El resolvedor reemplaza `isWeekdayBookingDate` y `resolveBaseSlotsByMonthMode`.
- **FR-017**: La validación de día hábil MUST dejar de ser fija de lunes a viernes. Un día es válido si una regla o excepción del mes lo cubre y produce horarios. Si ninguna regla ni excepción produce horarios para la fecha, reservas y reprogramaciones responden `SLOT_NOT_AVAILABLE` en lugar de `WEEKDAY_ONLY` (D46).
- **FR-018**: El flujo público NO cambia su flujo ni su UI más allá de mostrar y aceptar los horarios resultantes del resolvedor.
- **FR-019**: Las reglas y excepciones NO cruzan meses. Fuera de alcance.

**Edición admin**

- **FR-020**: En `/admin/months/[month]`, el admin MUST poder listar, crear, editar y eliminar reglas y excepciones del mes. **Default técnico** (no decidido por el owner; revisar en Gate 3).
- **FR-021**: Crear, editar y eliminar reglas o excepciones, y ejecutar `PATCH slot-mode`, MUST permitirse solo en meses no pasados. Un mes pasado responde con el error existente `MONTH_IN_PAST` (422). [D36; mismo criterio que `slot-mode` hoy]
- **FR-022**: Crear, editar o eliminar reglas o excepciones MUST NOT modificar ni cancelar citas existentes ni eventos de Google Calendar. [D5]
- **FR-023**: Al guardar cambios de reglas o excepciones (crear, editar o eliminar), o al ejecutar `PATCH slot-mode`, que dejan citas activas futuras fuera del nuevo horario, el sistema MUST mostrar antes de guardar un diálogo de confirmación con el listado de citas afectadas. Si el admin confirma, guarda. Si cancela, no modifica nada. Las citas no cambian. El mecanismo de confirmación en la API es decisión de plan. [D5, D18, D33]
- **FR-024**: Una cita está "fuera del nuevo horario" cuando es activa (`PENDING`, `CONFIRMED` o `SYNC_FAILED`), es futura en `America/Mexico_City` y su fecha u hora ya no están entre los horarios que resuelve el motor para ese día, considerando solo reglas y excepciones. No se consideran bloqueos manuales (los bloqueos se validan al crearse), separación ni capacidad. Las citas pasadas no se listan. [D35, D40]
- **FR-025**: Los errores de validación del guardado MUST tener código estable. Se validan como mínimo: fechas dentro del mes; horas `HH:mm`; `minGapMinutes` entre 0 y 1440; `maxPerDay` entre 1 y 6; máximo 24 horarios por día, contados después de normalizar (D37); al menos un día de la semana por regla, al menos una hora por regla y un rango válido dentro del mes. [D20, D21, D37, D38]

**Métricas**

- **FR-026**: El espacio disponible de un día (`availableSpaces`) MUST calcularse como `min(maxPerDay del día, máximo de citas adicionales alcanzables)` sobre los horarios resueltos. "Máximo de citas adicionales alcanzables" es el número máximo de citas que aún caben ese día respetando FR-009 a FR-014. [A4, D12, D11, D20]
- **FR-027**: La métrica mensual `Disponibles` MUST ser la suma de FR-026 sobre los días resueltos del mes. Sustituye la fórmula `(días hábiles × 3) - (citas activas + espacios bloqueados)`. [A4]
- **FR-028**: El semáforo del calendario mantiene los umbrales actuales: `available` si `>= 2`, `low` si `= 1`, `full` si `= 0`. Un día sin horarios resueltos (cerrado, con todos sus horarios bloqueados o con todas sus horas pasadas) se pinta gris, como hoy. Un día abierto, incluido un sábado habilitado por excepción, usa el semáforo normal. [D13, D34]
- **FR-029**: La métrica `Espacios bloqueados` MUST contar cada horario de la rejilla del día con bloqueo manual activo como 1 espacio. Un bloqueo de día completo cuenta 1 espacio por cada horario de la rejilla del día según la regla vigente; si la regla vigente no produce horarios ese día, cuenta 0. No hay pares direccionales ni vista "Por bloque". [D14, D41]

**Migración y compatibilidad**

- **FR-030**: La migración MUST crear, para cada fila de `active_months`, reglas según su `slot_mode` actual: `BLOCK_MODE` produce una regla lunes a viernes con horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00` y `240/true`; `SECOND_ONLY_MODE` produce una regla lunes a viernes con horas `10:00, 14:00, 18:00` y `0/false`. `maxPerDay=3` en ambos casos. [D4] **Default técnico** para `maxPerDay=3` (no decidido por el owner; revisar en Gate 3).
- **FR-031**: La migración MUST ser idempotente: una segunda ejecución no duplica reglas. **Default técnico** (no decidido por el owner; revisar en Gate 3).
- **FR-032**: La migración y el backfill MUST NOT modificar `appointments.date`, `appointments.time_slot`, `appointments.status` ni `google_event_id`.
- **FR-033**: La columna `active_months.slot_mode` MUST mantenerse como legado hasta la fase 4 (cleanup). Esta feature NO la elimina. Mientras tanto, se deriva de las reglas en este orden: (1) un mes sin reglas toma `BLOCK_MODE` [D31, que prevalece sobre la regla general de D19]; (2) si las reglas del mes coinciden con un preset de D4, toma el valor de ese preset; (3) en otro caso se conserva el último valor. [D19, D31] **Default técnico**: la coincidencia con el preset ignora las excepciones del mes (no decidido por el owner; revisar en Gate 3).
- **FR-034**: `GET /api/admin/months/[month]` MUST seguir devolviendo `slotMode` y añadir `rules` (aditivo). `PATCH /api/admin/months/[month]/slot-mode` MUST reemplazar las reglas del mes por el preset de D4 del modo indicado, conservar las excepciones y mantener `slot_mode` sincronizado. Ambos mantienen su contrato hasta la fase 4. [D16, D33]
- **FR-035**: Locks, sincronización con Google Calendar y logs de auditoría MUST mantener su comportamiento. Los cambios de reglas y excepciones NO generan registros en la auditoría de citas (los logs solo registran eventos de cita). [D24] La única excepción de sincronización es la duración de los eventos de bloqueos de horario puntual creados desde el despliegue (FR-036). Los eventos ya creados no cambian (D30).
- **FR-036**: Los eventos espejo de bloqueos de horario puntual creados desde el despliegue MUST durar 1 hora. El evento espejo de un bloqueo de día completo MUST mantener `06:00-23:00` del mismo día en `America/Mexico_City`. Los eventos ya creados en Google Calendar no se modifican. Esto reemplaza A5 y elimina la noción de "modalidad fija". [D15, D29, D30]
- **FR-037**: Todas las reglas, excepciones, horas y fechas MUST interpretarse en `America/Mexico_City`. [contrato]
- **FR-041**: Un guardado de reglas o excepciones MUST rechazarse, con un código de error estable y sin modificar datos, si la versión de las reglas del mes con la que el admin edita ya no coincide con la guardada. El mecanismo de versión es decisión de plan. [D24]

**UI y contrato técnico**

- **FR-038**: Los textos admin MUST resolverse con `react-i18next` (`es` y `en`). Las notificaciones de guardado MUST usar `sileo` (incluido `sileo.promise` para el guardado). [AGENTS.md]
- **FR-039**: La UI admin MUST construirse con `components/admin/ui/` y los tokens de `docs/ui/admin/`. Cada componente reusable nuevo se documenta en `docs/ui/admin/components.md`. [AGENTS.md]
- **FR-040**: La entrega MUST actualizar `docs/specification.md`, `docs/architecture/business-rules.md`, los `docs/features/*` afectados, `docs/architecture/api.md`, `docs/ui/admin/components.md` y crear `docs/architecture/data-model.md`, en el mismo flujo de trabajo. [constitución, D7]

### Key Entities _(include if feature involves data)_

- **Regla de disponibilidad**: pertenece a un mes. Atributos: rango de fechas, días de la semana, horas `HH:mm` (sin duplicados y ordenadas, D37), `minGapMinutes`, `preserveCapacity`, `maxPerDay` (1 a 6, D20).
- **Excepción por fecha**: una fecha concreta del mes con su lista de horas (vacía = cerrado) y sus tres parámetros propios, con los defaults de FR-002 (D10). Tiene prioridad sobre las reglas.
- **Horario resuelto**: resultado del resolvedor para un día y una hora. Lo consumen todos los flujos.
- **Bloqueo manual** (`blocked_slots`, existente): sin cambio de tabla en esta feature. Su efecto pasa por el resolvedor. El bloqueo de día completo es un marcador único (sin una fila por hora) y cuenta según FR-029 (D41).
- **Cita activa** (`appointments`, existente): estados `PENDING`, `CONFIRMED`, `SYNC_FAILED` ocupan capacidad. Sin cambios.
- **Mes registrado** (`active_months`, existente): `slot_mode` queda legado hasta la fase 4 y se deriva según FR-033.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Los escenarios de aceptación de User Stories 1 a 3 pasan en pruebas automatizadas, con los conjuntos de horarios exactos indicados.
- **SC-002**: Para meses migrados sin bloqueos manuales, el conjunto de horarios ofrecido coincide con el legado en 100% de los estados ocupados alcanzables. Es la verificación del experimento de equivalencia (0 diferencias).
- **SC-003**: Con bloqueos manuales, las diferencias con el legado se limitan a las combinaciones aceptadas (48 de 432, D43; la cifra 27 de D2 salió de una variante con pares). Ninguna otra combinación cambia.
- **SC-004**: Ninguna cita existente cambia de fecha, hora, estado ni `google_event_id` por crear, editar o eliminar reglas, ni por la migración. Se verifica con pruebas sobre datos de muestra.
- **SC-005**: Un admin define las reglas del mes de referencia de diciembre 2026 sin salir de `/admin/months/[month]`.
- **SC-006**: Al cerrar la fase 4, no existen referencias a `isWeekdayBookingDate` ni a `resolveBaseSlotsByMonthMode` en el código.
- **SC-007**: El mes de referencia de diciembre 2026 vacío reporta **67 espacios** disponibles (9 días × 3 + 10 días × 4), según D11 y D12.

## Assumptions

- Aprobadas por el owner (Gate 1): A1 traslapes y prioridad de excepción; A2 lista vacía cierra el día; A3 cualquier `HH:mm`; A4 `availableSpaces` redefinido (definición en D12); A5 reemplazada por D15 en Gate 2; A6 resuelta por D35 en Gate 2, con el alcance frente a bloqueos manuales precisado por D40.
- Aprobadas por el owner (Gate 1): D1 a D9 (ver el informe de cobertura en `agent-reports/01-specify.md`).
- Decididas por el owner en Gate 2: D10 a D42 (ver _Clarifications_).
- La regla de D9 para el 14 al 23 de diciembre usa `0/false/4` por D11. Ya no es supuesto.
- La separación mínima se mide entre horas de inicio (D25). Ya no es supuesto.
- Defaults técnicos, no decididos por el owner, para revisión en Gate 3: FR-020 (CRUD completo), FR-030 (`maxPerDay=3` en el backfill), FR-031 (migración idempotente), FR-033 (coincidencia con preset sin excepciones).
- Los cambios de reglas no generan auditoría de citas (D24). Ya no es supuesto.
- Dependencia existente: el lock temporal (TTL 10 min), la sincronización con Google Calendar y la auditoría de citas funcionan igual que hoy, salvo la duración de eventos de bloqueos de horario puntual creados desde el despliegue (FR-036, D15, D30).

## Documentation Impact _(mandatory for this repo)_

**Impacto en flujo: Sí.** Cambian reglas de disponibilidad, validación de días, pasos del detalle mensual, métricas y contratos de API. Esta sección es la nota de trazabilidad para `docs/`.

**Conciliación documental por fases (D52)**. El contrato de producto ya está descrito en esta spec, antes de implementar. Calendario: `docs/specification.md` y `docs/architecture/business-rules.md` al cierre de la Fase 1; features y `docs/ui/admin/components.md` al cierre de la Fase 2; verificación cruzada al cierre de la Fase 3, antes del release combinado de Fases 1 y 2 (D45). Contenido por documento:

- `docs/specification.md`:
  - 4.1 _Días válidos_: deja de ser solo lunes a viernes; los días válidos salen de las reglas del mes.
  - 4.2 _Horarios base_ y 4.3 _Reglas por Modalidad + Máximo Diario_: sustituidos por reglas de disponibilidad, separación mínima, capacidad preservada y excepciones. El máximo diario fijo de 3 pasa a ser por regla (1 a 6, D11, D20).
  - 7 _Flujo de Reserva_ (paso 0 y paso 1, validación del lock): los horarios vienen del resolvedor; lock sobre horario eliminado (D39).
  - 10 _Modelo de Datos_: nuevas tablas de reglas y excepciones; `active_months.slot_mode` queda legado y derivado (FR-033, D31).
  - 12 _Invariantes_ 4 (regla direccional) y 6 (solo lunes a viernes).
  - 15.7 _Catálogo de meses admin_: métrica `Disponibles`, modal `Modalidad` (sustituido por editor de reglas), `Bloquear espacios` (sin vista "Por bloque", D14; día completo según D41, ver líneas ~1020 y ~1131 que hoy dicen "cuenta como 3" y "06:00-23:00"), tono de calendario (D13, D34), contrato API, `POST /api/admin/months` (D17, D28, D31).
- `docs/architecture/business-rules.md`:
  - _Operating calendar_ y _Slot pair model_ / _Daily capacity model_: reemplazados por reglas.
  - _Admin Month Detail Rules_: fórmula de `availableSpaces` (D12), `blockedSpaces` (D14; día completo según D41; hoy línea ~534 dice "3 blocked spaces") y reglas de `slot-mode` (D16, D19, D31, D33).
  - _Availability Rules_: resolvedor, separación mínima, capacidad preservada, excepciones (D10), mes sin reglas (D6, D17, D28) y días cerrados (D23).
  - _Validation Rules_: día hábil ya no es fijo; rangos D20, máximo de 24 horarios (D21), normalización de horas (D37) y reglas inválidas (D38).
  - _Edge Cases_ y _Invariants_: traslapes, citas fuera de horario (D18, D33, D35, D40), mismo día (D22, D34), concurrencia (D24), lock sobre horario eliminado (D39), edición en meses pasados (D36), primera regla de un mes sin reglas (D42).
- `docs/architecture/business-rules.md` referencia la regla "slot-mode rules" en la reprogramación pública (línea sobre destino de reschedule). Se corrige su redacción para apuntar al resolvedor. La feature 002 no cambia de contrato: FR-016 de 002 sigue siendo válido porque el resolvedor es el mismo.
- `docs/features/admin-month-detail-flow.md`: pasos 7-8 (Modalidad → Reglas), paso 18 (Bloquear espacios; línea ~133 "bloqueo de día completo = 3 espacios" se reemplaza por D41; evento de día completo `06:00-23:00` sin cambio, D29), reglas de cálculo y flujos alternos (diálogo de D18, sin bloqueos manuales según D40).
- `docs/features/booking-flow.md`: sección de horarios válidos (líneas sobre `slotMode`) y validaciones.
- `docs/features/admin-months-catalog-flow.md`: paso 9 (creación del mes sin reglas, D17; default D6 y `slot_mode = BLOCK_MODE`, D31).
- `docs/features/my-appointments-flow.md`: destino de reprogramación usa el resolvedor (sin cambio de reglas de negocio).
- `docs/architecture/api.md`: nuevos endpoints de reglas y excepciones; contrato de `GET /api/admin/months/[month]` (campo aditivo `rules`, D16) y `PATCH slot-mode` (D16, D33: conserva excepciones; diálogo de D18).
- `docs/architecture/data-model.md` (nuevo, D7): tablas de reglas y excepciones, relación con `active_months`, derivación de `slot_mode` (D19, D31), marcador de día completo (D41), bitácora de cambios de esquema. Se registra como `data_model_doc` en el perfil.
- `docs/ui/admin/components.md`: `MonthSlotModeModal` pasa a editor de reglas; `BlockSpacesModal` se ajusta según D14 y D41 (sin vista "Por bloque"); diálogo de citas afectadas (D18, D40); el editor se documenta como componente reusable.
- `docs/decisions/*`: registro de la decisión de reemplazar los pares direccionales por separación mínima (D1), de aceptar la diferencia con bloqueos manuales (D2), de duración de 1 h para bloqueos de horario puntual nuevos (D15, D29, D30) y de la derivación de `slot_mode` (D19, D31).

**Cambios de contrato a documentar**

- Reglas de día hábil: lunes a viernes deja de ser fijo (FR-017).
- `Disponibles` mensual y `availableSpaces` diario: nueva fórmula (D12); tope por día = `maxPerDay` de la regla (D11, D20), no la constante 3.
- `slotMode` de `GET /api/admin/months/[month]`: legado y derivado (D19, D31); se añade `rules` (aditivo, D16); se retira de las respuestas en la fase 4, sin alias (D49).
- Duración de eventos espejo: 1 h para bloqueos de horario puntual creados desde el despliegue; día completo `06:00-23:00`; eventos existentes sin cambio (D15, D29, D30; reemplaza A5).
- Conteo de "Espacios bloqueados" del día completo: un espacio por horario de la rejilla según la regla vigente (D41).
- `POST /api/admin/months`: ya no crea reglas; el mes usa el default D6 en los días no cubiertos por excepciones (D17, D28).
- `PATCH slot-mode`: reemplaza las reglas y conserva las excepciones (D16, D33).
- Capacidad del dashboard de `/admin` (diaria y semanal): suma de `maxPerDay` de los días resueltos (D44).
- Día sin horarios en reservas y reprogramaciones: `SLOT_NOT_AVAILABLE` en lugar de `WEEKDAY_ONLY` (D46).

**Conflictos con documentación vigente** (se llevan a Gate 2 para confirmación del owner):

- C1: la regla "solo lunes a viernes" aparece en `docs/specification.md` (4.1, 12 invariante 6) y en `business-rules.md` (_Operating calendar_, _Validation Rules_). D9 la contradice; la feature la reemplaza.
- C2: la regla de pares direccionales aparece en `docs/specification.md` (4.3) y en `business-rules.md` (_Slot pair model_, _Availability Rules_). D1 la reemplaza.
- C3: la fórmula `(días hábiles × 3)` aparece en `docs/specification.md` (15.7) y `business-rules.md` (_Admin Month Detail Rules_). A4 la reemplaza.
- C4: feature 002 está en estado `Implemented`. Esta feature no reescribe su historia; solo ajusta la redacción de `business-rules.md` que la referencia.
- C5: feature 001 (`Completed`) no tiene conflicto. Sus logs solo registran eventos de cita.
- C6: el bloqueo de día completo cuenta 3 espacios y su evento espejo es `06:00-23:00` en `docs/specification.md` y `business-rules.md`. D29 mantiene el evento; el conteo se reemplaza por D41 (hoy 3 espacios).

**Sincronización de Flow Contract Check** (estado tras clarify ronda 2):

```text
Flow Contract Check:
- UI steps updated: Yes (US1-4 con diálogo de D18, D33 y D40; docs pendientes)
- API contract updated: Parcial (D16, D17, D19, D31, D33 registradas; contrato detallado en plan; mecanismo de confirmación de la API en plan)
- Validation rules updated: Yes (FR-003 a FR-006, FR-021, FR-023, FR-025, FR-041; D36, D37, D38; docs pendientes)
- Acceptance criteria updated: Yes (User Stories 1-4, SC-001 a SC-007; SC-007 = 67)
- docs/specification.md aligned: No (pendiente de implementación)
```

**Migration Compatibility Check** (estado tras clarify ronda 2):

```text
Migration Compatibility Check:
- Schema changes required: Yes (nuevas tablas de reglas y excepciones; slot_mode queda legado)
- Data backfill required: Yes (FR-030, FR-031, D4)
- Legacy compatibility required: Yes (FR-033, FR-034; hasta fase 4)
- Rollback strategy defined: Yes (D19 y D31: slot_mode derivado de las reglas, BLOCK_MODE sin reglas, o último valor; riesgo residual: reglas nuevas no existen en el código anterior)
- Cleanup phase defined: Yes (fase 4: eliminar slot_mode y código legado)
- Integrity protections defined: Parcial (FR-003 traslape a nivel aplicación; FR-041 concurrencia; restricciones de base de datos pendientes del plan)
```

**Admin UI Check** (previsto para la fase 2): usará `components/admin/ui/` (FR-039), sileo y react-i18next (FR-038), y no tocará el flujo público (regla de aislamiento).

**Notification Contract Check** (previsto para la fase 2): sileo para éxito, aviso y error del guardado; sin notificaciones alternas; textos con react-i18next. El diálogo de D18 es un modal de confirmación, no una notificación.

**Ambigüedades detectadas**: ninguna abierta para el owner. CF8 a CF10 se resuelven por D40 a D42. Quedan defaults técnicos para Gate 3 (ver _Defaults técnicos para Gate 3_).

## Fases de implementación

Esta sección describe el alcance por fase. El plan y las tareas lo detallarán; no sustituye al `speckit-plan`.

**Fase 1 - Backend y migraciones**

- Tablas de reglas y excepciones, backfill según D4, migración idempotente.
- Resolvedor único por día (FR-016), con reemplazo de `isWeekdayBookingDate` y `resolveBaseSlotsByMonthMode`. Sin constante 3 (FR-011).
- Endpoints admin de lectura y escritura de reglas y excepciones; validaciones (FR-003 a FR-006, FR-021, FR-025, FR-041).
- Compatibilidad de `GET /api/admin/months/[month]` y `PATCH slot-mode` (FR-034, D16, D33); derivación de `slot_mode` (FR-033, D19, D31).
- Métricas `availableSpaces` y `Disponibles` (FR-026, FR-027).
- Capacidad del dashboard de `/admin`: suma de `maxPerDay` de los días resueltos (D44, D53).
- Eventos espejo de 1 h solo para bloqueos de horario puntual nuevos; día completo sin cambio (FR-036, D29, D30).

**Fase 2 - UI/UX**

- Editor de reglas y excepciones en el detalle mensual, en el lugar del botón `Modalidad`.
- Diálogo de citas fuera de horario antes de guardar (FR-023, D18, D33, D40).
- Ajuste de `Bloquear espacios` (D14; conteo del día completo según D41) y del calendario (D13, D34).
- Documentación de componentes en `docs/ui/admin/components.md`.

**Fase 3 - Pruebas y rollout**

- Pruebas del motor con los escenarios de User Story 3 y la matriz de equivalencia del experimento (SC-002, SC-003).
- Pruebas de migración sobre datos de muestra (SC-004) y de los casos D9 (SC-007; User Story 4, escenarios 1 y 2).
- Despliegue con la migración antes de habilitar el editor.

**Fase 4 - Cleanup técnico**

- Eliminar `active_months.slot_mode`, la lógica legada de pares y las funciones reemplazadas (SC-006), y retirar `slotMode` de las respuestas de la API, sin alias (D49).
- Actualizar la documentación restante y cerrar `docs/` (incluye la reconciliación final de `specification.md` y `business-rules.md`).

**Acciones para el Orchestrator** (no son decisiones de producto):

- `specs/README.md` no tiene tabla de registro. La fila de la feature se agrega al crear `tasks.md`, y falta decidir el formato de la tabla.
- `data_model_doc` del perfil está en `none`. Actualizarlo a `docs/architecture/data-model.md` cuando se cree ese archivo (en la fase de documentación, no en esta etapa).
- El hook opcional `agent-context` (`after_specify`) no se ejecutó porque no fue solicitado.
- Gate 2: CF8 a CF10 quedan resueltos por D40 a D42; no hay preguntas abiertas para el owner. Los defaults técnicos (FR-020, FR-030, FR-031, FR-033) se revisan en Gate 3. Después se ejecuta `speckit-plan`.
