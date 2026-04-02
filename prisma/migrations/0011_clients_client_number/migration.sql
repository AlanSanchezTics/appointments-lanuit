ALTER TABLE `clients`
  ADD COLUMN `client_number` INT NULL AFTER `id`;

SET @client_number_seq := 0;

UPDATE `clients`
SET `client_number` = (@client_number_seq := @client_number_seq + 1)
ORDER BY `created_at` ASC, `id` ASC;

ALTER TABLE `clients`
  MODIFY COLUMN `client_number` INT NOT NULL;

CREATE UNIQUE INDEX `clients_client_number_key` ON `clients`(`client_number`);
