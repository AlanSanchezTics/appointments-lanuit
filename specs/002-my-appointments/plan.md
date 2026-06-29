# Implementation Plan: Public My Appointments

**Branch**: `002-my-appointments` | **Date**: 2026-06-28 | **Spec**: `specs/002-my-appointments/spec.md`

**Input**: Feature specification from `/specs/002-my-appointments/spec.md`

## Summary

Replace the public cancellation-only route with a unified `/my-appointments` flow that lets clients look up future appointments by phone, including appointments already blocked by public time-window rules, inspect the selected appointment state, cancel eligible appointments, and reschedule eligible appointments without support. Reschedule preserves the same appointment record, uses booking-style availability selection, skips `isLoyal` and 15-day suggestion logic, adds a `MODIFIED` audit event with historical schedule snapshots, and preserves the public WhatsApp success patterns for cancellation and reschedule.

## Technical Context

**Language/Version**: TypeScript / Next.js App Router  
**Primary Dependencies**: Next.js, React, Prisma ORM, i18next/react-i18next, existing booking and cancel feature modules  
**Storage**: MySQL via Prisma  
**Testing**: Vitest + Playwright (`npm run test`, `npm run test:e2e`)  
**Target Platform**: Public web flow  
**Project Type**: web application  
**Performance Goals**: Phone lookup should return future appointments with stable actionability metadata (`canCancel`, `canModify`, `isBlocked`, `blockedReason`) without adding a second eligibility engine; reschedule availability should reuse existing month/day availability endpoints and slot rules without adding duplicate availability engines.  
**Constraints**: Public flow only, no admin UI components, no `isLoyal` or 15-day suggestion logic in client reschedule, keep same `appointments.id` on reschedule, support `PENDING|CONFIRMED|SYNC_FAILED` modify eligibility, keep route files thin and move orchestration to hooks/lib.  
**Scale/Scope**: One new public route, new public APIs, route redirects, audit model expansion, and documentation alignment.

## Constitution Check

GATE: Must pass before design and again before implementation.

- `docs/specification.md` remains the source of truth for behavior.
- `docs/architecture/business-rules.md` remains the source of truth for domain rules.
- `docs/features/*` stays aligned with the flow it documents.
- `specs/*` is a temporary working area, not the canonical contract.

Status: PASS for planning. The docs delta is explicit and included in this workstream.

## Project Structure

### Documentation for this feature

```text
specs/002-my-appointments/
├── contracts/
│   └── my-appointments-api.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code

```text
app/my-appointments/
app/api/my-appointments/
components/my-appointments/
hooks/my-appointments/
lib/my-appointments/
lib/appointments/
lib/admin/appointment-logs/
docs/
tests/
```

## Documentation Impact

- `docs/specification.md`: required. Replace the standalone public cancellation contract with the unified `/my-appointments` flow and update home/booking references.
- `docs/architecture/business-rules.md`: required. Add public management rules and expand audit rules for `MODIFIED`.
- `docs/architecture/api.md`: required. Add `/api/my-appointments/*` capability contracts and expand admin appointment log filtering/action types.
- `docs/features/my-appointments-flow.md`: required. New flow document.
- `docs/features/cancel-flow.md`: required. Re-scope as the cancellation branch inside `/my-appointments`.
- `docs/features/admin-appointment-logs-flow.md`: required. Add `MODIFIED` plus previous/new schedule evidence.

## Phases

### Phase 1: backend y migraciones

- Add the `/api/my-appointments/*` capability namespace and domain services for lookup, cancel, and reschedule.
- Add/extend validation schemas for public appointment management.
- Expand `appointment_logs` persistence to support `MODIFIED` and schedule snapshots needed for historical evidence.
- Define migration/backfill strategy for existing `appointment_logs` rows so schedule evidence remains readable after the schema evolves.
- Add domain and API tests for lookup eligibility, cancellation, and reschedule rules.

### Phase 2: UI/UX flow

- Add `app/my-appointments/page.tsx`.
- Build the public lookup/detail/action flow using feature-specific components and hooks.
- Render blocked future appointments with a visible warning when no public action remains available because of the time window.
- Reuse booking-style schedule selection for the reschedule branch without coupling to booking’s 15-day suggestion or loyalty-specific confirm behavior.
- Redirect `/citas/cancelar` to `/my-appointments` and update root/home entry points.
- Keep the public design system isolated from admin UI components.

### Phase 3: pruebas y rollout

- Run focused Vitest coverage for lookup, cancel, reschedule, and audit side effects.
- Add or update Playwright coverage for `/my-appointments` browser behavior and the redirect from `/citas/cancelar`.
- Validate the migration path for `appointment_logs` snapshots and `MODIFIED`.
- Verify Google Calendar behavior for `PENDING`, `CONFIRMED`, and `SYNC_FAILED` reschedules.

### Phase 4: cleanup técnico

- Remove obsolete standalone cancellation-only scaffolding where it no longer owns the public flow.
- Confirm public copy, route links, and success links consistently point to `/my-appointments`.
- Reconcile final implementation into `docs/*`.

## Flow Contract Check

- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- `docs/specification.md` aligned: Yes, updated in this planning package

## Migration Compatibility Check

- Schema changes required: Yes
- Data backfill required: Yes, for existing `appointment_logs` rows if schedule snapshot fields become required/non-null or for populating legacy evidence
- Legacy compatibility required: Yes, route compatibility for `/citas/cancelar` redirect to `/my-appointments`
- Rollback strategy defined: Yes, rollback can disable the new route/API surface and preserve legacy redirects while keeping added audit schema inert
- Cleanup phase defined: Yes
- Integrity protections defined: Yes, same-record reschedule semantics, audit append-only rules, and transaction-safe availability validation

## Admin UI Check

- Uses components/admin/ui: No
- Reused existing components: Not applicable for public flow
- New reusable components created: Likely under public feature folders only
- Tokens respected: Yes, public flow tokens only
- design-system.md aligned: Yes, admin design system untouched
- Public flow untouched: No, this feature explicitly changes the public flow

## Notification Contract Check

- Sileo used for success/warning/error/info: Not applicable
- Sileo action notifications used when applicable: Not applicable
- Sileo promise notifications used when applicable: Not applicable
- i18n applied in admin notifications: Not applicable
- Alternative notification systems introduced: No
