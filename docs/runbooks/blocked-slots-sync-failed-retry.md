# Runbook: Blocked Slots SYNC_FAILED Retry

## Objetivo

Reintentar la sincronización con Google Calendar para bloqueos manuales en estado `SYNC_FAILED`, con el fin de llevarlos a `CONFIRMED` cuando la integración vuelva a estar disponible.

## Política

1. Regla funcional:
- Un bloqueo `SYNC_FAILED` sigue bloqueando disponibilidad en el dominio.
- Si el reintento crea/recupera el evento en Google Calendar, el bloqueo pasa a `CONFIRMED`.
- Si el reintento falla, el bloqueo permanece en `SYNC_FAILED`.

2. Ejecución operativa:
- El job se ejecuta por lotes e intenta recuperación bloqueo por bloqueo.
- Es idempotente respecto al estado (`updateMany` condicionado a `calendarSyncStatus = SYNC_FAILED`).
- Usa lock nominal por bloqueo (`GET_LOCK`) para reducir carreras entre corridas concurrentes.
- Cadencia recomendada: cada 15 minutos mediante cron externo.

## Comando

```bash
npm run blocked-slots:retry-sync-failed -- --batch=200
```

Modo simulación:

```bash
npm run blocked-slots:retry-sync-failed -- --batch=200 --dry-run=true
```

## Variables y parámetros

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: cuenta de servicio de Google.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: private key de la cuenta de servicio.
- `BLOCKED_GOOGLE_CALENDAR_ID`: calendario destino para eventos de bloqueos.
- `--batch`: tamaño de lote por iteración.
- `--dry-run`: si es `true`, no muta DB ni crea eventos; solo recorre registros.

## Verificación rápida

1. Ejecutar con `--dry-run=true` en staging.
2. Validar salida JSON con campos:
   - `scanned`
   - `recovered`
   - `calendarFailures`
   - `skippedByConcurrentChange`
   - `lockSkipped`
   - `dryRun`
   - `batchSize`
   - `executedAt`
3. Ejecutar sin dry-run y confirmar que aumente `recovered` en bloqueos recuperables.
4. Verificar en DB:
   - bloqueos recuperados cambian a `calendarSyncStatus = CONFIRMED`,
   - conservan/registran `googleEventId`.

## Monitoreo

- Alertar si `calendarFailures` sube de forma sostenida.
- Alertar si `recovered` se mantiene en cero durante periodos con backlog de `SYNC_FAILED`.
- Correlacionar con disponibilidad de Google Calendar y credenciales.

## Rollback operativo

- Si el job genera comportamiento inesperado:
  1. pausar el cron,
  2. ejecutar diagnóstico con `--dry-run=true`,
  3. corregir configuración de Calendar y reanudar.
- No hay rollback automático de eventos ya creados por el job; cualquier limpieza extraordinaria se hace de forma manual.
