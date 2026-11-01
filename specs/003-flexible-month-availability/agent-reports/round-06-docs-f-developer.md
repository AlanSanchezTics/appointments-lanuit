# Ronda T075-F (micro-ronda documental NB-5): informe del Developer

Transcrito (resumido) por el Orchestrator. Solo documentación; sin tests ejecutados; sin tocar código, scripts, `.env` ni bases de datos.

## Archivos modificados
- `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`: reescrito (decisiones D87-D93 en cabecera; paso 4 de RL con limpieza por fecha y orden tras citas; excepción del bloqueo de espacios; sección "Propagación de errores" D81/D88/D91; F3 sin cita a NB-1 de 1D; F4 corregido; F5 cubierta por integración; consecuencias del cron; trazabilidad).
- `docs/runbooks/reservation-lock-cleanup.md`: reescrito (limpieza lazy por fecha; cron cada minuto D92; sección "Concurrencia" sin ventana de bajo tráfico; 1213 raro, siguiente disparo del cron; 400 `UNKNOWN_ERROR` con rollback).
- `docs/specification.md`: 7 paso 8; 8.2 punto 4 (lock ajeno = `SLOT_NOT_AVAILABLE`, lock propio no bloquea, mes no reservable, error de infraestructura = 400 `UNKNOWN_ERROR`); sección 9 (cabecera, lazy cleanup y cron, orden de locks con paso 4 de RL y excepción del bloqueo de espacios, confirmación renumerada a 12 pasos, F4).
- `docs/features/booking-flow.md` (backend transaccional y Concurrency), `docs/architecture/business-rules.md` (Concurrency Rules), `docs/architecture/api.md` (causas de `SLOT_NOT_AVAILABLE` y `UNKNOWN_ERROR` en reprogramación pública; sin `MONTH_NOT_ACTIVE`).
- `docs/architecture/data-model.md` L241 y `docs/decisions/0002-*.md` L25-26: sin cita a informes de ronda.

## Decisiones del Developer (a confirmar por el owner)
1. En creación admin la lectura de RL precede a la lectura de ocupación: se escribió "después de los conflictos de citas", no "al final".
2. F4 pasó a corregido (D91); F5 a cubierta por la prueba de integración.
3. ADR 0002 "riesgo de cobertura": reescrito a lo verificado (el oráculo de equivalencia cubre bloqueos disjuntos solo en `BLOCK_MODE`; `SECOND_ONLY_MODE` con bloqueos solo en pruebas puntuales). Confirmar si el riesgo sigue vigente.
4. `data-model.md` L241: se quitó la afirmación de que MySQL rechaza `max_per_day = 7` (sin evidencia en el repo); reinstaurar sin cita si el owner tiene la evidencia de la ronda 1A. (Nota: el Developer de 1F observó en integración que el CHECK `max_per_day <= 6` sí rechaza 7 y 10.)
5. Cabecera del ADR 0006 con D91/D92; quitada "(NB-1 de 1D)" de F3.
6. Spec 9 y ADR mencionan que la reserva pública borra el lock vigente del propio teléfono sin acotar por fecha (`deleteActiveReservationLocksByPhone`).

## Fuera de alcance (no tocado)
- `README.md` L108 documenta `npm run locks:cleanup -- --older-than-days=7 --batch=5000`; el script solo acepta `--batch` (`scripts/cleanup-reservation-locks.mjs` L13).
- Citas de ronda restantes: `data-model.md` L9/L296, ADR 0001 L26, ADR 0005 L23, `api.md` L384-385.
- Crons "Retry sync appointments", "Retry sync blocked slots" y "Reject pending appointments" (D92) sin documentar en el runbook.

## Verificado (leyendo código) y límites
Orden de RL en las 6 rutas, limpieza acotada (`lib/db/appointments.ts` L449-461), lock ajeno (L497-520), B-1 (`lib/my-appointments/service.ts` L352-362), mapeos HTTP, `SLOT_LOCKED` admin, script y `package.json`. `python3 scripts/check-workflow-profile.py`: exit 0 con aviso de versión de Spec Kit. No ejecutó tests; el cron de producción solo consta en D92; el 1213 residual no está medido.

## Documentation Impact
Sí, sin cambio de comportamiento. Flow Contract Check: UI No; API contract Sí (documentación de causas); validation rules Sí; acceptance criteria No; spec alineada Sí. Migration: no aplica.
