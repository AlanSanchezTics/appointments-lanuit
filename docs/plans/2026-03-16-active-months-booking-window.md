# Active Months Booking Window Implementation Plan

## 1. Summary
Introducir `active_months` como fuente de verdad para habilitar reservas en mes actual + siguiente (escalable a N), reemplazando validaciones hardcodeadas de mes actual.

## 2. Current System Understanding
- La validación de mes está hardcodeada en `lib/validation/appointment.ts` y `lib/availability/service.ts`.
- Cancelación filtra únicamente por el mes actual en `lib/appointments/find-cancelable-appointment.ts` y `lib/appointments/cancel-appointment.ts`.
- El proyecto usa Next.js + Prisma + MySQL, con scripts operativos manuales (sin cron interno).

## 3. Gaps, Risks, and Ambiguities
- Riesgo de inconsistencias si no se actualizan todas las capas que usan `isCurrentMonth`.
- Riesgo operativo si no se agenda el job externo de reconciliación.
- Riesgo de timezone en rollover mensual si no se usa `America/Mexico_City`.

## 4. Proposed Data Model
- Tabla `active_months`:
  - `id` INT PK
  - `month` CHAR(7) UNIQUE (`YYYY-MM`)
  - `status` ENUM(`ACTIVE`, `INACTIVE`)
  - `created_at`, `updated_at`
- Índices: `UNIQUE(month)` y `INDEX(status, month)`.

## 5. Booking Month Access Logic
1. Derivar `month` solicitado de ruta o `date`.
2. Validar que `month >= currentMonth(MX)`.
3. Verificar registro `ACTIVE` en `active_months`.
4. Si no existe o está inactivo, devolver `MONTH_NOT_ALLOWED`.

## 6. Automatic Status Transition Strategy
- Job externo diario ejecutando reconciliación:
  - Activar ventana `[currentMonth .. currentMonth+N-1]`.
  - Desactivar meses fuera de ventana y todos los meses pasados.
- Variable configurable `ACTIVE_MONTH_WINDOW_SIZE` (default `2`).

## 7. Migration and Rollout Plan
1. Agregar modelo Prisma + migración SQL.
2. Implementar servicio/repositorio de `active_months`.
3. Agregar script operativo `months:reconcile`.
4. Cambiar booking/availability/cancel para usar meses activos.
5. Ejecutar backfill inicial en prod y programar job externo.

## 8. Scalability Strategy
- Ventana configurable por env var.
- `active_months` como fuente de verdad para soportar N meses sin hardcode.

## 9. Impacted Areas
- `prisma/schema.prisma`, `prisma/migrations/*`
- `lib/validation/appointment.ts`
- `lib/availability/service.ts`
- `lib/appointments/find-cancelable-appointment.ts`
- `lib/appointments/cancel-appointment.ts`
- nuevo `lib/db/active-months.ts`
- nuevo `lib/active-months/service.ts`
- `scripts/*`, `package.json`, tests y documentación.

## 10. Test Plan
- Unit: mes actual/siguiente activo permitido; pasado/inactivo rechazado.
- Integration: inicialización y reconciliación de meses.
- E2E: disponibilidad y booking en mes actual + siguiente; rechazo en pasado.

## 11. Documentation Impact
`docs/specification.md` debe actualizarse en:
- Regla de mes activo
- Flujo de reserva
- Flujo de cancelación
- Casos edge e invariantes

## 12. Acceptance Criteria
- Reserva permitida en mes actual y siguiente si están `ACTIVE`.
- Mes pasado siempre rechazado.
- Cancelación opera sobre meses activos.
- Reconciliación automática mantiene estados correctos.

## 13. Open Questions
- Scheduler externo definitivo para ejecutar `months:reconcile`.

## 14. Implementation Task Breakdown
- Fase 1: backend y migraciones.
- Fase 2: UI/UX flow (sin rediseño, solo copy alineado).
- Fase 3: pruebas y rollout.
- Fase 4: cleanup técnico.

Documentation Impact:
- Yes
- Updated docs/specification.md
- Sections affected: Regla de Mes Activo, Flujo de Reserva, Flujo de Cancelación, Invariantes, Casos Edge
