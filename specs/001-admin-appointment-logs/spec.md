# Feature Specification: Admin Appointment Logs

**Feature Branch**: `001-admin-appointment-logs`

**Created**: 2026-06-27

**Status**: Completed

**Input**: User description: "Crear un apartado para que el administrador pueda visualizar el log de las citas y ver quién y cuándo agendó, canceló, aprobó o rechazó una cita."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consult appointment audit log (Priority: P1)

As an authenticated admin, I can open a dedicated admin menu item and view appointment audit events so I can trace who requested, confirmed, cancelled, or rejected an appointment and when the action happened.

**Why this priority**: This is the core auditability need. Without a restricted log view, the feature does not solve accountability, abuse detection, or internal traceability.

**Independent Test**: Seed appointment log events for several appointments and verify that an authenticated active admin can access the log view and see paginated rows, while unauthenticated users cannot access the page or API.

**Acceptance Scenarios**:

1. **Given** an authenticated active admin and existing log events, **When** the user opens the admin appointment logs menu item, **Then** the system shows a paginated table with `No. de cita`, `cliente`, `Acción`, `Fecha/Hora de cita`, `Fecha/Hora de acción`, and `Actor`.
2. **Given** an unauthenticated user, **When** the user requests `/admin/appointment-logs` or `GET /api/admin/appointment-logs`, **Then** the system denies access and no log data is returned.

---

### User Story 2 - Filter appointment audit evidence (Priority: P2)

As an authenticated admin, I can filter appointment logs by client name or phone, appointment month, action date, and action type so I can find evidence for support, abuse investigation, and responsibility validation.

**Why this priority**: Audit logs are only useful if the admin can narrow the evidence to the relevant client, month, action, and time window.

**Independent Test**: Seed events across multiple clients, months, action types, and dates; apply each filter independently and in combination; verify returned rows match the criteria and pagination metadata stays consistent.

**Acceptance Scenarios**:

1. **Given** log events for multiple clients, **When** the admin searches by client name or phone, **Then** matching events are listed using normalized phone matching where applicable.
2. **Given** log events across multiple months, **When** the admin filters by month, **Then** only appointments scheduled within that month are listed.
3. **Given** log events across multiple action dates and types, **When** the admin filters by action date range and action type, **Then** only matching events are listed.

---

### User Story 3 - Export filtered audit evidence as PDF (Priority: P3)

As an authenticated admin, I can export the filtered appointment logs to PDF so I can preserve or share evidence outside the application.

**Why this priority**: Export supports audits and responsibility reviews after the log has been narrowed to relevant evidence.

**Independent Test**: Apply filters in the log view, request `GET /api/admin/appointment-logs?format=pdf` with the same filters, and verify the PDF contains the visible columns, applied filter summary, and generation timestamp.

**Acceptance Scenarios**:

1. **Given** a filtered appointment log result, **When** the admin exports PDF, **Then** the PDF contains the same columns visible in the table plus applied filters and generation date/time.
2. **Given** no rows match the applied filters, **When** the admin exports PDF, **Then** the PDF still renders the filter summary, generation date/time, and an empty-results state.

### Edge Cases

- Existing appointments at release time receive one baseline historical log event through the release-cutoff backfill; live logging continues after deployment.
- If an action has no identifiable actor, the event actor must be stored/displayed as `Sistema`.
- If a client has no alias, the combined client column must remain readable and not display placeholder noise.
- If an appointment or client is later deleted by a future capability, immutable log evidence must retain the denormalized display fields needed for audit review.
- If the PDF export is requested with invalid filters, the API must return a stable `errorCode` and no partial file.
- If the action is automated, such as pending expiration rejection, actor must be `Sistema`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create an immutable appointment log event whenever an appointment reaches one of these states after release: `PENDING`, `CONFIRMED`, `CANCELLED`, or `REJECTED`.
- **FR-002**: System MUST map state/action labels as follows: `PENDING` -> `Cita solicitada`, `CONFIRMED` -> `Cita confirmada`, `CANCELLED` -> `Cita cancelada`, `REJECTED` -> `Cita rechazada`.
- **FR-003**: System MUST record for each log event: appointment id, action type, actor type, client id, and action date/time, while resolving appointment date/time and client evidence data from the related records at read time.
- **FR-004**: System MUST support actors from clients, admins, and system-originated actions.
- **FR-005**: System MUST identify missing or unknown actor information as `Sistema` and store it as the system actor category.
- **FR-006**: System MUST expose an authenticated-admin menu item that navigates to the appointment log view.
- **FR-007**: System MUST render the appointment log table with these columns: `No. de cita`, `cliente`, `Acción`, `Fecha/Hora de cita`, `Fecha/Hora de acción`, `Actor`.
- **FR-008**: System MUST support filtering by client name or phone, appointment month, action date, and action type.
- **FR-009**: System MUST support pagination for the appointment log table.
- **FR-010**: System MUST expose `GET /api/admin/appointment-logs` for JSON list results with filters and pagination.
- **FR-011**: System MUST support PDF export through the same endpoint using `format=pdf`.
- **FR-012**: PDF export MUST include the same visible columns, applied filters, and generation date/time.
- **FR-013**: System MUST run a one-time historical backfill for appointments that existed before release, using the deployment cutoff as the boundary and skipping appointments that already have log rows.
- **FR-014**: System MUST NOT change existing booking, cancellation, approval, or rejection API contracts; log creation is an internal side effect of successful state changes.
- **FR-015**: Appointment log events MUST NOT be editable or deletable through the admin UI or public flows.
- **FR-016**: Admin UI copy MUST be resolved through `react-i18next` in `es` and `en`.
- **FR-017**: Admin UI MUST use `components/admin/ui/` and comply with `docs/ui/admin/*`.
- **FR-018**: Appointment logs API access MUST follow the existing admin session contract. A valid authenticated admin session grants access; inactive users cannot create a new valid session.
- **FR-019**: JSON pagination MUST enforce `pageSize` between 1 and 100, with default `pageSize=20`.
- **FR-020**: PDF export MUST export the filtered result set up to 1,000 rows; if filters match more than 1,000 rows, API MUST return `EXPORT_LIMIT_EXCEEDED` with HTTP `422`.

### Key Entities *(include if feature involves data)*

- **AppointmentLogEvent**: Immutable audit record for appointment lifecycle actions. Key attributes: appointment id, action type, actor type, client id, action date/time, with appointment and client evidence resolved through relations.
- **Actor Category**: Derived representation of who performed the action. Supports client, admin, and system.
- **Client Evidence**: Read-time client data used in logs and PDF exports: name, alias, phone, and client number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly successful request/confirm/cancel/reject state changes create exactly one immutable log event.
- **SC-002**: Authenticated active admin can retrieve filtered log results by client name/phone, appointment month, action date, and action type with deterministic pagination.
- **SC-003**: Unauthenticated users cannot access the log UI or API.
- **SC-004**: PDF export reflects the same filtered result set and includes filter summary plus generation timestamp.
- **SC-005**: Appointments that existed before deployment receive exactly one baseline historical log event through the backfill process, and no appointment is duplicated.

## Assumptions

- The existing admin authentication model remains unchanged; any active authenticated admin can access the appointment logs feature.
- The feature is read-only from the UI perspective; no edit or delete operation is provided for log rows.
- PDF export is simple evidence export, not a signed/legal certificate.
- Existing state-changing endpoints remain backward compatible and add logging only after successful transactions.

## Documentation Impact *(mandatory for this repo)*

- `docs/specification.md` must be updated because the feature changes admin UI, persistence, API contracts, and side effects for booking/cancel/approval/rejection flows.
- `docs/architecture/business-rules.md` must be updated to define immutable appointment log rules.
- `docs/architecture/api.md` must be updated with the new `GET /api/admin/appointment-logs` contract and PDF format behavior.
- A new `docs/features/admin-appointment-logs-flow.md` must document the admin log consultation/export flow.
- Admin UI docs remain aligned with existing components/tokens; implementation must update `docs/ui/admin/components.md` only if new reusable admin UI components are introduced.
