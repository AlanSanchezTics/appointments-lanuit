# Ronda 31 — corrección B-1 (+ N-2, N-3, N-4, N-7) — Developer

Informe consolidado por el Orquestador (el Developer no pudo escribir el archivo). Sin commit.

## Cambios
- `docs/architecture/data-model.md`, sección «Migración 0023», lista «Orden en cada entorno»: respaldo OBLIGATORIO (decisión del owner 2026-11-01) con verificación (conteo igual a `active_months` + restauración de prueba en base desechable); precondiciones (a) `availability_migration_runs` con `backfill-availability-rules-v1` = 1 fila, (b) consulta de cobertura de reglas, (c) `_prisma_migrations` con `0022_availability_rules` `finished_at` no nulo y `rolled_back_at` nulo; `npm run months:reconcile` en los procesos a parar (N-7); nota de fallo por `DROP COLUMN` sin `IF EXISTS` y recuperación con `prisma migrate resolve` (N-4).
- Orden final decidido por el owner tras la ronda: 1 confirmar 0022 → 2 parar instancias y procesos → 3 respaldo (tras la parada, sin desfase) → 4 precondiciones → 5 `migrate deploy` → 6 desplegar 4B y verificar. (Aplicado por el Orquestador sobre el texto del Developer.)
- `specs/003-flexible-month-availability/tasks.md` T069: respaldo y precondiciones reflejados; sigue `[ ]`.
- `docs/runbooks/admin-month-detail-rollout.md` (N-2): prerrequisito de migraciones y remisión a la lista de orden de data-model.md.
- `tests/lib/admin/months.detail-service.test.ts` (N-3): `expect(result).not.toHaveProperty("slotMode")`.

## Verificación
- Orquestador re-ejecutó `npx vitest run tests/lib/admin/months.detail-service.test.ts`: 13/13. `rg "recomendación, no una decisión" docs`: sin resultados. Relectura de la sección.
- Estático, no ejecutado en ninguna base: consultas (a), (b), (c), `SHOW COLUMNS` y el `CREATE TABLE ... AS SELECT`; las columnas `migration_name`, `finished_at`, `rolled_back_at` de `_prisma_migrations` son el diseño estándar de Prisma, no confirmadas contra una base real.
- No probado: que la aserción N-3 falle si se reintroduce `slotMode`; el rollback SQL (N-5).

## Decisiones del owner en esta ronda
- Orden "parar todo, migrar, desplegar" se mantiene (N-1); respaldo tras parar; wrapper `root:root` aceptado (N-11, solo apunta a `appointments_test`); B-1 se cierra por verificación del Orquestador, sin `reviewer-docs`.
