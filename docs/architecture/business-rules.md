# Business Rules

## Purpose

Define the business rules that govern the appointment domain for the manicure booking system, using `docs/specification.md` as the normative source.

This document captures domain behavior, constraints, states, and decision rules without implementation-level details. Data structures are described in `docs/architecture/data-model.md`; endpoint contracts and error codes are described in `docs/architecture/api.md`.

## Domain Overview

The system manages appointments for a single professional.

The core domain objective is to allow customers to book, consult, modify, and cancel appointments under strict availability, time, and identity constraints, while preserving schedule consistency and avoiding conflicts.

Business behavior is defined by:

- Appointment scheduling windows based on active months.
- A rule-based availability model per month: days, times, minimum gap between appointments, and daily capacity (see Availability Rules).
- Booking, cancellation, and self-service modification eligibility rules.
- 15-calendar-day threshold as UX suggestion trigger in public booking flow when same-month active future appointments exist.
- Temporary slot holding during public booking flow (from end of step 1 until confirmation/expiration).
- A single source of truth for appointment state.
- All time-based rules are evaluated using a fixed business timezone (`America/Mexico_City`).

## Core Entities

- Professional
  - Single service provider whose schedule is managed by the system.

- Customer
  - Identified by phone number.
  - Has a unique incremental `client_number` assigned at creation time.
  - Has one canonical name associated with that phone.
  - May define an optional `alias` (not unique) used for admin display and admin-originated messaging.
  - May be flagged as loyal for admin catalog and detail views.

- Appointment
  - Represents a scheduled service at a date and time slot.
  - Uses domain states (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `SYNC_FAILED`).

- Appointment Log Event
  - Immutable audit record for appointment lifecycle actions.
  - Records who performed the action, when it happened, which appointment was affected, and the client snapshot required for later evidence review.
  - Stores event evidence in a single `payload` JSON object.
  - For reschedules, `payload` must preserve the visible previous and new schedule snapshots.
  - Created prospectively only after the appointment log feature is released.

- Reservation Lock
  - Temporary hold used during booking flow (step 1 -> step 2 -> step 3) to prevent concurrent slot capture.
  - Locks expire automatically after a fixed time window of 10 minutes and stop blocking availability once expired.

- Active Month
  - Calendar month that is explicitly enabled for booking and destination reschedule availability flows.

- Availability Rule and Availability Exception
  - Per-month definitions of the days and times the professional offers (see Availability Rules).
  - A month always has a rules version used to detect concurrent edits.

## Core Concepts

- Active scheduling window
  - Appointments are only allowed in months marked as active.
  - Past months are never valid for new bookings.
  - The system operates within a limited forward-looking window of active months.

- Operating calendar
  - A day is offered only when the month's availability rules or exceptions open it and produce at least one offerable time (FR-017, D46). There are no fixed operating weekdays.
  - A month without any rule uses the default rule: Monday to Friday, times `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, minimum gap 240 minutes, `preserveCapacity` true, `maxPerDay` 3 (D6). Saturdays and Sundays stay closed in that case (D28).
  - A month with at least one rule closes every day that no rule or exception covers (D23).
  - Same-day booking is allowed only for times equal to or later than the current local business time (D50).

- Minimum gap model (replaces the former directional pair model, ADR 0001)
  - Offered times are the `HH:mm` times of the rule or exception that covers the day. There is no fixed list of times.
  - Each rule or exception has `minGapMinutes` (0 to 1440; default 240). A time is offered only when its start time is at least `minGapMinutes` away from the start time of every active appointment on that day.
  - In the public flow, valid temporary locks count as occupied for this check.
  - The former pairs `(09:00, 10:00)`, `(13:00, 14:00)`, `(17:00, 18:00)` and their directional restrictions no longer exist as a business rule. Only the migration presets keep the old time lists (see Availability Rules).

- Daily capacity model
  - Each rule or exception has `maxPerDay` (1 to 6; default 3). A day with `maxPerDay` active appointments offers no times.
  - `preserveCapacity` (default true): a time is offered only if booking it does not reduce how many more appointments still fit that day, capped at `maxPerDay`. When it is false, only the minimum gap and `maxPerDay` apply (FR-010, FR-012).
  - `availableSpaces` of a day is the number of additional appointments still reachable under these rules, capped by `maxPerDay`. It is not a fixed constant of 3 (FR-026, D12).
  - A day with no offerable times (closed by rule, empty exception, full-day block, or times already past) is unavailable (FR-015).
  - Compared with the former model, when there are manual single-time blocks 48 of 432 combinations differ; in those cases the new model offers more times. This difference is accepted (D43, D54; ADR 0002).

- Active appointment definition
  - Public booking, public reschedule, and admin writes (creation, reschedule, manual blocks) treat `PENDING`, `CONFIRMED`, and `SYNC_FAILED` as occupying their time (D68, D71).
  - `REJECTED` and `CANCELLED` appointments do not occupy time and do not count toward occupancy or conflict decisions.
  - Admin counters and metrics (month detail and dashboard) count only `CONFIRMED` and `SYNC_FAILED`; `PENDING` is not counted (D66).
  - Consequence accepted by the owner: a month's `availableSpaces` can show more free spaces than the admin can book, when a `PENDING` appointment sits on a time that is otherwise free.

- Temporary reservation lock
  - A slot can be temporarily held from the end of step 1 and kept across identity/confirmation while valid.
  - While active, a lock blocks availability for that slot.
  - On unexpected page exit (`refresh`, tab close, external navigation), frontend should attempt early lock release via `pagehide + sendBeacon` to a dedicated idempotent endpoint.
  - On `reload` navigation, frontend should revalidate month availability immediately (no-store) and perform one short retry to reduce transient stale availability after best-effort lock release.
  - Early release is best-effort only; business guarantee remains TTL expiration.
  - Locks expire automatically and stop affecting availability once expired.

- Mirror integration principle
  - External calendar synchronization mirrors domain state but does not define source-of-truth booking validity.

- Audit log integrity principle
  - Appointment lifecycle audit logs are append-only evidence.
  - Application flows must not expose edit or delete behavior for audit events.
  - Audit event display data must remain readable even if related appointment, client, or admin records change later.

- Referential integrity policy
  - `appointments.client_id -> clients.id` uses cascading referential actions (`ON DELETE CASCADE`, `ON UPDATE CASCADE`).

## Booking Rules

- A booking request is valid only when all of the following hold:
  - Target month is active.
  - Target date is a day of the month that has at least one offerable time under the availability rules.
  - Target time is one of the times offered by the availability resolver for that day (see Availability Rules).
  - For same-day booking, target time is still in the future.
  - Slot is not occupied by an active appointment (`PENDING`, `CONFIRMED`, `SYNC_FAILED`).
  - Slot is not blocked by a valid temporary lock or a manual block.
  - The minimum gap and daily capacity rules of the day allow the slot.

- Customer identity rules during booking:
  - Phone is normalized to exactly 10 digits.
  - Name must be at least 3 characters.
  - Customer is resolved by phone.
  - A phone cannot map to multiple names.
  - Alias does not participate in identity validation and never overrides canonical phone-name consistency checks.
  - Name comparison for phone identity must ignore leading/trailing whitespace (trim on both values).
  - New customers always receive a unique positive `client_number`.
  - Public booking assigns `client_number` automatically from the next available value.
  - Admin inline booking may provide a manual `client_number`; if omitted, system auto-assigns.

- Public booking exclusivity per phone:
  - In public booking flow, a phone can hold multiple active future appointments within the same target month.
  - In public booking flow, when same-month active future appointments exist within the 15-calendar-day threshold of the selected date, booking flow must enter a decision view with current selection details + list of active appointments.
  - In public booking flow, the 15-calendar-day threshold is used only to decide whether to show the decision/suggestion view.
  - The threshold counts `PENDING`, `CONFIRMED` and `SYNC_FAILED` as active appointments (D95); `CANCELLED` and `REJECTED` do not count.
  - A `PENDING` appointment listed by the threshold can be rescheduled through public confirmation: it moves to the new `date + timeSlot`, stays `PENDING`, has no calendar event (`googleEventId` null) and gets a `MODIFIED` log event, as in my-appointments (D95).
  - In public booking flow, when the new slot/date is within 15 calendar days of at least one existing active future appointment in the same month, UI shows the suggestion view and allows either rescheduling or booking as new.
  - In public booking flow, when the new slot/date is outside that threshold for all same-month active future appointments, UI can continue directly to confirmation.
  - In public booking flow, the same-month active appointments list must start with no preselected appointment; the customer must choose explicitly.
  - In public booking flow, the decision view primary CTA must be explicit: continue as new appointment when no appointment is selected, or reschedule selected appointment when one is selected.
  - In public booking flow, while reschedule selection is active, UI must show a summary block with the currently selected `date`, `timeSlot`, `name`, and `phone` before listing active appointments to reschedule.
  - In public booking flow, while reschedule selection is active, step-1 input sections (`available days`, `time selection`, `phone input`) must be hidden.
  - In public booking flow, customer may hold active future appointments across different months.
  - In admin booking flow, multiple active future appointments are allowed for the same phone.

- Booking confirmation rules:
  - Confirmation requires a valid, unexpired lock tied to the selected slot/date/phone.
  - If lock expires or becomes invalid, confirmation is rejected and slot must be reselected.
  - Confirmation revalidates the slot against the availability rules in force at confirmation time (D39). A valid lock does not guarantee that the time still exists: if a rule or exception removed it, confirmation fails with `SLOT_NOT_AVAILABLE`.
  - Public confirmation may include `appointmentIdToReschedule`; when present, the selected active future appointment for the same phone/month is rescheduled instead of creating a new record.
  - Public confirmation without `appointmentIdToReschedule` creates the new appointment in `CONFIRMED` for loyal customers and `PENDING` for non-loyal customers.
  - `PENDING` appointments do not create a calendar event until they are later confirmed.
  - Whenever a Google Calendar event is created or updated for an appointment, the event `summary` must use canonical client `name` (never `alias`).
  - Public success-step WhatsApp behavior:
    - Whenever WhatsApp text needs a client name in public flow, UI/backend payload must use canonical `name` (not `alias`).
    - `CONFIRMED` and `SYNC_FAILED`: UI performs one automatic WhatsApp redirect attempt when success view is entered, and keeps a visible manual CTA fallback.
    - `PENDING`: WhatsApp action remains explicit/manual (`Enviar comprobante`).

- Pending review rules:
  - `PENDING` appointments await manual review by admin.
  - Admin may transition `PENDING -> CONFIRMED` or `PENDING -> REJECTED`.
  - On `PENDING -> CONFIRMED`, system must attempt Google Calendar mirror sync.
  - If that sync fails, appointment transitions to `SYNC_FAILED` without rolling back the local confirmation lifecycle.
  - If a `PENDING` appointment remains unresolved for 36 hours, the system marks it as `REJECTED` automatically.

- Pending confirmation WhatsApp offer:
  - Applies only to the `Confirmar` action of the admin dashboard `Pendientes de confirmación` block.
  - When the confirmation result is `CONFIRMED` or `SYNC_FAILED`, the admin UI offers a `sileo.action` toast, separate from the success toast, to send the prefilled WhatsApp message. The toast is never automatic: nothing opens until the admin presses its button.
  - The button opens `https://wa.me/52{phone}?text={encodedMessage}` in the same tab, synchronously inside the click. Date and time are the labels shown on the card; the template and toast copy are resolved via `react-i18next`.
  - The admin stays on the dashboard. After a successful confirmation the card refreshes; the offer's URL is built before that refresh so the button keeps working after the card unmounts.
  - `Rechazar` never offers WhatsApp. A failed confirmation never offers WhatsApp; it shows an error notification and keeps the actions available.
  - Offering the message persists nothing: it does not change the appointment status and does not write any record.
  - The button must not use `window.open` or a new tab. Mobile browsers block new windows not opened directly from a user gesture.

## Concurrency Rules

- Scope:
  - Writes that touch times: public booking confirmation, public reschedule, admin appointment creation, admin reschedule, manual blocks, and changes to rules, exceptions, or slot mode.
  - Decisions are recorded in ADR 0006 (`docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`).

- First commit wins:
  - When two writes target the same time, only one succeeds (edge case: simultaneous booking).
  - There is no database constraint that prevents two active appointments at the same time. Protection is application-level, by the lock order below (owner architecture decision; see `docs/architecture/data-model.md`).

- Lock order for writes that touch times (D63, D77):
  1. Named locks for the date and for the phone, taken in alphabetical order with a 5-second wait. If they are not obtained, the request fails with `LOCK_TIMEOUT` (409 on the routes that map it, see `docs/architecture/api.md`). Manual blocks do not take these named locks (limitation F2, D83).
  2. Month rules read with a shared row lock in booking, confirmation, reschedule, and block flows. The rule editor takes an exclusive row lock on the same month.
  3. Conflicting appointments of the day are locked.
  4. Reservation locks (D88, D89): after the conflicting appointments are locked, expired locks of the processed date are cleaned up and the active locks the flow needs are read. No flow takes a reservation lock before the appointments. Manual blocks clean up and read the reservation locks of their date but do not take the named locks.
  5. Occupancy is read. In admin creation and admin reschedule the read is exclusive (D77). In manual blocks the appointment read is exclusive, but the blocked-slot read is plain (limitation F2). The public flows also read blocked slots plainly (F2).
  6. The appointment or block is written, then the named locks are released in the flows that took them.

- Infrastructure errors (deadlock, transaction or InnoDB lock wait timeout, connection pool) raised during a write are not business rejections. The transaction is rolled back and the request fails with `UNKNOWN_ERROR` (400). A `GET_LOCK` timeout is `LOCK_TIMEOUT` instead (D81).

- Rule editor:
  - The editor waits for writes in progress on the same month.
  - No write mixes old rules with a change in progress.

- Public confirmation order:
  - Start transaction; take the named locks; read the month rules with a shared lock; lock the conflicting appointments of the day and the phone; clean expired locks of the processed date; validate the temporary lock with a lock; validate availability against the current rules (D39) with a conflict lock; insert or reschedule; delete the consumed lock; release the named locks; commit; then create the calendar event.

- Known limitations (see ADR 0006):
  - F1 (D82, mandatory correction before the Phase 1 release): a session lock is not released when the database transaction expires first (default 5 seconds). In measurements the lock was kept in 7 of 10 expirations. Until it is corrected, `LOCK_TIMEOUT` is rarely reached and the response is usually `UNKNOWN_ERROR` (400).
  - F2 (D83, accepted by the owner): the manual-block read used by public routes is a plain read despite its name. Measured double occupancy under simultaneous load: 17 of 40 batches (admin block against admin creation) and 10 of 40 (admin block against public booking).
  - F3 (accepted): named locks of public booking are released before COMMIT. No double booking attributable to this was measured after the B-1 correction.
  - F4 (corrected, D88 and D91): in the destination validation of public reschedule only a non-bookable month becomes `SLOT_NOT_AVAILABLE`. Other errors, including database errors, propagate as `UNKNOWN_ERROR` (400) and roll back the transaction (D81).

## Appointment Audit Log Rules

- Scope:
  - Appointment audit logs support internal traceability, abuse detection, responsibility validation, and evidence export.
  - Only authenticated active admin users may consult appointment logs.

- Event creation:
  - A successful transition to `PENDING` creates a `Cita solicitada` event.
  - A successful transition to `CONFIRMED` creates a `Cita confirmada` event.
  - A successful transition to `CANCELLED` creates a `Cita cancelada` event.
  - A successful reschedule creates a `Cita modificada` event.
  - A successful transition to `REJECTED` creates a `Cita rechazada` event.
  - Automatic pending-expiration rejection also creates a `Cita rechazada` event with actor `Sistema`.
  - Events are created only for transitions that occur after the feature is released.
  - The system performs a one-time historical backfill for appointments that already existed before release, using the deployment cutoff as the boundary and skipping appointments that already have log rows.
  - Changes to availability rules, exceptions, and slot mode do not create audit events (FR-035, D24).

- Actor rules:
  - Valid actor categories are client, admin, and system.
  - If the actor cannot be identified, the event must use `Sistema`.
  - Automated transitions, including automatic pending rejection, must use the system actor.

- Evidence data:
  - Each event must preserve appointment id, action type, actor category, action date/time, and client reference.
  - Events must preserve the schedule evidence required to understand the action even if the appointment is moved later.
  - `MODIFIED` must preserve both previous and new date/time.
  - Client name, alias, phone, and client number are resolved through the linked client record.

- Consultation and export:
  - JSON list pagination must default to `pageSize=20` and enforce `pageSize` in range `1..100`.
  - PDF export must use the filtered result set and is limited to `1,000` rows.
  - If a PDF export would include more than `1,000` rows, the system must reject the export with `EXPORT_LIMIT_EXCEEDED` instead of generating a partial file.

- Immutability:
  - Appointment log events are append-only.
  - Admin UI and public flows must not provide edit/delete actions for log rows.

## Public My Appointments Rules

- Public appointment self-service entry route is `/my-appointments`.
- Legacy `/citas/cancelar` redirects to `/my-appointments`.
- Lookup by phone returns future appointments for the phone even when no public action remains available.
- Lookup ignores the `active_months` status of the appointment's current month.
- Public consultation in `/my-appointments` is read-only until the client chooses an action.
- Public management action area exposes cancellation and modification affordances for the selected appointment.
- An appointment may be:
  - modifiable only,
  - cancelable only,
  - or eligible for both actions.
- A future appointment that is outside both public time windows must still appear in lookup as blocked, with a UI warning that web changes or cancellations are no longer available.

## Cancellation Rules

- A cancellation request is allowed only when the appointment is:
  - In `CONFIRMED` or `SYNC_FAILED` state.
  - In the future (not past date).
  - At least 24 hours away from the current local time.
- Cancellation lookup by phone must return all future appointments that satisfy those conditions so the user can choose one or more to cancel.
- Cancellation execution in public flow must allow cancelling one or multiple selected appointments in the same request.
- Public cancellation executes inside `/my-appointments`.

- Cancellation effects:
  - Each selected appointment state changes to `CANCELLED`.
  - Released slot becomes available again under normal availability rules.
  - For `SYNC_FAILED`, cancellation remains valid even if no external event exists (`googleEventId = null`).
  - Public cancellation success-step WhatsApp behavior:
    - UI performs one automatic WhatsApp redirect attempt when success view is entered and `whatsappUrl` is available.
    - UI keeps a visible manual CTA fallback (`Notificar por WhatsApp`).

- Not allowed:
  - Cancelling past appointments.
  - Cancelling appointments with less than 24 hours remaining via the web cancellation flow.

## Public Reschedule Rules

- A public reschedule request is allowed only when the appointment is:
  - In `PENDING`, `CONFIRMED`, or `SYNC_FAILED` state.
  - In the future.
  - At least 3 hours away from the current local time.
- Public reschedule preserves the same appointment record (`appointments.id`).
- Public reschedule updates `date` and `timeSlot` to the newly selected slot.
- Destination slot selection uses the same availability resolver as public booking (see Availability Rules):
  - the target month must be bookable,
  - the target day must have at least one offerable time,
  - the target time must be offered given occupancy (including `PENDING` appointments), active locks, manual blocks, minimum gap, daily capacity, and the same-day cutoff.
  - Otherwise the reschedule is rejected with `SLOT_NOT_AVAILABLE`.
  - An active lock held by another client on the target time also rejects the reschedule with `SLOT_NOT_AVAILABLE` (D87). A lock held by the same client does not block it (D88).
- Mi cita public reschedule (`POST /api/my-appointments/reschedule`) must not apply `isLoyal` logic, the 15-day booking suggestion branch, or any 15-day rule between appointments. The booking wizard reaches reschedule through the 15-day suggestion with `appointmentIdToReschedule` (D95); that path follows the booking rules above.
- For source appointments in `CONFIRMED` or `SYNC_FAILED`:
  - system attempts calendar mirror re-sync for the new schedule,
  - if sync succeeds, the updated appointment stores the resulting `googleEventId` and ends in `CONFIRMED`,
  - if sync fails, the local reschedule remains valid and the appointment ends in `SYNC_FAILED`.
- For source appointments in `PENDING`:
  - the reschedule does not trigger calendar sync,
  - `googleEventId` remains `null`,
  - the appointment remains `PENDING`.

- SYNC_FAILED recovery:
  - A scheduled maintenance job may retry external sync for appointments in `SYNC_FAILED`.
  - On successful retry, appointment transitions to `CONFIRMED` and stores `googleEventId`.
  - On retry failure, appointment remains `SYNC_FAILED`.

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

- Admin global client search:
  - The authenticated admin shell exposes a global client search in `appHeader` on every protected `/admin/*` route except login.
  - Search matches client `name` or normalized `phone` partials.
  - Client search requests are debounced in the UI to avoid unnecessary database hits.
  - Search results are limited in the UI to the first 8 matches.
  - Selecting a search result must navigate to the selected client detail view and reset the search state.
  - Search results may expose the loyalty flag so the shell can render a loyalty badge without loading the client catalog.

## Admin Dashboard Rules

- Scope:
  - Applies to `/admin` dashboard UI.

- Weekly occupancy widget policy:
  - Widget displays one bar per day of the current business week, Monday to Sunday (D57). Saturdays and Sundays count when a rule or exception opens them.
  - Occupancy source uses only active appointments (`CONFIRMED`, `SYNC_FAILED`); `PENDING` is not counted (D66).
  - Capacity of each day is its `maxPerDay` when the day is open, and `0` when the day is closed or has a full-day block (D44, D53, D57). Each day uses the rules of its own month, so a week can span two months.
  - Daily occupancy percent is calculated as:
    - `activeAppointmentsForDay / capacityOfDay * 100`, rounded to integer.
    - If the capacity of the day is `0`, the percent is `0`.
  - Weekly occupancy percent is calculated as:
    - `activeAppointmentsInWeek / weekCapacity * 100`, rounded to integer,
    - where `weekCapacity` is the sum of the capacities of the seven days.
    - The weekly percent is not capped.
  - Weekly comparison is computed against the previous business week (Monday to Sunday) using the same formula.
  - Comparison indicator shows percent points delta (`currentWeekPercent - previousWeekPercent`) with semantic state:
    - `delta > 0`: `more`,
    - `delta < 0`: `less`,
    - `delta = 0`: `similar`.
  - Week boundaries and weekday resolution must use `America/Mexico_City`.
  - All visible copy in the widget must be resolved in frontend via `react-i18next`.
  - The UI still shows five columns until the Phase 2 UI work is delivered (see `docs/specification.md`, 15.1.4).

- Busiest-day widget policy:
  - Dashboard includes a highlighted block showing the busiest day of the current business week.
  - Source is derived from the same Monday-to-Sunday weekly occupancy dataset.
  - Busiest day is the day with highest active appointments count (`CONFIRMED`, `SYNC_FAILED`).
  - Tie-break rule: pick the earliest day in the week order (Monday to Sunday).
  - Widget renders localized weekday name and localized supporting copy via `react-i18next`.
  - If the current week has no active appointments, widget is hidden.

- Daily-occupancy widget policy:
  - Dashboard includes a card showing current-day occupancy percentage.
  - Source counts active appointments (`CONFIRMED`, `SYNC_FAILED`) for `currentDate` in `America/Mexico_City`.
  - Percentage is `activeAppointmentsToday / capacityToday * 100`, rounded to integer, capped visually at `100`; it is `0` when the capacity is `0`.
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

- Reminders widget policy:
  - Dashboard includes a `Recordatorios` block with two groups:
    - next-day appointments (`currentDate + 1`),
    - next-week appointments (`currentDate + 7`).
  - Source includes only active statuses (`CONFIRMED`, `SYNC_FAILED`).
  - Date bucketing and ordering must use business timezone `America/Mexico_City`.
  - Each row includes: customer initials avatar, `name`, `clientNumber`, `phone`, `timeSlot`.
  - Each row exposes action `Enviar recordatorio` that opens WhatsApp in a new tab using:
    - `https://wa.me/52{phone}?text={encodedMessage}`.
  - To support mobile browsers, the UI must open the final WhatsApp URL synchronously during the user click/tap and must not open an intermediate blank tab.
  - Reminder sending does not enforce duplicate restrictions; admin can resend the same reminder type for the same appointment multiple times.
  - Supported reminder types:
    - `NEXT_DAY`,
    - `NEXT_WEEK`.
  - Reminder copy and notifications are frontend-resolved through `react-i18next`.

- Retouch reminders widget policy:
  - Dashboard includes `Recordatorios de retoque` block below the standard reminders block.
  - Visibility rule:
    - render only when at least one candidate client exists.
  - Candidate source:
    - base set is clients with appointment exactly at `currentDate - 21 days` in states `CONFIRMED` or `SYNC_FAILED`.
    - base set is deduplicated by client.
  - Evaluation windows:
    - retrospective: `(D-21, D]`,
    - prospective: `[D, D+31]`.
  - Confirmed-appointment rule:
    - only `CONFIRMED` is treated as scheduled/locking status for candidate filtering.
    - if at least one `CONFIRMED` exists in retrospective or prospective window, client is omitted.
    - if no `CONFIRMED` exists in both windows, client remains candidate (including cases with only non-confirmed states).
  - Row payload includes:
    - `clientId`, `clientNumber`, `name`, `phone`, `lastAppointmentDate`, `candidateReason`.
  - Output ordering:
    - ascending by `clientNumber`.
  - Action:
    - opens WhatsApp synchronously with fixed reminder copy.
  - Re-send policy:
    - unlimited re-send allowed.

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
  - Filtro de presentación: oculta meses pasados por defecto; no cambia la fuente, la API ni las métricas.

- Creation policy:
  - New month registration is only allowed for future months (`month > currentMonth`).
  - Month selection UI excludes months already created in `active_months` (`ACTIVE` or `INACTIVE`).
  - Year selection for creation is constrained to `[currentYear..currentYear+5]`.
  - Batch selection supports multiple months in one request.
  - New records are created with `status = INACTIVE`.
  - New records are created with `slot_mode = BLOCK_MODE`, a legacy field that is derived from the rules, and without availability rules. The default rule of the Availability Rules section applies until the admin creates rules (D17, D31).
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
  - Supports partial updates for canonical client name, canonical phone, canonical `client_number`, and loyalty flag.
  - Loyalty flag is a manual admin segmentation marker stored in `clients.is_loyal`.
  - Name must satisfy domain identity validation (minimum length).
  - Phone, when provided, must be normalized to exactly 10 digits.
  - `client_number`, when provided, must be a positive integer (`> 0`).
  - Canonical phone identity remains unique; updates that collide with another client are rejected.
  - Canonical `client_number` remains unique; updates that collide with another client are rejected.
  - Empty payloads are rejected.
  - If client does not exist, returns `CLIENT_NOT_FOUND` (`404`).

- Auth and error semantics:
  - Endpoints require admin session.
  - Missing session returns `ADMIN_UNAUTHORIZED` (`401`).
  - Validation failures return stable machine-readable `errorCode`.

## Admin Month Detail Rules

- Scope:
  - Applies to `/admin/months/[month]`, `GET /api/admin/months/[month]`, `PATCH /api/admin/months/[month]/slot-mode`, `PATCH /api/admin/months/[month]/status`, and the availability rules endpoints of the month.

- Access and identity:
  - Admin authentication is mandatory for the endpoint.
  - `month` must match `YYYY-MM`.
  - If `month` does not exist in `active_months`, response must be `MONTH_NOT_REGISTERED` (`404`).

- Metrics policy:
  - `confirmedAppointments`: appointments in active states (`CONFIRMED`, `SYNC_FAILED`) within the selected month. `PENDING` is not counted (D66).
  - `cancelledAppointments`: appointments in `CANCELLED` within the selected month.
  - `occupiedSpaces`: active appointments (`CONFIRMED`, `SYNC_FAILED`) within the selected month. `PENDING` is not counted (D66).
  - `availableSpaces`: sum of the `availableSpaces` of every day of the month, computed by the availability resolver (see Availability Rules). Each day contributes the additional appointments still reachable, capped by its `maxPerDay`. Days before today contribute `0` (D12, D56). It is not computed as operational weekdays times 3 minus occupied and blocked spaces.
  - `blockedSpaces`: blocked capacity units of the month (not raw rows):
    - each time of the day's rule or exception that has a manual single-time block counts as `1`;
    - a full-day block counts as `1` for each time of that day's rule or exception;
    - a day without rule or exception counts `0`;
    - days before today are included (D14, D41, D62).
  - `projectedSaturationPercent`: `occupiedSpaces / (occupiedSpaces + availableSpaces) * 100`, rounded to integer, and `0` when the denominator is `0`. The `availableSpaces` used here keeps the days before today, so the value is comparable with the previous month (D60).
  - `saturationComparison`:
    - `previousMonth`: previous chronological month (`YYYY-MM`).
    - `previousProjectedSaturationPercent`: same saturation formula calculated for previous month.
    - `deltaPercentPoints`: `projectedSaturationPercent - previousProjectedSaturationPercent`.

- Calendar policy:
  - Calendar includes every day of the selected month.
  - Tone of each day:
    - `closed` (gray): a day before today, or a day with no offerable times once manual blocks and the times already past are applied (closed by rule or exception, all its times blocked, or all its times past). Occupancy is not considered for this tone (D34, D56).
    - `available`: `availableSpaces >= 2`.
    - `low`: `availableSpaces = 1`.
    - `full`: `availableSpaces = 0` on a day that is not `closed` (for example, a day filled with appointments).
  - Weekend is not a special tone. A Saturday or Sunday is closed unless a rule or exception opens it, and an open Saturday uses the same tones as any other day.
  - Tones are derived from the resolver, and `PENDING` appointments do not count (D66). A day can therefore show free spaces that the admin cannot book.

- Availability rules policy (month detail):
  - The month detail shows the rules and exceptions of the month, the availability version (`availabilityVersion`), and whether the month still uses the default rule (no rules).
  - Creating, editing, or deleting a rule or exception requires the version that the admin edited (see Availability Rules). A conflicting save is rejected and nothing changes.
  - Before saving, the admin is shown the future active appointments that the change leaves outside the times grid of the month. If there are any, saving requires explicit confirmation; confirming does not change those appointments (FR-023, FR-024, D18, D35, D40).
  - Rules and exceptions cannot be created, edited, or deleted, and the slot-mode preset cannot be applied, for a past month (`MONTH_IN_PAST`, D36).

- Day agenda policy:
  - Day-level agenda is requested with `month + date`.
  - `date` must belong to the selected `month`.
  - Agenda lists only active appointments (`CONFIRMED`, `SYNC_FAILED`) ordered by `timeSlot`.
  - Agenda includes manually blocked slots for the same day ordered by `timeSlot`.
  - Agenda item includes customer identity fields `name` and `phone` for operational context in admin UI.

- Admin edit policy:
  - Month status action updates `active_months.status` between `ACTIVE` and `INACTIVE`.
  - Month slot-mode action is only exposed in UI for current/future months (`isPastMonth=false`). The API rejects a past month with `MONTH_IN_PAST` (D36).
  - Share-agenda action is exposed only for current/future months and must stay disabled when `monthStatus=INACTIVE`.
  - Admin appointment creation is allowed in any registered month, `ACTIVE` or `INACTIVE` (D17). Only the public booking flow requires `ACTIVE`.
  - If `isPastMonth=true`, UI must hide the 4 action CTAs block (`Compartir agenda`, `Agendar nueva cita`, `Bloquear espacios`, `Activar|Desactivar mes`).
  - Month status update is only allowed for current or future months.
  - Updating month status in past months is rejected with `MONTH_IN_PAST`.
  - Edit action reprograms appointment `date + timeSlot` within the same selected month.
  - Only `CONFIRMED` or `SYNC_FAILED` appointments can be rescheduled from the admin agenda. A `PENDING` appointment is not editable there and responds `APPOINTMENT_NOT_FOUND` (D72).
  - Past appointments are not editable in day-agenda actions.
  - Destination must satisfy the availability invariants: the day has offerable times, the time is offered by the resolver (occupancy including `PENDING` appointments, active locks, manual blocks, minimum gap, daily capacity, and same-day cutoff), in the same month (D63, D68).

- Admin cancel policy:
  - UI must request explicit confirmation before executing cancel action.
  - Cancel action performs logical cancellation (`status = CANCELLED`) and preserves history.
  - Admin cancellation does not apply the public 24-hour restriction.
  - Admin cancellation can be executed for active appointments in past or future dates within the selected month.

- Admin booking policy:
  - Admin can create appointments inside `/admin/months/[month]` through admin-specific API contracts.
  - Creation is allowed when the selected `month` is registered, in any status (`ACTIVE` or `INACTIVE`).
  - Booking must satisfy the same booking invariants as the public flow:
    - the day has offerable times,
    - the time is offered by the availability resolver (no fixed list of times per mode),
    - future slot for same-day,
    - minimum gap and daily capacity,
    - no active temporary lock for another phone on same slot,
    - no active appointment on the same time, including `PENDING` (D68).
  - Admin can create multiple active future appointments for the same phone/customer.
  - Customer selection supports:
    - existing customer by `clientId`,
    - inline customer upsert by `name + phone`.
  - Phone identity remains canonical:
    - one phone maps to one customer name,
    - mismatch on upsert is rejected.
  - Admin booking uses deterministic API errors for conflicts/validation and keeps calendar sync behavior consistent with domain (`CONFIRMED` or `SYNC_FAILED`).

- Admin blocked-slots policy:
  - Admin can manually block multiple times in `/admin/months/[month]`, or a full day in one action.
  - Allowed reasons are constrained to: `DESCANSO`, `PERSONAL`, `OTRO`.
  - Only one reason can be selected per submit operation.
  - Day eligibility:
    - inside selected `month`,
    - current day or future day,
    - the day has at least one offerable time under the rules in force; otherwise the request fails with `DATE_NOT_OPERATIONAL` (D76).
  - Slot eligibility:
    - the time is one of the times offered by the resolver for that day at the moment of the block. That excludes times already past for same-day blocks, times occupied by an active appointment (including `PENDING`, D68, D71), times held by an active temporary lock, times already manually blocked, and times that the minimum gap or the daily capacity rules exclude. Otherwise the request fails with `SLOT_NOT_AVAILABLE`.
  - Effect of a manual single-time block:
    - the blocked time leaves the day's times grid before the minimum gap and daily capacity are computed (FR-013, D2, D43);
    - there is no propagation to other times of the day (the former directional propagation is retired).
  - Full-day block:
    - Admin can block a full day in one action, without selecting each time individually. The day is then unavailable for new bookings.
    - Stored as a single marker in `blocked_slots` (`00:00`), not one row per time (D41, D55).
    - The request fails with `SLOT_LOCKED` when an active temporary lock sits on a time of the day's grid, with `DAY_ALREADY_BLOCKED` when the day already has a full-day block, and with `SLOT_NOT_AVAILABLE` when the day has no time left to offer.
    - A successful full-day block replaces the single-time blocks that the day already had.
    - Day-agenda must allow unblocking a full-day block in a single action.
  - Calendar mirror:
    - Every blocked slot creation (including the full-day marker) must attempt to create a mirror event in Google Calendar.
    - Mirror event title format:
      - single-time block: `No disponible - [Reason]`.
      - full-day block: `Día libre - [Reason]`.
    - Single-time block: one mirror event of 1 hour (D15, D29, D30). Only blocks created from the deployment onward use this duration; existing events keep theirs.
    - Full-day block: mirror event on the same day from `06:00` to `23:00` in `America/Mexico_City`.
    - Blocked-slot reason updates must attempt to update the mirror event summary.
    - Blocked-slot deletion must attempt to delete the mirror event when `googleEventId` exists.
    - Calendar failures never roll back local blocked-slot mutations; failures are exposed as sync warnings and tracked as `SYNC_FAILED` for retry when applicable.
    - Blocking every offered time of a day leaves no bookable times for that day.
  - Submit behavior:
    - operation is atomic all-or-nothing for selected slots,
    - UI disables all modal interactions while submit is in progress.
  - Mass-action behavior:
    - `Seleccionar todo` selects all currently blockable times for the selected day in one action.
    - `Limpiar selección` removes every selected time before submit.
  - Time visualization:
    - UI shows the eligible times one by one (`Por hora`). The former `Por bloque` view and the directional pairs no longer exist (D14).
  - Persistence uses `blocked_slots` for single-time blocks and a dedicated full-day marker for day-level block (same table, no additional table).

- Day-agenda management behavior:
  - Day agenda includes operational CTAs to:
    - open `Agendar nueva cita` with the selected day prefilled,
    - open `Bloquear espacios` with the selected day prefilled.
  - Day-agenda CTAs are hidden when the selected day has no eligible spaces.
  - Admin can edit reason of a manual blocked slot from day-agenda modal.
  - Admin can delete a manual blocked slot from day-agenda modal with explicit confirmation.
  - Edit is allowed only for future blocked slots.
  - Delete is allowed for manual blocked slots in past or future dates.

## Availability Rules

- Scope:
  - One resolver decides, for each day, the offered times. Public booking, public reschedule, the lock, the confirmation, admin creation and reschedule, manual blocks, the dashboard, and the month detail all use it (FR-016).

- Rules and exceptions of a month:
  - A month has zero or more availability rules and zero or more date exceptions.
  - A rule covers a date range inside the month, one or more weekdays (Monday to Sunday), one or more `HH:mm` times, and three parameters: `minGapMinutes`, `preserveCapacity`, and `maxPerDay`. When a rule is created, the defaults are `240`, `true`, and `3` (D20, FR-002).
  - Two rules of the same month cannot share a date. The overlap is checked by dates, not by weekdays, when saving (FR-003).
  - An exception applies to one date and has its own times and parameters. It takes priority over any rule covering that date, and it can open a date that no rule covers. An exception with an empty times list closes that day (FR-004, FR-005, D10).
  - Rules and exceptions never cross months (FR-019).

- Month without rules:
  - A month with no rule uses the default rule: Monday to Friday, times `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `240` / `true` / `3`, on the days no exception covers. Saturdays and Sundays are closed (D6, D28).
  - Deleting the last rule of a month returns the month to that default (D17).
  - Adding the first rule to a month without rules closes the days that the default opened and the new rule does not cover; this is accepted without an extra warning (D28, D23, D42).

- Day resolution (single resolver, same result everywhere):
  1. Start from the times of the rule or exception that covers the day. An exception has priority over a rule.
  2. Remove times with a manual single-time block (FR-013, D2, D43).
  3. On the current day, remove times before the current local time in `America/Mexico_City`. A time equal to the current time is still offered (FR-014, D50).
  4. Apply the minimum gap: a time is offered only if its start is at least `minGapMinutes` from the start of every active appointment on that day. In the public flow, valid locks count as occupied (FR-009, D25).
  5. If `preserveCapacity` is `true`, offer a time only if booking it does not reduce how many more appointments still fit that day, capped at `maxPerDay` (FR-010). If it is `false`, only the minimum gap and `maxPerDay` apply (FR-012).
  6. If the day already has `maxPerDay` active appointments, offer no times (FR-011).
- A day with no offerable times is unavailable (FR-015, D46).
- `availableSpaces` of a day is the number of additional appointments still reachable, capped by `maxPerDay` (FR-026, D12).
- Without manual blocks the engine reproduces the former behavior (SC-002). With manual blocks, 48 of 432 combinations differ from the former behavior and that difference is accepted (D43, D54; ADR 0002).

- Limits and validation of rules and exceptions:
  - `minGapMinutes`: integer from `0` to `1440`.
  - `maxPerDay`: integer from `1` to `6`.
  - Each rule or exception has at most `24` distinct times, counted after normalization (D21).
  - Times use the `HH:mm` format. They are normalized on save: no duplicates, sorted (D37).
  - `00:00` is not a valid time in rules or exceptions. It is the internal marker of a full-day block (D55).
  - A rule needs at least one weekday and at least one time. An exception may have an empty times list, which closes the day.
  - Dates must be real calendar dates inside the month. A malformed or nonexistent date (for example `2026-02-30`) is rejected (D38).
  - Each validation error has a stable `AVAILABILITY_*` code; the list is in `docs/architecture/api.md`.

- Changes to rules and exceptions:
  - Creating, editing, or deleting rules or exceptions, and applying a slot-mode preset, is allowed only for months that are not in the past (D36, `MONTH_IN_PAST`).
  - Every month has a rules version. A save must carry the version the admin edited; if it changed, the save is rejected and nothing is modified (`AVAILABILITY_VERSION_CONFLICT`, FR-041, D24). Each successful save increments the version.
  - Future active appointments that the change leaves outside the times grid are listed before saving (FR-023, FR-024, D35, D40). Past appointments are not listed, and manual blocks are not part of this calculation (D18). When there are affected appointments, saving requires explicit confirmation (`AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`).
  - Changing rules or exceptions does not modify, move, or cancel appointments, their status, or Google Calendar events (FR-022, D5).
  - A temporary lock on a time that a rule removed keeps its TTL. Confirmation rejects it with `SLOT_NOT_AVAILABLE` (D39).
  - Rule changes do not generate appointment audit events (FR-035, D24).

- Slot mode (legacy field):
  - `slot_mode` is no longer a source of times. It is derived from the rules (FR-033, D19, D31; ADR 0004):
    - a month without rules has `BLOCK_MODE`;
    - a month with a single rule that covers the whole month, with exactly the values of a preset, has that preset's mode;
    - any other set of rules keeps the current value.
    - Exceptions are not compared.
  - Presets (D4, D16) are shortcuts that set the month's rules:
    - `BLOCK_MODE`: Monday to Friday, times `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, `240` / `true` / `3`;
    - `SECOND_ONLY_MODE`: Monday to Friday, times `10:00, 14:00, 18:00`, `0` / `false` / `3`.
  - The slot-mode action replaces the month's rules with one whole-month rule that has the values of the preset and keeps the exceptions (FR-034, D16, D33).
  - Migration of existing months (D4, FR-030 to FR-032): a month with `BLOCK_MODE` receives the default rule above; a month with `SECOND_ONLY_MODE` receives Monday to Friday with times `10:00, 14:00, 18:00` and `0` / `false`. Existing appointments are not modified. Details are in `docs/architecture/data-model.md`.

## State Transitions

- Appointment state model:
  - `CONFIRMED`: valid active appointment.
  - `CANCELLED`: appointment canceled; does not consume availability.
  - `SYNC_FAILED`: appointment remains active for domain conflicts even when external sync failed.
  - `PENDING`: appointment awaiting manual review; it occupies its time in the public flow and in admin writes, but it is not counted in admin counters (D66, D68).

- Allowed business transitions:
  - New public booking creates a `CONFIRMED` appointment for loyal customers and a `PENDING` appointment for non-loyal customers (see Booking confirmation rules).
  - Confirmed appointment can transition to `CANCELLED` when cancellation rules are met.
  - External sync failure may result in `SYNC_FAILED` while still preserving active occupancy behavior.

- Historical behavior:
  - Rebooking a previously canceled slot creates a new appointment record (cancellations are historical, not overwritten).

## Validation Rules

- Month/date validation:
  - Month must be active for the public booking flow and for public reschedule.
  - Past months are rejected for public booking. Rules, exceptions, slot mode, and month status cannot be changed in a past month (`MONTH_IN_PAST`).
  - Dates must be real calendar dates. A nonexistent or malformed date (for example `2026-02-30`) is `VALIDATION_ERROR` in public booking and public reschedule.
  - The day must have at least one offerable time under the resolver. Otherwise booking, reschedule, and admin appointment creation fail with `SLOT_NOT_AVAILABLE`, and a manual block fails with `DATE_NOT_OPERATIONAL`.

- Time validation:
  - Time must be `HH:mm`. Any valid `HH:mm` is accepted by the input validation; whether it is offered is decided by the resolver (`SLOT_NOT_AVAILABLE`).
  - Same-day time must still be in the future.
  - `00:00` is rejected in rules and exceptions (D55).

- Availability rule validation:
  - Limits, overlap, and version rules of the Availability Rules section apply (FR-025, FR-003, FR-041).

- Phone/name validation:
  - Phone input can include separators at capture time, but business identity is a normalized 10-digit phone.
  - Name minimum length is 3.
  - One phone corresponds to one canonical customer name.

- Booking precondition validation:
  - Slot availability under the resolver.
  - Minimum gap and daily capacity.
  - Valid temporary lock at confirmation step.
  - Public flow only: if same-phone active future appointments exist in the target month, evaluate the 15-calendar-day threshold only as UX suggestion trigger.
  - `PENDING`, `CONFIRMED` and `SYNC_FAILED` count as active for this threshold (D95).

- Cancellation precondition validation:
  - `CONFIRMED` status.
  - Future appointment.
  - Minimum 24-hour anticipation.
  - Month remains active.

## Invariants

- The appointment domain source of truth is internal system state.
- External calendar acts as mirror, not authority.
- No overlapping active occupancy per slot.
- Minimum gap (`minGapMinutes`), daily maximum (`maxPerDay`), and, when `preserveCapacity` is true, the capacity rule are enforced by the resolver for every public and admin write.
- Public flow: a phone can have multiple active future appointments per month; the 15-calendar-day threshold only drives suggestion UX and does not block booking creation.
- Admin flow: a phone can have multiple active future appointments.
- Booking and cancellation are only valid within active months. Admin appointments can be created in any registered month.
- Same-day booking is only valid for future slots in local business time.
- Cancellation releases availability.
- Temporary reservation locks stop blocking once expired.
- Changing availability rules or exceptions never changes, moves, or cancels appointments or calendar events (D5).
- A `PENDING` appointment occupies its time in the public flow and in admin writes, but does not count in admin counters (D66, D68).
- Admin protected routes are never accessible without a valid, non-expired admin session.

## Edge Cases

- Requesting bookings in past or inactive months must be rejected.
- Root-entry routing (`/`) behavior:
  - root renders a welcome entry view with primary CTA to `/booking` and secondary cancellation CTA.
  - booking month selection happens inside `/booking` (active eligible months `>= currentMonth` with at least one available slot).
  - if no months satisfy that filter, root keeps the same welcome layout and shows unavailable-agenda messaging while preserving cancellation CTA.
- Two users trying to secure the same slot at nearly the same time can result in only one successful booking.
- A lock can expire while the user is confirming; confirmation must fail and force reselection.
- Same-day booking: times equal to or later than the current local time are bookable (D50). A time that becomes past between selection and confirmation is rejected.
- A day can become unavailable by reaching `maxPerDay` active appointments, by the minimum gap or preserved capacity leaving no time, by a closed rule or empty exception, by a full-day block, or by active locks.
- A lock on a time that a rule removed afterwards is kept until its TTL; confirmation fails with `SLOT_NOT_AVAILABLE` (D39).
- Rule change that leaves future active appointments outside the grid: the appointments keep date, time, and status; the admin sees them before saving (D5, D18, D40).
- Admin reschedule of a `PENDING` appointment is not possible from the agenda; the response is `APPOINTMENT_NOT_FOUND` (D72).
- Manual block on a time with a `PENDING` appointment: `SLOT_NOT_AVAILABLE` (D68, D71).
- Past month: no rule, status, or slot-mode change is accepted (`MONTH_IN_PAST`, D36).
- Cancellation and new booking attempts on the same slot/time window must resolve without violating occupancy invariants.
- If external calendar sync fails, appointment remains active in domain conflict logic (`SYNC_FAILED`).
- If month activation is temporarily stale at month boundary, month eligibility rules must still treat past months as invalid and active-window policy as authoritative once reconciled.
