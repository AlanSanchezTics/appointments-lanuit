CREATE TABLE `reservation_locks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `time_slot` TIME NOT NULL,
  `phone` VARCHAR(10) NOT NULL,
  `lock_token` VARCHAR(191) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reservation_locks_lock_token_key` (`lock_token`),
  KEY `reservation_locks_date_time_slot_expires_at_idx` (`date`, `time_slot`, `expires_at`),
  KEY `reservation_locks_phone_expires_at_idx` (`phone`, `expires_at`)
);
