# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: `plan.md`, `spec.md`, and any `research.md`, `data-model.md`, `quickstart.md`, or `contracts/` files that exist.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel
- **[Story]**: Required for user story phases only (`[US1]`, `[US2]`, etc.)

## Phase 1: Setup

- [ ] T001 Create or update the working spec directory under `specs/[###-feature-name]/`
- [ ] T002 Capture the implementation plan in `specs/[###-feature-name]/plan.md`

## Phase 2: Foundational

- [ ] T003 Establish shared documentation or scaffolding required by every user story
- [ ] T004 Add any shared tests or fixtures required before feature work can begin

## Phase 3+: User Stories

### User Story 1 - [Title] (Priority: P1)

- [ ] T005 [US1] Implement the first independently testable slice in the relevant source file
- [ ] T006 [US1] Add the narrow test coverage that proves the slice works

### User Story 2 - [Title] (Priority: P2)

- [ ] T007 [US2] Implement the second independently testable slice in the relevant source file
- [ ] T008 [US2] Add the narrow test coverage that proves the slice works

### User Story 3 - [Title] (Priority: P3)

- [ ] T009 [US3] Implement the third independently testable slice in the relevant source file
- [ ] T010 [US3] Add the narrow test coverage that proves the slice works

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T011 Update `docs/specification.md` and any affected `docs/architecture/*` or `docs/features/*` files
- [ ] T012 Run the relevant lint, test, and validation commands

## Dependencies & Execution Order

- Setup precedes all user stories.
- Foundational work blocks all user stories.
- User stories should be independently testable and delivered in priority order.

## Documentation Impact

- Every feature task must indicate whether it changes product behavior.
- If behavior changes, the task set must include the matching docs updates.
