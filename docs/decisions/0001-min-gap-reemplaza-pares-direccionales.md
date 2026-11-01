# ADR 0001: `minGapMinutes` reemplaza el modelo de pares direccionales

- Estado: Accepted
- Fecha: 2026-10-30
- Spec: [003 Disponibilidad flexible por mes](../../specs/003-flexible-month-availability/spec.md)
- Decisiones de origen: D1, D3, D4, D20

## Contexto

La disponibilidad del legado (`lib/availability/rules.ts`, retirado en la ronda 4A, con `DIRECTIONAL_SLOT_PAIRS` y `MAX_APPOINTMENTS_PER_DAY = 3`) depende de dos modos fijos, `BLOCK_MODE` y `SECOND_ONLY_MODE`. Cada modo codifica en constantes qué pares de horas son compatibles. Ese modelo no admite días, horas, separación ni capacidad configurables por mes.

## Decisión

Cada regla de disponibilidad guarda tres parámetros además de sus fechas, días y horas:

- `min_gap_minutes` (0 a 1440): separación mínima entre horas de inicio. Un horario se ofrece si dista de cada cita ocupada al menos ese número de minutos (FR-009, D25).
- `preserve_capacity`: si es verdadero, un horario solo se ofrece si no reduce la cantidad máxima de citas que el día todavía admite (FR-010).
- `max_per_day` (1 a 6): tope de citas del día (D20).

Los dos modos del legado pasan a ser presets de la regla (D4). Un único resolvedor en `lib/availability/` calcula los horarios de todas las pantallas y reservas (FR-016). Ningún consumidor vuelve a implementar la regla.

## Consecuencias

- Positivo: los modos del legado se expresan como datos, sin código especial. El motor es el mismo para cualquier configuración.
- Positivo: la capacidad y la separación son explícitas por regla y por excepción.
- Negativo: el motor hace una búsqueda exhaustiva con poda por tope (`best`). El coste está acotado por `maxPerDay` (medido durante la implementación de la spec 003: 74 a 126 ms en el peor caso, con un pico aislado de 235 ms).
- Retirado en la ronda 4A: las constantes de pares (`DIRECTIONAL_SLOT_PAIRS`), `MAX_APPOINTMENTS_PER_DAY`, `BASE_TIME_SLOTS` y `SECOND_ONLY_BASE_TIME_SLOTS`, y el archivo `lib/availability/rules.ts`. El oráculo congelado del legado (`tests/lib/availability/fixtures/legacy-block-oracle.ts`) conserva el comportamiento anterior para las pruebas de equivalencia.
- Diferencias de resultado frente al legado: ver ADR 0002.
