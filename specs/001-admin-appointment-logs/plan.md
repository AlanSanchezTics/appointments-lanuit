# Implementation Plan: Admin Appointment Logs

**Branch**: `001-admin-appointment-logs` | **Date**: 2026-06-27 | **Spec**: `specs/001-admin-appointment-logs/spec.md`

**Input**: Feature specification from `/specs/001-admin-appointment-logs/spec.md`

## Summary

Add an authenticated-admin section for immutable appointment lifecycle logs. New successful appointment state changes (`PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`) create append-only log events. The admin UI lists, filters, paginates, and exports filtered evidence as PDF through `GET /api/admin/appointment-logs`.

## Technical Context

**Language/Version**: TypeScript / Next.js App Router  
**Primary Dependencies**: Next.js, React, Prisma ORM, next-auth, i18next/react-i18next, admin UI components  
**Storage**: MySQL via Prisma  
**Testing**: Project test stack to be confirmed from package scripts during implementation  
**Target Platform**: Web admin dashboard  
**Project Type**: web application  
**Performance Goals**: Filtered log list returns paginated results with `pageSize` constrained to `1..100` and default `20`; PDF export handles filtered evidence up to `1,000` rows and rejects larger exports with `EXPORT_LIMIT_EXCEEDED` (`422`).  
**Constraints**: Authenticated active admin access, one-time backfill for existing appointments at release, existing booking/cancel/approve/reject API contracts remain stable, admin UI must use `components/admin/ui/`.  
**Scale/Scope**: Appointment audit events for four lifecycle actions only.

## Constitution Check

GATE: Must pass before design and again before implementation.

- `docs/specification.md` remains the source of truth for behavior.
- `docs/architecture/business-rules.md` remains the source of truth for domain rules.
- `docs/features/*` stays aligned with the flow it documents.
- `specs/*` is a temporary working area, not the canonical contract.

Status: PASS for planning. Documentation updates are included in this workstream.

## Project Structure

### Documentation for this feature

```text
specs/001-admin-appointment-logs/
├── contracts/
│   └── appointment-logs-api.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code

```text
app/admin/appointment-logs/
app/api/admin/appointment-logs/
components/admin/appointment-logs/
components/admin/ui/
hooks/admin/appointment-logs/
lib/appointment-logs/
lib/validation/
docs/
tests/
```

## Documentation Impact

- `docs/specification.md`: required. Add appointment log requirements, data model table, API/UI behavior, acceptance criteria, and correct the stale active-appointment-per-phone invariant.
- `docs/architecture/business-rules.md`: required. Add immutable audit log domain rules.
- `docs/architecture/api.md`: required. Add endpoint inventory note for `GET /api/admin/appointment-logs`.
- `docs/features/admin-appointment-logs-flow.md`: required. New flow document.
- `docs/ui/admin/components.md`: only required during implementation if a new reusable admin UI component is introduced.

## Phases

### Phase 1: Backend and migrations

- Add appointment log persistence model/table.
- Add domain service for writing immutable log events.
- Wire log creation into successful booking, cancellation, approval, and rejection state changes as a side effect after business validation succeeds.
- Add `GET /api/admin/appointment-logs` with filters, pagination, and `format=pdf`.
- Add data and API tests for log creation, filtering, access control, and PDF response contract.

### Phase 2: UI/UX flow

- Add an admin menu item in the admin shell for authenticated admins.
- Create `/admin/appointment-logs` route with admin UI components.
- Create feature hooks for filter state, pagination, loading, error, and export lifecycle.
- Add i18n keys in `es` and `en`.
- Ensure public flow UI remains untouched.

### Phase 3: pruebas y rollout

- Validate the release-cutoff backfill generates baseline rows for existing appointments exactly once.
- Verify new live logs continue after deployment without duplicating the backfilled baseline.
- Run focused domain/API/UI tests.
- Run a manual quickstart flow with authenticated and unauthenticated access.
- Document rollout and rollback behavior.

### Phase 4: cleanup tecnico

- Remove any temporary scaffolding.
- Confirm no ad-hoc admin styles or non-admin UI coupling were introduced.
- Reconcile final implementation into `docs/*`.

## Flow Contract Check

- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- `docs/specification.md` aligned: Yes, updated in this planning package

## Migration Compatibility Check

- Schema changes required: Yes
- Data backfill required: Yes, a one-time historical backfill at release cutoff
- Legacy compatibility required: Yes, existing state-changing API contracts remain unchanged
- Rollback strategy defined: Yes, rollback disables new route/menu/log side effect; backfilled rows remain inert audit data and can be reprocessed with the same cutoff if needed
- Cleanup phase defined: Yes
- Integrity protections defined: Yes, append-only domain/API behavior and restricted access

## Admin UI Check

- Uses components/admin/ui: Required for implementation
- Reused existing components: Required before creating new components
- New reusable components created: Only if repeated admin UI patterns require it
- Tokens respected: Required
- design-system.md aligned: Yes, no design-system changes planned
- Public flow untouched: Yes

## Notification Contract Check

- Sileo used for success/warning/error/info: Not applicable in planning; required if implementation adds admin notifications
- Sileo action notifications used when applicable: Not applicable
- Sileo promise notifications used when applicable: Not applicable
- i18n applied in admin notifications: Required if notifications are added
- Alternative notification systems introduced: No
