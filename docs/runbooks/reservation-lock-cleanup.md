# Reservation Lock Cleanup Runbook

## Objetivo

Eliminar locks expirados de `reservation_locks` usando limpieza por lotes, apta para ejecución programada frecuente (por ejemplo, cada minuto).

## Política

1. Limpieza lazy automática (acotada a la fecha procesada):
- `POST /api/reservar/lock` borra los expirados (`expires_at <= now`) solo de la fecha solicitada, después de bloquear las citas en conflicto del día y del teléfono.
- `POST /api/reservar/confirm` hace lo mismo con la fecha de la reserva, antes de validar el lock. No limpia locks de otras fechas.
- Las escrituras admin de la fecha (creación, reprogramación y bloqueos de espacios) limpian los expirados de esa fecha. La reprogramación pública no limpia: solo lee el lock vigente del horario destino (D88).
- `GET /api/availability/[month]` solo filtra vigentes (`expires_at > now`).

2. Limpieza operativa programada:
- Cadencia de producción: cada minuto, con el cron `Lock cleanup` (`* * * * *`, ejecuta `npm run locks:cleanup`) (D92).
- El script elimina todos los locks con `expires_at <= cutoff` de todas las fechas (`cutoff` es la hora de inicio de ejecución).
- Usar `batch` para controlar el tamaño de cada borrado.

## Comando

```bash
npm run locks:cleanup -- --batch=5000
```

## Concurrencia

- El cron corre cada minuto y no hay ventana de bajo tráfico: el script está diseñado para ejecutarse en cada disparo.
- El script borra por clave primaria, en lotes. Cada lote es una sentencia con autocommit, así que los lotes ya confirmados se conservan si una ejecución falla.
- Riesgo residual: un `Deadlock found ... (1213)` raro entre el `DELETE` por clave primaria del script y la limpieza por fecha de una reserva o de una operación admin (D88, D92).
  - Si la víctima es el script, termina con error. El script no reintenta por sí mismo: el siguiente disparo del cron, un minuto después, vuelve a ejecutarlo.
  - Si la víctima es una reserva o una operación admin, responde 400 `UNKNOWN_ERROR`. La transacción se revierte completa: no queda cita ni lock a medias y no hay doble reserva. La clienta puede volver a intentar la acción.

## Verificación rápida

1. Contar filas antes y después.
2. Verificar que los locks vigentes (`expires_at > cutoff`) no fueron eliminados.
3. Revisar salida JSON del comando (`deleted`, `batchSize`, `cutoff`).

## Rollback

No aplica rollback lógico; los locks eliminados están expirados al momento del `cutoff` de ejecución.
Si se detecta borrado indebido, detener ejecuciones manuales y revisar parámetros usados.
