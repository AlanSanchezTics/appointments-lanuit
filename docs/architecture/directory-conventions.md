# Directory Conventions

## Purpose

Define the architectural intent for directory organization and file placement in this project so new development remains predictable, scalable, and consistent for both human contributors and agents.

This document is normative for new work. It does not require a full repository restructure.

## Core principles

- Organize by responsibility first, then by feature.
- Keep route handlers and pages thin; delegate business rules to domain services.
- Keep UI composition separate from business logic and persistence concerns.
- Prefer feature-scoped modules for flow state and side effects.
- Reuse shared primitives and utilities instead of duplicating logic.
- Adopt conventions incrementally: mandatory for new code, gradual for touched legacy features.

## Directory responsibilities

### app/

`app/` owns Next.js route composition and route-level framework files.

Allowed responsibilities:
- Route entrypoints and page composition (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`).
- Route-level metadata and navigation/redirect decisions.
- Server-side data orchestration to call domain services.

Not allowed responsibilities:
- Business rules, persistence orchestration, or cross-feature domain policies.
- Heavy client-side flow state inside route files.

### app/api/

`app/api/` owns HTTP transport for backend endpoints.

Allowed responsibilities:
- Parse request input.
- Call domain services in `lib/`.
- Map domain errors to stable API contracts (`errorCode`-based responses).
- Return transport-level status codes and payload shape.

Not allowed responsibilities:
- Implement business invariants directly in route handlers.
- Duplicate validation and business policies that already belong to domain/validation layers.

### app/`<feature>`/

Use `app/<feature>/` for feature routes (examples today include localized route names like `citas` and `cancelar`; new features should use consistent English naming).

Convention:
- Route files compose UI and call services.
- Feature-specific UI flows are rendered through `components/<feature>/`.
- Route-specific loading/error boundaries stay in `app/<feature>/`.

### components/

`components/` owns reusable React components grouped by domain and UI intent.

Allowed responsibilities:
- Presentation and interaction rendering.
- Feature UI composition.
- Local visual state.

Not allowed responsibilities:
- Deep orchestration of domain flow if it can be extracted to hooks.
- Persistence or backend business rules.

### components/ui/

`components/ui/` owns shared UI primitives and design-system-level elements.

Convention:
- Components are business-agnostic.
- API is stable and reusable across features.
- No feature terms, endpoint calls, or domain-specific behavior.

### components/`<feature>`/

`components/<feature>/` owns feature-specific UI blocks and screens.

Convention:
- Keep rendering and event wiring in components.
- Move non-trivial state machines, async flow orchestration, and reusable side effects to `hooks/<feature>/`.
- Keep feature naming consistent in English for new additions.

### hooks/

`hooks/` owns reusable hooks that are cross-feature or shared.

Convention:
- `hooks/shared/` (or top-level `hooks/`) is for generic hooks used by multiple features.
- Shared hooks must remain domain-light and composable.
- Shared hooks should not import feature-local components.

### hooks/`<feature>`/

`hooks/<feature>/` owns feature-scoped hooks for flow orchestration.

Required for new code:
- Put feature async orchestration, request lifecycle state, step transitions, and reusable feature effects in hooks.
- Expose minimal APIs to components (state + actions).
- Keep side effects testable and independent from visual markup.

Migration policy:
- Existing large components may remain until touched.
- When a legacy feature is modified functionally, move added or refactored orchestration logic into `hooks/<feature>/`.

### lib/

`lib/` owns non-UI application logic and infrastructure boundaries.

Expected sub-responsibilities:
- Domain services/use cases (`lib/<domain>/`).
- Business and payload validation (`lib/validation/`).
- Persistence/data-access and locking (`lib/db/`).
- External integrations (`lib/calendar/`, `lib/whatsapp/`).
- Shared technical utilities (`lib/datetime/`, `lib/constants/`, `lib/api/`, `lib/i18n/`).

Rule:
- If logic must remain correct independent of React rendering, it belongs in `lib/`.

### Current observations

These are current-state observations, not blockers for new work:
- There is no `hooks/` directory yet.
- Naming is mixed Spanish/English in legacy route and feature paths.
- Some feature components currently concentrate large flow orchestration logic.

## File placement rules

- Place route composition files in `app/` or `app/<feature>/` only.
- Place endpoint handlers in `app/api/<feature>/route.ts` and delegate to `lib/`.
- Place shared visual primitives in `components/ui/`.
- Place feature UI in `components/<feature>/`.
- Place feature flow hooks in `hooks/<feature>/`.
- Place cross-feature hooks in `hooks/shared/` (or `hooks/` when very small).
- Place business rules, data access, and integrations in `lib/`.
- Place schemas and runtime validation in `lib/validation/`.
- Keep tests aligned with responsibility:
  - route/API behavior tests under `tests/app/`
  - domain logic tests under `tests/lib/`
  - end-to-end flows under `tests/e2e/`

## Rules for new features

For every new feature `<feature>`:
- Create route surface in `app/<feature>/`.
- Create feature UI modules in `components/<feature>/`.
- Create feature hooks in `hooks/<feature>/` for non-trivial orchestration.
- Create or extend domain services in `lib/<domain>/`.
- Add matching tests by layer (`tests/app`, `tests/lib`, `tests/e2e` as needed).

Naming policy for new work:
- Use English, lowercase, kebab-case for directory names and file names where applicable.
- Do not rename legacy Spanish routes unless there is an explicit migration task.

Adoption policy:
- Mandatory for new files.
- Gradual for existing code when touched by functional changes.

## Anti-patterns

- Adding business rules directly in `app/api/*` handlers.
- Embedding long-lived flow orchestration and async control logic directly inside large UI components when it can be a feature hook.
- Creating feature-aware components inside `components/ui/`.
- Duplicating validation schemas across features when they can be centralized.
- Mixing persistence calls directly into presentation components.
- Introducing broad one-shot restructuring not required by the current feature.

## Decision guide for new files

Use this decision path:

1. Does it define a route screen/layout/loading/error boundary?
- Place it in `app/...`.

2. Is it an HTTP endpoint handler?
- Place it in `app/api/...` and call `lib/...`.

3. Is it a reusable visual primitive with no domain behavior?
- Place it in `components/ui/...`.

4. Is it UI specific to one feature flow?
- Place it in `components/<feature>/...`.

5. Is it feature state/effects/step orchestration reusable within a feature?
- Place it in `hooks/<feature>/...`.

6. Is it reusable hook logic across multiple features?
- Place it in `hooks/shared/...` (or `hooks/...`).

7. Is it business logic, validation, persistence, or external integration?
- Place it in `lib/...`.
