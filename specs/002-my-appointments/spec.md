# Feature Specification: Public My Appointments

**Feature Branch**: `002-my-appointments`

**Created**: 2026-06-28

**Status**: Implemented

**Input**: User description: "Reemplazar `/citas/cancelar` por `/my-appointments`, para que la clienta pueda consultar, cancelar o modificar sus citas futuras desde un solo flujo público."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consult future appointments (Priority: P1)

As a client, I can enter `/my-appointments`, submit my phone number, and view my future appointments, including the ones that are already blocked by time-window rules, so I can understand what I can still manage and what is no longer changeable without contacting support.

**Why this priority**: This is the new entry point and the foundation for both cancellation and reschedule. Without lookup and visible actionability state, the feature does not exist.

**Independent Test**: Seed future appointments for the same phone across statuses and months. Verify the public lookup returns future appointments regardless of `active_months` status, that actionable appointments expose the correct actions, and that expired ones appear blocked with the correct warning.

**Acceptance Scenarios**:

1. **Given** a client with future appointments in `PENDING`, `CONFIRMED`, and `SYNC_FAILED`, **When** the client searches by phone in `/my-appointments`, **Then** the system lists those future appointments and shows which ones can still be cancelled or modified.
2. **Given** a client with future appointments that no longer allow cancel or modify by time window, **When** the client searches by phone, **Then** the UI shows those appointments blocked with a warning that no more changes or cancellations are allowed through the web flow.
3. **Given** a future appointment in a month that is no longer `ACTIVE`, **When** the client searches by phone, **Then** the appointment can still appear in the list.

---

### User Story 2 - Cancel an eligible appointment from my appointments (Priority: P2)

As a client, I can cancel an eligible future appointment from `/my-appointments` so I no longer need a separate cancellation-only route.

**Why this priority**: Replacing `/citas/cancelar` requires preserving the existing cancellation capability within the new unified flow.

**Independent Test**: Lookup an eligible `CONFIRMED` or `SYNC_FAILED` appointment at least 24 hours in the future, execute cancellation from `/my-appointments`, and verify the appointment becomes `CANCELLED`, the slot becomes available again, and the UI reaches success state.

**Acceptance Scenarios**:

1. **Given** a `CONFIRMED` future appointment at least 24 hours away, **When** the client selects it and confirms `Cancelar cita`, **Then** the system changes the state to `CANCELLED` and the appointment stops blocking availability.
2. **Given** a `SYNC_FAILED` future appointment at least 24 hours away, **When** the client cancels it, **Then** the cancellation succeeds even if there is no mirror event in Google Calendar.
3. **Given** a future appointment with less than 24 hours remaining, **When** the client searches in `/my-appointments`, **Then** that appointment is not offered as cancelable through the public flow.

---

### User Story 3 - Reschedule an eligible appointment from my appointments (Priority: P3)

As a client, I can modify the date and time of an eligible future appointment from `/my-appointments` using a booking-like flow so I can self-serve a new slot without support intervention.

**Why this priority**: This is the new behavior requested by the feature and the main product evolution beyond current public cancellation.

**Independent Test**: Lookup an eligible future appointment, enter the modify action, choose a new available slot through the public reschedule flow, confirm the change, and verify the same `appointments.id` is preserved while `date`, `timeSlot`, and `google_event_id` are updated according to the new sync result.

**Acceptance Scenarios**:

1. **Given** a future `CONFIRMED` appointment more than 3 hours away, **When** the client chooses `Modificar cita` and confirms a new available slot, **Then** the system keeps the same appointment record, updates `date` and `timeSlot`, re-syncs Google Calendar, and stores the new `google_event_id`.
2. **Given** a future `PENDING` appointment more than 3 hours away, **When** the client reschedules it, **Then** the system keeps the appointment in `PENDING`, updates `date` and `timeSlot`, leaves `google_event_id=null`, and does not attempt calendar sync.
3. **Given** a future `CONFIRMED` or `SYNC_FAILED` appointment more than 3 hours away, **When** the client reschedules it and Google Calendar sync fails, **Then** the appointment remains locally updated and ends in `SYNC_FAILED`.
4. **Given** an eligible appointment and a target slot that is available, **When** the client reschedules from `/my-appointments`, **Then** the system must not apply `isLoyal` logic or the public 15-day suggestion/restriction flow.

### Edge Cases

- A `PENDING` appointment can be modifiable but not cancelable; the UI must still expose the action area coherently.
- A `CONFIRMED` appointment that is between 3 and 24 hours away is modifiable but no longer cancelable.
- Lookup must ignore `active_months` for source appointments, but destination availability for reschedule still uses the bookable availability model from public booking.
- A selected appointment can lose eligibility between lookup and confirmation due to time advancing or concurrent change; the mutation must fail with a stable error code.
- When a client modifies an appointment, old audit events must remain historically readable and must not be overwritten by the appointment’s new current date/time.
- `/citas/cancelar` must stop being the primary public flow and redirect to `/my-appointments`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose `/my-appointments` as the canonical public route for consulting, cancelling, and modifying future appointments.
- **FR-002**: System MUST redirect `/citas/cancelar` to `/my-appointments` as compatibility behavior.
- **FR-003**: System MUST allow a client to search `/my-appointments` by normalized 10-digit phone number.
- **FR-004**: Lookup MUST return future appointments for the provided phone, including appointments that are no longer actionable because of time-window rules.
- **FR-005**: Lookup eligibility MUST ignore the `active_months` status of the appointment’s current month.
- **FR-006**: Lookup MUST include future appointments in `PENDING`, `CONFIRMED`, and `SYNC_FAILED`.
- **FR-007**: `/my-appointments` MUST allow read-only consultation of the selected appointment data before action, whether through the selected row itself or the active success/reschedule summary.
- **FR-008**: The action area MUST expose `Cancelar cita` and `Modificar cita`; actions that do not apply to the selected appointment MUST be visibly unavailable without misrepresenting eligibility.
- **FR-008a**: When no public action is available for a future appointment, the UI MUST render the appointment as blocked and show a warning that changes or cancellations are no longer available because of the time window.
- **FR-009**: Public cancellation from `/my-appointments` MUST remain allowed only for appointments in `CONFIRMED` or `SYNC_FAILED`, in the future, and at least 24 hours away.
- **FR-010**: Public cancellation from `/my-appointments` MUST no longer require the appointment month to be `ACTIVE`.
- **FR-011**: Public reschedule from `/my-appointments` MUST be allowed for appointments in `PENDING`, `CONFIRMED`, or `SYNC_FAILED`, in the future, and at least 3 hours away.
- **FR-012**: Public reschedule MUST preserve the same `appointments.id` and update only the managed appointment record rather than cancel-and-recreate.
- **FR-013**: Public reschedule MUST update `date` and `timeSlot` to the new selected slot.
- **FR-014**: When rescheduling a `CONFIRMED` or `SYNC_FAILED` appointment, the system MUST attempt to move the Google Calendar mirror and persist the resulting `google_event_id`; if sync fails, the appointment MUST end in `SYNC_FAILED`.
- **FR-015**: When rescheduling a `PENDING` appointment, the system MUST keep `google_event_id = null` and MUST NOT attempt calendar sync.
- **FR-016**: The destination slot for public reschedule MUST satisfy the same slot availability rules used by public booking.
- **FR-017**: Public reschedule from `/my-appointments` MUST NOT apply `isLoyal` logic or the public 15-calendar-day suggestion flow used by `/booking`.
- **FR-018**: The public reschedule UI MUST reuse the booking-like date/time selection experience as a separate flow branch inside `/my-appointments`.
- **FR-019**: The home entry view (`/`) MUST update its secondary CTA to point to `/my-appointments`.
- **FR-020**: The booking success copy and deep link contract MUST point clients to `/my-appointments` as the place to review, modify, or cancel existing appointments.
- **FR-020a**: Successful public cancellation from `/my-appointments` MUST preserve the existing WhatsApp cancellation behavior: automatic redirect attempt on success plus visible manual fallback CTA.
- **FR-020b**: Successful public reschedule from `/my-appointments` MUST perform an automatic WhatsApp redirect attempt plus visible manual fallback CTA using `whatsapp.messageTemplate`.
- **FR-021**: The system MUST record an appointment audit event `MODIFIED` / `Cita modificada` whenever a client successfully reschedules from `/my-appointments`.
- **FR-022**: The `MODIFIED` audit event MUST capture enough schedule snapshot data to show previous and new date/time without relying only on the appointment’s current state.
- **FR-023**: Existing appointment log retrieval and filtering contracts MUST evolve to include `MODIFIED`.
- **FR-024**: The feature MUST not preserve any legacy public API endpoint contract solely for `/citas/cancelar`; the new public management capability owns the route/API surface going forward.

### Key Entities *(include if feature involves data)*

- **Managed Appointment**: A future appointment found from `/my-appointments`. Key dimensions: current status, current schedule, cancel eligibility, modify eligibility, and blocked state when no public action remains.
- **Public Appointment Management Session**: Frontend flow state that starts with phone lookup and branches into consultation, cancellation, or reschedule.
- **Appointment Log Event (Modified)**: Append-only audit record for a successful client reschedule, including actor category and schedule snapshots for before/after.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A client can complete phone lookup in `/my-appointments` and see future appointments together with their current actionability state, including blocked-by-time-window appointments.
- **SC-002**: `/citas/cancelar` no longer acts as the primary public cancellation UI and redirects to `/my-appointments`.
- **SC-003**: A `CONFIRMED` or `SYNC_FAILED` appointment that is at least 24 hours away can be cancelled end-to-end from `/my-appointments`.
- **SC-004**: A `PENDING`, `CONFIRMED`, or `SYNC_FAILED` appointment that is at least 3 hours away can be rescheduled end-to-end from `/my-appointments` without creating a new appointment record.
- **SC-005**: The reschedule flow does not trigger `isLoyal` behavior or the public 15-day suggestion branch.
- **SC-006**: Every successful client reschedule creates exactly one `Cita modificada` audit event with actor `Cliente` and readable schedule history.

## Assumptions

- The destination schedule picker for public reschedule uses the same month/day/slot availability model as public booking.
- The public management route remains outside the admin UI system and must not use `components/admin/ui/`.
- The public flow can show both action buttons while disabling or explaining unavailable actions for some statuses such as `PENDING`.
- Successful cancellation keeps the legacy WhatsApp cancellation pattern inside the new route.
- Successful reschedule uses the standard public appointment-management WhatsApp message (`whatsapp.messageTemplate`) with auto-redirect plus visible fallback CTA.

## Documentation Impact *(mandatory for this repo)*

- `docs/specification.md` requires updates because the public flow, route contract, validations, API/UI surface, persistence expectations, and audit side effects change.
- `docs/architecture/business-rules.md` requires updates to define unified public appointment management rules, the 3-hour reschedule window, lookup independence from `active_months`, and the `MODIFIED` audit event.
- `docs/architecture/api.md` requires updates for the new `/api/my-appointments/*` capability namespace and the expanded admin appointment logs filter contract.
- `docs/features/cancel-flow.md` requires updates because cancellation becomes a branch of `/my-appointments` instead of a standalone canonical route.
- A new `docs/features/my-appointments-flow.md` is required to document the combined consult/cancel/modify public flow.
- `docs/features/admin-appointment-logs-flow.md` requires updates because the audit model now includes `MODIFIED` and schedule snapshots.
