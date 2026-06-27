# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary

[Extract from feature spec: primary requirement + technical approach]

## Technical Context

**Language/Version**: [e.g., TypeScript 5.x or NEEDS CLARIFICATION]
**Primary Dependencies**: [e.g., Next.js, Prisma, React, or NEEDS CLARIFICATION]
**Storage**: [e.g., MySQL, files, or N/A]
**Testing**: [e.g., Vitest, Playwright, or NEEDS CLARIFICATION]
**Target Platform**: [e.g., web app, admin dashboard, or NEEDS CLARIFICATION]
**Project Type**: [web application]
**Performance Goals**: [domain-specific or NEEDS CLARIFICATION]
**Constraints**: [domain-specific or NEEDS CLARIFICATION]
**Scale/Scope**: [domain-specific or NEEDS CLARIFICATION]

## Constitution Check

GATE: Must pass before design and again before implementation.

- `docs/specification.md` remains the source of truth for behavior.
- `docs/architecture/business-rules.md` remains the source of truth for domain rules.
- `docs/features/*` stays aligned with the flow it documents.
- `specs/*` is a temporary working area, not the canonical contract.

## Project Structure

### Documentation for this feature

```text
specs/[###-feature]/
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code

```text
app/
components/
hooks/
lib/
docs/
tests/
```

## Documentation Impact

- Record whether `docs/specification.md` must change.
- Record which architecture or feature docs must change.
- Record whether any route/API/UI contract changes are required.
- Include the documentation update in the implementation sequence, not as an afterthought.

## Phases

### Phase 0: Research

- Resolve unclear requirements.
- Capture decisions and assumptions in `research.md`.
- Confirm whether the change affects behavior, data, API contracts, UI flow, or integrations.

### Phase 1: Design & Contracts

- Define data model or state changes.
- Define external contracts or route changes if needed.
- Draft `quickstart.md` with validation scenarios.

### Phase 2: Implementation

- Break work into small, testable steps.
- Keep route files thin.
- Put flow state in hooks and domain behavior in `lib/`.
- Add tests alongside the layer they protect.

### Phase 3: Validation & Rollout

- Run the relevant tests.
- Verify the docs delta is complete.
- Confirm the feature is independently demonstrable.

### Phase 4: Cleanup

- Remove temporary scaffolding.
- Keep only the durable docs and code needed by the repo.

## Flow Contract Check

- UI steps updated: [Yes/No]
- API contract updated: [Yes/No]
- Validation rules updated: [Yes/No]
- Acceptance criteria updated: [Yes/No]
- `docs/specification.md` aligned: [Yes/No]

## Migration Compatibility Check

- Schema changes required: [Yes/No]
- Data backfill required: [Yes/No]
- Legacy compatibility required: [Yes/No]
- Rollback strategy defined: [Yes/No]
- Cleanup phase defined: [Yes/No]
- Integrity protections defined: [Yes/No]
