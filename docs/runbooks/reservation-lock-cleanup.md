# Reservation Lock Cleanup Runbook

## Objetivo

Eliminar locks expirados de `reservation_locks` usando limpieza por lotes, apta para ejecución programada frecuente (por ejemplo, cada minuto).

## Política

1. Limpieza lazy automática:
- `POST /api/reservar/lock` ejecuta cleanup de expirados (`expires_at <= now`).
- `POST /api/reservar/confirm` ejecuta cleanup de expirados antes de validar lock.
- `GET /api/availability/[month]` solo filtra vigentes (`expires_at > now`).

2. Limpieza operativa programada:
- Cadencia recomendada: cada minuto vía cron externo.
- El script elimina todos los locks con `expires_at <= cutoff` (donde `cutoff` es la hora de inicio de ejecución).
- Usar `batch` para controlar el tamaño de cada borrado.

## Comando

```bash
npm run locks:cleanup -- --batch=5000
```

## Verificación rápida

1. Contar filas antes y después.
2. Verificar que los locks vigentes (`expires_at > cutoff`) no fueron eliminados.
3. Revisar salida JSON del comando (`deleted`, `batchSize`, `cutoff`).

## Rollback

No aplica rollback lógico; los locks eliminados están expirados al momento del `cutoff` de ejecución.
Si se detecta borrado indebido, detener ejecuciones manuales y revisar parámetros usados.
