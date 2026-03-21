# API Architecture

## Purpose

Define the normative architecture for the API layer implemented with Next.js Route Handlers under `app/api`.

This document establishes how API endpoints must be structured, what responsibilities belong to route handlers, what must be delegated to domain layers, and how the API should scale as new features are added.

This is an architecture contract, not an endpoint inventory.

---

## API Role in the System

The API layer is the HTTP transport boundary between clients and application domain services.

Inside this project architecture, `app/api` exists to:

- expose feature capabilities through stable HTTP contracts
- translate HTTP input/output into domain service calls
- map domain errors into consistent API error responses
- enforce transport-level concerns (methods, status codes, payload shape)

The API layer mirrors feature boundaries defined in the routing layer (e.g., booking, cancel), ensuring alignment between user-facing flows and backend capabilities.

The primary consumers of the API layer are feature-level hooks (`hooks/<feature>`), which orchestrate UI interaction and data flow between the frontend and the API.

`app/api` is not the source of truth for business rules, data integrity, or workflow state machines.

---

## API Design Principles

- Thin handler principle: route handlers must stay small and orchestration-focused.
- Feature ownership: endpoints are grouped by business capability, not by technical layer.
- Domain-first correctness: business invariants and validation rules live in `lib/*` and must be reusable outside HTTP.
- Contract stability: response and error shapes must remain predictable for UI and external consumers.
- Explicit error semantics: domain failures must map to deterministic `errorCode` values and status codes.
- Incremental evolution: new endpoints should extend existing capability namespaces before creating parallel trees.
- Backward compatibility by intent: deprecation paths must be explicit and machine-detectable.

---

## Endpoint Organization

Use capability-oriented namespaces under `app/api/<feature>/...`.

Organization rules:

- Group endpoints by feature capability, not by database entity names or internal implementation details.
- Keep segment names semantic and durable (`<resource>`, `<action>`, `<scope>`), avoiding ad-hoc naming.
- Prefer shallow, readable paths; add nesting only when it models a real capability boundary.
- Allow transitional legacy paths only when there is a defined migration/deprecation strategy.
- Keep route files method-centric (`GET`, `POST`, `DELETE`, etc.) and colocate only methods for the same route contract.

---

## Responsibilities of Route Handlers

A route handler is an HTTP adapter.

Required responsibilities:

- Read and parse request input (`params`, query, body).
- Perform minimal transport-level guards (method contract, required payload presence, basic coercion).
- Call one or more domain services in `lib/*` to execute use cases.
- Map known domain error codes to HTTP status codes.
- Return JSON payloads with stable success/error shapes.

Allowed but limited:

- Route-local branching required to map transport semantics (for example, conflict vs validation status code).
- Temporary endpoint deprecation responses with explicit error codes.

Not allowed:

- Implementing business rules directly in handler code.
- Writing database queries directly from `app/api`.
- Embedding lock management, scheduling policy, or cross-entity invariants in handlers.
- Duplicating domain validations already defined in `lib/validation` or domain services.
- Returning ad-hoc error formats per endpoint.

---

## Boundaries with Business Logic

Boundary contract by layer:

- `app/api/*`: HTTP transport adapter and contract mapping.
- `lib/validation/*`: schema/runtime validation and domain-safe input parsing.
- `lib/<domain>/*`: use cases, business invariants, transactional orchestration.
- `lib/db/*`: persistence primitives and data-access operations.
- `lib/integrations/*` (calendar, messaging, etc.): external side effects.

Dependency direction:

- `app/api` may depend on `lib/*`.
- `lib/*` must not depend on `app/api`.

Decision rule:
If a piece of logic must stay correct when invoked from non-HTTP contexts (jobs, scripts, tests, future transports), it belongs in `lib`, not in route handlers.

---

## Input Validation

Validation must be layered and centralized.

Rules:

- Handlers may parse raw payload (`request.json()`) and pass it as `unknown` or typed input into domain services.
- Canonical validation (schema + business constraints) must be executed in `lib/validation` and/or domain services.
- Validation errors must normalize to a stable error code (for example `VALIDATION_ERROR`) and consistent response shape.
- Avoid duplicating schema definitions across handlers.
- Path/query parameter format checks that affect route resolution are acceptable at handler level, but business meaning validation remains in domain.

---

## Response and Error Conventions

API responses must be deterministic and contract-driven.

Success conventions:

- Use JSON responses for all handlers.
- Use status codes by operation semantics:
  - `200` for successful reads/mutations without resource creation.
  - `201` for successful creation-like operations.
  - `410` for intentionally deprecated endpoints that should no longer be used.
- Return only fields needed by the client contract; avoid leaking internal persistence models.

Error conventions:

- Error payload shape must be stable:
  - `errorCode`: machine-readable code
  - `error`: same code or stable human-safe alias
- Map domain codes to HTTP status deterministically:
  - `400` malformed input/domain precondition failures
  - `404` resource not found
  - `409` state conflict (lock collisions, already-booked, invalid state transition)
  - `422` semantic input that is well-formed but not processable for the requested operation
- Unknown/unhandled errors must normalize to a generic machine code and avoid leaking internals.

---

## Rules for New Endpoints

1. Define capability ownership first.
   - Add endpoints under the feature namespace that owns the use case.

2. Design the contract before code.
   - Define method, input shape, success payload, error codes, and status mapping.

3. Keep handlers thin.
   - Parse input, call domain service, map result/error, return response.

4. Implement domain behavior in `lib`.
   - Add or extend service modules, validation schemas, and db/integration adapters there.

5. Reuse shared API helpers.
   - Use centralized error normalization/response builders for consistency.

6. Make deprecations explicit.
   - Keep legacy routes only with clear deprecation error code and migration target.

7. Add tests by layer.
   - API contract tests for status/payload mapping.
   - Domain tests for business rules and invariants.

8. Document contract evolution.
   - Update architecture/specification docs when behavior, workflow contract, or error semantics change.

---

## Evolution and Versioning Considerations

- Avoid introducing versioning (`/v1`, `/v2`) unless strictly necessary.
- Prefer evolving contracts in a backward-compatible way.
- When breaking changes are unavoidable:
  - introduce parallel endpoints temporarily
  - mark deprecated endpoints explicitly (e.g., `410` with deprecation error code)
  - define a migration path
- API evolution must remain predictable for consumers (UI hooks or external integrations).

---

## Anti-Patterns

- Treating `app/api` as a business-logic layer.
- Adding direct Prisma/database queries inside route handlers.
- Copy-pasting validation rules across multiple handlers.
- Returning endpoint-specific custom error shapes without `errorCode`.
- Encoding business workflow transitions only in HTTP status branching.
- Creating endpoint trees around internal implementation details.
- Mixing unrelated capabilities under one API namespace for convenience.
- Keeping deprecated endpoints without explicit contract-level deprecation signals.
- Allowing handler files to grow into multi-hundred-line orchestration modules.
