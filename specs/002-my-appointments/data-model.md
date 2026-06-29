# Data Model: Public My Appointments

## Managed Appointment

Purpose: Future appointment returned by `/my-appointments` lookup, whether actionable or blocked by time-window rules.

Suggested read model fields:

- `appointmentId`
- `status`
- `date`
- `timeSlot`
- `name`
- `phone`
- `canCancel`
- `canModify`
- `isBlocked`
- `blockedReason?`
- `cancelEligibilityReason?`
- `modifyEligibilityReason?`

## Rescheduled Appointment

Purpose: Existing appointment record updated in place through the public modify flow.

Persistent behavior:

- preserves `appointments.id`
- updates `date`
- updates `timeSlot`
- updates `google_event_id` only when sync is applicable and succeeds
- may transition resulting status to `SYNC_FAILED` when calendar sync fails for `CONFIRMED` or `SYNC_FAILED` source appointments

## Appointment Log Event

The existing audit model must expand for public reschedule:

- Add action type `MODIFIED`
- Preserve actor category (`CLIENT`, `ADMIN`, `SYSTEM`)
- Preserve schedule evidence relevant to the event

Suggested schedule evidence fields for `appointment_logs`:

- `appointment_date_snapshot`
- `appointment_time_slot_snapshot`
- `previous_date_snapshot?`
- `previous_time_slot_snapshot?`
- `new_date_snapshot?`
- `new_time_slot_snapshot?`

Minimum integrity goal:

- A `MODIFIED` row must show both the previous and the new schedule.
- Older log rows for the same appointment must remain readable after the appointment is moved later.

## Relationships

- `Managed Appointment` resolves from `appointments` joined to `clients`.
- `Appointment Log Event` continues to reference `appointment_id` and `client_id`.
- `MODIFIED` logs are append-only and tied to the same appointment identity that was rescheduled.

## Integrity Rules

- Lookup includes future appointments even when no action remains available.
- Eligibility rules are derived, not persisted flags.
- Public cancellation applies only to `CONFIRMED|SYNC_FAILED` and `>= 24h`.
- Public modification applies only to `PENDING|CONFIRMED|SYNC_FAILED` and `>= 3h`.
- Lookup does not depend on `active_months`.
- Destination slot validity for modification still depends on the active public availability model.

## Migration Notes

- Existing `appointment_logs` rows may require snapshot backfill or nullable transition fields so legacy rows remain readable after the new audit model is introduced.
- `AppointmentLogActionType` must evolve to include `MODIFIED`.
