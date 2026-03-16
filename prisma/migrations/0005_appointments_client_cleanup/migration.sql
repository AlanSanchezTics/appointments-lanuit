ALTER TABLE `appointments`
  MODIFY COLUMN `client_id` INT NOT NULL;

DROP INDEX `appointments_phone_status_idx` ON `appointments`;

ALTER TABLE `appointments`
  DROP COLUMN `name`,
  DROP COLUMN `phone`;
