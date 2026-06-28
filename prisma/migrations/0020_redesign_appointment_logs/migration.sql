DROP TABLE IF EXISTS `appointment_logs`;

CREATE TABLE `appointment_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `appointment_id` INT NOT NULL,
  `action_type` ENUM('PENDING','CONFIRMED','CANCELLED','REJECTED') NOT NULL,
  `actor_type` ENUM('SYSTEM','ADMIN','CLIENT') NOT NULL,
  `client_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `appointment_logs_created_at_idx`(`created_at`),
  INDEX `appointment_logs_action_type_created_at_idx`(`action_type`, `created_at`),
  INDEX `appointment_logs_actor_type_idx`(`actor_type`),
  INDEX `appointment_logs_client_id_idx`(`client_id`),
  INDEX `appointment_logs_appointment_id_idx`(`appointment_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `appointment_logs_appointment_id_fkey`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `appointment_logs_client_id_fkey`
    FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
