CREATE TABLE `clients` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(10) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clients_phone_key` (`phone`)
);

ALTER TABLE `appointments`
  ADD COLUMN `client_id` INT NULL AFTER `id`,
  ADD KEY `appointments_client_id_status_idx` (`client_id`, `status`),
  ADD CONSTRAINT `appointments_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `clients` (`name`, `phone`)
SELECT `a`.`name`, `a`.`phone`
FROM `appointments` `a`
INNER JOIN (
  SELECT `phone`, MAX(`id`) AS `latest_appointment_id`
  FROM `appointments`
  GROUP BY `phone`
) `latest`
  ON `latest`.`latest_appointment_id` = `a`.`id`;

-- Hard-stop safety check:
-- If a phone has multiple distinct names in legacy data, this insert intentionally
-- collides on UNIQUE(phone) and aborts the migration.
INSERT INTO `clients` (`name`, `phone`)
SELECT MIN(`name`) AS `name`, `phone`
FROM `appointments`
GROUP BY `phone`
HAVING COUNT(DISTINCT `name`) > 1;

UPDATE `appointments` `a`
INNER JOIN `clients` `c`
  ON `c`.`phone` = `a`.`phone`
SET `a`.`client_id` = `c`.`id`;
