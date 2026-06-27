# Spec Kit Adoption

## Summary

Adopt Spec Kit as the per-change workflow layer for this repository.
The repo keeps `docs/specification.md` and the architecture docs as the permanent product contract.

## What Was Added

- `.specify/memory/constitution.md`
- `.specify/templates/overrides/constitution-template.md`
- `.specify/templates/overrides/spec-template.md`
- `.specify/templates/overrides/plan-template.md`
- `.specify/templates/overrides/tasks-template.md`
- `docs/architecture/spec-driven-development.md`
- `specs/README.md`

## What Was Updated

- `AGENTS.md` now includes the Spec Kit workflow policy.
- `README.md` now points to the Spec Kit workflow docs.

## Result

The repository now has:

- a local constitution for spec-driven work
- project-specific templates for generated specs, plans, and tasks
- a durable architecture note explaining how Spec Kit fits into this codebase
- explicit governance that keeps `docs/` ahead of `specs/`
