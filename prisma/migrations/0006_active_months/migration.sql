CREATE TABLE `active_months` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `month` CHAR(7) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `active_months_month_key`(`month`),
  INDEX `active_months_status_month_idx`(`status`, `month`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
