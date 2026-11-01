# Quickstart: validación de la disponibilidad flexible por mes

**Feature**: `003-flexible-month-availability` | **Date**: 2026-10-28 | **Plan**: [plan.md](./plan.md)

Guía de validación de extremo a extremo. Pruebas automatizadas primero, luego verificación manual en un entorno local con una base MySQL de muestra. No contiene código de implementación; los contratos están en `contracts/`.

## Prerrequisitos

- Node 22 y dependencias instaladas (`npm install`).
- Variables de entorno de `.env` (base de datos, sesión admin). No se usan credenciales reales en pruebas: usar la base de desarrollo o de prueba del proyecto.
- MySQL local o de prueba con la migración `0021` aplicada (estado previo a la feature).
- Un mes futuro de prueba registrado en `active_months` (por ejemplo, diciembre 2026) con `slot_mode` conocido.

## Comandos de referencia

| Propósito | Comando |
|---|---|
| Estado de migraciones | `npm run prisma:status` |
| Aplicar migraciones (incluye `0022` y backfill) | `npm run prisma:deploy` |
| Generar cliente Prisma | `npm run prisma:generate` |
| Pruebas unitarias del dominio | `npm test -- tests/lib/availability` |
| Pruebas de cálculo admin | `npm test -- tests/lib/admin/months` |
| Pruebas de API admin | `npm test -- tests/app/api-admin-month` |
| Pruebas de componentes admin | `npm test -- tests/components/admin/months` |
| Pruebas de integración (MySQL) | `npm run test:integration` |
| Lint general | `npm run lint` |
| Lint i18n admin | `npm run lint:admin-i18n` |
| Tipos | `npx tsc --noEmit` |

## S-01. Motor puro con escenarios de US3

**Objetivo**: los escenarios de User Story 3 y de Edge Cases de disponibilidad (SC-001 parcial).

1. Ejecutar `npm test -- tests/lib/availability/capacity-engine.test.ts`.
2. Esperado: pasan los casos de regla BLOCK con cita a 09:00 (sin 10:00), cita a 10:00 (sin 17:00), `preserveCapacity=false` y día sin citas (seis horarios).

## S-02. Backfill idempotente (FR-030, FR-031)

**Objetivo**: la migración crea una regla por mes según D4, y una segunda ejecución no cambia nada.

1. Antes de la migración, registrar la lista de meses y su `slot_mode`:
   - `SELECT month, slot_mode FROM active_months ORDER BY month;`
2. Aplicar `npm run prisma:deploy`.
3. Verificar:
   - `SELECT COUNT(*) FROM availability_rules;` igual al número de meses en `active_months`.
   - `SELECT name, rows_created FROM availability_migration_runs;` con la fila `backfill-availability-rules-v1`.
   - Para cada mes, las horas de su única regla coinciden con su `slot_mode` (ver tabla de mapeo en `data-model.md`).
4. Ejecutar de nuevo la lógica de backfill (prueba de integración `tests/integration/availability-backfill.integration.test.ts`).
5. Esperado: el conteo de `availability_rules` no cambia y `availability_version` no se modifica.

## S-03. Citas y eventos sin cambios (SC-004, FR-032)

**Objetivo**: ninguna cita cambia de fecha, hora, estado ni `google_event_id` por migración ni por edición de reglas.

1. Tomar una muestra: `SELECT id, date, time_slot, status, google_event_id FROM appointments WHERE date BETWEEN '2026-12-01' AND '2026-12-31';`
2. Aplicar la migración y guardar un conjunto de reglas distinto (con confirmación de afectadas si aplica).
3. Repetir la consulta y comparar.
4. Esperado: resultados idénticos. Las pruebas `tests/integration/availability-backfill.integration.test.ts` automatizan esta comparación.

## S-04. Diciembre 2026: 67 espacios (SC-007, SC-005)

**Objetivo**: el mes de referencia vacío reporta 67 espacios disponibles.

1. Crear, en el editor de `/admin/months/2026-12`, dos reglas:
   - Regla A: del 1 al 13, lunes a viernes, horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, 240/true/3.
   - Regla B: del 14 al 23, todos los días, horas `07:30, 11:00, 14:30, 18:00`, 0/false/4.
2. Confirmar que no hay citas ni bloqueos del mes.
3. Esperado: `Disponibles` = 67. Días 5, 6, 12, 13 y 24 a 31 cerrados (gris). Los días 1-4, 7-11 con 3 espacios; 14-23 con 4 espacios.
   - Prueba automatizada: `tests/lib/admin/months.detail-service.test.ts`.

## S-05. Enero 2027: excepciones de sábados y lunes

**Objetivo**: US4 escenario 2.

1. Regla: L-V del 1 al 31 de enero, horas `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, 240/true/3.
2. Excepciones: sábados 16 y 23 con las mismas horas y 240/true/3; lunes 18 y 25 con lista vacía.
3. Esperado: 21 días abiertos, 63 espacios. Sábados 2, 9, 30 y domingos cerrados (D23, D28).

## S-06. Citas afectadas antes de guardar (FR-023, D18, D40)

**Objetivo**: el editor muestra el listado antes de guardar y no escribe si se cancela.

1. En un mes futuro con citas activas, quitar una hora de la regla (por ejemplo, 17:00) donde haya una cita futura.
2. Pulsar guardar.
3. Esperado: aparece el diálogo con la cita afectada (fecha, hora, estado, cliente). No hay escritura hasta confirmar.
4. Cancelar: los datos no cambian (`availability_version` igual).
5. Repetir y confirmar: la cita sigue igual (fecha, hora, estado, `google_event_id`); la regla cambia; `availability_version` aumenta.
6. Prueba de bloqueos (D40): un bloqueo manual sobre una cita futura no aparece en el diálogo.

## S-07. Conflicto de versión (FR-041, D24)

**Objetivo**: un guardado desactualizado se rechaza sin cambios.

1. Abrir el editor en dos pestañas del mismo mes.
2. Guardar en la primera.
3. Guardar en la segunda sin recargar.
4. Esperado: `409 AVAILABILITY_VERSION_CONFLICT` en la segunda; el editor muestra error con `sileo.error` y pide recargar; la base no cambia.

## S-08. Auditoría sin cambios (D24, FR-035)

1. Guardar un cambio de reglas.
2. Consultar `SELECT COUNT(*) FROM appointment_logs WHERE created_at >= '<hora del guardado>';`
3. Esperado: 0 filas nuevas por el cambio de reglas.

## S-09. Flujo público con el resolvedor (FR-015, FR-017, FR-018)

1. Con el mes activo y reglas de S-04, abrir `/booking` o consultar `GET /api/availability/2026-12`.
2. Esperado: días 1-4, 7-11 con seis (regla A) o cuatro (regla B) horarios; los fines de semana sin regla no aparecen; los días 14-23 incluyen sábados y domingos.
3. Reservar un horario en un día sin horarios (por ejemplo, 5 de diciembre, cerrado) mediante la API pública.
4. Esperado: error `SLOT_NOT_AVAILABLE` (D46). No se crea cita.

D32: tras un cambio de reglas, la siguiente consulta pública refleja el cambio sin publicación ni borrador (prueba `availability-public-consistency.integration.test.ts`).

## S-10. Concurrencia reserva y cambio de reglas (D39, R-06)

1. Crear un lock de reserva sobre 10:00 del 9 de diciembre.
2. Quitar 10:00 de la regla desde el editor.
3. Confirmar la reserva con el lock.
4. Esperado: `SLOT_NOT_AVAILABLE` (mismo error que horario no disponible). La prueba `tests/integration/availability-concurrency.integration.test.ts` automatiza el escenario.

## S-11. Bloqueos de horario puntual y Google Calendar (D15, D30)

1. Crear un bloqueo puntual nuevo en un mes en `SECOND_ONLY_MODE` (el evento debe durar 1 h).
2. Crear un bloqueo de día completo (evento `06:00-23:00`).
3. Editar un bloqueo puntual creado antes del despliegue: el evento existente no cambia de duración.
4. Esperado en tests: `syncBlockedSlotCreate` pasa `durationHours = 1` para puntuales; día completo sin cambio.

## S-12. Métricas con bloqueos (D14, D41, FR-029)

1. En diciembre, bloquear 14:00 del 2 de diciembre (regla A): `Espacios bloqueados` sube en 1.
2. Bloquear el día completo del 16 de diciembre (regla B, rejilla de 4 horas): `Espacios bloqueados` sube en 4.
3. Esperado: el conteo sigue el número de horarios de la rejilla vigente (D41).

## S-13. Mes pasado y mes nuevo (FR-021, D17, D31)

1. Intentar editar reglas de un mes pasado: `422 MONTH_IN_PAST`.
2. Crear un mes nuevo con `POST /api/admin/months`: sin reglas, `slot_mode = BLOCK_MODE`, default D6 en los días no cubiertos.
3. Crear la primera regla de un mes sin reglas: los días que D6 abría y que la nueva regla no cubre quedan cerrados (D42; prueba `day-rule.test.ts`).

## S-14. Rollback (riesgo de *Rollout and rollback*)

1. Con reglas de preset (BLOCK o SECOND_ONLY), desplegar la versión anterior: los horarios públicos y `slotMode` coinciden con el preset.
2. Con reglas no preset, la versión anterior muestra el último `slot_mode` (riesgo aceptado, D19). Revertir el release completo: fases 1 y 2 se despliegan y se revierten juntas (D45).

## S-15. Dashboard con capacidad por día (D44, D53)

1. Con diciembre 2026 configurado como en S-04, abrir el dashboard `/admin`.
2. Esperado: la capacidad diaria de un día abierto es su `maxPerDay` (3 o 4); un día cerrado tiene capacidad 0 y ocupación 0 %. La capacidad semanal es la suma de `maxPerDay` de los días resueltos de la semana.
3. Prueba automatizada: `tests/lib/admin/dashboard.service.test.ts`.

## Criterios de salida

- S-01 a S-13 pasan en pruebas automatizadas o en verificación manual documentada.
- Equivalencia sin bloqueos: 0 diferencias (SC-002).
- Pruebas de bloqueos: cifra 48 de 432 (D43) y prueba en verde.
- `npm run lint`, `npm run lint:admin-i18n`, `npx tsc --noEmit`, `npm test` y `npm run test:integration` sin errores nuevos.
- Documentación de la fase reconciliada según *Documentation Impact* del plan.
