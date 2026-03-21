# Routing Architecture

## Purpose

Define the normative routing architecture for this project using Next.js App Router.

This document establishes how routing must be organized, how feature route surfaces must grow inside `app/`, and what responsibilities belong to the routing layer versus components, hooks, and `lib`.

This is a forward-looking architecture contract. It is not a route inventory.

## Routing Model

The project uses a feature-oriented App Router model with two routing surfaces inside `app/`:

- UI routes: user-facing screens and flow entrypoints.
- API routes: HTTP transport endpoints under `app/api`.

Routing is the composition boundary, not the business-logic layer.

Routing layer responsibilities:

- Declare URL structure and route segments.
- Resolve route params and search params.
- Perform route-level navigation concerns (redirects, `notFound`, route-level metadata).
- Compose feature screens and pass route context.
- Orchestrate calls to domain services when needed at route level.

Routing layer must not:

- Implement business rules or persistence policies.
- Become the source of truth for feature state machines.
- Duplicate validation rules that already exist in domain/validation layers.

## Feature-Based Routing

A feature in routing terms is a coherent user or system capability exposed through one or more URL segments.

Examples today include reservation and cancellation flows, but the convention is generic and applies to any future feature.

Feature routing rules:

- Each feature owns its route namespace at `app/<feature>/`.
- Feature namespace must remain cohesive: only pages/endpoints that belong to the same capability should live there.
- Cross-feature shared behavior must not be solved by mixing route trees; share logic through `components`, `hooks`, or `lib`.
- New feature route names should use English, lowercase, kebab-case.
- Legacy localized paths may remain until there is an explicit migration task.

## Route Structure Conventions

### 1) Feature root

Use `app/<feature>/page.tsx` (or `page.jsx`) as the feature entry route.

- It should define the first screen/state of that feature.
- It can redirect to a default child route when the feature requires a canonical starting subflow.

### 2) Subroutes

Create subroutes when a feature has distinct screens/states with stable URLs:

- `app/<feature>/<subroute>/page.tsx`
- `app/<feature>/<subroute>/<step>/page.tsx` when URL-addressable steps are needed.

Subroutes should represent navigable states, not arbitrary component decomposition.

### 3) Route-level framework files

Within a feature segment, use route-level files only for route concerns:

- `layout.tsx`: shared route shell/layout for that segment subtree.
- `loading.tsx`: route-level pending UI.
- `error.tsx`: route-level recovery boundary.
- `not-found.tsx`: route-specific not-found behavior.

Do not use these files to host business workflows.

### 4) API routing under App Router

Use `app/api/<feature>/.../route.ts` for endpoint transport.

- Segment hierarchy should mirror endpoint capability, not internal implementation details.
- Keep nested segments meaningful (resource/action), not ad-hoc verbs.
- Route handlers must remain thin adapters to domain services.

## Dynamic Routes

Dynamic segments are allowed when the URL identifies a variable resource or scoped context.

Conventions:

- Use bracket notation: `app/<feature>/[param]/page.tsx`.
- Use semantic param names (`[month]`, `[id]`, `[slug]`, `[appointmentId]`) rather than generic names.
- Param format validation belongs in domain validation/service layers; routing may short-circuit invalid cases with `notFound` or stable error responses.
- Do not encode multiple independent variables in one segment if they can be modeled as separate path or query parameters.

Guidelines:

- Use a dynamic segment when the value is part of route identity.
- Use query string for optional filters/sorting/view state.
- Keep dynamic depth shallow; if depth grows, reconsider feature boundaries.

## Responsibilities of Page Files

`page.tsx`/`page.jsx` files are route entrypoints and must stay thin.

Required responsibilities:

- Read route params/search params.
- Perform route-level guards/redirects/not-found decisions.
- Fetch or orchestrate route data through domain services.
- Compose feature UI by rendering components.

Forbidden responsibilities:

- Embedding complex multi-step client flow orchestration that belongs in feature hooks.
- Re-implementing business invariants already defined in `lib`.
- Direct persistence/integration logic.

Rule of thumb: if logic must remain correct independently of the URL/render tree, it does not belong in `page` files.

## Boundaries with Other Layers

Routing boundaries must remain explicit:

- `app/`: URL composition, route boundaries, route entrypoints.
- `components/<feature>/`: feature UI composition and interaction rendering.
- `hooks/<feature>/`: reusable feature flow orchestration, async lifecycle, transitions.
- `hooks/shared` or `hooks/`: cross-feature reusable hook primitives.
- `lib/`: business rules, validation, persistence, integrations, domain services.

Dependency direction:

- `app/*` may depend on `components`, `hooks`, and `lib`.
- `components` may depend on `hooks` and `lib` through stable APIs.
- `lib` must not depend on route files.

## Rules for New Routes

When adding a new route, apply these rules:

1. Decide feature ownership first.
   - Create or extend `app/<feature>/`.
   - Avoid placing feature screens at `app/` root unless they are global entry routes.

2. Define URL intent.
   - Path segments for identity and hierarchy.
   - Query params for optional modifiers.

3. Keep route files minimal.
   - Resolve params.
   - Call domain services.
   - Compose UI.

4. Place non-routing logic in the correct layer.
   - UI pieces in `components/<feature>/`.
   - Flow orchestration in `hooks/<feature>/`.
   - Domain rules in `lib/`.

5. Keep API routes capability-oriented.
   - Group endpoints under `app/api/<feature>/`.
   - Maintain stable response contracts and error codes.

6. Add route boundaries intentionally.
   - Introduce `layout/loading/error/not-found` only when segment-level behavior is required.

7. Protect future growth.
   - Prefer clear, semantic segment names.
   - Avoid deeply nested route trees for simple flows.

## Anti-Patterns

- Treating `app/` as a generic place for business logic.
- Adding feature business rules directly inside `route.ts` handlers.
- Creating subroutes for purely visual composition that is not URL-worthy.
- Encoding multiple states in one opaque dynamic segment.
- Mixing unrelated capabilities under one feature route namespace.
- Copy-pasting the same validation/guard logic across multiple route files.
- Using route files as long-lived client workflow state containers.
- Growing API route paths around implementation details instead of domain capability.
