-- Spec 003 (disponibilidad flexible por mes). Ver specs/003-flexible-month-availability/data-model.md.
--
-- Orden: DDL aditivo primero. MySQL hace commit implícito con cada DDL, así que la
-- transacción solo cubre el bloque de backfill (entre BACKFILL:BEGIN y BACKFILL:END).
-- Cada sentencia del backfill exige que no exista la fila 'backfill-availability-rules-v1'
-- en availability_migration_runs; esa fila se inserta al final, dentro de la misma transacción.
-- slot_mode no cambia de valor aquí: queda como legado hasta la fase 4 (FR-033).

CREATE TABLE `availability_rules` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `active_month_id` INTEGER NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `min_gap_minutes` SMALLINT NOT NULL DEFAULT 240,
  `preserve_capacity` BOOLEAN NOT NULL DEFAULT true,
  `max_per_day` TINYINT NOT NULL DEFAULT 3,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `availability_rules_active_month_id_idx`(`active_month_id`),
  CONSTRAINT `availability_rules_date_range_check` CHECK (`end_date` >= `start_date`),
  CONSTRAINT `availability_rules_min_gap_check` CHECK (`min_gap_minutes` BETWEEN 0 AND 1440),
  CONSTRAINT `availability_rules_max_per_day_check` CHECK (`max_per_day` BETWEEN 1 AND 6),
  PRIMARY KEY (`id`),
  CONSTRAINT `availability_rules_active_month_id_fkey`
    FOREIGN KEY (`active_month_id`) REFERENCES `active_months`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `availability_rule_weekdays` (
  `rule_id` INTEGER NOT NULL,
  `weekday` TINYINT NOT NULL,

  CONSTRAINT `availability_rule_weekdays_weekday_check` CHECK (`weekday` BETWEEN 1 AND 7),
  PRIMARY KEY (`rule_id`, `weekday`),
  CONSTRAINT `availability_rule_weekdays_rule_id_fkey`
    FOREIGN KEY (`rule_id`) REFERENCES `availability_rules`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `availability_rule_times` (
  `rule_id` INTEGER NOT NULL,
  `time_slot` TIME(0) NOT NULL,

  PRIMARY KEY (`rule_id`, `time_slot`),
  CONSTRAINT `availability_rule_times_rule_id_fkey`
    FOREIGN KEY (`rule_id`) REFERENCES `availability_rules`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `availability_exceptions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `active_month_id` INTEGER NOT NULL,
  `date` DATE NOT NULL,
  `min_gap_minutes` SMALLINT NOT NULL DEFAULT 240,
  `preserve_capacity` BOOLEAN NOT NULL DEFAULT true,
  `max_per_day` TINYINT NOT NULL DEFAULT 3,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `availability_exceptions_active_month_id_date_key`(`active_month_id`, `date`),
  CONSTRAINT `availability_exceptions_min_gap_check` CHECK (`min_gap_minutes` BETWEEN 0 AND 1440),
  CONSTRAINT `availability_exceptions_max_per_day_check` CHECK (`max_per_day` BETWEEN 1 AND 6),
  PRIMARY KEY (`id`),
  CONSTRAINT `availability_exceptions_active_month_id_fkey`
    FOREIGN KEY (`active_month_id`) REFERENCES `active_months`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `availability_exception_times` (
  `exception_id` INTEGER NOT NULL,
  `time_slot` TIME(0) NOT NULL,

  PRIMARY KEY (`exception_id`, `time_slot`),
  CONSTRAINT `availability_exception_times_exception_id_fkey`
    FOREIGN KEY (`exception_id`) REFERENCES `availability_exceptions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `availability_migration_runs` (
  `name` VARCHAR(100) NOT NULL,
  `applied_at` DATETIME(3) NOT NULL,
  `rows_created` INTEGER NOT NULL,

  PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `active_months`
  ADD COLUMN `availability_version` INTEGER NOT NULL DEFAULT 0 AFTER `slot_mode`,
  MODIFY COLUMN `slot_mode` ENUM('BLOCK_MODE', 'SECOND_ONLY_MODE') NOT NULL DEFAULT 'BLOCK_MODE';

-- BACKFILL:BEGIN
START TRANSACTION;

-- Una regla por mes (D4, FR-030). BLOCK_MODE: 240/true; SECOND_ONLY_MODE: 0/false. maxPerDay = 3.
INSERT INTO `availability_rules`
  (`active_month_id`, `start_date`, `end_date`, `min_gap_minutes`, `preserve_capacity`, `max_per_day`, `created_at`, `updated_at`)
SELECT
  am.`id`,
  STR_TO_DATE(CONCAT(am.`month`, '-01'), '%Y-%m-%d'),
  LAST_DAY(CONCAT(am.`month`, '-01')),
  CASE am.`slot_mode` WHEN 'BLOCK_MODE' THEN 240 ELSE 0 END,
  CASE am.`slot_mode` WHEN 'BLOCK_MODE' THEN true ELSE false END,
  3,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `active_months` am
WHERE NOT EXISTS (
  SELECT 1 FROM `availability_migration_runs` r WHERE r.`name` = 'backfill-availability-rules-v1'
);

-- Lunes a viernes (ISO 1 a 5) para cada regla creada por el backfill.
INSERT INTO `availability_rule_weekdays` (`rule_id`, `weekday`)
SELECT ar.`id`, d.`weekday`
FROM `availability_rules` ar
CROSS JOIN (
  SELECT 1 AS `weekday`
  UNION ALL SELECT 2
  UNION ALL SELECT 3
  UNION ALL SELECT 4
  UNION ALL SELECT 5
) d
WHERE NOT EXISTS (
  SELECT 1 FROM `availability_migration_runs` r WHERE r.`name` = 'backfill-availability-rules-v1'
);

-- Horas según slot_mode actual (D4, tabla de mapeo de data-model.md).
INSERT INTO `availability_rule_times` (`rule_id`, `time_slot`)
SELECT ar.`id`, t.`time_slot`
FROM `availability_rules` ar
INNER JOIN `active_months` am
  ON am.`id` = ar.`active_month_id`
INNER JOIN (
  SELECT 'BLOCK_MODE' AS `slot_mode`, '09:00:00' AS `time_slot`
  UNION ALL SELECT 'BLOCK_MODE', '10:00:00'
  UNION ALL SELECT 'BLOCK_MODE', '13:00:00'
  UNION ALL SELECT 'BLOCK_MODE', '14:00:00'
  UNION ALL SELECT 'BLOCK_MODE', '17:00:00'
  UNION ALL SELECT 'BLOCK_MODE', '18:00:00'
  UNION ALL SELECT 'SECOND_ONLY_MODE', '10:00:00'
  UNION ALL SELECT 'SECOND_ONLY_MODE', '14:00:00'
  UNION ALL SELECT 'SECOND_ONLY_MODE', '18:00:00'
) t
  ON t.`slot_mode` = am.`slot_mode`
WHERE NOT EXISTS (
  SELECT 1 FROM `availability_migration_runs` r WHERE r.`name` = 'backfill-availability-rules-v1'
);

-- Paso 5 de data-model.md: los meses con regla creada por el backfill quedan en versión 1.
UPDATE `active_months` am
SET am.`availability_version` = 1
WHERE EXISTS (
  SELECT 1 FROM `availability_rules` ar WHERE ar.`active_month_id` = am.`id`
)
AND NOT EXISTS (
  SELECT 1 FROM `availability_migration_runs` r WHERE r.`name` = 'backfill-availability-rules-v1'
);

-- Registro de idempotencia. Va al final: si existe, todas las sentencias anteriores no hacen nada.
INSERT INTO `availability_migration_runs` (`name`, `applied_at`, `rows_created`)
SELECT
  'backfill-availability-rules-v1',
  CURRENT_TIMESTAMP(3),
  (SELECT COUNT(*) FROM `availability_rules`)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `availability_migration_runs` r WHERE r.`name` = 'backfill-availability-rules-v1'
);

COMMIT;
-- BACKFILL:END
