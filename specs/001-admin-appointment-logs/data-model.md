# Data Model: Admin Appointment Logs

## AppointmentLogEvent

Purpose: Immutable audit event for appointment lifecycle transitions relevant to admin accountability.

Suggested persistent fields:

- `id`: primary key
- `appointment_id`: appointment identifier shown as `No. de cita`
- `action_type`: enum-like value for `PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`
- `actor_type`: `CLIENT`, `ADMIN`, or `SYSTEM`
- `client_id`: client reference used to resolve evidence data
- `created_at`: action timestamp

## Relationships

- `AppointmentLogEvent.appointment_id` references the appointment identity for traceability.
- `AppointmentLogEvent.client_id` references the client identity used to resolve client evidence.
- Appointment date/time is resolved from the related appointment record at read time.
- Client name, alias, phone, and client number are resolved from the related client record at read time.
- Actor display is derived from `actor_type` and is not stored as a person-specific snapshot.

## Integrity Rules

- Rows are append-only.
- No update/delete feature is provided in v1.
- `action_type` only allows `PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`.
- Missing or automated actor data must normalize to `actor_type=SYSTEM`.
- A one-time historical backfill is performed for appointments that existed before the release cutoff.
- Backfilled rows use `actor_type=SYSTEM`, map the current appointment status to the closest lifecycle action, and derive the event timestamp from `createdAt` for `PENDING` or `updatedAt` for the remaining statuses.

## Indexing Guidance

- Index `created_at` for action date filtering and default sorting.
- Index `action_type` for type filtering.
- Index `actor_type` for actor category filtering and reporting.
- Index `client_id` for traceability and joins to client evidence.
- Index `appointment_id` for traceability by appointment.
