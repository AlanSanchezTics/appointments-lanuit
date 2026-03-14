# ExecPlan — Temporal Slot Locking During Reservation Flow

## Objective

Implement a **temporal reservation locking system** during the booking flow to prevent multiple users from reserving the same time slot simultaneously.

This feature must integrate with the existing reservation flow described in:

`docs/specification.md`

The goal is to ensure that once a user reaches the **reservation confirmation step**, the selected time slot becomes **temporarily blocked** for other users.

If the user confirms the reservation, the slot becomes **permanently booked** and an event is created in **Google Calendar**.

If the user does not confirm within **10 minutes**, the lock expires and the slot becomes available again.

---

# Context

The reservation flow contains multiple steps.

The new behavior must occur when the user reaches:

**STEP 2 — Validation of reservation data before confirmation.**

At this moment:

- the selected **date and time slot must be temporarily locked**
- the lock must expire after **10 minutes**

Possible outcomes:

### Scenario A — User confirms reservation

1. Slot becomes permanently reserved
2. Reservation is stored in database
3. Event is created in Google Calendar
4. Temporary lock becomes permanent booking

### Scenario B — User abandons reservation

1. Lock expires after 10 minutes
2. Slot becomes available again
3. No event is created

---

# Agent Responsibilities

Before designing the plan, the agent must **analyze the repository**.

Identify:

- current reservation flow implementation
- reservation data model
- scheduling logic
- Google Calendar integration
- database schema
- concurrency protections
- testing architecture

---

# Repository Exploration

The agent must inspect the repository to identify:

## Reservation Logic

Locate:

- reservation services
- booking controllers
- availability calculation logic

Typical locations:

/services  
/modules/reservations  
/controllers  
/api

Document the current booking flow.

---

## Database Schema

Identify tables related to:

- reservations
- time slots
- calendars
- bookings

Determine:

- how availability is currently calculated
- whether time slots are stored explicitly or generated dynamically

---

## Google Calendar Integration

Locate:

- service responsible for creating events
- authentication with Google APIs
- event creation flow

Determine how the reservation triggers the calendar event.

---

## Testing Architecture

Locate the testing structure:

/tests  
/e2e  
/integration

Identify:

- frameworks used
- test database strategy
- mocking of external APIs

---

# Target Feature Design

The plan must propose a robust strategy for **temporary slot locking**.

The design must address:

- concurrent reservation attempts
- lock expiration
- consistency with Google Calendar
- system crashes or restarts

---

# Locking Strategy

The agent must evaluate possible strategies such as:

### Option A — Database Lock Table

Example structure:

reservation_locks

Fields:

- id
- slot_datetime
- tenant_id
- user_session_id
- expires_at
- created_at

---

### Option B — Redis TTL Lock

Example key:

lock:tenant:slot_timestamp

With TTL = 10 minutes.

---

The plan must explain **which strategy is best for the current architecture**.

---

# Reservation State Model

Define reservation states such as:

- PENDING
- CONFIRMED
- EXPIRED

Explain how state transitions occur.

---

# Implementation Plan

Divide implementation into phases.

---

# Phase 1 — Reservation Flow Analysis

Tasks:

- map reservation workflow
- identify insertion point for slot locking
- identify data model changes required

Deliverables:

- architecture analysis
- proposed data model

Tests:

- unit tests validating slot availability logic

---

# Phase 2 — Temporary Lock Infrastructure

Implement slot locking when user reaches step 2.

Tasks:

- create lock mechanism
- store lock expiration
- prevent other users from selecting locked slots

Tests:

Unit tests:

- slot lock creation
- slot lock expiration
- prevention of double booking

E2E tests:

- two users attempting same slot
- second user blocked while lock exists

---

# Phase 3 — Reservation Confirmation

When user confirms reservation:

Tasks:

- convert temporary lock to permanent reservation
- persist reservation
- trigger Google Calendar event

Tests:

Unit tests:

- lock conversion
- reservation persistence

E2E tests:

- full booking flow from slot selection to confirmation

---

# Phase 4 — Lock Expiration

Implement automatic release of expired locks.

Possible strategies:

- TTL-based expiration
- background cleanup job
- database cleanup query

Tests:

Unit tests:

- lock expiration logic

E2E tests:

- slot becomes available after expiration window

---

# Phase 5 — Concurrency Protection

Ensure system prevents race conditions.

Consider:

- database transactions
- unique constraints
- distributed locks

Tests:

- concurrent booking attempts for the same slot

---

# Google Calendar Consistency

Ensure event creation only occurs when reservation becomes **confirmed**.

Handle failure cases such as:

- Google API failure
- partial reservation creation

Define rollback or retry strategy.

---

# Testing Strategy

The implementation must include:

## Unit Tests

Validate:

- lock creation
- lock expiration
- reservation confirmation logic

## Integration Tests

Validate:

- interaction between booking service and lock mechanism

## End-to-End Tests

Simulate real scenarios:

- User A selects a slot
- User B attempts the same slot
- Lock expiration behavior
- Successful reservation confirmation

---

# Constraints

1. Existing reservation flow must not break.
2. Slot locking must prevent race conditions.
3. Expired locks must automatically release.
4. Google Calendar events must only be created after confirmation.

---

# Expected Deliverables

The final plan produced by the agent must include:

- architecture analysis
- locking strategy decision
- database schema changes
- phased implementation plan
- testing strategy
- list of files requiring modification
