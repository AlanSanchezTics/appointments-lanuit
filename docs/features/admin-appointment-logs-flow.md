# Admin Appointment Logs Flow

## Purpose

Define the admin flow for consulting and exporting appointment audit logs.

This flow supports:

- audit review,
- internal traceability,
- abuse detection,
- responsibility validation.

`docs/specification.md` remains the normative source of truth for this behavior.

## Actors

- Admin:
  - can access the menu item, table, filters, and pagination.
- Unauthenticated user:
  - cannot access this section or API data.
- System:
  - may appear as actor for automated or unidentified actions.
- Client:
  - may appear as actor for public booking/cancellation actions.
- Admin:
  - may appear as actor for admin-originated actions.

## Entry Point

1. Admin signs into `/admin`.
2. Admin shell displays the `Logs de citas` menu item.
3. Admin opens `/admin/appointment-logs`.

## Main Flow

1. UI loads the appointment logs page.
2. UI requests `GET /api/admin/appointment-logs` with default pagination.
3. API validates authenticated active admin access.
4. API returns paginated log rows.
5. UI renders the table with:
   - `No. de cita`,
   - `cliente`,
   - `Acción`,
   - `Fecha/Hora de cita`,
   - `Fecha/Hora de acción`,
   - `Actor`.
   - Las columnas de fecha/hora se presentan en formato legible para admin: `DD-MMM-YYYY hh:mm am/pm` en zona `America/Mexico_City`.
   - La columna de actor se ubica al final de la tabla.
6. Admin can change page or page size.
7. UI requests the same endpoint with updated pagination.

## Filter Flow

1. Admin sets one or more filters:
   - cliente por nombre o teléfono,
   - mes de la cita,
   - fecha de acción,
   - estado/tipo de acción.
2. UI requests `GET /api/admin/appointment-logs` with filter query parameters.
3. API validates filter values.
4. API returns matching rows and pagination metadata.
5. UI displays loading, empty, and error states without leaving the admin shell.

## Event Generation Flow

Log rows are generated as side effects of successful appointment state transitions after feature release:

- `PENDING` -> `Cita solicitada`.
- `CONFIRMED` -> `Cita confirmada`.
- `CANCELLED` -> `Cita cancelada`.
- `MODIFIED` -> `Cita modificada`.
- `REJECTED` -> `Cita rechazada`.
- Automated pending-expiration rejection also creates `Cita rechazada` with actor `Sistema`.
- On release, a one-time backfill creates baseline log rows for appointments that already existed before the deployment cutoff, skipping any appointment that already has history. The backfill uses actor `Sistema`.

Existing booking, cancellation, approval, and rejection API contracts do not change.

## Rules

- Logs are immutable.
- Logs continue prospectively after the release-cutoff backfill completes.
- Missing or unknown actor is displayed as `Sistema`.
- `MODIFIED` rows must preserve readable previous and new schedule evidence even if the appointment changes again later.
- Ese snapshot se persiste en `appointment_logs.payload`.
- JSON pagination uses default `pageSize=20` and enforces `pageSize` in range `1..100`.
- Month filtering matches the appointment month (`YYYY-MM`) using the appointment date, not the log creation date.
- Admin UI text must use `react-i18next`.
- Admin UI must use `components/admin/ui/` and follow `docs/ui/admin/*`.
- Public booking and cancellation UI must remain isolated from the admin design system.

## Error and Access Behavior

- Unauthenticated request: redirect to `/admin/login` for UI; API returns `ADMIN_UNAUTHORIZED`.
- Invalid filters: API returns `VALIDATION_ERROR`.
- Unsupported export format: API returns `UNSUPPORTED_EXPORT_FORMAT`.
- Export over `1,000` filtered rows: API returns `EXPORT_LIMIT_EXCEEDED` (`422`).

## Acceptance Criteria

- Only authenticated active admin users can access the section.
- New events are registered for request, confirm, cancel, modify, and reject actions.
- Log records are immutable.
- Table supports filtering and pagination.
- Appointments existing before release receive a one-time baseline audit row through the backfill process.
- `docs/specification.md`, `docs/architecture/business-rules.md`, and this flow document stay aligned.
