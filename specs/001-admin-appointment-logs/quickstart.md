# Quickstart: Admin Appointment Logs

## Demo Preconditions

- At least one active admin user exists.
- Feature is deployed with the appointment log persistence migration.

## Backfill Process

1. Capture the release cutoff timestamp for the deployment window.
2. Run a dry run first:
   - `npm run appointment-logs:backfill -- --cutoff=<release-cutoff>`
3. Review the JSON summary:
   - confirm the `scanned`, `prepared`, and `skippedAlreadyLogged` counts make sense for the current dataset.
4. Apply the backfill when the dry run is correct:
   - `npm run appointment-logs:backfill -- --cutoff=<release-cutoff> --apply`
5. Confirm the command reports `mode=apply` and the expected `inserted` count before validating the admin UI.

## Validation Flow

1. Sign in as an active admin.
2. Open the new admin menu item for appointment logs.
3. Confirm the table loads with columns:
   - `No. de cita`
   - `cliente`
   - `Acción`
   - `Fecha/Hora de cita`
   - `Fecha/Hora de accion`
   - `Actor`
4. Confirm an appointment that already existed before the feature release appears in the table with a `Sistema` actor and the correct baseline action mapping.
5. Create or trigger a public booking that results in `PENDING`.
6. Confirm a `Cita solicitada` log appears with client actor data.
7. Approve the appointment.
8. Confirm a `Cita confirmada` log appears with admin actor data.
9. Cancel an appointment.
10. Confirm a `Cita cancelada` log appears.
11. Reject a pending appointment or trigger an automated pending rejection.
12. Confirm a `Cita rechazada` log appears and unknown/automated actor appears as `Sistema`.
13. Apply filters by client name/phone, appointment month, action date, and action type.
14. Sign out and verify unauthenticated access to the route/API is denied.

## Documentation Verification

- `docs/specification.md` contains the admin appointment log behavior, data model, API, and acceptance criteria.
- `docs/architecture/business-rules.md` contains immutable audit log rules.
- `docs/features/admin-appointment-logs-flow.md` contains the consultation/export flow.
- The backfill process is documented in the feature spec and should be executed with a release cutoff timestamp before validating current appointments.
