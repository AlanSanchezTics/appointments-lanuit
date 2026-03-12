DROP INDEX `appointments_date_time_slot_key` ON `appointments`;

CREATE INDEX `appointments_date_time_slot_idx` ON `appointments` (`date`, `time_slot`);
