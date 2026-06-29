# Quickstart: Public My Appointments

## Demo Preconditions

- At least one future appointment exists for a known phone number.
- Test data covers `PENDING`, `CONFIRMED`, and `SYNC_FAILED`.
- At least one source appointment is in a future month that is not currently `ACTIVE`.
- At least one appointment is between 3 and 24 hours away to validate modify-only behavior.

## Validation Flow

1. Open `/`.
2. Confirm the secondary CTA points to `/my-appointments`.
3. Open `/citas/cancelar` and confirm it redirects to `/my-appointments`.
4. In `/my-appointments`, submit an invalid phone and confirm the UI stays in lookup with validation feedback.
5. Submit a phone with no manageable appointments and confirm the API/UI return the stable empty/not-found behavior.
6. Submit a phone with multiple future manageable appointments.
7. Confirm the list includes future appointments from months that are not `ACTIVE`.
8. Confirm appointments outside the public time windows appear blocked with a warning that no more changes or cancellations are allowed through the web flow.
9. Select a `PENDING` appointment more than 3 hours away from the results list.
10. Confirm `Modificar cita` is available and `Cancelar cita` is unavailable.
11. Complete the modify flow and confirm the same appointment id is preserved while `date` and `timeSlot` change.
12. Confirm the reschedule success step attempts WhatsApp auto-redirect with the standard appointment-management message and keeps a visible manual fallback CTA.
13. Select a `CONFIRMED` appointment more than 24 hours away.
14. Cancel it and confirm the success state, WhatsApp auto-redirect attempt, manual fallback CTA, and returned availability.
15. Select a `CONFIRMED` appointment between 3 and 24 hours away.
16. Confirm modify is allowed and cancel is not.
17. Reschedule a `SYNC_FAILED` appointment and simulate calendar sync failure.
18. Confirm the appointment remains locally updated and ends in `SYNC_FAILED`.
19. Open admin appointment logs and confirm a `Cita modificada` row exists with actor `Cliente` and readable previous/new schedule evidence.

## Documentation Verification

- `docs/specification.md` reflects `/my-appointments` as the canonical public management route.
- `docs/architecture/business-rules.md` reflects lookup, cancel, modify, and audit rules.
- `docs/architecture/api.md` reflects the `/api/my-appointments/*` namespace and `MODIFIED` log filtering.
- `docs/features/my-appointments-flow.md` documents the end-to-end public flow.
- `docs/features/cancel-flow.md` documents the cancellation branch under `/my-appointments`.
- `docs/features/admin-appointment-logs-flow.md` documents `MODIFIED` and schedule snapshots.
