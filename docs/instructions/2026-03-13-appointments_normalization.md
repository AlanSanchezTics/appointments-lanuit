**First inspect the repository and supporting docs. Do not produce the final plan until you have identified the real stack, data layer, booking entrypoints, and validation approach used by the codebase.**

## Mandatory Instructions

You are and Agent operating as a senior software architect and implementation planner inside an IDE.

Your task is **not to implement code yet**. Your task is to analyze the requested feature, inspect the existing codebase and docs, identify all impacted backend and frontend layers, detect ambiguities or risks, and produce a **complete execution plan** that will be implemented later.

Use `docs/specification.md` as the primary source of truth for the application's functionality, rules, flows, business context, and UX constraints. If you detect any contradiction between this prompt and `docs/specification.md`, explicitly document it in your plan and propose the safest resolution.

## Feature context

Currently, the booking flow stores confirmed appointments directly in the `appointments` table.

Current `appointments` columns:

- `id`
- `name`
- `phone`
- `date`
- `timeSlot`
- `status`
- `googleEventId`
- `createdAt`
- `updatedAt`

Current booking flow:

1. User lands on the current month.
2. User selects an available day.
3. User selects an available time slot.
4. User enters name and phone number.
5. When advancing to the confirmation step, backend creates a temporary slot lock (`TTL = 10 minutes`).
6. If the lock cannot be created because the slot is already booked or temporarily locked, the user must choose another slot.
7. User confirms the appointment.
8. Backend:
   - Starts a transaction.
   - Cleans expired locks.
   - Validates an active temporary lock (`lock_token`) for date / slot / phone.
   - Validates availability.
   - Inserts a `CONFIRMED` appointment.
   - Deletes the consumed temporary lock.
   - Commits.
9. Backend creates a Google Calendar event.
10. User is redirected to WhatsApp with an encoded message.

Current issue:

- With the current schema, multiple records can exist with the same `name` and `phone`.

## Desired feature

Implement a client normalization strategy and update the booking experience so the backend model and the UI flow both reflect client reuse.

### Data model goals

- Create a new `clients` table to store unique client information.
- Each client record must represent a unique person.
- `clients` must store at least the client's name and phone number.
- Modify `appointments` so it no longer stores `name` and `phone` directly.
- Instead, `appointments` must store a foreign key `clientId` pointing to `clients`.
- During booking, the system must check whether the client already exists in `clients`.
- Client lookup must be performed **only by phone number**.
- If a client with the same phone number exists, reuse its `clientId` when creating the appointment.
- If no client exists for that phone number, create a new client and then use the new `clientId` for the appointment.
- The flow must prevent duplicate client records for the same phone number.
- Add validation rules to ensure the provided phone number is valid and matches the expected 10-digit format before persisting data.

### Updated booking and UX flow

The booking flow must be updated to the following target behavior:

1. User lands on the current month.
2. User selects an available day.
3. User selects an available time slot.
4. User enters a **10-digit phone number**.
5. When advancing to the next step, the phone number is sent to the backend for prior existence validation:
   - If the client already exists, advance directly to the confirmation step.
   - If the client does not exist, show the user a `name` input field and a primary action button labeled **"Siguiente"** so the user can then advance to the confirmation step.
6. For both cases, backend creates a temporary slot lock (`TTL = 10 minutes`).
7. If the lock cannot be created because the slot is already booked or temporarily locked, the user must choose another slot.
8. User confirms the appointment.
9. Backend:
   - Starts a transaction.
   - Cleans expired locks.
   - Validates an active temporary lock (`lock_token`) for date / slot / phone.
   - Validates availability.
   - Inserts a `CONFIRMED` appointment.
   - Deletes the consumed temporary lock.
   - Commits.
10. Backend creates a Google Calendar event.
11. User is redirected to WhatsApp with an encoded message.

## Critical UX requirements

- The plan must impact **both backend and UI/UX**.
- The solution must **respect current UI styles**.
- Reuse existing UI components whenever feasible to preserve visual consistency and reduce unnecessary refactors.
- Do not propose a redesign unless the codebase proves the current flow cannot support the feature safely.
- The plan must explicitly describe:
  - step transitions
  - conditional rendering of the `name` field
  - validation states
  - loading states
  - error states
  - lock conflict recovery UX
  - back navigation behavior
  - how the confirmation screen should behave in both cases (existing client vs new client)
- Preserve the current visual language, spacing, interaction patterns, and component conventions already present in the booking flow.

## Critical planning requirements

Your output must be a **planning artifact**, not code implementation.

Before proposing the plan, inspect the codebase and identify:

- data access layer / ORM / query builder / migrations tooling in use
- booking flow entrypoints
- lock creation and lock validation flow
- validation layer
- calendar integration layer
- API routes, services, controllers, actions, or handlers involved
- UI screens, steps, forms, state containers, hooks, and reusable components involved
- navigation / stepper logic involved in the booking process
- any tests already covering booking, locks, appointments, form validation, or persistence behavior

## Main goals

Produce a plan that is:

- technically precise
- UX-aware
- incremental
- safe for production data
- resilient to race conditions
- explicit about migration strategy
- explicit about backward compatibility risks
- explicit about validation behavior
- explicit about testing strategy
- explicit about UI states and transitions

## What you must do

1. Read and use `docs/specification.md` as context.
2. Inspect the codebase to understand the current architecture and current booking flow across backend and frontend.
3. Infer the exact impacted files, modules, schemas, services, routes, UI screens, components, hooks, and tests.
4. Produce a detailed implementation plan for the feature.
5. Highlight ambiguities, hidden risks, and assumptions.
6. Propose a migration and rollout strategy.
7. Define acceptance criteria for both system behavior and UI behavior.
8. Do **not** write production code yet unless explicitly asked later.

## Specific planning expectations

Your plan must cover, at minimum:

### 1) Current-state analysis

- How the booking flow works today end to end across frontend and backend.
- Where temporary slot locks are created and validated.
- Where `appointments` records are created.
- Where Google Calendar events are created.
- How form validation currently works.
- How booking step navigation currently works.
- Whether there are existing assumptions in the code that still expect `appointments.name` and `appointments.phone`.
- Whether the current UI architecture can support conditional steps without breaking style consistency.

### 2) Data model changes

Define the proposed schema evolution for:

- new `clients` table
- new `appointments.clientId` foreign key
- treatment of old `appointments.name` and `appointments.phone` fields

You must explicitly address:

- unique constraint strategy for `clients.phone`
- nullability decisions
- indexes needed
- foreign key behavior
- whether legacy columns should be removed immediately or through a phased migration
- how to normalize phone numbers before lookup and persistence

### 3) Booking flow changes

Explain the exact new logical flow across UI and backend:

- validate and normalize phone input
- submit phone for existence check
- decide whether to reveal the `name` field
- handle the `"Siguiente"` action for new clients
- create temporary lock at the correct moment for both branches
- handle lock creation failure
- preserve confirmation step behavior
- create appointment linked to `clientId`
- preserve Google Calendar event creation
- store `googleEventId` correctly
- preserve current booking semantics unless a justified change is needed

### 4) UI/UX flow changes

You must explicitly plan:

- whether the flow remains the same number of visible steps or introduces a conditional intermediate state
- how the phone step behaves for an existing client
- how the phone step expands or transitions when the client is new
- whether the `name` field is inline, progressive disclosure, or a distinct sub-step
- button labels and state transitions
- loading indicators during backend phone validation
- inline validation for invalid phone format
- messaging when slot lock fails after the phone validation step
- how back navigation affects previously entered phone / name data
- whether previously entered state should persist if the user goes back to select another slot
- how to preserve style consistency using existing components and patterns
- which existing components can be reused versus where a narrowly scoped new component is justified

### 5) Concurrency and duplicate prevention

You must explicitly address race conditions such as:

- two bookings arriving at nearly the same time with the same new phone number
- duplicate client creation attempts
- lock creation timing issues between phone validation and confirmation
- stale UI state caused by lock expiration
- user spending too long before confirming after the lock is created

Describe the safest strategy, for example:

- normalized unique index on phone
- transaction boundaries
- upsert / connect-or-create pattern if supported by the stack
- fallback handling if unique constraint violations happen under concurrent requests
- UI handling when lock TTL expires before confirmation

### 6) Migration strategy for existing data

You must include a safe migration plan for existing production data:

- how existing `appointments` rows with `name` and `phone` will map to `clients`
- how duplicates will be consolidated when multiple appointments share the same phone
- what happens if names differ for the same phone across old records
- whether backfill should choose the earliest, latest, or another rule for canonical client name
- step ordering for schema migration, data backfill, code rollout, and cleanup
- rollback considerations

### 7) Validation rules

Define the phone validation expectations:

- accepted formats at input time
- enforcement of the 10-digit requirement
- normalization format used internally
- rejection behavior for invalid input
- how validation errors should surface to the caller / UI
- whether formatting characters are allowed in the UI and stripped before submission, or whether only raw digits are accepted

If the expected format is not explicit in the codebase or docs, call it out as an ambiguity and propose a conservative default aligned with the new requirement.

### 8) Impact analysis

List all code areas likely to require changes, for example:

- database schema / migrations
- ORM models / types
- booking service / controller / action
- request validation schemas
- lock creation endpoint or equivalent
- booking confirmation endpoint or equivalent
- UI forms
- stepper / multi-step flow logic
- state containers / hooks
- Google Calendar integration inputs
- admin or reporting screens
- tests
- seed data / fixtures
- documentation

### 9) Testing strategy

Propose tests at the appropriate levels:

- unit tests
- integration tests
- end-to-end tests if applicable

Include at least these scenarios:

- booking with a new 10-digit phone creates a new client and appointment
- booking with an existing phone reuses the existing client
- invalid phone is rejected before progressing
- new client path reveals the name field and requires it before confirmation
- existing client path skips name entry and reaches confirmation directly
- lock conflict is handled correctly in UI and backend
- concurrent requests do not create duplicate clients
- Google Calendar event creation still works
- lock expiration is handled correctly if the user delays confirmation
- legacy appointment reads do not break during rollout, if relevant

### 10) Acceptance criteria

Provide a concrete checklist of observable outcomes that would prove the feature is correctly implemented across backend and UI.

### 11) Open questions / assumptions

Include a final section with:

- unresolved ambiguities
- assumptions made
- decisions that should be confirmed before implementation

## Output format

Return your answer in the following exact structure:

# Feature Planning Report

## 1. Summary

A concise summary of the feature and implementation intent.

## 2. Current System Understanding

What exists today, based on the docs and codebase.

## 3. Gaps, Risks, and Ambiguities

Bullet list of important findings.

## 4. Proposed Data Model

Detailed schema-level proposal.

## 5. Backend Flow Changes

Step-by-step future backend flow.

## 6. UI/UX Flow Changes

Step-by-step future user flow, states, transitions, and component strategy.

## 7. Migration and Rollout Plan

Phased plan with ordering and rollback notes.

## 8. Concurrency and Data Integrity Strategy

How duplicates, lock timing issues, and race conditions will be prevented.

## 9. Validation Strategy

Phone validation and normalization decisions.

## 10. Impacted Areas

Concrete files/modules/layers to update.

## 11. Test Plan

Recommended test coverage and scenarios.

## 12. Acceptance Criteria

Checklist.

## 13. Open Questions

Anything that needs confirmation.

## 14. Implementation Task Breakdown

A sequenced task list suitable for later execution in the IDE.

## Additional execution rules

- Be concrete. Avoid generic advice.
- Ground all findings in the actual repository structure.
- Prefer the safest reversible migration strategy.
- Respect the current UI style system and existing components unless a change is clearly necessary.
- Do not assume the stack; inspect it first.
- Do not silently invent nonexistent files or modules. If something cannot be found, state it explicitly.
- Do not implement code yet.
- Do not skip migration details.
- Do not skip concurrency protections.
- Do not skip UI state and navigation details.
- When uncertain, document the uncertainty and propose options with tradeoffs.
