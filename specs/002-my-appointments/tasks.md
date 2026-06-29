# Tasks: Public My Appointments

**Input**: Design documents from `/specs/002-my-appointments/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/my-appointments-api.md`.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel
- **[Story]**: Required for user story phases only (`[US1]`, `[US2]`, etc.)

## Phase 1: Setup

- [X] T001 Confirm current public booking/cancel architecture in `app/`, `components/`, `hooks/`, and `lib/`
- [X] T002 Confirm current appointment log schema/service constraints in `prisma/` and `lib/admin/appointment-logs/`
- [X] T003 Lock the public route/API namespace decisions in `specs/002-my-appointments/contracts/my-appointments-api.md`

## Phase 2: Foundational

- [X] T004 Add or update Prisma schema and migration for `appointment_logs` to support `MODIFIED` and schedule snapshots in `prisma/schema.prisma` and `prisma/migrations/*`
- [X] T005 Add snapshot backfill or nullable compatibility handling for existing `appointment_logs` rows
- [X] T006 Create shared public appointment management validation/domain modules in `lib/my-appointments/` and `lib/validation/`
- [X] T007 Add or update appointment log service support for `MODIFIED` in `lib/admin/appointment-logs/`
- [X] T008 Add foundational tests for audit snapshot mapping and `MODIFIED` filtering

## Phase 3: User Story 1 - Consult future appointments (Priority: P1)

- [X] T009 [US1] Add canonical route `app/my-appointments/page.tsx`
- [X] T010 [US1] Add lookup API endpoint(s) under `app/api/my-appointments/`
- [X] T011 [US1] Add public components under `components/my-appointments/` for lookup, list, and detail
- [X] T012 [US1] Add feature hook(s) under `hooks/my-appointments/` for lookup and state orchestration
- [X] T013 [US1] Add domain tests for lookup coverage across statuses, month activity independence, and appointment actionability rules
- [X] T013a [US1] Extend lookup API/domain output with `isBlocked` and `blockedReason` for future appointments that no longer allow public actions
- [X] T013b [US1] Render blocked future appointments in `components/my-appointments/` with explicit warning copy and disabled action state
- [X] T013c [US1] Add API/UI tests for blocked-by-time-window appointments in `/my-appointments`
- [X] T014 [US1] Update root/home links and redirect behavior for `/citas/cancelar`

## Phase 4: User Story 2 - Cancel an eligible appointment from my appointments (Priority: P2)

- [X] T015 [US2] Implement cancellation mutation(s) under `app/api/my-appointments/`
- [X] T016 [US2] Reuse/extend domain cancellation logic so month activity no longer blocks public cancellation from `/my-appointments`
- [X] T017 [US2] Integrate cancellation branch in `components/my-appointments/` and `hooks/my-appointments/`
- [X] T018 [US2] Add API/domain/browser tests for cancellation from `/my-appointments`
- [X] T018a [US2] Decommission or redirect legacy public cancellation API surface (`/api/cancelar*`) so `/api/my-appointments/*` is the canonical public management capability

## Phase 5: User Story 3 - Reschedule an eligible appointment from my appointments (Priority: P3)

- [X] T019 [US3] Implement public reschedule mutation(s) under `app/api/my-appointments/`
- [X] T020 [US3] Add reschedule domain service that preserves `appointments.id` and applies the 3-hour rule
- [X] T021 [US3] Reuse booking-style availability UI for the public reschedule branch without loyalty or 15-day suggestion logic
- [X] T022 [US3] Add calendar sync handling for `CONFIRMED|SYNC_FAILED` source appointments and no-sync handling for `PENDING`
- [X] T023 [US3] Create `MODIFIED` audit events with actor `CLIENT` and previous/new schedule snapshots
- [X] T024 [US3] Add API/domain/browser tests for reschedule success, conflict, window expiry, and sync-failed behavior

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T025 Update `docs/specification.md`, `docs/architecture/business-rules.md`, `docs/architecture/api.md`, `docs/features/my-appointments-flow.md`, `docs/features/cancel-flow.md`, and `docs/features/admin-appointment-logs-flow.md`
- [X] T025a Update booking success copy, deep links, and WhatsApp-generated appointment-management links to point to `/my-appointments`
- [X] T026 Run focused lint/test/e2e commands for public management and appointment logs
- [X] T027 Verify Flow Contract Check and Migration Compatibility Check against implementation reality
- [X] T028 Remove obsolete standalone cancellation-only scaffolding if it no longer owns the flow

## Dependencies & Execution Order

- Setup precedes foundational work.
- Foundational audit/schema work blocks the reschedule story because `MODIFIED` requires durable evidence.
- US1 is required before US2 and US3 because both actions depend on the lookup/detail flow.
- US2 and US3 can proceed in parallel once the shared domain contract is stable.

## Documentation Impact

- This feature changes product behavior, UI flow, route ownership, validation rules, API contracts, persistence expectations, and audit side effects.
- Documentation updates are part of the feature package, not a post-implementation cleanup item.
