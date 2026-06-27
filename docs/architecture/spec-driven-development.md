# Spec-Driven Development

## Purpose

This repository uses Spec Kit as a workflow layer for change management.
It helps turn an incoming request into a feature spec, a technical plan, and an executable task list.

The workflow is for implementation discipline only.
It does not replace the product contract stored in `docs/specification.md`.

## Authority Model

The documentation hierarchy for this repo is:

1. `docs/specification.md`
2. `docs/architecture/*.md`
3. `docs/features/*.md`
4. `specs/*`
5. code

If a `specs/*` artifact conflicts with `docs/specification.md`, the docs win.

## Repository Layout

- `.specify/memory/constitution.md`: repository constitution for Spec Kit.
- `.specify/templates/overrides/`: project-specific overrides for generated spec, plan, and task templates.
- `specs/<feature>/`: temporary working artifacts for the change in progress.
- `docs/plans/`: durable records of implementation plans and adoption decisions.

## Workflow

1. Clarify the requested change.
2. Write the feature spec under `specs/<feature>/spec.md`.
3. Resolve ambiguities before planning.
4. Build the technical plan and task list.
5. Implement the change in small, testable steps.
6. Update `docs/specification.md` and any affected architecture or feature docs before closing the work.

## Required Documentation Impact

Any change that affects behavior, data, API contracts, UI flow, validations, states, integrations, or persistence must include an explicit documentation impact note.

At minimum, the note must state:

- whether `docs/specification.md` changes
- which flow or contract changed
- which architecture or feature docs change with it
- whether the update happens before, during, or after implementation

## Practical Use

When Spec Kit is available in the environment, use the local repo defaults in `.specify/` and the repo constitution above.
When it is not available, mirror the same workflow manually:

1. write the spec
2. write the plan
3. break down tasks
4. implement
5. reconcile the docs

## Scope

This workflow applies to all feature work in the repository.
It is especially important for booking, cancellation, admin operations, migrations, and any UI or API contract change.
