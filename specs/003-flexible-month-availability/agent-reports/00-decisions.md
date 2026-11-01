# Registro de decisiones — 003 Disponibilidad flexible por mes

Aprobado por el owner en Gate 1 (2026-10-28).

## Meta
Reemplazar `slotMode` (BLOCK_MODE / SECOND_ONLY_MODE) por reglas de disponibilidad (rango de fechas + días de la semana + horas HH:mm) y excepciones por fecha, con `minGapMinutes`, `preserveCapacity` y `maxPerDay` configurables, en `/admin/months/[month]`.

## Dentro del alcance
Modelo y migración (reglas, excepciones, backfill); resolvedor único de slots por día; motor con minGap/preserveCapacity/maxPerDay incluyendo bloqueos manuales; API admin de reglas; UI de edición; migración de consumidores (lib/availability, book-appointment, lock-reservation-slot, my-appointments, admin appointments, blocked-spaces, months detail-service, lib/validation/appointment.ts); docs (specification.md, business-rules.md, features/*, ui/admin/components.md, nuevo docs/architecture/data-model.md).

## Fuera del alcance
Duraciones de servicio por cita; reglas que crucen meses; cambios al flujo público más allá de mostrar slots resueltos; borrado de `slot_mode` (legacy hasta Fase 4).

## Decisiones
- D1 `minGapMinutes` reemplaza el par direccional.
- D2 Bloqueos manuales usan el modelo nuevo; se aceptan 27/432 diferencias de casos extremos (0 sin bloqueos manuales).
- D3 Cada regla: minGapMinutes, preserveCapacity, maxPerDay; defaults 240 / true / 3.
- D4 Backfill: BLOCK_MODE -> L-V, 09/10/13/14/17/18, 240/true. SECOND_ONLY_MODE -> L-V, 10/14/18, 0/false. `slot_mode` queda legacy.
- D5 Editar con citas fuera del horario nuevo: guardar con aviso listando citas afectadas; citas intactas.
- D6 Mes sin reglas recibe regla por defecto: L-V, 09/10/13/14/17/18, 240/true.
- D7 Modelo de datos en nuevo docs/architecture/data-model.md.
- D8 Docs nuevos en español.
- D9 Casos de aceptación: dic 2026 (1-13 L-V 09/10/13/14/17/18; 14-23 L-D 07:30/11:00/14:30/18:00); ene 2027 (sábados selectivos con horas por día).

## Supuestos aprobados
- A1 Sin traslape de fechas entre reglas; excepción por fecha tiene prioridad.
- A2 Excepción con horas vacías cierra el día.
- A3 Horas HH:mm a cualquier minuto.
- A4 `availableSpaces` = suma por día resuelto de min(maxPerDay, slots factibles restantes).
- A5 Bloqueos manuales en Google Calendar mantienen 1 h, salvo modo fijo.

## Contratos a preservar
Citas existentes y su `timeSlot`; GET /api/admin/months/[month] y PATCH .../slot-mode hasta cleanup; locks, sync Google Calendar, logs de auditoría; zona America/Mexico_City.

## Decisiones de Gate 2 (owner, 2026-10-28; respuestas a Q1-Q18 de spec.md)
- D10 (Q1) Las excepciones por fecha llevan sus propios minGapMinutes/preserveCapacity/maxPerDay, con defaults 240/true/3.
- D11 (Q2) La regla del 14-23 dic 2026 usa `0 / false / 4` (maxPerDay=4, supera el 3 histórico).
- D12 (Q3) "Slots restantes" = máximo de citas adicionales alcanzables, con tope en maxPerDay (A4 queda así).
- D13 (Q4) Día cerrado se pinta gris como hoy; un sábado habilitado usa el semáforo normal.
- D14 (Q5) Cada horario bloqueado cuenta 1 espacio bloqueado; se elimina la vista "Por bloque".
- D15 (Q6) Todos los bloqueos manuales crean evento espejo de 1 h (reemplaza A5; cambia el comportamiento de bloqueos manuales en meses SECOND_ONLY, hoy duración estándar).
- D16 (Q7) PATCH /slot-mode reemplaza las reglas del mes por el preset D4 del modo indicado y mantiene `slot_mode` sincronizado; GET añade `rules` sin quitar `slotMode`.
- D17 (Q8) POST /api/admin/months NO crea reglas: el mes nuevo recibe el default D6 (cambia el comportamiento actual de meses nuevos, hoy SECOND_ONLY). Si se eliminan todas las reglas, el mes vuelve al default D6.
- D18 (Q9) Citas fuera de horario: diálogo de confirmación con listado antes de guardar.
- D19 (Q10) Rollback: `slot_mode` se deriva de las reglas cuando coinciden con un preset; si no coinciden, se conserva el último valor.
- D20 (Q11) minGapMinutes 0 a 1440; maxPerDay 1 a 6.
- D21 (Q12) Máximo 24 horarios por día (validación al guardar).
- D22 (Q13) Los horarios pasados del día actual se retiran de la rejilla antes de calcular capacidad.
- D23 (Q14) Un día sin regla ni excepción queda cerrado.
- D24 (Q15) Cambios de reglas NO generan auditoría. Concurrencia: se rechaza el guardado desactualizado.
- D25 (Q16) La separación mínima se mide entre horas de inicio.
- D26 (Q17) Encabezados de plantilla en inglés, contenido en español.
- D27 (Q18) Enero 2027: sábados 16 y 23 habilitados con 09:00/10:00/13:00/14:00/17:00/18:00; lunes 18 y 25 cerrados; resto de días (L-V): 09:00/10:00/13:00/14:00/17:00/18:00 (parámetros default 240/true/3).
- A6 [ASSUMPTION, por confirmar] "Fuera de horario" (Q9) = la fecha u hora de la cita ya no es ofrecida por la configuración nueva (no incluye incumplir separación/capacidad).

## Decisiones de Gate 2, segunda ronda (owner, 2026-10-28; CF1-CF7, A6 y supuestos heredados)
- D28 (CF1) Un mes con excepciones pero sin reglas usa el default D6 en los días que ninguna excepción cubre. Si el mes tiene al menos una regla, los días no cubiertos por regla ni excepción están cerrados (D23).
- D29 (CF2) El bloqueo de día completo mantiene su evento espejo 06:00-23:00; solo los bloqueos de horario puntual pasan a 1 h (D15).
- D30 (CF3) Solo los bloqueos nuevos usan 1 h; los eventos ya creados en Google Calendar no se modifican.
- D31 (CF4) Meses nuevos o sin reglas guardan `slot_mode = BLOCK_MODE` (coherente con D6 y D19).
- D32 (CF5) Los cambios de reglas son visibles de inmediato en el flujo público; no hay borrador/publicación. El estado activo/inactivo del mes sigue controlando si se puede reservar.
- D33 (CF6) El diálogo de confirmación de D18 aplica a crear, editar y eliminar reglas/excepciones y a PATCH slot-mode. PATCH slot-mode reemplaza solo las reglas y conserva las excepciones.
- D34 (CF7) Un día cuyos horarios ya pasaron todos se pinta gris como cerrado.
- D35 (A6) "Fuera de horario" = cita activa futura cuya fecha u hora ya no está entre los horarios que resuelve el motor. No incluye incumplir separación ni capacidad; no lista citas pasadas.
- D36 (FR-021) Edición solo en meses no pasados; mes pasado responde MONTH_IN_PAST (422).
- D37 (hora repetida) Se normaliza al guardar: sin duplicados y ordenadas.
- D38 (regla inválida) Se rechaza al guardar: cada regla exige al menos 1 día de la semana, 1 hora y un rango válido dentro del mes. Cerrar un día se hace con excepción de lista vacía.
- D39 (lock sobre horario eliminado) El lock sigue hasta su TTL; la confirmación valida contra las reglas vigentes y rechaza como horario no disponible.
- Defaults técnicos NO decididos por el owner (revisar en Gate 3): FR-020 CRUD completo de reglas/excepciones; FR-030 backfill con maxPerDay=3; FR-031 migración idempotente.

- D40 (CF8) El diálogo D18 lista solo citas afectadas por cambios en reglas/excepciones; los bloqueos manuales no entran (se validan al crearse).
- D41 (CF9) Un bloqueo de día completo cuenta un espacio bloqueado por cada horario de la rejilla del día según la regla vigente (coherente con D14).
- D42 (CF10) Crear la primera regla de un mes sin reglas cierra los días no cubiertos (D28+D23); se acepta tal cual, sin advertencia extra en el editor.

## Decisiones tras plan/tasks (owner, 2026-10-28; Q-P1 a Q-P7)
- D43 (Q-P1) Corrige D2: sin pares, el modelo difiere de la regla legacy en 48 de 432 combinaciones con bloqueos manuales (el 27 salió de una variante que aún usaba pares). Se acepta 48. Actualizar D2, SC-003 y T051.
- D44 (Q-P5) La capacidad del dashboard (diaria y semanal) es la suma de `maxPerDay` de los días resueltos.
- D45 (Q-P6) Rollout: fases 1 y 2 salen en el mismo release, sin bandera; PATCH slot-mode sigue funcionando para clientes viejos.
- D46 (Q-P3) Reservar un día sin horarios responde `SLOT_NOT_AVAILABLE` (reemplaza `WEEKDAY_ONLY`).
- D47 (Q-P2) Confirmados A-03 (el aviso lista solo citas que el cambio deja fuera) y A-04 (fuera = contra las horas de la regla/excepción del día, sin ocupación ni separación).
- D48 (Q-P4) `projectedSaturationPercent` conserva su fórmula; cada mes usa sus propias reglas (A-06).
- D49 (Q-P7) En Fase 4 `slotMode` se retira de inmediato de las respuestas de la API (sin alias).
- Pendientes técnicos para Gate 3: Q-T1 (`{{test_commands}}` apunta a una sección "Commands" de CLAUDE.md que no existe), Q-T2 (versión de MySQL para CHECK), Q-T3 (`data_model_doc` en T071), Q-T4 (`docs/decisions/` no existe), Q-T5 (marcadores SPECKIT en AGENTS.md).

## Decisiones tras revisión de docs, ciclo 1 (owner, 2026-10-28)
- D50 (A-08) El día actual conserva la comparación `>=` del legado: se ofrece el horario cuya hora es igual a la hora actual. D22 ("posteriores") se interpreta así.
- D51 Los supuestos técnicos A-01, A-02, A-05, A-07, A-09, A-10 y A-11 del plan se tratan como defaults técnicos marcados [ASSUMPTION], a revisar en Gate 3 (no son decisiones del owner).
- D52 Conciliación documental: `specification.md` y `business-rules.md` al cerrar la Fase 1; features y UI admin al cerrar la Fase 2; ambas antes del release combinado de Fases 1+2 (D45).
- D53 El cambio del dashboard (capacidad = suma de maxPerDay, D44) pasa a la Fase 1.
- Nota: D2 queda superada por D43 (48 de 432); el "27" de D2 es histórico.
- D54 (F5, revisión 1B, 2026-10-28) Se acepta el sentido de las 48 diferencias de D43: con bloqueos manuales el motor ofrece más horas que el legado (un bloqueo solo retira su propia hora; nunca menos horas). La capacidad diaria se respeta.
- D56 (1C, 2026-10-28) D34 se extiende a días pasados: en el detalle del mes todo día anterior a hoy se pinta gris como cerrado y aporta 0 disponibles.
- D57 (1C, 2026-10-28) Dashboard: la semana suma capacidad de lunes a domingo (días abiertos por regla cuentan) y un día con bloqueo de día completo aporta capacidad 0.
- D58 (1C, 2026-10-28) Dashboard con hoy en fin de semana: la capacidad de la ocupación diaria usa la misma fecha que la agenda mostrada (lunes siguiente).
- D59 (1C, 2026-10-28) El detalle admin del mes cuenta como ocupadas las citas en los mismos estados que bloquean en el flujo público (`SLOT_BLOCKING_APPOINTMENT_STATUSES`, incluye PENDING). Corrige un defecto preexistente.
- Defaults sin cambio (1C): mes sin registro usa D6 en mes anterior y dashboard; la ocupación semanal no se topa en 100 %.
- D60 (1C, 2026-10-28) D56 solo afecta el tono y la cifra "Disponibles". `projectedSaturationPercent` y la comparación con el mes anterior usan los espacios sin quitar días pasados en ambos meses (A-06).
- D61 (1C, 2026-10-28) La ocupación del dashboard (diaria y semanal) cuenta los mismos estados que bloquean horario (`SLOT_BLOCKING_APPOINTMENT_STATUSES`, incluye PENDING), igual que el detalle (D59).
- D62 (1C, 2026-10-28) "Espacios bloqueados" del mes sigue contando los bloqueos de días pasados (historial). `dailyOccupancy.date` se mantiene en hoy (el título del dashboard depende de ella).
- D55 (F4, revisión 1B, 2026-10-28) `00:00` no es una hora válida en reglas ni excepciones (se rechaza con `AVAILABILITY_TIME_INVALID`), porque es el centinela de bloqueo de día completo (`FULL_DAY_BLOCK_TIME_SLOT`).
- D63 (1D, 2026-10-29) NB-1 (doble reserva admin vs reprogramación pública, preexistente): se corrige en 1E (named locks + `FOR SHARE` en el reschedule admin, como la creación admin).
- D64 (1D, 2026-10-29) NB-6: se acepta el comportamiento transitorio de la creación admin (acepta sábado/domingo con horas legacy; hora fuera de rejilla -> 409) hasta que 1E conecte el servicio admin al resolvedor.
- D65 (1D, 2026-10-29) NB-2, NB-3 (y NB-4 cuando se toque la ruta) se aplican junto con 1E; NB-5/NB-9 se corrigen en el informe del Developer.
- D66 (1C/NB-2, 2026-10-29) Los contadores NO cuentan citas PENDING. Reemplaza D59 y D61 en lo que cuentan los estados PENDING (detalle del mes y dashboard); las listas siguen excluyéndola. Consecuencia a confirmar en 1E: el PENDING sigue bloqueando horario en el flujo público, así que "Disponibles" puede mostrar más espacios libres que los realmente reservables.
- D67 (1E, 2026-10-29) Aceptados cambios de tipo fuera de lista (`timeSlot` de BASE a string) en `lib/admin/appointments/types.ts`, `hooks/admin/months/{useBlockSpacesModal,useBookAppointmentModal}.ts`, `components/admin/months/{BookAppointmentModal,BlockSpacesModal}.tsx`; la Fase 2 (T051/T052) los rehace.
- D68 (1E, 2026-10-29) El agendado admin, la reprogramación admin y `getAdminDayAgenda` (`availableSlots`) respetan las citas PENDING como ocupación (igual que el flujo público), en 1E-bis. Los contadores siguen sin contarlas (D66).
- D69 (1E, 2026-10-29) PATCH slot-mode con el mismo modo ya no es no-op: reemplaza reglas por el preset e incrementa versión (D16).
- D70 (1E, 2026-10-29) El preview de disponibilidad no bloquea meses pasados (no escribe); el guardado sí (`MONTH_IN_PAST`, D36).
- D71 (1E-bis, 2026-10-29) Aceptado: por D68, una cita PENDING impide crear un bloqueo admin en ese horario (`SLOT_NOT_AVAILABLE`), vía `listActiveAppointmentSlotsByDateForUpdate`.
- D72 (1E-bis, 2026-10-29) Sin cambio: la reprogramación admin sigue limitada a citas CONFIRMED/SYNC_FAILED (`findAppointmentOwnerPhone`); una PENDING no se reprograma desde admin.
- D73 (1E-ter, 2026-10-29) D64 queda en 409: la creación admin con hora fuera de rejilla responde `SLOT_NOT_AVAILABLE` 409 (ruta existente, contrato). Se retira la expectativa de 400.
- D74 (1E-ter, 2026-10-29) D63 extensión de integración admin↔pública y N2 pasan a carry-forward non-blocking (el orden de locks tiene prueba unitaria).
- D75 (1E-quater, 2026-10-30) T038 queda [X]: `month-slot-mode.test.ts` sigue afirmando las constantes por modo porque `resolveBaseSlotsByMonthMode` sigue vivo en producción (UI del detalle del mes) hasta T068/T078.
- D76 (1E-quater, 2026-10-30) `DATE_NOT_OPERATIONAL` en `blocked-slots` POST sigue respondiendo 400 (sin mapeo explícito; R-13 sin cambio de contrato). Documentar en T075.
- D77 (1E ciclo 1, 2026-10-30) B-1: D63 se amplía a la creación admin (`createAdminAppointment`): las lecturas de ocupación deben ser bloqueantes (o la primera lectura consistente va tras `lockConflictingAppointments`); corrección de integridad, con prueba de integración que falle sin ella.
- D78 (1E ciclo 1, 2026-10-30) NB-3: `LOCK_TIMEOUT` responde 409 también en las rutas admin de crear y reprogramar cita. NB-5: `findRescheduleRulesForShare` propaga el error (o lo mapea a código propio) en vez de disfrazarlo de `SLOT_NOT_AVAILABLE`.
- D79 (1E ciclo 1, 2026-10-30) NB-6 (PATCH slot-mode sin `expectedVersion`) y NB-7 (la UI actual no envía `confirmAffectedAppointments`; no desplegar Fase 1 sin Fase 2, D45) quedan como carry-forward de Fase 2.
- D80 (1E ciclo 1, 2026-10-30) Aceptado como residual: `listBlockedSlotsByDateForUpdate` (`lib/db/blocked-slots.ts`) sigue siendo lectura plana (bloqueo admin concurrente con creación admin, no medido). Dejado sin cambio.
- D81 (1E ciclo 1, 2026-10-30) NB-5: un error de `FOR SHARE` en la reprogramación pública se propaga como 400 `UNKNOWN_ERROR` (antes 409 `SLOT_NOT_AVAILABLE`); no se mapea a 409. Documentar en T075.
- D82 (1E ciclo 2, 2026-10-30) F1 (named locks retenidos si la transacción expira, preexistente): se corrige con la opción (a) (alinear `timeout` de `prisma.$transaction` con `innodb_lock_wait_timeout` de sesión) como trabajo propio ANTES de la release combinada (D45), no dentro de 1E. Hasta entonces es riesgo residual; no describir NB-2/NB-3 como protección frente a expiración.
- D83 (1E ciclo 2, 2026-10-30) F2: aceptada la magnitud medida (bloqueo admin vs creación admin 17/40 y vs pública 10/40 en carrera simultánea) como residual; revisar junto con F1 antes de publicar.
- D84 (T075-A, 2026-10-30) Aceptado: sección nueva de `api.md` en español (perfil); línea `PHONE_INVALID` de `api.md` se corrige a `VALIDATION_ERROR` en T075-B; la recuperación manual N4 incluye restaurar el default `SECOND_ONLY_MODE` (0014); meses reconciliados sin reglas usan D6 (D31); comentarios obsoletos D59/D61 en `detail-service.ts` (~189) y `dashboard/service.ts` (~473) se corrigen en la limpieza de Fase 4; Q-T2 (versión de MySQL para CHECK) queda como pendiente documentado.
- D85 (T075-B, 2026-10-30) Aceptado: redacción de 15.7 (objetivo + aviso de UI en Fase 2), texto de "Disponibles" con D66, F4 como limitación en la sección 9 de `specification.md`; se elimina la frase "discrepancia pendiente" de `api.md` (~L489). Carry-forward: `MonthDetailView.tsx` (L38/45/305/521) sigue usando `resolveBaseSlotsByMonthMode` y `getAvailableStartSlotsWithManualBlocks` -> Fase 2 (T049–T050, FR-016); FR-033 vs código (derivación exige una regla que cubra todo el mes); sugerencia de 15 días ignora PENDING (preexistente).
- D86 (T075-C/D, 2026-10-30) Owner: el código es la verdad. Spec alineada en 4.1 (público: día sin horarios ofrecibles = deshabilitado), 15.7 (tonos closed/full, horas bloqueables = resolvedor 4.3, bloqueo de día completo con SLOT_LOCKED/DAY_ALREADY_BLOCKED/SLOT_NOT_AVAILABLE). C4 (sugerencia de 15 días ignora PENDING) = pendiente de producto, nota en spec sec. 7 paso 5. C7 verificado: reprogramación pública exige mes ACTIVE y no pasado (service.ts L351), spec 8.2 no lo menciona. Carry-forward: C4 también en business-rules.md L134-135/799/813; `docs/features/admin-month-detail-flow.md` desalineado -> T076; D34 vs gris por bloqueos; día completo rechazado si el único horario libre tiene bloqueo puntual; C6 comentarios D59/D61 -> Fase 4.
- D87 (T075 review, 2026-10-30) Owner: B1 = cambio de CÓDIGO (ronda 1F): la reprogramación pública debe respetar los `reservation_locks` vigentes de otros clientes (mientras Ana retiene el jueves 10:00, Luis no puede reprogramar a ese horario hasta que el lock expire). La documentación 8.2/business-rules ya lo describe así. B2 = alinear spec, business-rules y ADR 0006 con data-model (los bloqueos manuales no toman locks con nombre, F2/D83). Arreglos menores: `api.md:440` MONTH_NOT_ACTIVE, spec 7 paso 8 orden de limpieza de locks, `api.md:255`, citas a "informe de ronda" en docs permanentes.
- D88 (ronda 1F, 2026-10-30) Owner: B1 opción (a): `cleanupExpiredReservationLocks` se acota a la fecha procesada (`WHERE date = ? AND expires_at <= ?`) para eliminar el deadlock reserva pública vs reprogramación pública (también preexistente en creación admin). B2: la lectura de locks en la reprogramación pública NO pasa por el catch que la convierte en `SLOT_NOT_AVAILABLE`; los errores propagan como error de transacción (D81). Error por lock ajeno: `SLOT_NOT_AVAILABLE` (confirmado). Base de integración autorizada: `appointments_test` (nunca `appointments`).
- D89 (ronda 1F, ciclo 2, 2026-10-30) Owner: "Corregir todo". BLK-1: eliminar la inversión locks de reserva -> citas moviendo la limpieza de `reservation_locks` DESPUÉS de `lockConflictingAppointments` en todas las rutas (reserva pública, confirmación, creación y reprogramación admin, bloqueo de espacios); actualizar ADR 0006 y D88 (D88 NO se da por cerrado hasta Approved). BLK-2: el catch de `validateRescheduleDestination` convierte solo errores de dominio y relanza el resto (D81). NB-1/NB-2: test de concurrencia con la función real y espera determinista (INNODB_TRX LOCK WAIT).
- D90 (ronda 1F, corrección 3, 2026-10-30) Owner: "Sí, lanza". Corrección 3: test de concurrencia que discrimine (falla con el orden antiguo, pasa con D89; pausa dentro de `cleanupExpiredReservationLocks`), mutación admin, repeticiones x3, verificar tests BLK-2 contra el código antiguo, y acotar por fecha (o documentar en el runbook) los scripts globales de limpieza de locks. Incidente: el Developer de la corrección 2 hizo un SELECT de conteo (solo lectura) contra `appointments`; sin escrituras. `prisma db execute` queda prohibido en briefs.
- D91 (ronda 1F, corrección 4, 2026-10-31) Owner: "Autorizo ronda 4" (excepción a la norma de 3 rondas). B-1: el catch de `getBookableMonthConfig` en `validateRescheduleDestination` convierte solo `MONTH_NOT_ALLOWED` en `SLOT_NOT_AVAILABLE` y relanza el resto + test. NB-1/NB-2 (`admin-create-concurrency`: espera de LOCK WAIT, réplica con orden D89 o función real), NB-3 (aserciones de orden en unitarios), NB-4 (afirmar que la espera es sobre `appointments`), NB-8 (restaurar 2 comentarios NB-4). NB-5 docs en micro-ronda aparte. NB-6 (cron de `locks:cleanup`) pendiente de respuesta del owner.
- D92 (NB-6, 2026-10-31) Owner (captura de crons en producción): existe el cron "Lock cleanup" habilitado, `* * * * *` (cada minuto), `npm run locks:cleanup`; también "Retry sync appointments" (*/10, `--batch=200`), "Retry sync blocked slots" (*/10, `--batch=200`) y "Reject pending appointments" (*/10, `--older-than-hours=36 --batch=100`) DESHABILITADO. NB-6 resuelto: la tabla `reservation_locks` no crece sin límite tras D88. El runbook NO debe decir "ventana de bajo tráfico": el script está diseñado para correr cada minuto; el residual es un 1213 raro entre el DELETE por PK del script y la limpieza por fecha de una reserva (víctima: el script, que reintenta al minuto siguiente, o una reserva con 400 `UNKNOWN_ERROR`, rollback completo, sin doble reserva).
- D93 (ronda 1F cerrada, 2026-10-31) `reviewer-high-risk` ciclo 4 Approved (sin bloqueantes). 1F cerrada en código: la reprogramación pública respeta locks vigentes ajenos (`SLOT_NOT_AVAILABLE`), limpieza de RL por fecha (D88) y después de los conflictos de citas en las 6 rutas (D89), errores de infraestructura propagan (D81; 400 `UNKNOWN_ERROR`). Condición de cierre: micro-ronda docs NB-5 (ADR 0006, runbook con D92, spec 7/8.2/9/L202/L417/L435, booking-flow L132/L227, business-rules ~L196/~L288, api.md). Carry-forward 1F (NB-R3-1..12): ver `round-07-reschedule-locks-reviewer-r3.md`; destacan NB-R3-1 (sin unitario de orden de creación admin), NB-R3-4/5 (tests de integración preexistentes inválidos), NB-R3-7 (`getBookableMonthConfig` dentro de la transacción), NB-R3-9 (`isWeekdayInMexicoCity` sin usos), NB-R3-12 (`appointments.lock-order.test.ts` sin trackear: debe entrar en el commit), línea base ampliada con 16 fallos de `tests/lib`+`tests/app` dependientes de fecha.
- D94 (T075 cerrada, 2026-10-31) `reviewer-docs` ciclo 2 Approved sobre todo T075 (A–F; informe `round-06-docs-reviewer-r1.md`). T075 [X] se sostiene. Fase 1 completa en código y documentación. Carry-forward: NB-1 (reinstaurar CHECK `max_per_day` 1-6 en `data-model.md` L241), NB-2 (spec 9 paso 4: `deleteActiveReservationLocksByPhone` sin fecha), NB-3 (`booking-flow.md` L179-181/L217/L238 regla direccional -> T076/T078), NB-4 (crons de D92 en runbook), `README.md:108` (`--older-than-days` inexistente), citas de ronda residuales (data-model L9/L296, ADR 0001 L26, ADR 0005 L23, api.md L384-385). Siguiente: Fase 2 (UI, T076+) con autorización del owner; antes de la release combinada (D45): F1 opción (a) (D82), revisión de F2 (D83), NB-6/NB-7 (Fase 2 obligatoria).
- D95 (entrevista de resume, 2026-10-31) Owner: C4 -> las citas `PENDING` SÍ cuentan para el umbral de 15 días (activas = PENDING, CONFIRMED y SYNC_FAILED). Requiere cambio de código en el flujo público (ronda propia, alto riesgo) y alinear spec sec. 7 paso 5 y business-rules L134-135/799/813. Ejemplo: PENDING el 5 y reserva el 12 -> se muestra la vista de sugerencia.
- D96 (2026-10-31) Owner: día completo rechazado si el único horario libre tiene bloqueo puntual -> se mantiene el rechazo y se documenta en spec 15.7 (T076).
- D97 (2026-10-31) Owner: D90 incidente de archivos reconstruidos cerrado con la verificación del Reviewer (sin comparación con Time Machine). Contraseñas PROD ya rotadas por el owner.
- D98 (2026-10-31) Owner: C7 -> documentar en spec 8.2 que la reprogramación pública exige mes ACTIVE y no pasado (T076). Owner autoriza Fase 2, empezando solo por T076.
- D99 (ronda 2A, 2026-10-31) Owner: excepción nueva = sin horas (día cerrado con aviso); regla nueva = mes completo, lunes a viernes, valores D6; conflicto de versión = mensaje de cerrar y reabrir (sin botón recargar); descartar con cambios = tarjeta dentro del modal. Bloque provisional de citas afectadas hasta T047: asumido aceptable (no se preguntó; no se despliega sin 2B).
- D100 (ronda 2B, 2026-10-31) Owner: autoriza `lib/admin/appointments/{types,api-client}.ts` (H1 tipar `availableSlots`; H2 enviar `excludeAppointmentId` al reagendar); H3/H4 `canSelectFullDay` vuelve a exigir TODOS los horarios de la rejilla del día bloqueables (más estricto que el servidor, que acepta >=1; el servidor no cambia); H5/H6 textos y ubicación del botón Reglas se revisan en la validación manual; H7 se permite seleccionar un sábado/domingo abierto por excepción (`!day.isWeekend`).
- D101 (corrección 2B-r1, 2026-10-31) Owner: H3/H4 revierte parte de D100: "Bloquear día completo" se ofrece si queda >=1 horario bloqueable (paridad con servidor y D96; sin cambio de código). H7: un día entre semana cerrado o pasado sigue seleccionable (acceso a su agenda); solo el fin de semana con tono `closed` queda deshabilitado, y un fin de semana abierto por excepción es seleccionable. Hecho en 2B-r1: H1, H2, H7. Para T076 documentar reagendado (hora actual incluida), selección de días y día completo.
- D102 (revisión Fase 2, 2026-10-31) `reviewer-high-risk` Approved (round-12-phase2-ui-reviewer.md; 12 non-blocking). Owner: corregir R12-1, R12-2, R12-5, R12-6 (hecho en round-13-review-fixes-developer.md, con mutación). Owner acepta la excepción a AGENTS.md/T042: `useAvailabilitySave` usa `sileo.show` (carga) + success/error en lugar de `sileo.promise`, porque `sileo.promise` no puede silenciar el error del 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`; documentar en T076 (Notification Contract Check). Abiertos: R12-3 (servidor guarda con confirm sin comparar lista, D18/D79) y R12-9 (useState en Tooltip/TimeSlotChipInput) pendientes de decisión; R12-4 validar en navegador filtros de fecha de AppointmentLogsView; R12-7, R12-8, R12-10..R12-12 a T076/Fase 4.
- D103 (revisión Fase 2, 2026-10-31) Owner: R12-3 aceptado como riesgo residual (D18/D79 sin cambio; una cita creada entre la vista previa y Confirmar puede quedar fuera de horario sin mostrarse, sin cancelarse); R12-9 excepción documentada (estado de presentación en Tooltip y TimeSlotChipInput, documentar en components.md en T076); R12-1 refinado: al recargar la agenda durante el reagendado se conserva la elección del usuario si el servidor sigue ofreciéndola, si no vuelve a la hora actual de la cita. Siguiente: re-revisión corta del Reviewer sobre R12-1, 2, 5, 6 antes de T076.
- D104 (re-revisión Fase 2 ciclo 2, 2026-10-31) `reviewer-high-risk` Rejected por R14-1 (cambio de día durante la carga conserva lista y selección del día anterior y Guardar envía una hora no confirmada). Owner: corregir SOLO R14-1 (vaciar lista y selección visible al cambiar de día durante la carga, conservando la elección explícita para restaurarla si el día nuevo la ofrece; pruebas de hook y de componente); R14-2, R14-3, R14-5, R14-6 quedan como non-blocking abiertos (carry-forward). R14-4: al cambiar de día se conserva la elección explícita si el día nuevo la ofrece (D103 sin cambio); documentarlo en spec en T076.
- D105 (cierre T076, 2026-10-31) Owner: (a) día lleno (tono `full`) se pinta verde con >=1 cita activa (antes >1; gris solo si cerrado o sin citas); cambio en `getToneClasses` de `MonthDetailView.tsx` y sus pruebas, y alinear docs (admin-month-detail-flow, spec 15.7); (b) `design-system.md` y `tokens.md` se actualizan en T077 (patrones de Fase 2: confirmación con scrim, tooltip de ayuda, chips en rejilla; scrim como token documentado, sin cambiar colores actuales); (c) `handleReschedule` sin `catch` -> Fase 4 (T078); (d) R15-1: texto accesible de carga junto al select de hora del reagendado (`role="status"`, es/en), antes de la release combinada.

## Preguntas abiertas
Ninguna.
