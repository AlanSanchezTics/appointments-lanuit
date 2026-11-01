# Contrato API admin: disponibilidad por mes

**Feature**: `003-flexible-month-availability` | **Date**: 2026-10-28 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

Contrato de trabajo. Los endpoints son de `/api/admin/months/[month]/...`, requieren sesión admin (`auth()`), y siguen el patrón existente de `buildErrorPayload` y `normalizeErrorCode`. Las rutas son delgadas: validan, llaman a `lib/admin/months/service.ts` y devuelven JSON. La lógica vive en `lib/availability/` y `lib/db/availability-rules.ts`.

Formato de fechas: `YYYY-MM-DD`. Formato de horas: `HH:mm`. Zona horaria: `America/Mexico_City` (FR-037).

## Resumen de endpoints

| Método y ruta | Estado | Propósito |
|---|---|---|
| `GET /api/admin/months/[month]` | Existente, **campos aditivos** | Detalle del mes con `slotMode` (legado), `rules`, `exceptions`, `availabilityVersion` (FR-034) |
| `GET /api/admin/months/[month]/availability` | **Nuevo** | Reglas, excepciones y versión para el editor |
| `POST /api/admin/months/[month]/availability/preview` | **Nuevo** | Calcula citas afectadas sin escribir (FR-023) |
| `PUT /api/admin/months/[month]/availability` | **Nuevo** | Reemplaza reglas y excepciones del mes (FR-020, FR-041) |
| `PATCH /api/admin/months/[month]/slot-mode` | Existente, **contrato ampliado** | Reemplaza reglas por preset D4 y conserva excepciones (D16, D33) |
| `GET /api/admin/months/[month]/days/[date]/agenda` | Existente, **campo aditivo** | Añade `availableSlots` (A-07, PD-09) |
| `GET /api/admin/months/[month]/blockable-slots` | Existente, **cambio de origen** | Horarios bloqueables desde el resolvedor |
| `POST /api/admin/months` | Existente, **cambio de comportamiento** | Crea meses sin reglas (D17); `slot_mode = BLOCK_MODE` (D31) |

## `GET /api/admin/months/[month]/availability`

Respuesta `200`:

```json
{
  "month": "2026-12",
  "availabilityVersion": 3,
  "slotMode": "BLOCK_MODE",
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
    {
      "id": 4,
      "date": "2026-12-19",
      "times": [],
      "minGapMinutes": 240,
      "preserveCapacity": true,
      "maxPerDay": 3
    }
  ],
  "usesDefaultRule": false
}
```

- `weekdays`: ISO, 1 = lunes, 7 = domingo (A-10).
- `slotMode`: campo legado de las fases 1 a 3. Se retira de esta respuesta en la fase 4, sin alias (D49).
- `usesDefaultRule`: `true` cuando el mes no tiene reglas; el resolvedor aplica D6 a los días no cubiertos por excepción (D28). Es informativo; el editor lo muestra como aviso.
- Errores: `404 MONTH_NOT_REGISTERED`, `401 ADMIN_UNAUTHORIZED`.

## `POST /api/admin/months/[month]/availability/preview`

Cuerpo: el mismo esquema que `PUT` (sin `expectedVersion` ni `confirmAffectedAppointments`).

Respuesta `200`:

```json
{
  "affectedCount": 2,
  "affectedAppointments": [
    {
      "appointmentId": 87,
      "date": "2026-12-03",
      "timeSlot": "17:00",
      "status": "CONFIRMED",
      "clientName": "Nombre de ejemplo"
    }
  ]
}
```

- Solo citas activas (`PENDING`, `CONFIRMED`, `SYNC_FAILED`), futuras en `America/Mexico_City` (D35).
- Diferencia: citas que estaban dentro del horario vigente y quedan fuera con el conjunto propuesto (A-03). Citas que ya estaban fuera no se listan.
- "Fuera" = fecha no cubierta por ninguna regla o excepción abierta, o hora que no está en la lista de horas de la regla o excepción del día (A-04). No se consideran bloqueos manuales (D40), separación ni capacidad.
- Sin escritura. No incrementa `availabilityVersion`.
- Errores de validación de la sección *Códigos de error*.

## `PUT /api/admin/months/[month]/availability`

Cuerpo:

```json
{
  "expectedVersion": 3,
  "rules": [
    {
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
    { "date": "2026-12-19", "times": ["10:00", "14:00"], "minGapMinutes": 240, "preserveCapacity": true, "maxPerDay": 3 }
  ],
  "confirmAffectedAppointments": false
}
```

Reglas de la escritura (en una transacción, con `FOR UPDATE` sobre `active_months`, PD-07 y PD-08):

1. Mes no registrado → `404 MONTH_NOT_REGISTERED`. Mes pasado (`month < currentMonth`) → `422 MONTH_IN_PAST` (FR-021, D36).
2. `expectedVersion` distinto de `availabilityVersion` vigente → `409 AVAILABILITY_VERSION_CONFLICT` (FR-041, D24). No se escribe nada.
3. Se normalizan horas (sin duplicados, ordenadas, D37) y se validan los valores (sección *Códigos de error*). Error → `400`, no se escribe nada.
4. Se calculan las citas afectadas (preview). Si hay citas y `confirmAffectedAppointments` no es `true` → `409 AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` con `affectedAppointments` en el cuerpo (mismo formato que preview). No se escribe nada.
5. Se reemplazan reglas y excepciones, se recalcula `slot_mode` (PD-11), se incrementa `availabilityVersion` y se confirma la transacción.
6. No se escribe en `appointment_logs` (D24, FR-035). No se modifican citas ni eventos de Google Calendar (FR-022, D5).

Respuesta `200`: mismo cuerpo que el `GET` del editor, con el `availabilityVersion` nuevo y `slotMode` derivado.

## `PATCH /api/admin/months/[month]/slot-mode` (contrato ampliado)

Cuerpo:

```json
{
  "slotMode": "SECOND_ONLY_MODE",
  "expectedVersion": 3,
  "confirmAffectedAppointments": false
}
```

- `slotMode` obligatorio (`BLOCK_MODE` o `SECOND_ONLY_MODE`). `expectedVersion` y `confirmAffectedAppointments` son opcionales en la fase 1-2 (A-01; default técnico D51).
- Efecto: reemplaza las reglas del mes por el preset D4 del modo indicado (rango de mes completo, D16), **conserva las excepciones** (D33), y mantiene `slot_mode` sincronizado (D16).
- Mismo flujo de confirmación que `PUT` (D33). Sin `confirmAffectedAppointments` y con citas afectadas → `409 AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED`. Hoy el modal no envía esta confirmación: riesgo de compatibilidad (ver *Compatibilidad*).
- Mes pasado → `422 MONTH_IN_PAST` (sin cambio).
- Respuesta `200`: `{ "month": "2026-12", "slotMode": "SECOND_ONLY_MODE", "availabilityVersion": 4 }`. Hoy devuelve `{ month, slotMode }`; el campo nuevo es aditivo. En la fase 4 la respuesta pierde `slotMode` (D49).

## `GET /api/admin/months/[month]/days/[date]/agenda` (campo aditivo)

Parámetro de consulta opcional: `excludeAppointmentId` (entero). Respuesta: los campos actuales más:

```json
{
  "availableSlots": ["10:00", "14:00", "18:00"]
}
```

- Horarios ofrecibles para reagendar en ese día, calculados con el resolvedor (ocupación, bloqueos, locks y hora actual), excluyendo la cita indicada (A-07, PD-09).
- Día cerrado o sin horarios → `[]`.

## `POST /api/admin/months`

Crea meses inactivos. Cambio de comportamiento: no crea reglas (D17). El mes queda sin reglas, usa el default D6 en los días no cubiertos (D28) y guarda `slot_mode = BLOCK_MODE` (D31). Respuesta sin cambio de forma.

## Códigos de error

| Código | HTTP | Endpoint(s) |
|---|---|---|
| `ADMIN_UNAUTHORIZED` | 401 | todos |
| `MONTH_NOT_REGISTERED` | 404 | todos los de mes |
| `MONTH_IN_PAST` | 422 | `PUT`, `PATCH slot-mode` |
| `AVAILABILITY_VERSION_CONFLICT` | 409 | `PUT`, `PATCH slot-mode` (si se envía `expectedVersion`) |
| `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` | 409 | `PUT`, `PATCH slot-mode` |
| `AVAILABILITY_RULE_RANGE_OUTSIDE_MONTH` | 400 | `PUT`, `preview` |
| `AVAILABILITY_RULE_RANGE_INVALID` | 400 | `PUT`, `preview` |
| `AVAILABILITY_RULE_OVERLAP` | 400 | `PUT`, `preview` |
| `AVAILABILITY_RULE_WEEKDAYS_REQUIRED` | 400 | `PUT`, `preview` |
| `AVAILABILITY_RULE_TIMES_REQUIRED` | 400 | `PUT`, `preview` |
| `AVAILABILITY_TIME_INVALID` | 400 | `PUT`, `preview` |
| `AVAILABILITY_MIN_GAP_OUT_OF_RANGE` | 400 | `PUT`, `preview` |
| `AVAILABILITY_MAX_PER_DAY_OUT_OF_RANGE` | 400 | `PUT`, `preview` |
| `AVAILABILITY_TIMES_LIMIT_EXCEEDED` | 400 | `PUT`, `preview` |
| `AVAILABILITY_EXCEPTION_DATE_DUPLICATE` | 400 | `PUT`, `preview` |
| `AVAILABILITY_EXCEPTION_DATE_OUTSIDE_MONTH` | 400 | `PUT`, `preview` |
| `SLOT_NOT_AVAILABLE` | según la ruta existente | Reservas, reprogramaciones y agendado cuando el día no produce horarios o el horario no está disponible (D46) |
| `VALIDATION_ERROR` | 400 | solo para cuerpos que no cumplen la forma JSON (no para reglas de negocio) |

Cada código de validación es estable (FR-025). Los mensajes para la interfaz se resuelven con `react-i18next` en el cliente, por código.

## Compatibilidad

- `GET /api/admin/months/[month]` conserva `slotMode` y su forma (FR-034). Campos nuevos aditivos.
- `PATCH slot-mode` conserva ruta, cuerpo de entrada y forma de la respuesta (D45). Sin `confirmAffectedAppointments` y con citas afectadas, responde `409` sin escribir. El editor del mismo release siempre envía la confirmación, así que el `409` solo lo ve un cliente externo que no confirme (pregunta RQ-2 en `plan.md`).
- Ningún otro endpoint público cambia de forma. `GET /api/availability/[month]` mantiene `days[].date` y `days[].slots`.
- Versión de API: no hay versionado por ruta en el proyecto (`docs/architecture/api.md`); los cambios se documentan en `api.md` en la misma entrega.
