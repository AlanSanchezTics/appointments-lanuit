# Appointments La Nuit Constitution

## Core Principles

### I. Docs First
`docs/specification.md` is the permanent source of truth for product behavior.
Any feature spec, plan, or task artifact must reconcile back to `docs/*` before the work is considered complete.

### II. Working Artifacts Are Temporary
`specs/*` is a working area for one change at a time.
Artifacts there support clarification, planning, and execution, but they do not replace `docs/*`.

### III. Flow Changes Must Be Traced
Any change that affects user flow, validations, states, persistence, integrations, or UI/UX must include an explicit documentation impact note.
If the behavior changes, the matching docs must be updated in the same change.

### IV. Keep Layers Separated
Route files stay thin, hooks own interaction/state orchestration, `lib/` owns domain logic, and feature UI stays out of shared primitives.
Admin UI must continue to use `components/admin/ui/` and the admin design system.

### V. Test the Change, Not the Hunch
Feature work must be validated with the narrowest useful tests first, then broader regression checks.
Acceptance criteria must be measurable and independently testable.

## Project Constraints

- Public booking and cancellation flows are separate from admin flows.
- Admin notifications must use `sileo` and `react-i18next`.
- Business rules belong in `docs/architecture/business-rules.md`, not in spec-kit artifacts.
- If a `specs/*` artifact conflicts with `docs/specification.md`, the docs win.

## Development Workflow

1. Clarify the request.
2. Write or update the feature spec under `specs/<feature>/spec.md`.
3. Build the plan and task list from that spec.
4. Implement the change with tests.
5. Sync all affected docs before closing the work.

## Governance

This constitution applies only to this repository.
It supersedes generic Spec Kit defaults when they conflict with the repo's documented contracts.

**Version**: 1.0.0 | **Ratified**: 2026-06-27 | **Last Amended**: 2026-06-27
