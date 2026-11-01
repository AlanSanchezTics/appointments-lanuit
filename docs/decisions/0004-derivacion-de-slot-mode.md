# ADR 0004: `slot_mode` se deriva de las reglas y queda como legado

- Estado: Accepted
- Fecha: 2026-10-30
- Spec: [003 Disponibilidad flexible por mes](../../specs/003-flexible-month-availability/spec.md)
- Decisiones de origen: D11, D16, D17, D19, D31, D33, D49

## Contexto

La columna `active_months.slot_mode` era la fuente de la disponibilidad. Con reglas por mes, la columna deja de ser la fuente, pero sigue siendo leída por respuestas de la API y por la versión anterior de la aplicación durante el despliegue y el rollback.

## Decisión

- `slot_mode` se mantiene sincronizado con las reglas en cada escritura, dentro de la misma transacción (`deriveSlotMode` en `lib/availability/slot-mode-derivation.ts`):
  1. Mes sin reglas: `BLOCK_MODE` (D31).
  2. Exactamente una regla que cubre todo el mes, con días 1 a 5, horas, separación, capacidad y tope iguales a un preset: el valor del preset.
  3. En otro caso: se conserva el valor actual (D19).
- Las excepciones no entran en la comparación (default técnico A-09).
- `PATCH slot-mode` reemplaza las reglas por el preset como regla de mes completo y conserva las excepciones (D16, D33).
- Los meses nuevos quedan con `BLOCK_MODE` (D17, D31). El default de la columna cambia de `SECOND_ONLY_MODE` a `BLOCK_MODE` en la migración `0022`.
- La fase 4 retira la columna, el campo `slotMode` de las respuestas, sin alias (D49), y la lectura en la UI. La eliminación física va en `0023_drop_active_months_slot_mode`, pendiente de autorización del owner.

## Consecuencias

- Positivo: la versión anterior de la aplicación muestra el preset equivalente cuando las reglas coinciden con un preset.
- Negativo: si las reglas no coinciden con un preset, la versión anterior muestra el último valor de `slot_mode`, que puede no describir la disponibilidad real (riesgo residual aceptado por D19).
- Negativo: un `PATCH slot-mode` hecho con la versión anterior actualiza solo la columna y no las reglas. Ver "Riesgos de rollback" en `docs/architecture/data-model.md`.
- Los meses creados por la reconciliación (`reconcileActiveMonthsInDatabase`) no reciben reglas y aplican la regla por defecto D6. Ver `docs/architecture/data-model.md`, sección "Default de `slot_mode`".
