# Ronda 06-A (T075-A): informe del Developer

**Alcance**: documentación de la mitad A del cierre documental de la Fase 1 (T075). Solo `docs/`. Sin código, sin pruebas, sin `specs/` (salvo este informe). Sin commit y sin cambio de rama.

**Estado**: completada en la parte documental. Pendiente T075-B (`docs/specification.md` y `docs/architecture/business-rules.md`). `tasks.md` no se tocó: T075 sigue sin marcar.

## Archivos

Creados:

- `docs/architecture/data-model.md` (nuevo, D7).
- `docs/decisions/README.md` (índice).
- `docs/decisions/0001-min-gap-reemplaza-pares-direccionales.md` (D1).
- `docs/decisions/0002-diferencias-con-bloqueos-manuales-frente-al-legado.md` (D2 superada por D43; D54).
- `docs/decisions/0003-bloqueos-puntuales-de-una-hora.md` (D15, D29, D30).
- `docs/decisions/0004-derivacion-de-slot-mode.md` (D19, D31).
- `docs/decisions/0005-capacidad-del-dashboard-y-contadores.md` (D44, D53, D66).
- `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` (D63, D77; F1 D82; F2 D83; F3).
- `specs/003-flexible-month-availability/agent-reports/round-06-docs-a-developer.md` (este informe).

Modificados:

- `docs/architecture/api.md`: sección nueva "Disponibilidad mensual y reservas (spec 003)" antes de "Evolution and Versioning Considerations", y una línea de referencia en "Public My Appointments Endpoints". El resto del archivo no cambió.
- `docs/standards/subagent-workflow.profile.md`: `{{data_model_doc}}` pasa de `none` a `docs/architecture/data-model.md`. Única modificación del perfil.

No tocados: `docs/specification.md`, `docs/architecture/business-rules.md`, `docs/features/*`, `specs/003-*/tasks.md`, `specs/README.md` (la modificación que aparece en git ya existía antes de esta ronda), código y pruebas.

## Qué se documentó

**`docs/architecture/data-model.md`**: tablas nuevas con columnas, tipos, PK, UNIQUE, FK ON DELETE CASCADE y CHECK tal como están en `prisma/migrations/0022_availability_rules/migration.sql`; cambios en `active_months` (`availability_version`, default de `slot_mode`); relaciones; tablas existentes relacionadas (`appointments` sin UNIQUE sobre fecha y hora; `blocked_slots` con UNIQUE); derivación de `slot_mode` (D19, D31); backfill D4 con idempotencia por `backfill-availability-rules-v1` y transacción; historial del default de `slot_mode` (0014 `SECOND_ONLY_MODE`, 0022 `BLOCK_MODE`); estado legado; marcador de día completo (`00:00`, D29, D41, D55); orden de bloqueo en escrituras (D63, D77); tabla de protecciones de integridad, con la aclaración explícita de que no hay restricción de BD para dos citas activas en el mismo horario; orden de migración, backfill, despliegue y limpieza; procedimiento de recuperación manual de 0022 (N4); riesgos de rollback; bitácora de esquema.

**`docs/architecture/api.md`**: sección nueva en español con convenciones de error, y contratos de `GET` y `PUT` de `/availability`, `POST /availability/preview`, `PATCH slot-mode`, `POST /api/admin/months`, `GET /api/admin/months/[month]` (campos aditivos), agenda (`excludeAppointmentId`, `availableSlots`), `blockable-slots`, `blocked-slots` (`DATE_NOT_OPERATIONAL` sin mapeo, D76), creación admin (D73, D78), reprogramación admin (D72, D78), `GET /api/availability/[month]` (forma `{ month, days: [{date, slots}] }`), reserva pública (`/api/reservar/*`) y reprogramación pública. Cada tabla de error sale del código de las rutas. Los códigos `AVAILABILITY_*` se documentan con su HTTP real (400).

**`docs/decisions/`**: seis ADR en español, con estado Accepted, fecha 2026-10-30 y enlace relativo a la spec 003, y un índice. El ADR 0006 (concurrencia) se redactó primero, por prioridad.

## Trazabilidad (AGENTS.md)

Documentation Impact:
- Impacto en flujo: Sí.
- `docs/specification.md`: no actualizado en esta ronda (T075-B). Secciones pendientes según plan D52: 4.1, 4.2, 4.3, 7, 10, 12 e invariantes 4 y 6, 15.7.
- `docs/architecture/business-rules.md`: no actualizado en esta ronda (T075-B).
- Documentos cambiados en esta ronda: `docs/architecture/data-model.md` (nuevo), `docs/architecture/api.md` (sección nueva), `docs/decisions/*` (nuevo), perfil (`data_model_doc`).
- Ambigüedad: `api.md` está en inglés. La sección nueva está en español, según el perfil (`{{language}}`). Ver ambigüedades.

Flow Contract Check:
- UI steps updated: No (Fase 2, T076).
- API contract updated: Yes (`api.md`).
- Validation rules updated: Yes (tablas en `data-model.md` y en `api.md`).
- Acceptance criteria updated: No (fuera de esta mitad).
- docs/specification.md aligned: No (pendiente de T075-B).

Migration Compatibility Check:
- Schema changes required: Yes, ya presentes en la migración 0022 (creada en la ronda 1A). Esta ronda solo documenta; no cambia esquema.
- Data backfill required: Yes (documentado; ejecutado y verificado en 1A).
- Legacy compatibility required: Yes (`slot_mode` legado hasta fase 4).
- Rollback strategy defined: Yes (release rollback y recuperación manual N4).
- Cleanup phase defined: Yes (fase 4 con `0023`, pendiente de autorización).
- Integrity protections defined: Yes, con la nota de que no hay UNIQUE en `appointments`.

Admin UI Check: no aplica (no hay cambios de UI).
Notification Contract Check: no aplica.

## Verificación

- `python3 scripts/check-workflow-profile.py`: exit 0. Salida: `OK: 9 keys, all defined, used, and resolvable`. Aviso del entorno, no bloqueante: Spec Kit instalado 0.11.9, probado 1.0.5.
- Verificación documental: estática, por lectura del código. Se revisaron `prisma/schema.prisma`, la migración 0022, `lib/availability/*` (day-rule, capacity-engine, resolver, rules-validation, slot-mode-derivation, affected-appointments, service, defaults), `lib/db/availability-rules.ts`, `lib/admin/months/{service,validation}.ts`, `lib/appointments/{book-appointment,lock-reservation-slot}.ts`, `lib/my-appointments/service.ts`, `lib/admin/appointments/service.ts`, `lib/admin/blocked-spaces/service.ts`, `lib/admin/dashboard/service.ts`, `lib/admin/months/detail-service.ts`, `lib/db/appointments.ts`, `lib/db/admin-appointments.ts`, `lib/db/blocked-slots.ts`, `lib/db/admin-months.ts`, `lib/db/active-months.ts`, `lib/api/error-response.ts` y las rutas de `app/api/admin/months/`, `app/api/admin/appointments/`, `app/api/my-appointments/reschedule`, `app/api/reservar/*` y `app/api/availability/[month]`.
- No se ejecutaron pruebas, build, lint, migraciones ni consultas a la BD en esta ronda.

## Diferencias plan o contrato frente a código (gana el código, y está documentado así)

1. `POST /api/admin/months` responde 200, no 201. La convención de `api.md` dice 201 para creaciones. Se documenta el comportamiento real y no se cambia el código.
2. `GET /api/availability/[month]` devuelve `{ month, days }`. `days` solo incluye fechas desde hoy con al menos un horario. El contrato hablaba solo de la forma `{ date, slots }`. Todos sus errores responden 422.
3. `PUT .../availability` exige `expectedVersion` (zod obligatorio). El plan lo marcaba como opcional solo en PATCH. Se documenta como obligatorio.
4. Una fecha inexistente o malformada en reglas o excepciones (por ejemplo `2026-02-30`) responde `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH` o `AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH`, no un código de formato.
5. Reprogramación admin de una cita `PENDING`: la lectura filtra estados, así que responde 404 `APPOINTMENT_NOT_FOUND`. El plan (D72) no decía el código. Verificado por lectura; sin prueba específica.
6. `data-model.md` de trabajo indicaba `applied_at` como `DATETIME`. El código y la migración usan `DATETIME(3)`. Se documenta el real.
7. La bitácora de trabajo decía "Reversible: Sí en esquema". Lo real: el DDL no es transaccional, no hay rollback automático, y la recuperación es manual. Se documenta así.
8. `reconcileActiveMonthsInDatabase` (`lib/db/active-months.ts`) crea meses sin reglas, así que aplican D6. Antes, con el default de 0014, recibían `SECOND_ONLY_MODE`. Ver ambigüedad A4.
9. `replaceMonthAvailability` no exige transacción en el código; solo lo indica un comentario (N2, carry-forward). Sin cambio.
10. `listBlockedSlotsByDateForUpdate` (`lib/db/blocked-slots.ts`) es una lectura plana sin `FOR UPDATE`, pese a su nombre (F2). Confirmado.
11. Comentarios obsoletos en código: `lib/admin/months/detail-service.ts` (D59, línea ~189) y `lib/admin/dashboard/service.ts` (D61, línea ~473) dicen que `PENDING` cuenta. La consulta no la incluye (D66). Corregir comentarios fuera de esta ronda.
12. `docs/architecture/api.md` (sección my-appointments, en inglés) lista `PHONE_INVALID`. El código devuelve `VALIDATION_ERROR` porque zod se normaliza. No cambié la línea existente; ver A2.
13. Decisiones de documentación que no estaban en el plan: formato de ADR (`spec-driven-development.md` no lo define) y restauración del default de `slot_mode` en la recuperación manual (ver A3).

## Afirmaciones no verificadas en esta ronda (tomadas de STATE o de informes de revisión)

- F1: lock retenido en 7 de 10 expiraciones (medido por el Reviewer en 1E).
- F2: 17/40 y 10/40 dobles (medido en 1E).
- F3, B-1 (40/40 en HEAD), regresión B-1 fallando 3/3 sin corrección, carrera admin frente a pública 0/120: tomados de STATE. No se reprodujeron.
- Timeout por defecto de 5 s en `$transaction`. No hay `timeout:` explícito en `lib/` ni `app/` (grep). El valor se toma de STATE.
- Duración de 1 h de los bloqueos puntuales: verificada en código (líneas 352 y 96). La prueba T034 no se ejecutó.
- Versión de MySQL para aplicar CHECK (Q-T2): no verificada.
- Valor del TTL de los locks de reserva: no documentado, porque no se verificó.
- Suite de integración: no ejecutada.

## Ambigüedades y decisiones para el Orchestrator

- **A1. Idioma de `api.md`**: el archivo está en inglés. La sección nueva está en español, según `{{language}}`. Confirmar si se prefiere inglés o una traducción.
- **A2. `PHONE_INVALID` frente a `VALIDATION_ERROR`**: decisión de contrato, no de documentación. Dos opciones: cambiar el código para devolver `PHONE_INVALID`, o cambiar la línea de `api.md`. No decidido aquí.
- **A3. Recuperación N4**: el paso 5 restaura el default `SECOND_ONLY_MODE` (default de 0014). La nota N4 del STATE no lo mencionaba. Lo añadí yo. Confirmar.
- **A4. Meses reconciliados**: los meses creados por `reconcileActiveMonthsInDatabase` quedan sin reglas (D6) y ya no reciben `SECOND_ONLY_MODE`. Confirmar que D31 cubre este caso.
- **A5. Comentarios D59 y D61** en código: corrección fuera de esta ronda.
- **A6. `AFFECTED_MONTH_MISMATCH`**: documentado como interno, con la salvedad de que el normalizador lo devolvería como 400 si llegara a una ruta. No es alcanzable porque ambos llamadores pasan el mes del path.
- **A7. Formato ADR**: propuesto en `docs/decisions/README.md` (estado, fecha, enlace a la spec). El repositorio no define uno.
- **A8. Q-T2**: el aplicado de `CHECK` depende de la versión de MySQL. No verificada.
- **A9. Pendientes de otras rondas**: `{{test_commands}}` (Q-T1) y `--no-file-parallelism` siguen en STATE; no están en esta ronda.

## Residuales para el cierre documental

- T075-B: `docs/specification.md` (4.1, 4.2, 4.3, 7, 10, 12, 15.7, con D50 y D55) y `docs/architecture/business-rules.md`. Incluye la redacción de la reprogramación pública hacia el resolvedor y D39 (`SLOT_LOCKED` precede a `SLOT_NOT_AVAILABLE`), que sí se mencionó en `api.md` como precedencia.
- T075: marcar solo después de T075-B, según la instrucción del Orchestrator.
- Corrección de F1 (D82) y revisión de F2 (D83) antes de la release combinada. Fuera de esta ronda.
- `api.md`: si A2 se decide a favor de `PHONE_INVALID`, actualizar la sección de my-appointments.

## Turnos

Aproximadamente 70 llamadas de herramienta. No son turnos oficiales. No se usó compactación.
