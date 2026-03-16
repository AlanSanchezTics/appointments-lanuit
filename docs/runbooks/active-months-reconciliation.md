# Active Months Reconciliation Runbook

## Objetivo

Mantener `active_months` sincronizada para que solo la ventana vigente de meses se marque como `ACTIVE`.

## Política

- Fuente de verdad: MySQL (`active_months`).
- Scheduler externo recomendado: diario a las 00:05 en `America/Mexico_City`.
- Ventana configurable por `ACTIVE_MONTH_WINDOW_SIZE` (default `2`).

## Comando

```bash
npm run months:reconcile -- --window=2
```

## Resultado esperado

Salida JSON con:
- `currentMonth`
- `windowSize`
- `activeMonths`

## Verificación rápida

1. Confirmar que `activeMonths` contiene mes actual + siguientes N-1.
2. Confirmar que meses pasados quedaron `INACTIVE`.
3. Confirmar que no existen duplicados por `month`.

## Rollback

1. Corregir manualmente estados en `active_months`.
2. Re-ejecutar el comando con la ventana correcta.
3. Verificar con consultas SQL y endpoints de disponibilidad.
