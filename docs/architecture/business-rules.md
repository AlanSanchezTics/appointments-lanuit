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

## Admin Access Rules

- Admin panel routes are isolated under `/admin`.
- Only authenticated admin users can access protected admin routes.
- Admin authentication is based on:
  - `next-auth` credentials provider,
  - `username + password` credentials stored in `admin_users`,
  - active account status (`status = active`),
  - signed NextAuth session with expiration.
- Admin login flow:
  - Credentials are validated against `password_hash` + `password_salt` + `ADMIN_AUTH_PEPPER`.
  - On success, the system issues a signed session cookie.
  - On failure, the system returns a stable error code (not localized UX copy).
- Admin i18n contract:
  - Admin UI text is resolved in frontend through `react-i18next`.
  - Frontend translates admin auth error codes to locale-specific messages.
  - Backend does not return final localized UX messages.
- Route protection behavior:
  - unauthenticated access to `/admin/*` (except `/admin/login`) must redirect to `/admin/login`,
  - authenticated access to `/admin/login` must redirect to `/admin/`.
- Admin logout flow:
  - clears session cookie,
  - invalidates further access to protected admin routes.

## Admin Months Catalog Rules

- Scope:
  - Applies to `/admin/months`, `/api/admin/months/catalog`, and `POST /api/admin/months`.

- Filter policy:
  - `year` must be in `[currentYear..currentYear+5]`.
  - `status` filter allows `ALL`, `ACTIVE`, `INACTIVE`.

- Metrics policy (computed per selected year):
  - `activeMonths`: count of `active_months` with `status = ACTIVE`.
  - `inactiveMonths`: count of `active_months` with `status = INACTIVE`.
  - `futureMonths`: count of `active_months.month > currentMonth`.
  - `pastMonths`: count of `active_months.month < currentMonth`.
  - `pastAppointments`: count of appointments with `date < currentDate` and active status (`CONFIRMED`, `SYNC_FAILED`).
  - `futureAppointments`: count of appointments with `date > currentDate` and active status (`CONFIRMED`, `SYNC_FAILED`).

- List policy:
  - Month list is sourced from `active_months` filtered by selected `year` and `status`.
  - Ordering is ascending by `month` (`YYYY-MM` lexical order).
  - Each row is navigable to `/admin/months/[month]` detail view.

- Creation policy:
  - New month registration is only allowed for future months (`month > currentMonth`).
  - Month selection UI excludes months already created in `active_months` (`ACTIVE` or `INACTIVE`).
  - Year selection for creation is constrained to `[currentYear..currentYear+5]`.
  - Batch selection supports multiple months in one request.
  - New records are created with `status = INACTIVE`.
  - Persistence is idempotent-partial:
    - existing months are skipped,
    - missing months are created,
    - response returns `createdMonths` and `skippedMonths`.

- Time policy:
  - `currentMonth` and `currentDate` must be resolved in `America/Mexico_City`.

- i18n policy:
  - UI labels and statuses are frontend-resolved via `react-i18next`.
  - API returns structural data and stable machine-readable errors only.

## Admin Month Detail Rules

- Scope:
  - Applies to `/admin/months/[month]`, `GET /api/admin/months/[month]`, `PATCH /api/admin/months/[month]/slot-mode`, and `PATCH /api/admin/months/[month]/status`.

- Access and identity:
  - Admin authentication is mandatory for the endpoint.
  - `month` must match `YYYY-MM`.
  - If `month` does not exist in `active_months`, response must be `MONTH_NOT_REGISTERED` (`404`).

- Metrics policy:
  - `confirmedAppointments`: appointments in active states (`CONFIRMED`, `SYNC_FAILED`) within the selected month.
  - `cancelledAppointments`: appointments in `CANCELLED` within the selected month.
  - `occupiedSpaces`: same count as active appointments for the month.
  - `availableSpaces`: `(operationalWeekdays * 3) - (occupiedSpaces + blockedSpaces)` where `3` is max daily capacity.
  - `blockedSpaces`: count of manual blocked slots persisted in `blocked_slots` for the selected month.
  - `projectedSaturationPercent`: `occupiedSpaces / (occupiedSpaces + availableSpaces) * 100`, rounded to integer.

- Calendar policy:
  - Calendar includes every day of the selected month.
  - Weekend days are non-operational (`weekend` tone).
  - Weekday tone is derived from `availableSpaces` per day:
    - `available`: `>= 2`
    - `low`: `= 1`
    - `full`: `= 0`

- Day agenda policy:
  - Day-level agenda is requested with `month + date`.
  - `date` must belong to the selected `month`.
  - Agenda lists only active appointments (`CONFIRMED`, `SYNC_FAILED`) ordered by `timeSlot`.
  - Agenda includes manually blocked slots for the same day ordered by `timeSlot`.
  - Agenda item includes customer identity fields `name` and `phone` for operational context in admin UI.

- Admin edit policy:
  - Month status action updates `active_months.status` between `ACTIVE` and `INACTIVE`.
  - Month status update is only allowed for current or future months.
  - Updating month status in past months is rejected with `MONTH_IN_PAST`.
  - Edit action reprograms appointment `date + timeSlot` within the same selected month.
  - Destination must satisfy booking availability invariants (weekday-only, valid slot, future slot, pair-direction constraints, daily max, and active lock checks).

- Admin cancel policy:
  - UI must request explicit confirmation before executing cancel action.
  - Cancel action performs logical cancellation (`status = CANCELLED`) and preserves history.
  - Admin cancellation does not apply the public 24-hour restriction.

- Admin blocked-slots policy:
  - Admin can manually block multiple slots in `/admin/months/[month]`.
  - Allowed reasons are constrained to: `DESCANSO`, `PERSONAL`, `OTRO`.
  - Only one reason can be selected per submit operation.
  - Day eligibility:
    - inside selected `month`,
    - current day or future day,
    - operational weekday.
  - Slot eligibility:
    - base slot from the official catalog,
    - not in the past for same-day,
    - not occupied by active appointment,
    - not blocked by active temporary lock,
    - not already manually blocked.
  - Manual-block directional propagation:
    - Blocking a single slot in a pair applies directional propagation to homologous slots in other pairs.
    - Blocking both slots of the same pair does not propagate additional directional restriction beyond that pair.
    - Blocking all base slots in a day results in no bookable slots for that day.
  - Submit behavior:
    - operation is atomic all-or-nothing for selected slots,
    - UI disables all modal interactions while submit is in progress.
  - Mass-action behavior:
    - `Seleccionar todo` selects all currently blockable slots for the selected day in one action.
    - `Limpiar selección` removes every selected slot before submit.
  - Slot visualization behavior:
    - UI supports `Por hora` and `Por bloque` views over the same eligible slot set in `BLOCK_MODE`.
    - In `SECOND_ONLY_MODE`, blocked-spaces modal only allows `Por hora`.
    - Selecting a block toggles both slots of the directional pair in the current day.
    - Persistence remains slot-based in `blocked_slots` (no additional block-level entity).
  - Day-agenda management behavior:
    - Admin can edit reason of a manual blocked slot from day-agenda modal.
    - Admin can delete a manual blocked slot from day-agenda modal with explicit confirmation.
    - Edit/delete is allowed only for future blocked slots.

## Availability Rules

- Month slot mode policy:
  - `BLOCK_MODE`:
    - valid base time slots: `09:00`, `10:00`, `13:00`, `14:00`, `17:00`, `18:00`.
  - `SECOND_ONLY_MODE`:
    - valid base time slots: `10:00`, `14:00`, `18:00`.
  - Month slot mode is persisted in `active_months.slot_mode`.
  - Mode change does not alter or cancel existing appointments.
  - Mode affects new booking lock, booking confirmation, admin reschedule, and blockable-slot eligibility.

- Visible/eligible availability must exclude:
  - Past-time slots for same-day booking.
  - Slots occupied by active appointments.
  - Slots blocked by active temporary locks.
  - Slots manually blocked by admin (`blocked_slots`).
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
- Admin protected routes are never accessible without a valid, non-expired admin session.

## Edge Cases

- Requesting bookings in past or inactive months must be rejected.
- Two users trying to secure the same slot at nearly the same time can result in only one successful booking.
- A lock can expire while the user is confirming; confirmation must fail and force reselection.
- Same-day booking near slot time cutoff may become invalid between selection and confirmation.
- A day can become unavailable either by reaching max active appointments or by directional constraints + locks.
- Cancellation and new booking attempts on the same slot/time window must resolve without violating occupancy invariants.
- If external calendar sync fails, appointment remains active in domain conflict logic (`SYNC_FAILED`).
- If month activation is temporarily stale at month boundary, month eligibility rules must still treat past months as invalid and active-window policy as authoritative once reconciled.
