# Research: Public My Appointments

## Decisions

### Decision 1: Replace the standalone public cancellation route with a unified management route

Decision: `/my-appointments` becomes the canonical public entry point for consultation, cancellation, and modification of existing appointments. `/citas/cancelar` becomes a redirect-only compatibility route.

Rationale: The requested product change is not a small extension to cancellation. It is a flow replacement that groups all self-service appointment management in one place.

Alternatives considered:
- Keep `/citas/cancelar` as the canonical route and add reschedule inside it. Rejected because the requested product language and scope define a broader “my appointments” area.
- Keep two separate public routes. Rejected because it preserves an avoidable split in the public self-service experience.

### Decision 2: Source appointment lookup ignores `active_months`

Decision: Lookup by phone in `/my-appointments` searches future appointments regardless of whether they are still actionable, and marks which ones are blocked by the time-window rules.

Rationale: The client must be able to see her future appointments even when the web window for changing them has already closed, so the UI can explain why no further action is possible.

### Decision 3: Reschedule preserves the same appointment record

Decision: Public reschedule updates the existing `appointments` row in place and preserves `appointments.id`.

Rationale: The user explicitly requested this behavior. It preserves continuity for auditability, admin references, and calendar synchronization semantics.

### Decision 4: Public reschedule uses booking availability but not booking suggestion logic

Decision: The destination date/time picker for `/my-appointments` reuses the booking-style availability model and slot rules, but must not apply `isLoyal` logic or the 15-day suggestion branch.

Rationale: The client still needs the same month/day/slot availability rules, but the feature explicitly excludes the booking heuristics that depend on loyalty and near-date future appointments.

### Decision 5: Cancellation and modification use separate time windows

Decision:

- cancel eligibility remains `>= 24 hours`
- modify eligibility becomes `>= 3 hours`

Rationale: This came directly from the intake interview and creates a valid state where an appointment may still be modifiable after it is no longer cancelable.

### Decision 6: Audit logs need schedule snapshots for `MODIFIED`

Decision: Add `MODIFIED` as a first-class appointment log action and require historical schedule evidence for both previous and new date/time.

Rationale: The current log model reads appointment date/time from the live appointment row. Once reschedule is allowed on the same appointment record, older events would become misleading unless schedule snapshots are captured at log-write time.

Alternatives considered:
- Keep logs join-based only. Rejected because all past log rows for a rescheduled appointment would show the latest schedule instead of the schedule relevant to each event.
- Create a second “reschedule history” table. Rejected for v1 because it fragments the audit trail instead of extending the existing appointment log contract.

### Decision 7: `PENDING` can be modified but not synced

Decision: `PENDING` appointments are modifiable if they are at least 3 hours away, but they do not create or update Google Calendar events during public reschedule.

Rationale: The requested behavior keeps pending appointments outside confirmed calendar sync while still allowing the client to move the requested slot.

## Open Implementation Notes

- The exact API shape should stay capability-oriented under `app/api/my-appointments/`.
- Existing cancellation tests and UI assumptions around `/citas/cancelar` will need to move or be rewritten for `/my-appointments`.
- If schedule snapshot fields are introduced to `appointment_logs`, existing admin log queries and PDFs should evolve without breaking existing filters or pagination semantics.
