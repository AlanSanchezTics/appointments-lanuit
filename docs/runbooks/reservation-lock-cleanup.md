# Reservation Lock Cleanup Runbook

## Objetivo

Controlar el crecimiento de `reservation_locks` sin cron interno, usando limpieza profunda manual por lotes.

## Política

1. Limpieza lazy automática:
- `POST /api/reservar/lock` ejecuta cleanup de expirados (`expires_at <= now`).
- `POST /api/reservar/confirm` ejecuta cleanup de expirados antes de validar lock.
- `GET /api/availability/[month]` solo filtra vigentes (`expires_at > now`).

2. Limpieza profunda manual:
- Cadencia recomendada: 1 vez por semana.
- Retención recomendada: conservar locks expirados de los últimos 7 días.
- Ejecutar ad-hoc si `reservation_locks` supera 100,000 filas.

## Comando

```bash
npm run locks:cleanup -- --older-than-days=7 --batch=5000
```

## Verificación rápida

1. Contar filas antes y después.
2. Verificar que los locks vigentes no fueron eliminados.
3. Revisar salida JSON del comando (`deleted`, `olderThanDays`, `batchSize`).

## Rollback

No aplica rollback lógico; los locks eliminados están expirados.
Si se detecta borrado indebido, detener ejecuciones manuales y revisar parámetros usados.
