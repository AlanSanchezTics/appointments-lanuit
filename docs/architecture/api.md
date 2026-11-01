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

## Admin Appointment Logs Endpoint

`GET /api/admin/appointment-logs` is the global admin audit endpoint for appointment lifecycle logs.

Ownership:

- Capability namespace: `admin/appointment-logs`.
- Consumer: authenticated admin UI route `/admin/appointment-logs`.
- Route handler responsibility: parse query parameters, enforce authenticated active admin access, call appointment log domain services, and return JSON or PDF response.
- Domain responsibility: filtering, pagination, immutable log retrieval, PDF data preparation, and validation semantics that must remain correct outside HTTP.

Supported query contract:

- `page`: positive integer.
- `pageSize`: positive integer in range `1..100`, default `20`.
- `client`: optional client name or phone search text.
- `actionType`: optional `PENDING`, `CONFIRMED`, `CANCELLED`, `MODIFIED`, or `REJECTED`.
- `month`: optional appointment month in `YYYY-MM`, interpreted against the linked appointment date.
- `actionDateFrom`: optional `YYYY-MM-DD`.
- `actionDateTo`: optional `YYYY-MM-DD`.
- `format`: optional `json` or `pdf`.

Response modes:

- JSON mode returns paginated rows plus pagination metadata and normalized applied filters.
- PDF mode (`format=pdf`) returns `Content-Type: application/pdf` and exports the same filtered evidence set with visible columns, applied filters, and generation date/time.
- PDF export is limited to `1,000` filtered rows; larger result sets return `EXPORT_LIMIT_EXCEEDED` with HTTP `422` and no partial PDF.

Required error codes:

- `ADMIN_UNAUTHORIZED` for unauthenticated admin requests.
- `VALIDATION_ERROR` for invalid filters or pagination.
- `UNSUPPORTED_EXPORT_FORMAT` for unsupported `format` values.
- `EXPORT_LIMIT_EXCEEDED` (`422`) when a PDF export would exceed `1,000` rows.

Existing booking, cancellation, approval, and rejection endpoint contracts must not change for this feature. Appointment log creation is an internal side effect after successful domain state transitions.

---

## Public My Appointments Endpoints

`/api/my-appointments/*` owns the unified public self-service capability for consulting, cancelling, and rescheduling existing appointments.

Ownership:

- Capability namespace: `my-appointments`.
- Consumer: public UI route `/my-appointments`.
- Route handler responsibility: parse body/query input, call appointment-management domain services, and map stable errors.
- Domain responsibility: eligibility evaluation, availability validation, transactional cancellation/reschedule, and audit side effects.

Supported contracts:

- `POST /api/my-appointments/lookup`
  - input: `{ phone }`
  - returns future appointments for that phone with their current public actionability state
  - source lookup ignores `active_months`
- `POST /api/my-appointments/cancel`
  - input: `{ phone, appointmentIds[] }`
  - applies web cancellation rule `>= 24 hours`
- `POST /api/my-appointments/reschedule`
  - input: `{ phone, appointmentId, month, date, timeSlot }`
  - applies web reschedule rule `>= 3 hours`
  - preserves the same appointment identity
  - destination slot follows the public booking availability model
  - must not apply `isLoyal` logic or the 15-day booking suggestion branch

Required error semantics:

- `VALIDATION_ERROR` for invalid phone input (the zod error is normalized to `VALIDATION_ERROR`; the code does not return `PHONE_INVALID`, D84)
- `APPOINTMENT_NOT_FOUND` when no eligible appointment is found or the target appointment no longer matches the flow
- `APPOINTMENT_IS_COMING_SOON` when cancellation fails due to the 24-hour rule
- `APPOINTMENT_NOT_MODIFIABLE` when reschedule fails due to the 3-hour rule or state mismatch
- `SLOT_NOT_AVAILABLE` when the target slot is no longer available or is held by another client's active reservation lock (D87)
- `VALIDATION_ERROR` for malformed or semantically invalid payloads
- `LOCK_TIMEOUT` (409), invalid calendar dates (`VALIDATION_ERROR`, 400) and `UNKNOWN_ERROR` (400) for reschedule: see "Disponibilidad mensual y reservas (spec 003)".

---

## Disponibilidad mensual y reservas (spec 003)

Esta sección documenta el contrato de los endpoints de disponibilidad por mes, de la reserva pública y de las reprogramaciones tal como están implementados. La decisión y el alcance están en `specs/003-flexible-month-availability/`.

Propiedad:

- Capacidad: disponibilidad y bloqueos por mes en `admin/months/[month]`, reprogramación admin en `admin/appointments/[appointmentId]/reschedule`, lectura pública en `availability/[month]`, reserva en `reservar/*` y reprogramación pública en `my-appointments/reschedule`.
- Cálculo de horarios: un único resolvedor en `lib/availability/` (FR-016). Las rutas validan la forma, llaman al servicio de dominio y mapean códigos. No calculan horarios.
- Persistencia: `lib/db/availability-rules.ts`. Esquema en `docs/architecture/data-model.md`.

Formatos: fechas `YYYY-MM-DD`, horas `HH:mm`, zona horaria `America/Mexico_City`. El segmento `[month]` es `YYYY-MM`.

Convenciones de error de esta capacidad:

- El cuerpo es siempre `{ errorCode, error }`. Los 409 de citas afectadas añaden `affectedCount` y `affectedAppointments`.
- `ADMIN_UNAUTHORIZED` (401) en todas las rutas admin.
- `VALIDATION_ERROR` (400): el cuerpo o la query no cumplen la forma (validación zod). Las fechas de calendario inválidas (por ejemplo `2026-02-30`) en reservas y reprogramación pública también responden `VALIDATION_ERROR`.
- `MONTHS_INVALID_FORMAT` (400): el segmento `[month]` no es un `YYYY-MM` válido.
- `AFFECTED_MONTH_MISMATCH` es interno: lo lanza el cálculo de citas afectadas si el mes actual y el propuesto no coinciden. Ambos llamadores pasan el mes del path, así que no debería llegar a una ruta. Si llegara, el normalizador lo devolvería como 400 con ese código.
- Códigos de validación de dominio `AVAILABILITY_*` (400): ver la tabla de cada endpoint.
- Error no mapeado, incluidos errores de base de datos y expiración de la transacción: `UNKNOWN_ERROR` con el HTTP por defecto de la ruta (400 en las rutas admin, en la reserva y en la reprogramación pública; 422 en `GET /api/availability/[month]`).

Orden de comprobaciones en las escrituras de disponibilidad: primero la forma del cuerpo (400 `VALIDATION_ERROR`). Después, dentro de la transacción: mes registrado (404), mes pasado (422), versión (409), valores de dominio (400), citas afectadas (409) y, al final, la escritura.

### GET /api/admin/months/[month]/availability

Respuesta 200:

```json
{
  "month": "2026-12",
  "availabilityVersion": 3,
  "rules": [
    {
      "id": 11,
      "startDate": "2026-12-01",
      "endDate": "2026-12-13",
      "weekdays": [1, 2, 3, 4, 5],
      "times": ["09:00", "10:00", "13:00", "14:00", "17:00", "18:00"],
      "minGapMinutes": 240,
      "preserveCapacity": true,
      "maxPerDay": 3
    }
  ],
  "exceptions": [
    { "id": 4, "date": "2026-12-19", "times": [], "minGapMinutes": 240, "preserveCapacity": true, "maxPerDay": 3 }
  ],
  "usesDefaultRule": false
}
```

- `weekdays`: ISO, 1 = lunes, 7 = domingo.
- `usesDefaultRule`: `true` cuando el mes no tiene reglas. Los días no cubiertos por una excepción usan la regla por defecto (D6, D28). Es informativo.
- Sin `slotMode`: el campo se retiró de la respuesta, sin alias (D49).
- Errores: 404 `MONTH_NOT_REGISTERED`; 400 `MONTHS_INVALID_FORMAT`.

### PUT /api/admin/months/[month]/availability

Cuerpo:

- `expectedVersion` (entero ≥ 0, obligatorio): `availabilityVersion` leído con el GET.
- `rules[]`: `{ startDate, endDate, weekdays[], times[], minGapMinutes, preserveCapacity, maxPerDay }`.
- `exceptions[]`: `{ date, times[], minGapMinutes, preserveCapacity, maxPerDay }`. `times` puede ser `[]`, que cierra el día.
- `confirmAffectedAppointments` (boolean, opcional, por defecto `false`).

Semántica: reemplaza el conjunto completo de reglas y excepciones del mes en una transacción con `FOR UPDATE` sobre `active_months`. Incrementa `availabilityVersion`; no deriva ningún modo (D49). No escribe en `appointment_logs` (D24) y no modifica citas ni eventos de Google Calendar (FR-022).

Respuesta 200: el mismo cuerpo que el GET, con la versión nueva.

409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`:

```json
{
  "errorCode": "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
  "error": "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED",
  "affectedCount": 1,
  "affectedAppointments": [
    { "appointmentId": 87, "date": "2026-12-03", "timeSlot": "17:00", "status": "CONFIRMED", "clientName": "Nombre de ejemplo" }
  ]
}
```

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `MONTH_NOT_REGISTERED` | El mes no está registrado. |
| 422 | `MONTH_IN_PAST` | El mes es anterior al mes actual (D36). |
| 409 | `AVAILABILITY_VERSION_CONFLICT` | `expectedVersion` no coincide con la versión vigente. No se escribe nada. |
| 409 | `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` | Hay citas que quedan fuera del horario y no se confirmó. |
| 400 | `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH` | Fecha de regla fuera del mes, o fecha inexistente o malformada. |
| 400 | `AVAILABILITY_RULE_RANGE_INVALID` | `startDate` posterior a `endDate`. |
| 400 | `AVAILABILITY_RULE_OVERLAP` | Dos reglas comparten fechas. No se miran los días de la semana. |
| 400 | `AVAILABILITY_RULE_WEEKDAYS_REQUIRED` | La regla no tiene días, o un día está fuera de 1-7. |
| 400 | `AVAILABILITY_RULE_TIMES_REQUIRED` | La regla no tiene horas. |
| 400 | `AVAILABILITY_TIME_INVALID` | Hora fuera de `HH:mm`, o `00:00`, que es el centinela de día completo (D55). |
| 400 | `AVAILABILITY_TIMES_LIMIT_EXCEEDED` | Más de 24 horas por día después de normalizar. |
| 400 | `AVAILABILITY_MIN_GAP_OUT_OF_RANGE` | `minGapMinutes` no es entero o está fuera de 0-1440. |
| 400 | `AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE` | `maxPerDay` no es entero o está fuera de 1-6. |
| 400 | `AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH` | Fecha de excepción fuera del mes, o inexistente. |
| 400 | `AVAILABILITY_EXCEPTION_DATE_DUPLICATE` | Dos excepciones con la misma fecha. |
| 400 | `VALIDATION_ERROR` | La forma del cuerpo no es válida. |

### POST /api/admin/months/[month]/availability/preview

Cuerpo: `rules[]` y `exceptions[]` con la misma forma que el PUT. `expectedVersion` y `confirmAffectedAppointments` no se usan y se ignoran.

Respuesta 200: `{ "affectedCount": 2, "affectedAppointments": [...] }`, con los mismos elementos que el 409 del PUT.

- Sin escritura y sin cambio de `availabilityVersion`.
- Solo cuentan citas `PENDING`, `CONFIRMED` o `SYNC_FAILED` que sean futuras (D35).
- Lista solo la diferencia: citas que estaban dentro de la rejilla vigente y quedan fuera de la propuesta (A-03).
- "Fuera" significa que la fecha no tiene horarios o que la hora no está en la rejilla del día (A-04). No cuentan bloqueos, separación ni capacidad (D40).
- Funciona también en meses pasados (D70).
- Errores: 404 `MONTH_NOT_REGISTERED`; 400 con los códigos `AVAILABILITY_*` de la tabla anterior o `VALIDATION_ERROR`.

### PATCH /api/admin/months/[month]/slot-mode (contrato ampliado)

Cuerpo:

- `slotMode` (`BLOCK_MODE` o `SECOND_ONLY_MODE`, obligatorio).
- `expectedVersion` (entero ≥ 0, opcional).
- `confirmAffectedAppointments` (boolean, opcional, por defecto `false`).

Semántica: reemplaza las reglas del mes por el preset D4 como regla de mes completo, de lunes a viernes. Conserva las excepciones (D33). Siempre escribe: enviar el mismo modo ya no es una operación sin efecto (D69) y siempre incrementa `availabilityVersion`.

Respuesta 200: `{ "month": "2026-12", "availabilityVersion": 4 }`. `slotMode` no se devuelve (D49, sin alias).

Errores: 404 `MONTH_NOT_REGISTERED`; 422 `MONTH_IN_PAST`; 409 `AVAILABILITY_VERSION_CONFLICT` (solo si se envía `expectedVersion`); 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`; 400 `VALIDATION_ERROR` o `MONTHS_INVALID_FORMAT`.

Compatibilidad:

- Sin `expectedVersion` no hay control de versión: un `PATCH slot-mode` puede sobrescribir un guardado del editor. La UI del editor siempre envía `expectedVersion`.
- El editor de la UI envía `confirmAffectedAppointments: true` solo tras la confirmación de citas afectadas. Un cliente que guarde sin ese campo recibe 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` cuando hay citas afectadas.

### POST /api/admin/months

Crea meses inactivos sin reglas (D17). Los días no cubiertos usan la regla por defecto D6 (lunes a viernes, 09:00, 10:00, 13:00, 14:00, 17:00, 18:00; 240 minutos; `preserveCapacity` TRUE; `maxPerDay` 3).

Respuesta 200 con el cuerpo existente (la convención de 201 no se aplica a este endpoint; sin cambio). Errores: 401; 400 para cualquier error de dominio o de forma.

### GET /api/admin/months/[month]

Campos aditivos: `rules`, `exceptions`, `availabilityVersion` y `usesDefaultRule`. `slotMode` no se devuelve (D49).

- Los días anteriores a hoy cuentan 0 disponibles (D56).
- Un día sin horarios resueltos se marca con `tone: "closed"` (D34).
- Errores: 404 `MONTH_NOT_REGISTERED`; 400 `MONTHS_INVALID_FORMAT`.

### GET /api/admin/months/[month]/days/[date]/agenda

Query opcional `excludeAppointmentId` (entero). Campo aditivo `availableSlots`: horarios ofrecibles para reagendar ese día, calculados con el resolvedor (ocupación, bloqueos, locks y hora actual), sin contar la cita indicada. Un día sin horarios devuelve `[]` (D46).

Errores: 404 `MONTH_NOT_REGISTERED`; 400 `DATE_OUTSIDE_MONTH` o `DATE_INVALID_FORMAT`.

### GET /api/admin/months/[month]/blockable-slots?date=YYYY-MM-DD

Horarios bloqueables calculados con el resolvedor. Errores: 404 `MONTH_NOT_REGISTERED`; 400 `DATE_OUTSIDE_MONTH` o `DATE_INVALID_FORMAT`.

### POST /api/admin/months/[month]/blocked-slots

Crea un bloqueo manual:

- Horario puntual: evento de Google Calendar de 1 hora (D15, D29). Los eventos existentes no cambian (D30).
- Día completo (`00:00`): evento de 06:00 a 23:00 (D29).

Una cita `PENDING` ocupa el horario y bloquea el bloqueo admin en ese horario (D71).

Errores:

- 404 `MONTH_NOT_REGISTERED`.
- 409 `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED`, `DAY_ALREADY_BLOCKED`, `BLOCKED_SLOT_ALREADY_EXISTS`.
- 422 `DATE_IN_PAST`.
- 400 `DATE_NOT_OPERATIONAL` cuando el día no tiene horarios. No tiene mapeo explícito a 409 (D76).
- 400 para el resto.

### POST /api/admin/months/[month]/appointments (creación admin)

- Un `timeSlot` `HH:mm` fuera de la rejilla del día responde 409 `SLOT_NOT_AVAILABLE` (D73, D46).
- Un horario con lock de reserva activo responde 409 `SLOT_LOCKED`.
- Una cita `PENDING` ocupa el horario (D68).
- Éxito: 201.
- Orden de bloqueo: locks con nombre, después `FOR SHARE` de reglas, después conflictos del día y lectura de ocupación con `FOR UPDATE` (D63, D77; ver `data-model.md`).

Errores:

- 404 `MONTH_NOT_REGISTERED` o `CLIENT_NOT_FOUND`.
- 409 `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED`, `LOCK_TIMEOUT` (D78).
- 400 para el resto, incluidos `VALIDATION_ERROR` y `UNKNOWN_ERROR`.

Nota: `LOCK_TIMEOUT` se mapea a 409. Desde la corrección F1 (D82; ADR 0006) la transacción tiene 30 s de timeout, mayor que la espera de `GET_LOCK` (5 s por nombre), así que el 409 se alcanza. Si una transacción supera 30 s y expira, la respuesta es 400 `UNKNOWN_ERROR` (riesgo residual de F1).

### PATCH /api/admin/appointments/[appointmentId]/reschedule

- Solo se reprograman citas `CONFIRMED` o `SYNC_FAILED` (D72). La lectura bloqueante filtra por esos estados, así que una cita `PENDING` responde 404 `APPOINTMENT_NOT_FOUND`. Esto está verificado en el código; no hay prueba específica.
- Una cita pasada responde 409 `APPOINTMENT_NOT_EDITABLE`.
- La propia cita no cuenta como ocupada en el horario de destino (`excludeAppointmentId`).

Errores:

- 404 `MONTH_NOT_REGISTERED` o `APPOINTMENT_NOT_FOUND`.
- 409 `SLOT_NOT_AVAILABLE`, `SLOT_LOCKED`, `APPOINTMENT_NOT_EDITABLE`, `LOCK_TIMEOUT` (D78).
- 400 para el resto.

### GET /api/availability/[month] (público)

Respuesta 200: `{ "month": "2026-12", "days": [{ "date": "2026-12-03", "slots": ["09:00", "13:00"] }] }`.

- Solo incluye fechas desde hoy con al menos un horario.
- La forma de `days[]` (`date`, `slots`) no cambia.
- Cualquier error de dominio responde 422 con `{ errorCode, error }` (por ejemplo `MONTH_NOT_ALLOWED`).

### Reserva pública (`/api/reservar/*`)

- `POST /api/reservar/lock` y `POST /api/reservar/client-check-lock`: 201 en éxito. 409 para `SLOT_NOT_AVAILABLE`, `PHONE_ALREADY_BOOKED`, `LOCK_TIMEOUT` y `SLOT_LOCKED`. 400 para el resto.
- `POST /api/reservar/confirm`: 201 en éxito. 409 para `SLOT_NOT_AVAILABLE`, `PHONE_ALREADY_BOOKED`, `LOCK_TIMEOUT`, `LOCK_EXPIRED_OR_INVALID`, `CLIENT_NAME_MISMATCH` y `APPOINTMENT_NOT_FOUND`. 400 para el resto.
- Un día sin horarios, o una hora que no se ofrece, responde `SLOT_NOT_AVAILABLE` (D46). El código `WEEKDAY_ONLY` ya no existe.
- Si la hora no se ofrece y tiene un lock activo en `reservation_locks`, responde `SLOT_LOCKED`. Si no, `SLOT_NOT_AVAILABLE` (D39).
- `timeSlot` es `HH:mm` con cualquier minuto (FR-006). Una fecha de calendario inválida responde `VALIDATION_ERROR` (400).
- Mes no reservable (sin registro, inactivo o pasado) en `reservar/lock`, `client-check-lock` o `confirm`: 400 `MONTH_NOT_ALLOWED`. En la reprogramación pública de Mi cita el mismo caso responde `SLOT_NOT_AVAILABLE` (D91).
- `POST /api/reservar/client-check-lock` devuelve `futureAppointmentsInMonth[]` (`{ appointmentId, date, timeSlot }`) y `canBookAsNewAppointment`. La lista incluye las citas activas del mismo teléfono y mes (`PENDING`, `CONFIRMED`, `SYNC_FAILED`; D95) que quedan a menos de 15 días naturales de la fecha elegida. Si no hay ninguna, la lista va vacía y no hay sugerencia. El umbral nunca bloquea la creación.
- `POST /api/reservar/confirm` con `appointmentIdToReschedule` reprograma una cita activa del mismo teléfono y mes (`PENDING`, `CONFIRMED` o `SYNC_FAILED`; D95). Si no existe, es de otro teléfono o mes, o ya pasó, responde 409 `APPOINTMENT_NOT_FOUND`. Una `PENDING` sigue `PENDING`, no crea ni borra evento de calendario y registra `MODIFIED` en la bitácora. `CONFIRMED` y `SYNC_FAILED` recrean el evento de calendario, y el reagendado del wizard no escribe bitácora para ellos (inconsistencia aceptada por el owner; no corregida en la spec 003).
- Las reglas se leen dentro de la transacción, después de los bloqueos de reserva, con `FOR SHARE` (PD-08). Si `GET_LOCK` no obtiene el bloqueo en 5 s, `LOCK_TIMEOUT` (409). La transacción tiene 30 s de timeout (F1, D82). Si aun así expira, la respuesta es 400 `UNKNOWN_ERROR` (riesgo residual de F1, ADR 0006).

### Reprogramación pública `POST /api/my-appointments/reschedule`

Cuerpo: `{ phone, appointmentId, month, date, timeSlot }`. Éxito: 200.

Orden: forma (400 `VALIDATION_ERROR`), después transacción: bloqueos de reserva, `FOR SHARE` de reglas, conflictos del día, fila de la cita, lock vigente de otra clienta sobre el destino (lectura `FOR UPDATE`, sin limpieza de locks) y destino.

409:

- `APPOINTMENT_NOT_FOUND`
- `APPOINTMENT_NOT_MODIFIABLE`
- `SLOT_NOT_AVAILABLE`: destino fuera del día, día sin horarios, hora no ofrecida, `month` distinto del mes de `date`, mes no reservable (inactivo, sin registro o pasado), o lock vigente de otra clienta sobre el horario destino (D87, D88). El lock del propio teléfono no cuenta.
- `LOCK_TIMEOUT`

400:

- `VALIDATION_ERROR`: fecha de calendario inválida, mes con formato incorrecto, o teléfono inválido. El teléfono inválido responde `VALIDATION_ERROR` en el código actual, porque el error de zod se normaliza a `VALIDATION_ERROR` (D84).
- `UNKNOWN_ERROR`: error de infraestructura o de transacción (deadlock, timeout de espera de InnoDB, pool de conexiones) en cualquier lectura o escritura de la transacción, incluidas las reglas con `FOR SHARE`, los locks, la ocupación y la consulta del mes. La transacción se revierte (D81, D88).

F4 corregido (D88, D91): en la validación del destino, solo un mes no reservable (`MONTH_NOT_ALLOWED`) se traduce a `SLOT_NOT_AVAILABLE`. Los demás errores, incluidos los de base de datos, se propagan como `UNKNOWN_ERROR` (400).

### Compatibilidad de la capacidad

- `slotMode` se retiró de las respuestas de disponibilidad, del detalle del mes y de `PATCH .../slot-mode` (D49, sin alias). `PATCH .../slot-mode` conserva su ruta y su cuerpo: `slotMode` sigue siendo el selector de preset (RQ-1).
- Ningún otro endpoint público cambia de forma.
- Versionado: el proyecto no versiona por ruta. Los cambios de contrato se documentan en este archivo en la misma entrega.

---

## Administración de meses, citas y clientes

Esta sección documenta el contrato de endpoints administrativos que no tenían ficha en este archivo. Se deriva de los manejadores en `app/api/admin/**` y de los servicios que llaman (`lib/admin/**`, `lib/db/**`, `lib/calendar/**`).

Propiedad:

- Capacidad: catálogo y estado de meses (`admin/months`), bloqueos manuales (`admin/months/[month]/blocked-slots`), transiciones de citas (`admin/appointments`) y consulta de clientes (`admin/clients`).
- Consumidores (UI verificada en el código): dashboard `/admin` (confirmar y rechazar citas pendientes), `/admin/months` y `/admin/months/[month]` (catálogo, estado del mes, cancelación y bloqueos), y `/admin/clients` y `/admin/clients/[clientId]` (catálogo, búsqueda y detalle).
- Autenticación: todos los endpoints de esta sección requieren sesión admin. Sin sesión responden `401` con `ADMIN_UNAUTHORIZED`.

Convenciones de error de esta sección (verificadas en el código):

- Un fallo de validación de Zod se responde como `VALIDATION_ERROR` (`400`). Los códigos personalizados que aparecen en los esquemas (por ejemplo `CLIENT_CATALOG_PAGE_INVALID` por `page` menor que 1) no llegan al cliente cuando el valor es numérico fuera de rango; ver "Pendiente de aclarar" en clientes.
- Un cuerpo JSON malformado, o cualquier error no mapeado (incluidos los de base de datos), responde `UNKNOWN_ERROR` con el HTTP por defecto de la ruta, que es `400` en todas las rutas de esta sección.
- Cada tabla lista los códigos que el manejador mapea explícitamente. Cualquier otro error cae en el HTTP por defecto de la ruta.

### GET /api/admin/months/catalog

Query:

- `year` (opcional): `YYYY`. Por defecto, el año actual. Debe estar en `availableYears`, que son el año actual y los cinco siguientes. Un valor vacío equivale a omitido.
- `status` (opcional): `ALL` (por defecto), `ACTIVE` o `INACTIVE`. Se normaliza a mayúsculas, así que `active` también se acepta. Un valor vacío responde `400`.

Respuesta 200:

```json
{
  "filters": { "year": 2026, "status": "ALL", "availableYears": [2026, 2027, 2028, 2029, 2030, 2031] },
  "metrics": {
    "activeMonths": 3,
    "inactiveMonths": 2,
    "futureMonths": 4,
    "pastMonths": 1,
    "pastAppointments": 5,
    "futureAppointments": 12
  },
  "months": [{ "month": "2026-12", "status": "ACTIVE" }],
  "total": 1,
  "currentMonth": "2026-11",
  "currentDate": "2026-11-01"
}
```

- `months[]` se filtra por `status` y va ordenado por mes ascendente. `total` es `months.length`.
- `metrics` se calcula sobre todo el año y no cambia con `status`.
- `activeMonths` e `inactiveMonths`: meses del año con estado `ACTIVE` o `INACTIVE`.
- `futureMonths` y `pastMonths`: meses del año posteriores o anteriores a `currentMonth` (zona `America/Mexico_City`).
- `pastAppointments` y `futureAppointments`: citas del año en estado `CONFIRMED` o `SYNC_FAILED`, con fecha anterior o posterior a `currentDate`. `PENDING` no cuenta (D66).
- Solo lectura: no escribe en base de datos, bitácora ni Google Calendar.

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `MONTHS_YEAR_INVALID` | `year` no tiene cuatro dígitos. |
| 400 | `MONTHS_YEAR_OUT_OF_RANGE` | `year` no está en `availableYears`. |
| 400 | `MONTHS_STATUS_INVALID` | `status` no es `ALL`, `ACTIVE` ni `INACTIVE`. |
| 400 | `UNKNOWN_ERROR` | Error no mapeado, por ejemplo de base de datos. |

### PATCH /api/admin/months/[month]/status

Path: `[month]` en formato `YYYY-MM`.

Cuerpo:

```json
{ "status": "ACTIVE" }
```

`status` es obligatorio y solo acepta `ACTIVE` o `INACTIVE`.

Semántica:

- Cambia únicamente `active_months.status` del mes.
- No modifica citas, bloqueos, reglas ni `availabilityVersion`. No escribe en `appointment_logs` y no toca Google Calendar.
- Si el mes ya tiene el estado pedido, responde `200` sin escribir.
- Un mes `INACTIVE` no admite reserva pública (`MONTH_NOT_ALLOWED` en `reservar/*`, ver "Reserva pública").
- No usa transacción ni control de versión.

Orden de comprobaciones: formato del mes y forma del cuerpo (`400`), después mes registrado (`404`), después mes pasado (`422`) y, por último, la escritura.

Respuesta 200:

```json
{ "month": "2026-12", "status": "INACTIVE" }
```

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `MONTH_NOT_REGISTERED` | El mes no existe en `active_months`. |
| 422 | `MONTH_IN_PAST` | El mes es anterior al mes actual. |
| 400 | `MONTHS_INVALID_FORMAT` | El segmento `[month]` no es un `YYYY-MM` válido con mes entre 01 y 12. |
| 400 | `VALIDATION_ERROR` | El cuerpo no es un objeto con `status` válido. |
| 400 | `UNKNOWN_ERROR` | JSON malformado o error no mapeado. |

Pendiente de aclarar: el código no comprueba las citas activas del mes al pasarlo a `INACTIVE`. Las citas existentes se conservan sin cambios. El efecto esperado sobre ellas no está documentado en `business-rules.md`.

### PATCH /api/admin/months/[month]/blocked-slots/[blockedSlotId]

Path:

- `[month]`: `YYYY-MM`.
- `[blockedSlotId]`: entero mayor que 0. Si no lo es, responde `400 BLOCKED_SLOT_ID_INVALID`.

Cuerpo:

```json
{ "reason": "PERSONAL" }
```

`reason` es obligatorio y solo acepta `DESCANSO`, `PERSONAL` u `OTRO`. Otros campos se ignoran. Si el cuerpo trae `month`, prevalece el del path.

Semántica:

- Cambia únicamente `reason`. Fecha y hora no cambian.
- Solo es editable un bloqueo puntual (hora distinta de `00:00`) cuya fecha y hora sean futuras en `America/Mexico_City`. Los bloqueos de día completo (marcador `00:00`) no son editables aunque su fecha sea futura (ver "Pendiente de aclarar").
- El bloqueo debe pertenecer al mes del path. Si está en otro mes, responde `404 BLOCKED_SLOT_NOT_FOUND`.
- La escritura local va en transacción con lectura del bloqueo. La sincronización con Google Calendar se hace después de la transacción:
  - si el bloqueo tiene `googleEventId`, se actualiza el resumen del evento a `No disponible - <motivo>`;
  - si no lo tiene, se crea un evento de 1 hora para el bloqueo.
- Un fallo de Calendar no revierte el cambio local. El fallo queda registrado en el bloqueo y la respuesta sigue siendo `200`, con `syncWarnings`.
- No escribe en `appointment_logs`.

Respuesta 200:

```json
{
  "month": "2026-12",
  "blockedSlotId": 21,
  "date": "2026-12-03",
  "timeSlot": "17:00",
  "reason": "PERSONAL",
  "syncSummary": { "total": 1, "failed": 0, "synced": 1 },
  "syncWarnings": []
}
```

Si Calendar falla, `syncSummary` queda con `failed: 1`, `synced: 0` y `syncWarnings` lleva `[{ "blockedSlotId": 21, "reason": "CALENDAR_SYNC_FAILED" }]`. Los motivos posibles son `CALENDAR_NOT_CONFIGURED` y `CALENDAR_SYNC_FAILED`.

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `MONTH_NOT_REGISTERED` | El mes no está registrado. |
| 404 | `BLOCKED_SLOT_NOT_FOUND` | El id no existe, o el bloqueo pertenece a otro mes. |
| 409 | `BLOCKED_SLOT_NOT_EDITABLE` | Bloqueo de día completo, o fecha y hora ya pasadas. |
| 400 | `BLOCKED_SLOT_ID_INVALID` | `blockedSlotId` no es entero positivo. |
| 400 | `MONTHS_INVALID_FORMAT` | El path `[month]` no es válido. |
| 400 | `VALIDATION_ERROR` | `reason` falta o no está en la lista permitida. |
| 400 | `UNKNOWN_ERROR` | JSON malformado o error no mapeado. |

Pendiente de aclarar:

- Bloqueos de día completo: el código responde `409` aunque la fecha sea futura. `business-rules.md` y la especificación dicen solo "bloqueos futuros" y no mencionan el marcador `00:00`.
- Bloqueo sin evento en Calendar: el PATCH crea un evento. Las reglas solo hablan de actualizar el resumen del evento existente.

### POST /api/admin/appointments/[appointmentId]/confirm

Path: `[appointmentId]`, entero mayor que 0. Si no lo es, responde `400 APPOINTMENT_ID_INVALID`.

Sin cuerpo: el manejador no lee la petición.

Semántica:

- Transición `PENDING` a `CONFIRMED` dentro de una transacción. La lectura usa `FOR UPDATE` sobre la cita y su cliente. Escribe un evento de bitácora `CONFIRMED` con actor admin.
- Solo acepta citas `PENDING`. Cualquier otro estado responde `409`.
- Después de confirmar, se crea el evento de Google Calendar y se guarda su `googleEventId`. Si Calendar falla, la cita pasa a `SYNC_FAILED`, la confirmación local se mantiene y la respuesta sigue siendo `200`.

Respuesta 200 (sincronización correcta):

```json
{ "appointmentId": 87, "status": "CONFIRMED" }
```

Respuesta 200 (fallo de Calendar):

```json
{ "appointmentId": 87, "status": "SYNC_FAILED", "syncReason": "CALENDAR_SYNC_FAILED" }
```

`syncReason` puede ser `CALENDAR_NOT_CONFIGURED` o `CALENDAR_SYNC_FAILED`. `SYNC_FAILED` es un estado de éxito con `200`, no un error HTTP.

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `APPOINTMENT_NOT_FOUND` | La cita no existe. |
| 409 | `APPOINTMENT_STATUS_INVALID_TRANSITION` | La cita no está en `PENDING`. |
| 400 | `APPOINTMENT_ID_INVALID` | `appointmentId` no es entero positivo. |
| 400 | `UNKNOWN_ERROR` | Error no mapeado. Si ocurre antes del commit, la transición se revierte. Si ocurre durante la sincronización, la confirmación ya está guardada. |

Pendiente de aclarar:

- El código no comprueba que la cita sea futura ni que su mes esté activo. Una cita `PENDING` pasada se puede confirmar.
- La bitácora registra `CONFIRMED`, pero si Calendar falla la cita queda en `SYNC_FAILED` y no hay evento de bitácora para ese paso.
- Si la escritura a `SYNC_FAILED` falla, la respuesta es `400 UNKNOWN_ERROR` aunque la confirmación local ya esté guardada.

### POST /api/admin/appointments/[appointmentId]/reject

Path: `[appointmentId]`, igual que en confirm.

Sin cuerpo.

Semántica:

- Transición `PENDING` a `REJECTED` con la misma lectura bloqueante y la misma validación de estado que confirm.
- Escribe un evento de bitácora `REJECTED` con actor admin.
- No toca Google Calendar, porque una cita `PENDING` no tiene evento.

Respuesta 200:

```json
{ "appointmentId": 87, "status": "REJECTED" }
```

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `APPOINTMENT_NOT_FOUND` | La cita no existe. |
| 409 | `APPOINTMENT_STATUS_INVALID_TRANSITION` | La cita no está en `PENDING`. |
| 400 | `APPOINTMENT_ID_INVALID` | `appointmentId` no es entero positivo. |
| 400 | `UNKNOWN_ERROR` | Error no mapeado. La transacción se revierte. |

### POST /api/admin/appointments/[appointmentId]/cancel

Path: `[appointmentId]`, igual que en confirm.

Cuerpo:

```json
{ "month": "2026-12" }
```

`month` es obligatorio y debe ser un `YYYY-MM` válido.

Semántica:

- Solo cancela citas `CONFIRMED` o `SYNC_FAILED` cuya fecha cae dentro de `month`. Una cita `PENDING`, `REJECTED` o `CANCELLED`, o una cita de otro mes, responde `404 APPOINTMENT_NOT_FOUND`. Las citas `PENDING` se resuelven con reject.
- No aplica la restricción pública de 24 horas. Puede cancelar citas pasadas o futuras del mes indicado.
- Cambia el estado a `CANCELLED` (sin borrado físico) y escribe un evento de bitácora `CANCELLED` con actor admin, en la misma transacción.
- Después de la transacción, si la cita tenía `googleEventId`, se elimina el evento y el campo se pone a `null`. Si la eliminación falla, la cita sigue `CANCELLED`, el `googleEventId` se conserva y la respuesta es `200` con `syncReason`.

Respuesta 200:

```json
{ "appointmentId": 87, "status": "CANCELLED" }
```

Si Calendar falla:

```json
{ "appointmentId": 87, "status": "CANCELLED", "syncReason": "CALENDAR_DELETE_FAILED" }
```

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `MONTH_NOT_REGISTERED` | El `month` del cuerpo no está registrado. |
| 404 | `APPOINTMENT_NOT_FOUND` | La cita no existe, no está activa o no pertenece a ese mes. |
| 400 | `APPOINTMENT_ID_INVALID` | `appointmentId` no es entero positivo. |
| 400 | `MONTHS_INVALID_FORMAT` | `month` del cuerpo no es un `YYYY-MM` válido. |
| 400 | `VALIDATION_ERROR` | Falta `month` o no es texto. |
| 400 | `UNKNOWN_ERROR` | JSON malformado o error no mapeado. |

Pendiente de aclarar: la consulta de lectura se llama `findActiveAppointmentByIdInMonthForUpdate`, pero usa `findFirst` sin `FOR UPDATE`. No hay bloqueo de fila antes de cancelar. El comportamiento con dos cancelaciones simultáneas de la misma cita no está verificado.

### GET /api/admin/clients/[clientId]

Path: `[clientId]`, entero mayor que 0. Si no lo es, responde `400 CLIENT_ID_INVALID`.

Respuesta 200:

```json
{
  "client": {
    "clientId": 14,
    "clientNumber": 7,
    "name": "Nombre de ejemplo",
    "alias": null,
    "phone": "5500000000",
    "isLoyal": false,
    "createdAt": "2026-03-10T15:00:00.000Z",
    "updatedAt": "2026-10-20T12:30:00.000Z"
  },
  "summary": {
    "totalAppointments": 4,
    "activeAppointments": 2,
    "cancelledAppointments": 1,
    "futureActiveAppointments": 1,
    "lastAppointmentDate": "2026-10-20",
    "nextAppointmentDate": "2026-12-03",
    "nextAppointmentTimeSlot": "17:00"
  },
  "appointments": [
    { "appointmentId": 87, "date": "2026-12-03", "timeSlot": "17:00", "status": "CONFIRMED" }
  ],
  "currentDate": "2026-11-01"
}
```

Semántica:

- `summary.totalAppointments`: todas las citas del cliente, sin filtrar por estado.
- `activeAppointments`: citas `CONFIRMED` o `SYNC_FAILED`. `cancelledAppointments`: citas `CANCELLED`.
- `futureActiveAppointments`: activas con fecha posterior a `currentDate`.
- `lastAppointmentDate`: fecha de la cita más reciente de cualquier estado.
- `nextAppointmentDate` y `nextAppointmentTimeSlot`: la activa futura más próxima. Son `null` si no hay ninguna.
- `appointments[]`: todas las citas del cliente, de cualquier estado, ordenadas por fecha y hora descendentes.
- `currentDate`: fecha actual en `America/Mexico_City`.

| HTTP | Código | Cuándo |
|---|---|---|
| 404 | `CLIENT_NOT_FOUND` | El cliente no existe. |
| 400 | `CLIENT_ID_INVALID` | `clientId` no es entero positivo. |
| 400 | `UNKNOWN_ERROR` | Error no mapeado. |

Pendiente de aclarar: `business-rules.md` (Detail policy) dice que la línea de tiempo excluye `PENDING` y `REJECTED`, y que las métricas de detalle cuentan solo `CONFIRMED`. El código incluye todos los estados en `appointments[]` y en `summary.totalAppointments`.

### GET /api/admin/clients/catalog

Query:

- `query` (opcional): texto de hasta 100 caracteres tras recortar. Busca por subcadena en `name` y `alias`. Si contiene dígitos, busca también en `phone` por esos dígitos.
- `status` (opcional): `ALL` (por defecto), `WITH_FUTURE_APPOINTMENTS`, `WITHOUT_FUTURE_APPOINTMENTS` o `LOYAL`. Se normaliza a mayúsculas.
- `sort` (opcional): `RECENT` (por defecto, `updatedAt` descendente), `NAME_ASC`, `NAME_DESC` (ambos con `updatedAt` descendente como desempate) o `APPOINTMENTS_DESC`.
- `page` (opcional): entero mayor o igual que 1. Por defecto `1`.
- `pageSize` (opcional): entero de `1` a `100`. Por defecto `20`.

Respuesta 200:

```json
{
  "filters": { "query": "ejemplo", "status": "ALL", "sort": "RECENT", "page": 1, "pageSize": 20 },
  "metrics": {
    "totalClients": 40,
    "withFutureAppointments": 6,
    "withoutFutureAppointments": 34,
    "loyalClients": 10,
    "loyalClientsPercentage": 25
  },
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 },
  "clients": [
    {
      "clientId": 14,
      "clientNumber": 7,
      "name": "Nombre de ejemplo",
      "alias": null,
      "phone": "5500000000",
      "isLoyal": false,
      "createdAt": "2026-03-10T15:00:00.000Z",
      "updatedAt": "2026-10-20T12:30:00.000Z",
      "totalAppointments": 3,
      "hasFutureActiveAppointments": true,
      "lastAppointmentDate": "2026-10-20",
      "nextAppointmentDate": "2026-12-03",
      "nextAppointmentTimeSlot": "17:00"
    }
  ],
  "currentDate": "2026-11-01"
}
```

Semántica:

- `metrics` se calcula sobre los clientes que cumplen `query`, sin aplicar `status`: `totalClients`, `withFutureAppointments`, `withoutFutureAppointments`, `loyalClients` y `loyalClientsPercentage` (redondeado; `0` si no hay clientes).
- `pagination.total` cuenta los clientes que cumplen `query` y `status`. `totalPages` es como mínimo `1`.
- `clients[].totalAppointments`: solo citas `CONFIRMED`.
- `hasFutureActiveAppointments`, `nextAppointmentDate` y `nextAppointmentTimeSlot`: la primera cita `CONFIRMED` o `SYNC_FAILED` con fecha posterior a `currentDate`.
- `lastAppointmentDate`: fecha de la cita más reciente de cualquier estado.
- `PENDING` no cuenta en los contadores (D66).

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `CLIENT_CATALOG_PAGE_INVALID` | `page` contiene algo que no son solo dígitos. |
| 400 | `CLIENT_CATALOG_PAGE_SIZE_INVALID` | `pageSize` contiene algo que no son solo dígitos. |
| 400 | `VALIDATION_ERROR` | `status` o `sort` fuera de lista, `query` de más de 100 caracteres, `page` menor que 1 o `pageSize` fuera de `1..100`. |
| 400 | `UNKNOWN_ERROR` | Error no mapeado. |

Pendiente de aclarar:

- Los rangos de `page` y `pageSize` responden `VALIDATION_ERROR`, no los códigos personalizados que aparecen en el esquema. Solo los valores no numéricos responden esos códigos.
- `sort=APPOINTMENTS_DESC` ordena por el número de citas de cualquier estado, mientras que `totalAppointments` muestra solo `CONFIRMED`.

### GET /api/admin/clients/next-number

Sin parámetros.

Respuesta 200:

```json
{ "nextClientNumber": 42 }
```

`nextClientNumber` es el máximo `clientNumber` existente más uno, o `1` si no hay clientes. Es solo una sugerencia: no reserva el número.

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `UNKNOWN_ERROR` | Error no mapeado, por ejemplo de base de datos. |

### GET /api/admin/clients/search

Query:

- `query` (obligatorio en la práctica): texto de 2 a 100 caracteres tras recortar. Si falta o es más corto, responde `VALIDATION_ERROR`.
- `limit` (opcional): entero de `1` a `20`. Por defecto `8`. Si no son solo dígitos, responde `CLIENT_SEARCH_LIMIT_INVALID`. Si está fuera de rango, responde `VALIDATION_ERROR`.

Semántica:

- Coincide igual que el catálogo: subcadena en `name` y `alias`, y en `phone` si la consulta contiene dígitos.
- Lee los `limit × 3` clientes coincidentes más recientes por `updatedAt`, los ordena por relevancia y devuelve los primeros `limit`. La relevancia es `0` si el nombre, el alias o el teléfono empieza por la consulta, `1` si la contiene y `2` en otro caso. Un cliente fuera de esa ventana de recientes no aparece, aunque coincida mejor.
- `total` es el número de elementos devueltos (no mayor que `limit`), no el número total de coincidencias.
- Solo lectura.

Respuesta 200:

```json
{
  "query": "ejemplo",
  "total": 1,
  "clients": [
    { "clientId": 14, "clientNumber": 7, "name": "Nombre de ejemplo", "alias": null, "phone": "5500000000", "isLoyal": false }
  ]
}
```

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `query` falta o tiene menos de 2 caracteres, o `query` supera 100, o `limit` está fuera de `1..20`. |
| 400 | `CLIENT_SEARCH_LIMIT_INVALID` | `limit` contiene algo que no son solo dígitos. |
| 400 | `UNKNOWN_ERROR` | Error no mapeado. |

---

## Endpoints públicos auxiliares

Esta sección cubre dos endpoints públicos sin ficha previa: la liberación best-effort de un lock de reserva y las rutas `/api/cancelar*`, que están retiradas.

### POST /api/reservar/lock/release-beacon

Sin sesión. Está pensado para `navigator.sendBeacon` al salir de la página de reserva.

Cuerpo:

```json
{ "lockToken": "token-de-ejemplo" }
```

Semántica:

- Recorta `lockToken`. Si falta, está vacío o no es texto, responde `400 LOCK_TOKEN_REQUIRED`.
- Borra la fila de `reservation_locks` con ese token. No usa transacción ni locks con nombre, y no modifica citas, bloqueos ni Google Calendar.
- No comprueba teléfono, fecha ni expiración. Basta con conocer el token para liberar el lock.
- Es idempotente: repetir la llamada no produce error.

Respuesta 200:

```json
{ "released": true }
```

`released` es `true` si borró una fila. Es `false` si el token no existe, ya se liberó o la fila ya no está.

| HTTP | Código | Cuándo |
|---|---|---|
| 400 | `LOCK_TOKEN_REQUIRED` | `lockToken` falta, está vacío o no es texto. |
| 400 | `UNKNOWN_ERROR` | JSON malformado o error no mapeado. |

### POST /api/cancelar/buscar y POST /api/cancelar

Rutas retiradas. Ambas responden `410` sin leer el cuerpo ni la sesión:

```json
{
  "errorCode": "ENDPOINT_DEPRECATED_USE_MY_APPOINTMENTS",
  "error": "ENDPOINT_DEPRECATED_USE_MY_APPOINTMENTS"
}
```

El reemplazo está en `/api/my-appointments/*` (ver "Public My Appointments Endpoints"). El manejador no indica la ruta exacta de cada una.

Pendiente de aclarar: `lib/cancel/api-client.ts` todavía llama a estas dos rutas. Su único consumidor, `hooks/cancel/use-cancel-flow.ts`, se usa desde `components/cancel/cancel-form.tsx`, que ninguna página monta. `app/cancelar` y `app/citas/cancelar` solo redirigen a `/my-appointments`. Hoy no hay una llamada alcanzable desde una página.

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
