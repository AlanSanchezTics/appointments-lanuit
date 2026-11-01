# ADR 0005: Capacidad del dashboard y contadores sin PENDING

- Estado: Accepted
- Fecha: 2026-10-30
- Spec: [003 Disponibilidad flexible por mes](../../specs/003-flexible-month-availability/spec.md)
- Decisiones de origen: D44, D53, D59, D61, D66, D68, D71

## Contexto

El dashboard calculaba la capacidad con una constante fija de tres citas por día (`MAX_APPOINTMENTS_PER_DAY`, retirada en la ronda 4A). Con reglas por mes, un día puede admitir otra cantidad, o ninguna. Además, los contadores y la agenda no trataban de forma consistente las citas `PENDING`: las notas D59 y D61 decían que sí las contaban, y la lista de agenda y los contadores de la BD las excluían.

## Decisión

- **Capacidad** de cada fecha = `maxPerDay` del día resuelto con las reglas de su propio mes. Un día cerrado tiene capacidad 0 (D44, D53). La capacidad semanal y la del día son suma de esas capacidades. Implementado en `lib/admin/dashboard/service.ts`.
- **Contadores de ocupación del admin** no cuentan `PENDING` (D66): solo `CONFIRMED` y `SYNC_FAILED`. Se usan en el dashboard y en el detalle del mes.
- **Listas de agenda** tampoco muestran `PENDING` (la lista visible sigue sin ellas).
- **Escrituras admin** sí respetan las citas `PENDING` como ocupadas: agendar, reprogramar y bloquear un horario con una `PENDING` lo rechaza (D68, D71). El flujo público también bloquea por `PENDING`, sin cambio.

## Consecuencias

- Positivo: la capacidad refleja la configuración real del día, incluidos los cierres.
- Positivo: el admin no cuenta como ocupado un horario que todavía no confirmó, pero no puede pisarlo.
- Negativo: la ocupación semanal puede superar 100 %. Se aceptó sin tope, por decisión del owner. El porcentaje diario sí se limita a 100.
- Deuda de comentarios (abierta al cierre de T078): los comentarios de `lib/admin/months/detail-service.ts` (línea 189, D59) y `lib/admin/dashboard/service.ts` (línea 473, D61) describen `PENDING` como incluida. La decisión vigente es D66. Corregir los comentarios exige un cambio de código, fuera de la ronda documental; queda como pendiente.
