ALTER TABLE `appointment_logs`
  ADD COLUMN `payload` JSON NULL AFTER `action_type`;

ALTER TABLE `appointment_logs`
  MODIFY `action_type` ENUM('PENDING','CONFIRMED','CANCELLED','REJECTED','MODIFIED') NOT NULL;

UPDATE `appointment_logs` al
INNER JOIN `appointments` a
  ON a.id = al.appointment_id
SET al.payload = JSON_OBJECT(
  'appointment',
  JSON_OBJECT(
    'date',
    DATE_FORMAT(a.date, '%Y-%m-%d'),
    'timeSlot',
    DATE_FORMAT(a.time_slot, '%H:%i')
  )
)
WHERE al.payload IS NULL;

ALTER TABLE `appointment_logs`
  MODIFY `payload` JSON NOT NULL;
