ALTER TABLE `blocked_slots`
  ADD COLUMN `google_event_id` VARCHAR(255) NULL,
  ADD COLUMN `calendar_sync_status` ENUM('CONFIRMED', 'SYNC_FAILED') NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN `calendar_sync_reason` ENUM('CALENDAR_NOT_CONFIGURED', 'CALENDAR_SYNC_FAILED', 'CALENDAR_DELETE_FAILED') NULL;

CREATE INDEX `blocked_slots_calendar_sync_status_idx` ON `blocked_slots`(`calendar_sync_status`);
