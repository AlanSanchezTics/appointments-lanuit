# API Contract: My Appointments

## Capability Namespace

- Canonical route: `/my-appointments`
- API namespace: `/api/my-appointments/*`

## Proposed Endpoints

### `POST /api/my-appointments/lookup`

Purpose:

- Search future appointments by phone and return their current public actionability state.

Request:

```json
{
  "phone": "5512345678"
}
```

Success `200`:

```json
{
  "appointments": [
    {
      "appointmentId": 123,
      "name": "Ana Lopez",
      "phone": "5512345678",
      "date": "2026-07-04",
      "timeSlot": "10:00",
      "status": "PENDING",
      "canCancel": false,
      "canModify": false,
      "isBlocked": true,
      "blockedReason": "PUBLIC_ACTIONS_UNAVAILABLE"
    }
  ]
}
```

Rules:

- Normalizes phone to 10 digits
- Searches future appointments regardless of `active_months`
- Includes future appointments even when no action remains available
- Blocked appointments must expose state such as `isBlocked` and an explanatory reason/message code
- `blockedReason` must be a stable machine code, for example `CANCELLATION_WINDOW_EXPIRED`, `RESCHEDULE_WINDOW_EXPIRED`, or `PUBLIC_ACTIONS_UNAVAILABLE`
- Frontend owns localized UX copy for blocked states

Errors:

- `PHONE_INVALID`
- `APPOINTMENT_NOT_FOUND`

### `POST /api/my-appointments/cancel`

Purpose:

- Cancel one or more appointments selected from the lookup result.

Request:

```json
{
  "phone": "5512345678",
  "appointmentIds": [123]
}
```

Success `200`:

```json
{
  "cancelledAppointments": [
    {
      "appointmentId": 123,
      "status": "CANCELLED"
    }
  ]
}
```

Rules:

- Eligible states: `CONFIRMED|SYNC_FAILED`
- Future appointment
- At least 24 hours away
- Source month does not need to be `ACTIVE`

Errors:

- `PHONE_INVALID`
- `APPOINTMENT_NOT_FOUND`
- `APPOINTMENT_IS_COMING_SOON`

### `POST /api/my-appointments/reschedule`

Purpose:

- Move one existing appointment to a new slot while preserving the same appointment record.

Request:

```json
{
  "phone": "5512345678",
  "appointmentId": 123,
  "month": "2026-07",
  "date": "2026-07-10",
  "timeSlot": "14:00"
}
```

Success `200`:

```json
{
  "appointmentId": 123,
  "status": "CONFIRMED",
  "date": "2026-07-10",
  "timeSlot": "14:00",
  "syncReason": null
}
```

Rules:

- Eligible source states: `PENDING|CONFIRMED|SYNC_FAILED`
- Source appointment must be future and at least 3 hours away
- Destination must satisfy public booking availability rules
- Must not apply `isLoyal` or 15-day suggestion logic
- Preserves same `appointments.id`

Errors:

- `PHONE_INVALID`
- `APPOINTMENT_NOT_FOUND`
- `APPOINTMENT_NOT_MODIFIABLE`
- `SLOT_NOT_AVAILABLE`
- `VALIDATION_ERROR`

## Admin Appointment Logs Contract Impact

- `actionType` filtering must expand to include `MODIFIED`
- log rows for `MODIFIED` must expose schedule evidence for previous and new date/time
