# API Contract: Admin Appointment Logs

## `GET /api/admin/appointment-logs`

Access: authenticated active admin only.

Purpose: Return appointment audit log rows with filters and pagination, or export the same filtered results as PDF.

### Query Parameters

- `page`: positive integer, default `1`
- `pageSize`: positive integer from `1` to `100`, default `20`
- `client`: optional client name or phone search string
- `actionType`: optional one of `PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED`
- `month`: optional appointment month in `YYYY-MM`
- `actionDateFrom`: optional date in `YYYY-MM-DD`
- `actionDateTo`: optional date in `YYYY-MM-DD`
- `format`: optional; omit or `json` for JSON, `pdf` for PDF export

Date filters are interpreted in `America/Mexico_City`.

### JSON Success Response

Status: `200`

```json
{
  "items": [
    {
      "id": 123,
      "appointmentNumber": 456,
      "client": {
        "name": "Cliente",
        "alias": "Alias",
        "phone": "5551234567",
        "clientNumber": 42
      },
      "actionType": "CONFIRMED",
      "actionLabel": "Cita confirmada",
      "appointmentDateTime": "2026-07-03T10:00:00-06:00",
      "actor": {
        "type": "ADMIN",
        "label": "Admin"
      },
      "actionDateTime": "2026-06-27T12:30:00-06:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  },
  "filters": {
    "client": "555",
    "actionType": "CONFIRMED",
    "month": "2026-06",
    "actionDateFrom": "2026-06-01",
    "actionDateTo": "2026-06-27"
  }
}
```

### PDF Success Response

Status: `200`

Headers:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="appointment-logs-YYYY-MM-DD.pdf"`

PDF content must include:

- visible columns from the UI table
- applied filters
- generation date/time
- empty state when no rows match

PDF export limit:

- Exports at most `1,000` filtered rows.
- If the filtered result set exceeds `1,000` rows, the API returns `EXPORT_LIMIT_EXCEEDED` with HTTP `422` instead of a partial PDF.

### Error Responses

Unauthorized:

```json
{
  "errorCode": "ADMIN_UNAUTHORIZED",
  "error": "ADMIN_UNAUTHORIZED"
}
```

Invalid query:

```json
{
  "errorCode": "VALIDATION_ERROR",
  "error": "VALIDATION_ERROR"
}
```

Unsupported format:

```json
{
  "errorCode": "UNSUPPORTED_EXPORT_FORMAT",
  "error": "UNSUPPORTED_EXPORT_FORMAT"
}
```

Export limit exceeded:

Status: `422`

```json
{
  "errorCode": "EXPORT_LIMIT_EXCEEDED",
  "error": "EXPORT_LIMIT_EXCEEDED"
}
```
