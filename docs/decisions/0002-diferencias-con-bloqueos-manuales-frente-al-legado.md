# ADR 0002: Diferencias con bloqueos manuales frente al legado

- Estado: Accepted
- Fecha: 2026-10-30
- Spec: [003 Disponibilidad flexible por mes](../../specs/003-flexible-month-availability/spec.md)
- Decisiones de origen: D2 (superada), D43, D54

## Contexto

Al pasar al motor nuevo (ADR 0001), el resultado cambia en algunos estados con bloqueos manuales de horario. Sin bloqueos, el motor reproduce al legado sin diferencias. Con bloqueos, la semántica literal de FR-013 (rejilla menos horas bloqueadas, y después capacidad y separación sobre esa rejilla) produce horarios que el legado no producía.

La primera estimación de esas diferencias (D2) fue de 27 combinaciones. Salió de una variante del cálculo basada en pares y no de la semántica implementada. Esa cifra queda solo como historia.

## Decisión

- Se implementa la semántica literal de FR-013 (D43).
- Medido con el oráculo congelado del legado: con bloqueos manuales disjuntos de las citas ocupadas, el modelo nuevo difiere en **48 de 432** combinaciones (D43).
- El sentido de la diferencia es que el motor nuevo ofrece más horas que el legado en esos casos. El owner lo aceptó (D54).
- Sin bloqueos, el resultado es igual al legado en BLOCK_MODE y SECOND_ONLY_MODE (0 diferencias).

## Consecuencias

- La prueba de equivalencia fija la constante 48. Cualquier cambio de semántica debe actualizar esa constante y esta ADR.
- La cifra 27 de D2 no es el valor vigente. No la usen las pruebas ni la documentación de producto.
- Riesgo de cobertura: la prueba de equivalencia con el legado (`tests/lib/availability/equivalence-legacy.test.ts`) mide las combinaciones de bloqueos disjuntos solo en `BLOCK_MODE` (432). El caso `SECOND_ONLY_MODE` con bloqueos tiene pruebas puntuales, no un oráculo de equivalencia. Pendiente.
- Impacto de producto: un día con bloqueos manuales puede ofrecer más horas que antes. La documentación de negocio (`docs/architecture/business-rules.md`) debe reflejar esta semántica (D54).
