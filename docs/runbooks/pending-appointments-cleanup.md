# Runbook: Pending Appointments Cleanup

## Objetivo

Rechazar de forma operativa las citas en estado `PENDING` que superen la ventana de confirmación definida por negocio.

## Política

1. Regla funcional:
- Toda cita `PENDING` que no reciba confirmación ni rechazo manual dentro de 36 horas debe pasar a `REJECTED`.

2. Ejecución operativa:
- El job se ejecuta por lotes y es idempotente.
- Solo actualiza citas que sigan en estado `PENDING` al momento del `updateMany`.
- Cadencia recomendada: cada 15 minutos mediante cron externo.

3. Criterio de selección:
- El corte se calcula como `now - older-than-hours`.
- Valor por defecto: `36`.
- El tamaño de lote se controla con `--batch`.

## Comando

```bash
npm run appointments:reject-pending -- --older-than-hours=36 --batch=5000
```

## Variables y parámetros

- `PENDING_APPOINTMENT_REJECTION_HOURS`: valor por defecto para la ventana de rechazo automático.
- `--older-than-hours`: override puntual para una ejecución manual.
- `--batch`: tamaño del lote por iteración.

## Verificación rápida

1. Ejecutar el job en staging con un lote pequeño.
2. Confirmar que la salida JSON incluya:
   - `rejected`
   - `olderThanHours`
   - `batchSize`
   - `executedAt`
3. Revisar que las citas confirmadas o rechazadas no cambien de estado.
4. Validar que las citas `PENDING` recientes no entren en el corte.

## Monitoreo

- Revisar salida estándar del job en cada corrida.
- Alertar si `rejected` es inusualmente alto o cero durante una ventana esperada de actividad.
- Correlacionar el volumen de `PENDING` con el bloque de pendientes del dashboard admin.

## Rollback operativo

- No existe rollback automático para citas ya marcadas `REJECTED`.
- Si una cita fue rechazada por error, un admin debe corregirla manualmente solo si el proceso de negocio lo permite.
- Si se detecta un corte incorrecto, pausar el cron, ajustar `older-than-hours` y reanudar con validación previa en staging.
