# Research: Admin Appointment Logs

## Decisions

### Decision 1: Backfill current appointments once at release

Decision: Backfill the current appointment base with one synthetic audit row per appointment using a controlled release cutoff. Logging continues prospectively after the backfill completes.

Rationale: The feature is meant to support traceability, abuse detection, and responsibility validation. Starting with an empty log would hide the state of appointments that already exist when the feature is enabled, so a deterministic one-time backfill is required.

Alternatives considered:
- Do not backfill existing appointments. Rejected because it weakens audit coverage for the current operational base.
- Backfill without a release cutoff. Rejected because it would make the historical boundary ambiguous and risk duplicate coverage.

### Decision 2: Use immutable appointment log events

Decision: Appointment log rows are append-only. No edit/delete UI or API is included in v1.

Rationale: Audit features lose value if evidence can be modified after the fact. Future retention or legal hold policies can be specified separately.

### Decision 3: Keep existing state-changing endpoint contracts stable

Decision: Booking, cancellation, approval, and rejection endpoints keep their current request/response contracts. Log writing is an internal side effect after successful state changes.

Rationale: The user explicitly requested no API contract changes for existing flows. This also reduces rollout risk.

### Decision 4: Use a single global admin endpoint

Decision: Expose `GET /api/admin/appointment-logs` with filters, pagination, and `format=pdf` for export.

Rationale: The log is a global admin audit capability, not a child-only view under a single appointment. Reusing the same endpoint with `format=pdf` keeps filter semantics aligned.

### Decision 5: Require authenticated admin access

Decision: Any authenticated active admin user can access the UI route and API.

Rationale: The current application has a single admin role with active/inactive status, and the feature should align with that existing authorization model instead of introducing a new role.

### Decision 6: Denormalize evidence fields into the log

Decision: Store references to the appointment and client records on each log event, then resolve client and appointment evidence at read time. The backfill process uses the same rule set as live event generation, with actor defaulting to `Sistema` when no actor is present.

Rationale: The audit log only needs immutable traceability pointers. Appointment and client evidence remain readable through joins, and the actor is represented as a stable category instead of a person-specific snapshot. A shared rule set keeps the live log and the one-time backfill consistent.

Backfill rules:
- Appointments created before the release cutoff receive one synthetic baseline event if they do not already have a log row.
- The synthetic event uses `actorType=SYSTEM`.
- The synthetic event maps the current appointment status to the closest lifecycle action.
- `PENDING` uses `createdAt` as the event timestamp; other statuses use `updatedAt`.

## Open Implementation Notes

- Do not add a new admin role for this feature unless a future requirement introduces differentiated admin permissions.
- Use business timezone `America/Mexico_City` for user-facing date/time formatting and filter interpretation.
- PDF generation library selection belongs to implementation planning; the contract only requires a valid PDF response with filtered rows and metadata.
