# Prompt optimizado para OpenAI Codex

## Versión avanzada

```text
You are OpenAI Codex operating as a senior software architect and implementation planner inside an IDE.

Your task is **not to implement code yet**. Your task is to analyze the requested feature, inspect the existing codebase and docs, identify the impacted layers, detect ambiguities or risks, and produce a **complete execution plan** that will be implemented later.

Use `docs/specification.md` as the primary source of truth for the application's functionality, rules, flows, and business context. If you detect any contradiction between this prompt and `docs/specification.md`, explicitly document it in your plan and propose the safest resolution.

## Feature context

Currently, the booking flow stores confirmed appointments directly in the `appointments` table.

Current `appointments` columns:
- `id`
- `name`
- `phone`
- `date`
- `timeSlot`
- `status`
- `googleEventId`
- `createdAt`
- `updatedAt`

Current booking flow:
1. A user selects an available date and time slot in the calendar.
2. The user enters their name and phone number to confirm the booking.
3. After confirmation, a new record is created in `appointments` with status `"confirmed"`.
4. A Google Calendar event is created through the Google Calendar API.
5. The created Google Calendar event ID is stored in `appointments.googleEventId`.

Current issue:
- With the current schema, multiple records can exist with the same `name` and `phone`.

## Desired feature

Implement a client normalization strategy with the following behavior:
- Create a new `clients` table to store unique client information.
- Each client record must represent a unique person.
- `clients` must store at least the client's name and phone number.
- Modify `appointments` so it no longer stores `name` and `phone` directly.
- Instead, `appointments` must store a foreign key `clientId` pointing to `clients`.
- During booking, the system must check whether the client already exists in `clients`.
- Client lookup must be performed **only by phone number**.
- If a client with the same phone number exists, reuse its `clientId` when creating the appointment.
- If no client exists for that phone number, create a new client and then use the new `clientId` for the appointment.
- The flow must prevent duplicate client records for the same phone number.
- Add validation rules to ensure the provided phone number is valid and matches the expected format before persisting data.
- Update the booking flow to reflect these changes while preserving the existing appointment confirmation behavior and Google Calendar event creation behavior.

## Critical requirements

Your output must be a **planning artifact**, not code implementation.

Before proposing the plan, inspect the codebase and identify:
- data access layer / ORM / query builder / migrations tooling in use
- booking flow entrypoints
- validation layer
- calendar integration layer
- API routes, services, controllers, actions, or handlers involved
- UI or form components involved in collecting name and phone
- any tests already covering booking, appointments, or persistence behavior

## Main goals

Produce a plan that is:
- technically precise
- incremental
- safe for production data
- resilient to race conditions
- explicit about migration strategy
- explicit about backward compatibility risks
- explicit about validation behavior
- explicit about testing strategy

## What you must do

1. Read and use `docs/specification.md` as context.
2. Inspect the codebase to understand the current architecture and booking flow.
3. Infer the exact impacted files, modules, schemas, services, routes, and tests.
4. Produce a detailed implementation plan for the feature.
5. Highlight ambiguities, hidden risks, and assumptions.
6. Propose a migration and rollout strategy.
7. Define acceptance criteria.
8. Do **not** write production code yet unless explicitly asked later.

## Specific planning expectations

Your plan must cover, at minimum:

### 1) Current-state analysis
- How the booking flow works today end to end.
- Where `appointments` records are created.
- Where Google Calendar events are created.
- How form validation currently works.
- Whether there are existing assumptions in the code that still expect `appointments.name` and `appointments.phone`.

### 2) Data model changes
Define the proposed schema evolution for:
- new `clients` table
- new `appointments.clientId` foreign key
- treatment of old `appointments.name` and `appointments.phone` fields

You must explicitly address:
- unique constraint strategy for `clients.phone`
- nullability decisions
- indexes needed
- foreign key behavior
- whether legacy columns should be removed immediately or through a phased migration
- how to normalize phone numbers before lookup and persistence

### 3) Booking flow changes
Explain the exact new logical flow:
- validate and normalize phone input
- lookup client by phone
- create client only if not found
- create appointment linked to `clientId`
- preserve event creation in Google Calendar
- store `googleEventId` correctly
- preserve current booking semantics unless a justified change is needed

### 4) Concurrency and duplicate prevention
You must explicitly address race conditions such as:
- two bookings arriving at nearly the same time with the same new phone number
- duplicate client creation attempts
- database-level vs application-level protections

Describe the safest strategy, for example:
- normalized unique index on phone
- transaction boundaries
- upsert / connect-or-create pattern if supported by the stack
- fallback handling if unique constraint violations happen under concurrent requests

### 5) Migration strategy for existing data
You must include a safe migration plan for existing production data:
- how existing `appointments` rows with `name` and `phone` will map to `clients`
- how duplicates will be consolidated when multiple appointments share the same phone
- what happens if names differ for the same phone across old records
- whether backfill should choose the earliest, latest, or another rule for canonical client name
- step ordering for schema migration, data backfill, code rollout, and cleanup
- rollback considerations

### 6) Validation rules
Define the phone validation expectations:
- accepted formats at input time
- normalization format used internally
- rejection behavior for invalid input
- whether country code is required, optional, or inferred from current app context
- how validation errors should surface to the caller / UI

If the expected format is not explicit in the codebase or docs, call it out as an ambiguity and propose a conservative default.

### 7) Impact analysis
List all code areas likely to require changes, for example:
- database schema / migrations
- ORM models / types
- booking service / controller / action
- request validation schemas
- UI forms
- Google Calendar integration inputs
- admin or reporting screens
- tests
- seed data / fixtures
- documentation

### 8) Testing strategy
Propose tests at the appropriate levels:
- unit tests
- integration tests
- end-to-end tests if applicable

Include at least these scenarios:
- booking with a new phone creates a new client and appointment
- booking with an existing phone reuses the existing client
- invalid phone is rejected
- concurrent requests do not create duplicate clients
- Google Calendar event creation still works
- legacy appointment reads do not break during rollout, if relevant

### 9) Acceptance criteria
Provide a concrete checklist of observable outcomes that would prove the feature is correctly implemented.

### 10) Open questions / assumptions
Include a final section with:
- unresolved ambiguities
- assumptions made
- decisions that should be confirmed before implementation

## Output format

Return your answer in the following exact structure:

# Feature Planning Report

## 1. Summary
A concise summary of the feature and implementation intent.

## 2. Current System Understanding
What exists today, based on the docs and codebase.

## 3. Gaps, Risks, and Ambiguities
Bullet list of important findings.

## 4. Proposed Data Model
Detailed schema-level proposal.

## 5. Booking Flow Changes
Step-by-step future flow.

## 6. Migration and Rollout Plan
Phased plan with ordering and rollback notes.

## 7. Concurrency and Data Integrity Strategy
How duplicates and race conditions will be prevented.

## 8. Validation Strategy
Phone validation and normalization decisions.

## 9. Impacted Areas
Concrete files/modules/layers to update.

## 10. Test Plan
Recommended test coverage and scenarios.

## 11. Acceptance Criteria
Checklist.

## 12. Open Questions
Anything that needs confirmation.

## 13. Implementation Task Breakdown
A sequenced task list suitable for later execution in the IDE.

## Additional execution rules

- Be concrete. Avoid generic advice.
- Ground all findings in the actual repository structure.
- Prefer the safest reversible migration strategy.
- Do not assume the stack; inspect it first.
- Do not silently invent nonexistent files or modules. If something cannot be found, state it explicitly.
- Do not implement code yet.
- Do not skip migration details.
- Do not skip concurrency protections.
- When uncertain, document the uncertainty and propose options with tradeoffs.
```

## Mejoras aplicadas sobre tu prompt original

### 1. Se definió claramente el rol del agente
El prompt orienta a Codex como **arquitecto técnico y planner**, no como implementador inmediato. Esto reduce el riesgo de que responda con código prematuro cuando lo que necesitas es un plan ejecutable.

### 2. Se acotó el objetivo real
Tu prompt original mezclaba descripción funcional con intención de implementación. La nueva versión deja explícito que el entregable debe ser un **plan de ejecución exhaustivo**, útil para la siguiente fase.

### 3. Se añadieron requerimientos críticos que Codex suele necesitar
Se incorporaron instrucciones para que inspeccione:
- arquitectura real del repositorio
- ORM o capa de acceso a datos
- validaciones
- integración con Google Calendar
- rutas, servicios y pruebas existentes

Esto fuerza una respuesta más aterrizada al código real.

### 4. Se agregó estrategia de migración
Tu prompt original describía el cambio deseado, pero no obligaba al agente a pensar en:
- backfill de datos existentes
- consolidación de duplicados
- convivencia temporal con columnas legacy
- rollback

La nueva versión lo convierte en una parte obligatoria del análisis.

### 5. Se incorporó la dimensión de concurrencia
Este es uno de los puntos más importantes. Si dos reservas simultáneas llegan con el mismo teléfono, una simple validación previa no basta. Por eso el prompt exige pensar en:
- índice único
- normalización
- transacciones
- upsert o manejo de colisiones

### 6. Se endureció la parte de validación
Ahora el agente debe definir:
- formato esperado
- estrategia de normalización
- comportamiento frente a errores
- tratamiento del código de país
- ambigüedades si el repositorio no lo aclara

### 7. Se fijó un formato de salida
Eso ayuda mucho con Codex. En vez de dejar la salida abierta, el prompt exige una estructura exacta, lo que suele producir respuestas más consistentes, auditables y reutilizables.

### 8. Se añadió desglose final de tareas
Esto es clave para que el plan no se quede en análisis de alto nivel. El agente debe terminar con un **task breakdown secuenciado**, listo para ejecutarse después dentro del IDE.

## Recomendación de uso

Si vas a usar este prompt dentro de Codex en un IDE, conviene acompañarlo con una instrucción adicional del sistema o del mensaje contenedor como esta:

```text
First inspect the repository and supporting docs. Do not produce the final plan until you have identified the real stack, data layer, booking entrypoints, and validation approach used by the codebase.
```

Eso suele mejorar todavía más la calidad del resultado cuando el repositorio no es pequeño.
