CREATE TABLE `appointment_reminders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `appointment_id` INT NOT NULL,
  `reminder_type` ENUM('NEXT_DAY', 'NEXT_WEEK') NOT NULL,
  `target_phone` VARCHAR(10) NOT NULL,
  `message` TEXT NOT NULL,
  `sent_by_admin_user_id` INT NULL,
  `opened_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `appointment_reminders_appointment_id_reminder_type_key`(`appointment_id`, `reminder_type`),
  INDEX `appointment_reminders_sent_by_admin_user_id_idx`(`sent_by_admin_user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `appointment_reminders_appointment_id_fkey`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointment_reminders_sent_by_admin_user_id_fkey`
    FOREIGN KEY (`sent_by_admin_user_id`) REFERENCES `admin_users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
