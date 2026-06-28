# Tasks: Admin Appointment Logs

**Input**: Design documents from `/specs/001-admin-appointment-logs/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/appointment-logs-api.md`.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel
- **[Story]**: Required for user story phases only (`[US1]`, `[US2]`, etc.)

## Phase 1: Setup

- [X] T001 Confirm package scripts and test framework from `package.json`
- [X] T002 Review current admin auth/session shape in `lib/`, `app/api/admin/`, and `components/admin/layout/`
- [X] T003 Review current appointment state transition services for booking, cancellation, approval, rejection, and pending cleanup

## Phase 2: Foundational

- [X] T004 Add appointment log persistence model and migration in Prisma/MySQL
- [X] T005 Confirm existing active admin authentication protects the new log route/API without changing the admin user model
- [X] T006 Add appointment log domain service in `lib/appointment-logs/`
- [X] T007 Add appointment log validation/filter schemas in `lib/validation/`
- [X] T008 Add immutable log creation tests for the domain service
- [X] T009 Add unit tests for appointment log action label mapping: `PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`
- [X] T010 Add migration/domain test proving the release-cutoff backfill creates one baseline appointment log row for existing appointments and skips appointments that already have history

## Phase 3: User Story 1 - Consult appointment audit log (Priority: P1)

- [X] T011 [US1] Wire log creation into public booking success for `PENDING` and `CONFIRMED`
- [X] T012 [US1] Wire log creation into admin approval/rejection transitions for `CONFIRMED` and `REJECTED`
- [X] T013 [US1] Wire log creation into public/admin cancellation transitions for `CANCELLED`
- [X] T014 [US1] Wire log creation into automated pending-expiration rejection for `REJECTED` with actor `Sistema`
- [X] T015 [US1] Add test for system-originated `PENDING -> REJECTED` log creation
- [X] T016 [US1] Add authenticated admin guard helper for appointment logs API/UI
- [X] T017 [US1] Implement `GET /api/admin/appointment-logs` JSON mode in `app/api/admin/appointment-logs/route.ts`
- [X] T018 [US1] Add admin route `app/admin/appointment-logs/page.tsx`
- [X] T019 [US1] Add feature UI components under `components/admin/appointment-logs/`
- [X] T020 [US1] Add feature hook under `hooks/admin/appointment-logs/`
- [X] T021 [US1] Add appointment logs menu item in the admin shell for authenticated admins
- [X] T022 [US1] Add API and UI access-control tests for authenticated active admin, unauthenticated user, and inactive admin login/session behavior

## Phase 4: User Story 2 - Filter appointment audit evidence (Priority: P2)

- [X] T023 [US2] Implement filter support by client name/phone, action date, and action type in `lib/appointment-logs/`
- [X] T024 [US2] Implement pagination metadata, `pageSize` bounds (`1..100`), default `pageSize=20`, and default sorting by action date descending
- [X] T025 [US2] Add UI filter controls using `components/admin/ui/`
- [X] T026 [US2] Add filter, pagination, and pagination-bound tests for API/domain behavior
- [X] T027 [US2] Add i18n keys for filter UI, table headers, empty, loading, and error states in `es` and `en`

## Phase 5: User Story 3 - Export filtered audit evidence as PDF (Priority: P3)

- [X] T028 [US3] Implement `format=pdf` mode in `GET /api/admin/appointment-logs`
- [X] T029 [US3] Generate PDF with visible columns, applied filters, generation timestamp, and empty state
- [X] T030 [US3] Enforce PDF export row limit of `1,000` rows and return `EXPORT_LIMIT_EXCEEDED` with HTTP `422` when exceeded
- [X] T031 [US3] Add export action in the admin UI using the same active filters
- [X] T032 [US3] Add API tests for PDF headers, authorization, validation errors, filtered output behavior, and `EXPORT_LIMIT_EXCEEDED`

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T033 Verify `docs/specification.md`, `docs/architecture/business-rules.md`, `docs/architecture/api.md`, and `docs/features/admin-appointment-logs-flow.md` remain aligned with implementation
- [X] T034 Run focused tests and project lint/typecheck commands
- [X] T035 Execute the quickstart validation flow from `specs/001-admin-appointment-logs/quickstart.md`, including the release-cutoff backfill step
- [X] T036 Confirm no public flow UI changes and no ad-hoc admin styling were introduced

## Dependencies & Execution Order

- Setup precedes all implementation.
- Foundational persistence/auth/domain work blocks all stories.
- US1 is the minimum viable audit capability.
- US2 depends on US1 list retrieval.
- US3 depends on US2 filter semantics.

## Documentation Impact

- This feature changes product behavior by adding audit log persistence, admin UI, and API/PDF contracts.
- Documentation updates are part of the feature package and must be reconciled after implementation.
