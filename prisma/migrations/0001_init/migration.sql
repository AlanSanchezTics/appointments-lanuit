CREATE TABLE `appointments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(10) NOT NULL,
  `date` DATE NOT NULL,
  `time_slot` TIME NOT NULL,
  `status` ENUM('CONFIRMED', 'CANCELLED', 'SYNC_FAILED') NOT NULL DEFAULT 'CONFIRMED',
  `google_event_id` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `appointments_date_time_slot_key` (`date`, `time_slot`),
  KEY `appointments_phone_status_idx` (`phone`, `status`),
  KEY `appointments_date_idx` (`date`)
);
