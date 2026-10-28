# Spec Questionnaire

Use this sequence to interview the user before generating the spec.

## Round 1: Goal

1. What user problem are we solving?
2. Who is the primary user or actor?
3. What outcome should they get when the feature works?

## Round 2: Flow

1. What entry point starts the feature?
2. Which existing flow, screen, route, or command changes?
3. What is explicitly in scope and out of scope for v1?

## Round 3: Contracts

1. Does this change data, API contracts, validations, states, integrations, UI, or persistence?
2. What entities, endpoints, or screens are affected?
3. What must remain backward compatible, if anything?

## Round 4: Risk

1. Is any migration or backfill needed?
2. Are there rollback or coexistence constraints?
3. What edge cases or failures must the spec cover?

## Round 5: Success

1. What does a successful implementation look like?
2. How will we know the feature is complete?
3. What evidence should the plan and tasks produce?

## If the user is vague

Prefer direct closed questions like:

- "Does this change the flow, data, or both?"
- "Is this a new feature or a modification of an existing one?"
- "Should we update {{product_spec}} as part of the change?"
- "Do we need compatibility with the old behavior?"
