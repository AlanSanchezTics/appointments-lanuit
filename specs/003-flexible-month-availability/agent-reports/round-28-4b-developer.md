# Ronda 4B (round-28) - Developer: eliminar `slot_mode` y `slotMode` de las respuestas

Spec 003, tareas T069 a T074. Rama `003-flexible-month-availability`, HEAD `fed5d46`. Sin commit ni push. Cambios en el árbol de trabajo.

Estado: T070 a T074 verificadas en este entorno. T069 queda abierta: el archivo de migración está creado y aplicado solo en `appointments_test`; la verificación de procesos previos al despliegue y el Gate 4 son del owner (ver "Pendiente del owner").

## Flow Contract Check

- UI steps updated: No (sin cambio de pasos; solo se retiran claves de locales sin uso).
- API contract updated: Yes (en `docs/architecture/api.md`, mínimo; ver "Documentación").
- Validation rules updated: No (el preset de `PATCH slot-mode` sigue validándose igual, RQ-1).
- Acceptance criteria updated: No (los criterios de salida de 4B están en `tasks.md`; no se tocaron).
- docs/specification.md aligned: No. Pendiente T078: `docs/specification.md` L1493 (detalle del mes con `slotMode`) y L1503 (respuesta PATCH `{ month, slotMode }`) siguen describiendo el contrato anterior.

## Migration Compatibility Check

- Schema changes required: Yes (`DROP COLUMN active_months.slot_mode`; `enum MonthSlotMode` eliminado de `schema.prisma`).
- Data backfill required: No (el backfill de 0022 ya creó las reglas; la columna es legado).
- Legacy compatibility required: Yes, pero sin ventana. El código anterior a 4B lee `slot_mode` en `findActiveMonth`/`listActiveMonths` (reservas vía `getBookableMonthConfig`), `findRegisteredMonth` (admin de citas y bloqueos), `findMonthAvailability` (SQL) y escribe en `replaceMonthAvailability`. Con la columna eliminada, esas consultas fallan. No hay convivencia posible: la migración y el despliegue deben ser atómicos.
- Rollback strategy defined: Parcial (ver "Orden de despliegue y rollback"). La migración es irreversible sin backup.
- Cleanup phase defined: Yes. `availability_migration_runs` se conserva (decisión del owner pendiente). T078 limpia la documentación.
- Integrity protections defined: No se añaden constraints. La eliminación de columna no altera FK ni índices existentes (`slot_mode` no tenía índice).

## Admin UI Check

- Uses components/admin/ui: No cambio de UI. Se eliminan claves de locales (`monthsDetail.slotMode.*`, 21 líneas en es y en) que ningún componente usaba (grep sin resultados).
- Reused existing components: N/A.
- New reusable components created: No.
- Tokens respected: N/A.
- design-system.md aligned: N/A (sin cambio visual).
- Public flow untouched: Yes (no se tocó `booking`/`cancel`; `lib/active-months/service.ts` solo deja de recibir `slotMode` en el registro).

Notification Contract Check: N/A (sin notificaciones nuevas ni modificadas).

## Archivos modificados

Migración y esquema:
- `prisma/migrations/0023_drop_active_months_slot_mode/migration.sql` (nuevo): `ALTER TABLE active_months DROP COLUMN slot_mode`, con cabecera en español que describe la irreversibilidad y el rollback.
- `prisma/schema.prisma`: eliminados `enum MonthSlotMode` y el campo `slotMode` de `ActiveMonth`. `AvailabilityMigrationRun` se conserva.

Código de aplicación:
- `lib/availability/month-slot-mode.ts`: eliminado (T073).
- `lib/availability/defaults.ts`: nuevo `SLOT_MODE_PRESET_VALUES` y `AvailabilityPresetMode` derivado de él. Es la reubicación de los valores del preset (RQ-1); `DEFAULT_MONTH_SLOT_MODE` desaparece con su único uso.
- `lib/availability/slot-mode-derivation.ts`: eliminado `deriveSlotMode` (solo escribía la columna). Se conserva `buildSlotModePresetRules`, que usa el PATCH.
- `lib/db/active-months.ts`: sin `slotMode` en tipo, mapeo ni `select`.
- `lib/db/admin-months.ts`: sin `slotMode` en `createInactiveMonths` ni en `findRegisteredMonth`; eliminada `updateRegisteredMonthSlotMode` (sin llamadores).
- `lib/db/availability-rules.ts`: deja de leer `slot_mode` en `readMonthAvailability` y de escribirla en `replaceMonthAvailability` (`activeMonth.update` solo incrementa `availabilityVersion`). Este archivo no estaba en la lista literal de T071; sin el cambio, el SQL fallaría tras 0023.
- `lib/admin/months/types.ts`: sin `slotMode` en `MonthDetailResponse`, `MonthAvailabilityResponse` y `UpdateAdminMonthSlotModeResponse`. `UpdateAdminMonthSlotModePayload.slotMode` pasa a `AvailabilityPresetMode` (entrada, sin cambio de cuerpo).
- `lib/admin/months/service.ts`: sin `slotMode` en respuestas ni en escrituras; `updateAdminMonthSlotMode` devuelve `{ month, availabilityVersion }`.
- `lib/admin/months/detail-service.ts`: sin `slotMode` en el detalle del mes (GET `[month]`).
- `lib/admin/months/validation.ts`: el zod enum usa `SLOT_MODE_PRESET_VALUES`; cuerpo de entrada del PATCH sin cambio.
- `lib/admin/months/api-client.ts`: tipo del preset = `AvailabilityPresetMode`; cuerpo sin cambio.
- Rutas `app/api/admin/months/[month]/route.ts` y `.../slot-mode/route.ts`: no requirieron cambios de código (la forma viene de los servicios).

Locales:
- `locales/es/admin.json` y `locales/en/admin.json`: eliminado el bloque `monthsDetail.slotMode` (21 líneas cada uno). JSON válido comprobado.

Documentación (mínima, por la regla de contrato de `api.md`):
- `docs/architecture/api.md`: retirado `slotMode` de los ejemplos y textos de respuesta de `GET .../availability`, `PATCH .../slot-mode` (respuesta `{ month, availabilityVersion }`) y `GET /api/admin/months/[month]`; `slotMode` se mantiene como selector de preset en el cuerpo del PATCH (RQ-1, D49 sin alias).

Pruebas:
- `tests/lib/availability/month-slot-mode.test.ts`: eliminado (módulo borrado).
- `tests/lib/availability/slot-mode-derivation.test.ts`: reducido a las dos pruebas de `buildSlotModePresetRules`. Se eliminan 10 pruebas de `deriveSlotMode`.
- `tests/integration/availability-backfill.integration.test.ts`: ver "Decisiones". Crea la columna legada `slot_mode` en `beforeAll` (si no existe), siembra con SQL crudo, lee con SQL crudo y la elimina en `afterAll`.
- `tests/integration/availability-concurrency.integration.test.ts`: eliminada la aserción `stored?.slotMode`.
- `tests/app/api-admin-month-availability-route.test.ts`: la respuesta ya no incluye `slotMode`; se añade `not.toHaveProperty("slotMode")`.
- `tests/app/api-admin-month-slot-mode-route.test.ts`: la respuesta esperada es `{ month, availabilityVersion }`. El cuerpo de entrada con `slotMode` se conserva.
- `tests/lib/admin/months.service.test.ts`, `months.detail-service.test.ts`, `months-availability-api-client.test.ts`, `tests/lib/db/admin-months.test.ts`, `tests/lib/active-months/service.test.ts`, `blocked-spaces.service.test.ts`, `tests/lib/appointments/*`, `tests/lib/admin/dashboard.service.test.ts`, `appointments.lock-order.test.ts`, `tests/lib/availability/service.test.ts`, `tests/lib/my-appointments.service.test.ts`, componentes y hooks de `tests/components/admin/months/*` y `tests/hooks/admin/months/*`: eliminadas líneas de fixtures `slotMode` (sin cambio de aserciones de comportamiento). Las entradas de preset (`updateAdminMonthSlotMode(..., "SECOND_ONLY_MODE")`, `parseUpdateMonthSlotModePayload`) se conservan.
- Integración: `tests/integration/reservation-lock`, `book-appointment`, `admin-create-concurrency`, `reschedule-*`: eliminadas líneas `slotMode` en `activeMonth.create`.

Fuera de `git status` por diseño: `tsconfig.tsbuildinfo` se restauró con `git checkout` tras cada `tsc`.

## Decisiones tomadas en la ronda (revisar)

1. `deriveSlotMode` eliminado, no reubicado. Sin escritura de la columna no tiene llamadores de producción; conservarlo sería código muerto con `slotMode` en el nombre. Se borraron sus 10 pruebas. Son 11 pruebas menos en total (818 a 807), todas de código eliminado.
2. El preset se reubica en `lib/availability/defaults.ts` (junto a `SLOT_MODE_PRESETS`). Es la única dependencia que el motor/PATCH necesitaba de `month-slot-mode.ts`.
3. `availability-backfill.integration.test.ts` prueba el bloque BACKFILL de la migración 0022, que lee `slot_mode`. Tras 0023 la columna no existe en la BD de pruebas. Opciones: (a) eliminar el test; (b) recrear la columna legada como fixture, como se hizo. Elegí (b) para no perder la cobertura de la migración 0022. Es decisión del Orquestador: si prefiere (a), el cambio es borrar el archivo.
4. El icono `adminIcons.slotModeSettings` (`components/admin/ui/admin-icons.ts`) y su uso en `MonthDetailView.tsx` no son datos ni contrato; se dejan. Renombrarlo es cosmético y queda para T078 si el owner lo quiere.
5. `updateAdminMonthSlotMode` y el enum de preset siguen llamándose "SlotMode" porque el endpoint `PATCH slot-mode` conserva ruta y nombre (RQ-1).

## Comandos ejecutados y resultados

Entorno: `npx vitest`, `npx tsc`, `npx eslint`, `npx prisma`. Integración con `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/de56eec6-6707-4ada-9fd5-423ddadab785/scratchpad/with-test-db.sh` (fuerza `DATABASE_URL=mysql://root:root@127.0.0.1:3306/appointments_test`, aborta si el nombre de base no es `appointments_test`, exporta `ENABLE_INTEGRATION_DB=1`). Las credenciales son las del patrón de `.env.example`; no se leyó `.env`. Confirmación pendiente del owner (ver abajo).

| Comando | Línea base | Resultado final |
|---|---|---|
| `npx vitest run` (npm test) | 818 pruebas, 21 fallos en 11 archivos | 807 pruebas, 21 fallos en 11 archivos. Los nombres de fallo son idénticos a la línea base (comparado con `diff`). Las 11 pruebas menos son las eliminadas. |
| `npx tsc --noEmit -p tsconfig.json` | 32 errores, todos en `tests/` | 32 errores, mismo conjunto (`diff` vacío), 0 fuera de `tests/` |
| `wrapper vitest run --maxWorkers=1 tests/integration` | 63 pruebas, 5 fallos (cancel-appointment x3, reservation-lock x2) | 63 pruebas, 5 fallos, mismos nombres y mismos mensajes |
| `npx eslint` sobre `lib/`, `app/`, `components/`, `hooks/` tocados | - | Sin errores (exit 0) |
| `prisma generate` | - | OK |
| `prisma migrate status` (appointments_test) | 0022 aplicada | 0023 pendiente (esperado) |
| `prisma migrate deploy` (appointments_test) | - | 0023 aplicada |
| `prisma migrate diff --from-url appointments_test --to-schema-datamodel` | - | Solo diferencias preexistentes en `admin_users`, `appointments`, `blocked_slots`, `clients`, `reservation_locks` (precisión DATETIME y defaults). Ninguna en `active_months`. |
| Consulta de solo lectura a appointments_test | - | `active_months` sin `slot_mode`; `availability_migration_runs` con 1 fila (conservada) |
| `grep` de `slotMode`/`slot_mode`/`MonthSlotMode`/`month-slot-mode` en `lib`, `app`, `components`, `hooks`, `scripts`, `locales`, `prisma/schema.prisma` | - | Solo el nombre del endpoint y la función `updateAdminMonthSlotMode`, la entrada `slotMode` del preset (RQ-1), y el icono `slotModeSettings`. Ninguna respuesta lo contiene. `scripts/*` (incl. `reconcile-active-months.mjs`) no referencian la columna. |

Ejecutado en este entorno: todos los comandos anteriores. Verificado por diseño (lectura, no ejecutado): el motor de reservas no lee `slotMode` (grep en el árbol actual). Verificado solo por diseño: el ejemplo de `docs/architecture/api.md`.

## Referencias para T078 (no tocadas salvo `api.md`)

`docs/specification.md`: L119, L526, L605, L610, L614 (slot_mode legado y backfill); L1221, L1230 (creación con `slot_mode=BLOCK_MODE`); L1319-1320 (PATCH: `slotMode` como preset de entrada, correcto, se revisa); L1493 (detalle del mes con `slotMode` en la respuesta); L1503 (respuesta PATCH `{ month, slotMode }`).
`docs/architecture/data-model.md`: L24, L123-L182 (derivación, backfill, default y estado legado), L209, L258-L305 (rollback y bitácora); L304-305 (0022 y 0023 "pendiente de autorización"). Completar la bitácora con 0023.
`docs/architecture/business-rules.md`: L491, L756.
`docs/features/admin-months-catalog-flow.md`: L61, L83.
`docs/features/admin-month-detail-flow.md`: L32 (botón con texto "Modalidad", revisar).
`docs/decisions/0004-derivacion-de-slot-mode.md` (L1, L10, L14, L21, L26, L28) y `docs/decisions/README.md` L12: cerrar ADR (derivación superada por retirada).
`docs/ui/admin/components.md`: L906 (revisar si queda "Modalidad").
`docs/plans/2026-04-10-second-only-mode-availability-rules.md`: histórico, no cambiar salvo que T078 lo pida.

## Orden de despliegue y rollback (riesgo alto, irreversible en producción)

Orden obligatorio, en cada entorno:
1. Confirmar Gate 4 y que 0022 está aplicada (0023 no puede ejecutarse antes que 0022; el release combinado de fases 1 y 2 va primero).
2. Tomar backup antes de 0023: dump completo o `CREATE TABLE active_months_slot_mode_backup_0023 AS SELECT id, slot_mode FROM active_months;`. Esto es recomendación, no decisión tomada.
3. Parar todas las instancias de la versión anterior a 4B. El código anterior falla al leer `active_months` tras 0023 (reservas incluidas). No hay ventana de convivencia: migrar solo cuando no haya procesos de la versión anterior.
4. `prisma migrate deploy` (aplica 0023).
5. Desplegar el código 4B de inmediato y verificar `GET .../months/[month]`, `PATCH .../slot-mode` y una reserva pública.

Rollback: no es automático. Revertir el código a `fed5d46` no basta: ese código requiere la columna. Pasos: `ALTER TABLE active_months ADD COLUMN slot_mode ENUM('BLOCK_MODE','SECOND_ONLY_MODE') NOT NULL DEFAULT 'BLOCK_MODE' AFTER status;` y restaurar valores desde el backup (`UPDATE active_months a JOIN <backup> b ON b.id=a.id SET a.slot_mode=b.slot_mode;`). Sin backup, los valores se pierden y el código anterior mostraría `BLOCK_MODE` a todos los meses (la etiqueta del admin; el motor de reservas de HEAD no lee la columna). Las reglas editadas con el código 4B no alteran la columna, así que el valor restaurado puede quedar desfasado respecto a las reglas.

## Pendiente del owner

- Gate 4 (`tasks.md` línea 171 indica "requiere Gate 4"; no lo verifiqué).
- Confirmar la fuente de credenciales del wrapper de integración (`root:root` en `127.0.0.1:3306` según el patrón de `.env.example`; no se leyó `.env`).
- Decidir sobre la prueba de backfill (decisión 3) y sobre el backup/rollback propuesto.
- Verificar procesos previos antes del despliegue (T069) y el criterio de salida "migración 0023 aplicada en staging": no hay staging accesible desde este entorno.
- Aceptación manual en UI del admin (editor de meses, lista de meses) y prueba E2E: no ejecutadas.

## Limitaciones

- No ejecuté `next build`, Playwright E2E ni `npx eslint` sobre los archivos de tests (la configuración no los cubre en la ronda; no verificado).
- Staging y producción no se tocaron. `appointments` (copia local de producción) no se migró.
- Las pruebas de integración se ejecutaron en serie con `--maxWorkers=1`.
- El entorno de MySQL se usó en `127.0.0.1:3306` con `appointments_test`; el orden de migraciones 0022-0023 se verificó solo en esa base.
- Quedan referencias en `docs/` (lista arriba) hasta T078; `docs/specification.md` no está alineada con las respuestas.

## Handoff

- Hecho: T070 a T074 verificadas; T069 archivo creado y aplicado en appointments_test.
- Pendiente: ver "Pendiente del owner" y T078.
- Archivos tocados: lista arriba. No hay commit.
- Siguiente paso: revisión (Reviewer de alto riesgo por Prisma y migración, según `{{high_risk_areas}}`), luego decisión de Gate 4 y del backup.
- Turnos: se usaron cerca de 70 de 80; no se alcanzó el límite.
