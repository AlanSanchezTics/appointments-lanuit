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
- Minimum 15-calendar-day separation policy between active future appointments in the same month per customer phone in public booking flow (admin flow allows multiple future appointments without this separation rule).
- Temporary slot holding during booking confirmation.
- A single source of truth for appointment state.
- All time-based rules are evaluated using a fixed business timezone (`America/Mexico_City`).

## Core Entities

- Professional
  - Single service provider whose schedule is managed by the system.

- Customer
  - Identified by phone number.
  - Has a unique incremental `client_number` assigned at creation time.
  - Has one canonical name associated with that phone.
  - May be flagged as loyal for admin catalog and detail views.

- Appointment
  - Represents a scheduled service at a date and time slot.
  - Uses domain states (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `SYNC_FAILED`).

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
  - `PENDING` appointments are not active and do not count toward occupancy or conflict decisions.

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
  - New customers always receive a unique positive `client_number`.
  - Public booking assigns `client_number` automatically from the next available value.
  - Admin inline booking may provide a manual `client_number`; if omitted, system auto-assigns.

- Public booking exclusivity per phone:
  - In public booking flow, a phone can hold multiple active future appointments within the same target month only when every pair remains at least 15 calendar days apart.
  - In public booking flow, when same-month active future appointments exist, booking flow must enter a decision view with current selection details + list of active appointments.
  - In public booking flow, when the new slot/date violates that 15-calendar-day separation against existing active future appointments in the same month, booking flow must require selecting one of those appointments to reschedule.
  - In public booking flow, when the 15-calendar-day separation is valid, that same decision view must offer an alternative action to book as a new appointment.
  - In public booking flow, while reschedule selection is active, UI must show a summary block with the currently selected `date`, `timeSlot`, `name`, and `phone` before listing active appointments to reschedule.
  - In public booking flow, while reschedule selection is active, step-1 input sections (`available days`, `time selection`, `phone input`) must be hidden.
  - In public booking flow, customer may hold active future appointments across different months.
  - In admin booking flow, multiple active future appointments are allowed for the same phone.

- Booking confirmation rules:
  - Confirmation requires a valid, unexpired lock tied to the selected slot/date/phone.
  - If lock expires or becomes invalid, confirmation is rejected and slot must be reselected.
  - Public confirmation may include `appointmentIdToReschedule`; when present, the selected active future appointment for the same phone/month is rescheduled instead of creating a new record.
  - Public confirmation without `appointmentIdToReschedule` creates the new appointment in `CONFIRMED` for loyal customers and `PENDING` for non-loyal customers.
  - `PENDING` appointments do not create a calendar event until they are later confirmed.

- Pending review rules:
  - `PENDING` appointments await manual review by admin.
  - Admin may transition `PENDING -> CONFIRMED` or `PENDING -> REJECTED`.
  - If a `PENDING` appointment remains unresolved for 36 hours, the system marks it as `REJECTED` automatically.

## Cancellation Rules

- A cancellation request is allowed only when the appointment is:
  - In `CONFIRMED` state.
  - In the future (not past date).
  - Inside an active month.
  - At least 24 hours away from the current local time.
- Cancellation lookup by phone must return all future appointments that satisfy those conditions so the user can choose one or more to cancel.
- Cancellation execution in public flow must allow cancelling one or multiple selected appointments in the same request.

- Cancellation effects:
  - Each selected appointment state changes to `CANCELLED`.
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

## Admin Dashboard Rules

- Scope:
  - Applies to `/admin` dashboard UI.

- Weekly occupancy widget policy:
  - Widget displays exactly 5 bars, one per operational weekday (`Monday` to `Friday`) of the current business week.
  - Occupancy source uses only active appointments (`CONFIRMED`, `SYNC_FAILED`).
  - Daily occupancy percent is calculated as:
    - `activeAppointmentsForDay / 3 * 100`, rounded to integer.
  - Weekly occupancy percent is calculated as:
    - `activeAppointmentsInWeek / 15 * 100`, rounded to integer.
    - where `15 = 5 weekdays * 3 max daily appointments`.
  - Weekly comparison is computed against previous business week (`Monday` to `Friday`) using the same formula.
  - Comparison indicator shows percent points delta (`currentWeekPercent - previousWeekPercent`) with semantic state:
    - `delta > 0`: `more`,
    - `delta < 0`: `less`,
    - `delta = 0`: `similar`.
  - Week boundaries and weekday resolution must use `America/Mexico_City`.
  - All visible copy in the widget must be resolved in frontend via `react-i18next`.

- Busiest-day widget policy:
  - Dashboard includes a highlighted block showing the busiest operational weekday for the current business week.
  - Source is derived from the same Monday-Friday weekly occupancy dataset.
  - Busiest day is the weekday with highest active appointments count (`CONFIRMED`, `SYNC_FAILED`).
  - Tie-break rule: pick the earliest weekday in the week order (`Monday` to `Friday`).
  - Widget renders localized weekday name and localized supporting copy via `react-i18next`.
  - If the current week has no active appointments, widget is hidden.

- Daily-occupancy widget policy:
  - Dashboard includes a card showing current-day occupancy percentage.
  - Source counts active appointments (`CONFIRMED`, `SYNC_FAILED`) for `currentDate` in `America/Mexico_City`.
  - Percentage is `activeAppointmentsToday / 3 * 100`, rounded to integer and capped visually at `100`.
  - Card must render:
    - title (`Ocupación del día`),
    - percentage value,
    - progress bar tied to percentage,
    - informational line `N appointments scheduled for today` with `InfoCircle` icon.
  - Visible copy is frontend-resolved via `react-i18next`.
  - Title resolution:
    - Monday-Friday: `Ocupación del día`,
    - Saturday/Sunday: `Ocupación para el Lunes` when the visible occupancy is aligned to Monday context.

- Today-agenda widget policy:
  - Dashboard includes a timeline block for active appointments of a `targetDate`.
  - `targetDate` resolution:
    - Monday-Friday: `currentDate`,
    - Saturday/Sunday: next Monday.
  - Widget title resolution:
    - Monday-Friday: `Today's Agenda`,
    - Saturday/Sunday: `Agenda for Monday` (localized).
  - Header includes a navigation icon that links to `/admin/months/[currentMonth]`.
  - Source includes only active statuses (`CONFIRMED`, `SYNC_FAILED`) ordered by `timeSlot` ascending.
  - Each row renders `timeSlot`, customer `name`, and `phone`.
  - UI operational status is derived per appointment using current local business time (`America/Mexico_City`) and 3-hour duration:
    - `READY`: `now >= start + 3h`,
    - `IN_PROGRESS`: `start <= now < start + 3h`,
    - `PENDING`: `now < start`.
  - `IN_PROGRESS` status tag must blink unless `prefers-reduced-motion` disables animation.
  - When no active appointments exist for current day, widget renders an empty informational state.

- Daily-tip widget policy:
  - Dashboard includes a `Tip del día` card sourced from CSV assets.
  - Tips are selected by deterministic date-based rotation in `America/Mexico_City`.
  - Anchor date is fixed at `2026-03-29` mapping to first row.
  - Selection formula:
    - `tipIndex = ((dayOffset % totalTips) + totalTips) % totalTips`.
  - Language source:
    - Spanish UI uses `tips_operativos_salon_unas.csv`.
    - English UI uses `tips_operativos_salon_unas_en.csv` only when row count matches ES.
  - Fallback:
    - If EN source is missing/misaligned, use Spanish tips.

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

## Admin Clients Catalog Rules

- Scope:
  - Applies to admin clients catalog contracts:
    - `GET /api/admin/clients/catalog`
    - `GET /api/admin/clients/[clientId]`
    - `PATCH /api/admin/clients/[clientId]`

- Query/filter policy (`GET /api/admin/clients/catalog`):
  - `query` is optional and matches by `name` or normalized `phone` partial.
  - `status` allows:
    - `ALL`
    - `WITH_FUTURE_APPOINTMENTS`
    - `WITHOUT_FUTURE_APPOINTMENTS`
    - `LOYAL`
  - `sort` allows:
    - `RECENT`
    - `NAME_ASC`
    - `NAME_DESC`
    - `APPOINTMENTS_DESC`
  - `page` is 1-based and must be positive integer.
  - `pageSize` must be positive integer within configured maximum.

- Future-appointment semantics:
  - Future appointment means `date > currentDate` in `America/Mexico_City`.
  - Active statuses considered for future filters/metrics are `CONFIRMED` and `SYNC_FAILED`.

- Catalog response policy:
  - Returns stable `filters`, `metrics`, `pagination`, `clients[]`, and `currentDate`.
  - `metrics` include:
    - `totalClients`
    - `withFutureAppointments`
    - `withoutFutureAppointments`
    - `loyalClients`
    - `loyalClientsPercentage`
  - `loyalClientsPercentage` is computed as `round(loyalClients / totalClients * 100)`.
  - If `totalClients = 0`, `loyalClientsPercentage` must be `0`.
  - Each catalog row includes identity and operational summary:
    - `clientId`, `name`, `phone`, loyalty flag, timestamps
    - `totalAppointments` counts only appointments in `CONFIRMED` status.
    - next/last appointment references.

- Detail policy (`GET /api/admin/clients/[clientId]`):
  - Requires valid numeric `clientId`.
  - If the client does not exist, returns `CLIENT_NOT_FOUND` (`404`).
  - Response includes:
    - client identity block including loyalty flag,
    - summary metrics (`total`, `active`, `cancelled`, `futureActive`, next/last appointment),
    - chronological appointments list for detail timeline excluding `PENDING` and `REJECTED`.
  - Detail UI metrics (`total`, `past`, `future`) must count only appointments in `CONFIRMED` status.

- Update policy (`PATCH /api/admin/clients/[clientId]`):
  - Requires valid numeric `clientId`.
  - Supports partial updates for canonical client name, canonical phone, and loyalty flag.
  - Loyalty flag is a manual admin segmentation marker stored in `clients.is_loyal`.
  - Name must satisfy domain identity validation (minimum length).
  - Phone, when provided, must be normalized to exactly 10 digits.
  - Canonical phone identity remains unique; updates that collide with another client are rejected.
  - Empty payloads are rejected.
  - If client does not exist, returns `CLIENT_NOT_FOUND` (`404`).

- Auth and error semantics:
  - Endpoints require admin session.
  - Missing session returns `ADMIN_UNAUTHORIZED` (`401`).
  - Validation failures return stable machine-readable `errorCode`.

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
  - `saturationComparison`:
    - `previousMonth`: previous chronological month (`YYYY-MM`).
    - `previousProjectedSaturationPercent`: same saturation formula calculated for previous month.
    - `deltaPercentPoints`: `projectedSaturationPercent - previousProjectedSaturationPercent`.

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
  - Month slot-mode action is only exposed in UI for current/future months (`isPastMonth=false`).
  - Share-agenda action is exposed only for current/future months and must stay disabled when `monthStatus=INACTIVE`.
  - If `isPastMonth=true`, UI must hide the 4 action CTAs block (`Compartir agenda`, `Agendar nueva cita`, `Bloquear espacios`, `Activar|Desactivar mes`).
  - Month status update is only allowed for current or future months.
  - Updating month status in past months is rejected with `MONTH_IN_PAST`.
  - Edit action reprograms appointment `date + timeSlot` within the same selected month.
  - Past appointments are not editable in day-agenda actions.
  - Destination must satisfy booking availability invariants (weekday-only, valid slot, future slot, pair-direction constraints, daily max, and active lock checks).

- Admin cancel policy:
  - UI must request explicit confirmation before executing cancel action.
  - Cancel action performs logical cancellation (`status = CANCELLED`) and preserves history.
  - Admin cancellation does not apply the public 24-hour restriction.
  - Admin cancellation can be executed for active appointments in past or future dates within the selected month.

- Admin booking policy:
  - Admin can create appointments inside `/admin/months/[month]` through admin-specific API contracts.
  - Creation is only allowed when selected `month` exists and is `ACTIVE`.
  - Booking must satisfy the same booking invariants as public flow:
    - operational weekday,
    - valid base slot according to month slot mode,
    - future slot for same-day,
    - pair-direction constraints,
    - daily max capacity,
    - no active temporary lock for another phone on same slot.
  - Admin can create multiple active future appointments for the same phone/customer.
  - Customer selection supports:
    - existing customer by `clientId`,
    - inline customer upsert by `name + phone`.
  - Phone identity remains canonical:
    - one phone maps to one customer name,
    - mismatch on upsert is rejected.
  - Admin booking uses deterministic API errors for conflicts/validation and keeps calendar sync behavior consistent with domain (`CONFIRMED` or `SYNC_FAILED`).

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
    - Edit is allowed only for future blocked slots.
    - Delete is allowed for manual blocked slots in past or future dates.

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
  - Public flow only: if same-phone active future appointments already exist in the target month, the new booking date must keep a minimum 15-calendar-day gap against them.

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
- Public flow: a phone can have multiple active future appointments per month only if each active appointment keeps a minimum 15-calendar-day gap from the others.
- Admin flow: a phone can have multiple active future appointments.
- Booking and cancellation are only valid within active months.
- Same-day booking is only valid for future slots in local business time.
- Cancellation releases availability.
- Temporary reservation locks stop blocking once expired.
- Admin protected routes are never accessible without a valid, non-expired admin session.

## Edge Cases

- Requesting bookings in past or inactive months must be rejected.
- Root-entry routing (`/`) behavior when current month is inactive:
  - if at least one active eligible month exists, redirect must resolve to the nearest active month (ascending `YYYY-MM`),
  - if no active eligible months exist, root must render an unavailable-agenda state with WhatsApp contact action.
- Two users trying to secure the same slot at nearly the same time can result in only one successful booking.
- A lock can expire while the user is confirming; confirmation must fail and force reselection.
- Same-day booking near slot time cutoff may become invalid between selection and confirmation.
- A day can become unavailable either by reaching max active appointments or by directional constraints + locks.
- Cancellation and new booking attempts on the same slot/time window must resolve without violating occupancy invariants.
- If external calendar sync fails, appointment remains active in domain conflict logic (`SYNC_FAILED`).
- If month activation is temporarily stale at month boundary, month eligibility rules must still treat past months as invalid and active-window policy as authoritative once reconciled.
