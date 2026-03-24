CREATE TABLE `blocked_slots` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `time_slot` TIME(0) NOT NULL,
  `reason` ENUM('DESCANSO','PERSONAL','OTRO') NOT NULL,
  `created_by_admin_user_id` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `blocked_slots_date_time_slot_key`(`date`, `time_slot`),
  INDEX `blocked_slots_date_idx`(`date`),
  INDEX `blocked_slots_created_by_admin_user_id_idx`(`created_by_admin_user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `blocked_slots_created_by_admin_user_id_fkey`
    FOREIGN KEY (`created_by_admin_user_id`) REFERENCES `admin_users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
