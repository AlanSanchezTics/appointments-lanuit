-- Spec 003, fase 4 (T069). Retira la columna legada active_months.slot_mode.
-- Desde la ronda 4B ningún código lee ni escribe la columna (T070-T072): las reglas viven en availability_rules.
-- Irreversible sin backup: revertir exige recrear slot_mode ENUM('BLOCK_MODE', 'SECOND_ONLY_MODE') NOT NULL DEFAULT 'BLOCK_MODE' y repoblarla desde el backup.
-- availability_migration_runs se conserva (el owner no ha decidido retirarla).

ALTER TABLE `active_months`
  DROP COLUMN `slot_mode`;
