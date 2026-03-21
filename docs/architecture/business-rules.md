# Business Rules

## Purpose

Define the business rules that govern the appointment domain for the manicure booking system, using `docs/specification.md` as the normative source.

This document captures domain behavior, constraints, states, and decision rules without implementation-level details.

## Domain Overview

The system manages appointments for a single professional.

The core domain objective is to allow customers to book and cancel appointments under strict availability, time, and identity constraints, while preserving schedule consistency and avoiding conflicts.

Business behavior is defined by:

- Appointment scheduling windows based on active months.
- A fixed weekday/time-slot model.
- Booking and cancellation eligibility rules.
- One-active-appointment policy per customer phone number.
- Temporary slot holding during booking confirmation.
- A single source of truth for appointment state.
- All time-based rules are evaluated using a fixed business timezone (`America/Mexico_City`).

## Core Entities

- Professional
  - Single service provider whose schedule is managed by the system.

- Customer
  - Identified by phone number.
  - Has one canonical name associated with that phone.

- Appointment
  - Represents a scheduled service at a date and time slot.
  - Uses domain states (`CONFIRMED`, `CANCELLED`, `SYNC_FAILED`).

- Reservation Lock
  - Temporary hold used during booking confirmation to prevent concurrent slot capture.
  - Locks expire automatically after a fixed time window and stop blocking availability once expired.

- Active Month
  - Calendar month that is explicitly enabled for booking and cancellation flows.

## Core Concepts

- Active scheduling window
  - Appointments are only allowed in months marked as active.
  - Past months are never valid for new bookings.
  - The system operates within a limited forward-looking window of active months.

- Operating calendar
  - Service is offered only Monday through Friday.
  - Same-day booking is allowed only for future time slots relative to local business time.

- Slot pair model
  - Time slots are grouped in directional pairs:
    - (09:00, 10:00)
    - (13:00, 14:00)
    - (17:00, 18:00)

- Daily capacity model
  - A day can have at most three active appointments.
  - A pair can contain at most one active appointment.

- Active appointment definition
  - States considered active for occupancy/conflict decisions: `CONFIRMED`, `SYNC_FAILED`.

- Temporary reservation lock
  - A slot can be temporarily held during booking confirmation.
  - While active, a lock blocks availability for that slot.
  - Locks expire automatically and stop affecting availability once expired.

- Mirror integration principle
  - External calendar synchronization mirrors domain state but does not define source-of-truth booking validity.

## Booking Rules

- A booking request is valid only when all of the following hold:
  - Target month is active.
  - Target date is a weekday.
  - Target slot is one of the official base slots.
  - For same-day booking, target slot is still in the future.
  - Slot is not occupied by an active appointment.
  - Slot is not blocked by a valid temporary lock.
  - Slot satisfies pair-direction constraints induced by all active appointments on that day.
  - Daily active appointment limit has not been reached.

- Customer identity rules during booking:
  - Phone is normalized to exactly 10 digits.
  - Name must be at least 3 characters.
  - Customer is resolved by phone.
  - A phone cannot map to multiple names.

- Active appointment exclusivity per phone:
  - A phone can hold at most one active future appointment.
  - Customer must cancel their active future appointment before creating another.

- Booking confirmation rules:
  - Confirmation requires a valid, unexpired lock tied to the selected slot/date/phone.
  - If lock expires or becomes invalid, confirmation is rejected and slot must be reselected.

## Cancellation Rules

- A cancellation request is allowed only when the appointment is:
  - In `CONFIRMED` state.
  - In the future (not past date).
  - Inside an active month.
  - At least 24 hours away from the current local time.

- Cancellation effects:
  - Appointment state changes to `CANCELLED`.
  - Released slot becomes available again under normal availability rules.

- Not allowed:
  - Cancelling past appointments.
  - Cancelling appointments with less than 24 hours remaining via the web cancellation flow.

## Availability Rules

- Valid base time slots are fixed:
  - 09:00
  - 10:00
  - 13:00
  - 14:00
  - 17:00
  - 18:00

- Visible/eligible availability must exclude:
  - Past-time slots for same-day booking.
  - Slots occupied by active appointments.
  - Slots blocked by active temporary locks.
  - Slots invalidated by pair-direction constraints.

- Pair-direction rule:
  - If a booking exists on the first slot of pair `i`, the second slot of every earlier pair is blocked.
  - If a booking exists on the second slot of pair `i`, the first slot of every later pair is blocked.
  - A candidate slot must satisfy all directional restrictions produced by all active appointments on that day.

- Day visibility rule:
  - If all slots for a day are unavailable, that day is treated as unavailable.

## State Transitions

- Appointment state model:
  - `CONFIRMED`: valid active appointment.
  - `CANCELLED`: appointment canceled; does not consume availability.
  - `SYNC_FAILED`: appointment remains active for domain conflicts even when external sync failed.

- Allowed business transitions:
  - New booking creates a `CONFIRMED` appointment.
  - Confirmed appointment can transition to `CANCELLED` when cancellation rules are met.
  - External sync failure may result in `SYNC_FAILED` while still preserving active occupancy behavior.

- Historical behavior:
  - Rebooking a previously canceled slot creates a new appointment record (cancellations are historical, not overwritten).

## Validation Rules

- Month/date validation:
  - Month must be active.
  - Past months are rejected.
  - Day must be Monday to Friday.

- Time validation:
  - Slot must be one of the official base slots.
  - Same-day slot must still be in the future.

- Phone/name validation:
  - Phone input can include separators at capture time, but business identity is a normalized 10-digit phone.
  - Name minimum length is 3.
  - One phone corresponds to one canonical customer name.

- Booking precondition validation:
  - Slot availability.
  - Daily and pair constraints.
  - Valid temporary lock at confirmation step.
  - No existing active future appointment for the same phone.

- Cancellation precondition validation:
  - `CONFIRMED` status.
  - Future appointment.
  - Minimum 24-hour anticipation.
  - Month remains active.

## Invariants

- The appointment domain source of truth is internal system state.
- External calendar acts as mirror, not authority.
- No overlapping active occupancy per slot.
- Pair-direction constraints and daily max capacity are always enforced.
- A phone can have at most one active future appointment.
- Booking and cancellation are only valid within active months.
- Same-day booking is only valid for future slots in local business time.
- Cancellation releases availability.
- Temporary reservation locks stop blocking once expired.

## Edge Cases

- Requesting bookings in past or inactive months must be rejected.
- Two users trying to secure the same slot at nearly the same time can result in only one successful booking.
- A lock can expire while the user is confirming; confirmation must fail and force reselection.
- Same-day booking near slot time cutoff may become invalid between selection and confirmation.
- A day can become unavailable either by reaching max active appointments or by directional constraints + locks.
- Cancellation and new booking attempts on the same slot/time window must resolve without violating occupancy invariants.
- If external calendar sync fails, appointment remains active in domain conflict logic (`SYNC_FAILED`).
- If month activation is temporarily stale at month boundary, month eligibility rules must still treat past months as invalid and active-window policy as authoritative once reconciled.
