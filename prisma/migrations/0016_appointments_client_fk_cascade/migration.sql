ALTER TABLE `appointments`
  DROP FOREIGN KEY `appointments_client_id_fkey`;

ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_client_id_fkey`
    FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
