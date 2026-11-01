# Ronda 06 (T075 A-D): informe del Docs Reviewer

Veredicto: **Rejected** (2 bloqueantes, ambos de correccion corta y solo documental).

Modo auditoria, solo lectura. Verificacion estatica por lectura y grep del codigo; no se ejecutaron pruebas. Unica ejecucion: `python3 scripts/check-workflow-profile.py` (exit 1 por el aviso de version de Spec Kit; "OK: 9 keys, all defined, used, and resolvable"; el aviso 0.11.9 vs 1.0.5 es de entorno).

## Lo que si coincide con el codigo (verificado)

- Orden de locks (GET_LOCK fecha/telefono -> FOR SHARE reglas -> lockConflictingAppointments -> lectura de ocupacion -> escritura -> RELEASE_LOCK): `lock-reservation-slot.ts:113-123`, `book-appointment.ts:480-534`, `admin/appointments/service.ts:271-342, 463-533`, `my-appointments/service.ts:414-417`. Lecturas `FOR UPDATE` reales (D77) en `lib/db/admin-appointments.ts:124-169`. F2 (`listBlockedSlotsByDateForUpdate` plano) coincide con D80/D83.
- Mapeo HTTP de rutas: creacion admin (404/409 incl. LOCK_TIMEOUT D78/422 MONTH_NOT_ACTIVE/400; 201), reprogramacion admin (404/409/400), blocked-slots (409 x4, 422 DATE_IN_PAST, DATE_NOT_OPERATIONAL 400 sin mapeo, D76), reprogramacion publica (409 x4, 400), reservar/* (409/400, 201), `GET /api/availability/[month]` (422), `POST /api/admin/months` (200), availability PUT/PATCH (404/422/409/400). Todo coincide con `api.md`.
- Orden de comprobaciones del PUT (`months/service.ts:237-256`), D69, D70, D72 (PENDING -> 404), D73 (409), D78, D81 (FOR SHARE propaga -> 400 UNKNOWN_ERROR; `my-appointments/service.ts:415-416`; F4 catch amplio en `:394-399`).
- D66: `COUNTED_APPOINTMENT_STATUSES` sin PENDING (`lib/db/admin-months.ts:292`); dashboard `ACTIVE_APPOINTMENT_STATUSES` CONFIRMED/SYNC_FAILED (`dashboard/service.ts:22`); capacidad por `maxPerDay`, 7 dias (`:349-395`). D68: `SLOT_BLOCKING_APPOINTMENT_STATUSES` incluye PENDING.
- C1/C2 en spec 15.7 coinciden con `blocked-spaces/service.ts:211, 250-318`.
- `data-model.md` coincide con `0022_availability_rules/migration.sql` y `schema.prisma:135-136` (CHECK, FK CASCADE, `applied_at` DATETIME(3), `availability_version` default 0, default `slot_mode` BLOCK_MODE).
- Enlaces y paths en data-model, ADR 0001-0006, README de decisiones, api.md, specification.md y business-rules.md: sin enlaces rotos ni paths inexistentes. Perfil: `data_model_doc` apunta a un archivo existente. `specs/README.md` tiene la fila 003. Terminos obsoletos (pares direccionales, SECOND_ONLY, BLOCK_MODE, Por bloque, WEEKDAY_ONLY) solo aparecen como legado o negacion explicita.
- T030-T039 [X] y T075 [X]: los entregables nombrados en T075 existen (data-model, api.md, spec 4.1/4.2/4.3/7/10/12/15.7/"Mismo dia", business-rules, ADR 0001-0006). T075 esta justificado salvo por los bloqueantes B1 y B2, que son errores dentro de lo que T075 declaro entregar.

## Bloqueantes

### B1. La reprogramacion publica NO considera `reservation_locks`, pero spec y business-rules dicen que si

- `docs/specification.md:370` (8.2 paso 4): "ocupacion (incluidas citas PENDING), locks, bloqueos manuales y horario futuro".
- `docs/architecture/business-rules.md:288`: "occupancy (including PENDING appointments), active locks, manual blocks...".
- Codigo: `lib/my-appointments/service.ts:357-391` (`validateRescheduleDestination`) lee solo citas (`SLOT_BLOCKING_APPOINTMENT_STATUSES`) y `listBlockedSlotsByDateForUpdate`; no lee locks ni los pasa al resolvedor (`grep -i lock` en el archivo: solo locks de fila y `acquireBookingLocks`). Coherente con `api.md` (reprogramacion publica: sin `SLOT_LOCKED`), que si es correcto.
- Efecto: se afirma una garantia (un destino con lock vigente de otra clienta se rechaza) que el codigo no da. Es comportamiento de reserva y concurrencia (area de alto riesgo).
- Correccion requerida: quitar "locks" en ambos pasajes o marcarlo como limitacion conocida (por D86 el codigo es la verdad). Si el owner quiere que cuente, es cambio de codigo/alcance y va al Orchestrator.

### B2. El orden de locks se declara igual para bloqueos manuales, pero estos no toman los locks con nombre

- `docs/specification.md:419-421` (seccion 9): el orden "reserva publica, confirmacion, reprogramacion publica, creacion admin, reprogramacion admin y bloqueos manuales" empieza por `GET_LOCK` fecha/telefono.
- `docs/architecture/business-rules.md:177, 185` (Concurrency Rules): mismo alcance y paso 1 para "manual blocks".
- `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` (Contexto/Decision): "Todas las escrituras que tocan horarios siguen el mismo orden... 1. GET_LOCK".
- Codigo: `lib/admin/blocked-spaces/service.ts:230-245` solo hace FOR SHARE de reglas, `lockConflictingAppointments(tx, date, "")` y lecturas bloqueantes; no hay `acquireBookingLocks`. `data-model.md` (seccion "Concurrencia a nivel de datos") lo dice bien: "No toman los bloqueos con nombre de las reservas".
- Efecto: contradiccion entre cuatro documentos sobre el mecanismo de integridad que sustituye al UNIQUE inexistente.
- Correccion requerida: en spec 9, business-rules y ADR 0006, indicar que los bloqueos manuales omiten el paso 1 (como en data-model.md).

## No bloqueantes

- N1. `docs/architecture/api.md:440` lista `422 MONTH_NOT_ACTIVE` como error de la creacion admin; ninguna libreria lo lanza (solo mapeo en `app/api/admin/months/[month]/appointments/route.ts:27`) y `docs/specification.md:1128` dice que el agendado no exige mes ACTIVE. Quitarlo o anotar "no alcanzable".
- N2. `docs/specification.md:200-203` (7, paso 8) pone "Limpia locks expirados" antes de tomar los locks y leer reglas; la seccion 9 (pasos 2-4 de confirmacion) y el codigo (`book-appointment.ts:480-483`) lo hacen despues de leer reglas. Alinear paso 8 con la seccion 9.
- N3. `docs/architecture/api.md:255` aun dice "La reconciliacion de `docs/specification.md` y de `docs/features/*` se hace en T075-B y en la Fase 2"; T075-B esta hecho. Reescribir a "Fase 2 (T076)".
- N4. Documentos permanentes refieren a informes de ronda: `data-model.md:174` ("Ver Ambiguedades en el informe de ronda"), `data-model.md:213`, `api.md:443` ("informe de la Ronda 1E"). Sustituir por D-IDs/ADR 0006.
- N5. Carry-forward ya registrados en D85/D86 (confirmados, no son hallazgos nuevos): `business-rules.md:134-135, 799, 813` dicen "citas activas futuras" para el umbral de 15 dias (codigo: solo CONFIRMED/SYNC_FAILED, `lock-reservation-slot.ts:78-96`; nota ya en spec 7 paso 5); spec 8.2 no menciona que el mes destino de la reprogramacion publica debe ser ACTIVE y no pasado (`my-appointments/service.ts:351`), ocultado por F4; FR-033 vs derivacion de una sola regla de mes completo; `MonthDetailView.tsx` aun usa funciones legadas (Fase 2); comentarios D59/D61 obsoletos en `detail-service.ts:189` y `dashboard/service.ts:473` (Fase 4).
- N6. `docs/features/admin-month-detail-flow.md` y `docs/ui/**`: fuera de alcance (T076); no se detecto que contradigan algo nuevo mas alla de lo ya listado en el informe 06-D (duda 5).

## Checklist del rol

1. IDs D63-D86 cubiertos: D63/D77 (ADR 0006, spec 9, data-model), D66 (ADR 0005, spec 15.1.4/15.7, business-rules), D68/D71/D72/D73/D76/D78/D81 (api.md), D82/D83 (ADR 0006), D84/D85/D86 (aplicados). Sin contradiccion salvo B1/B2 (que no son contra decisiones sino contra codigo).
2. Sin decisiones de producto fuera del log; los pendientes de producto (C4, 8.2 ACTIVE, D34 vs gris por bloqueos, dia completo con unico horario bloqueado puntualmente) estan marcados como abiertos.
3. Sin conflicto con exclusiones de specs anteriores detectado.
4. Impacto documental declarado (data-model, api, spec, business-rules, ADR, perfil) y fila 003 en `specs/README.md` (estado Draft, correcto hasta T078).

## Para volver a Approved

Corregir B1 y B2 (3 archivos de docs mas ADR 0006). N1-N4 recomendados en la misma pasada. Sin cambios de codigo.
