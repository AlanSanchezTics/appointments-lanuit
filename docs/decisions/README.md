# Decisiones de arquitectura (ADR)

Registro de decisiones de arquitectura del proyecto. Cada ADR documenta contexto, decisión y consecuencias, y enlaza la spec que la originó.

Formato: un archivo por decisión, `NNNN-titulo-corto.md`, con estado (`Accepted`, `Superseded`), fecha y enlace a la spec. Los ADR no reemplazan `docs/specification.md` ni `docs/architecture/*`: explican por qué la arquitectura es como es.

| ADR | Título | Estado | Fecha | Spec |
|---|---|---|---|---|
| [0001](0001-min-gap-reemplaza-pares-direccionales.md) | `minGapMinutes` reemplaza el modelo de pares direccionales | Accepted | 2026-10-30 | 003 |
| [0002](0002-diferencias-con-bloqueos-manuales-frente-al-legado.md) | Diferencias con bloqueos manuales frente al legado (48 de 432) | Accepted | 2026-10-30 | 003 |
| [0003](0003-bloqueos-puntuales-de-una-hora.md) | Bloqueos puntuales de una hora en Google Calendar | Accepted | 2026-10-30 | 003 |
| [0004](0004-derivacion-de-slot-mode.md) | `slot_mode` se deriva de las reglas y queda como legado (superada: columna retirada del código en 4B; eliminación física pendiente con 0023) | Superseded | 2026-10-30 | 003 |
| [0005](0005-capacidad-del-dashboard-y-contadores.md) | Capacidad del dashboard y contadores sin PENDING | Accepted | 2026-10-30 | 003 |
| [0006](0006-concurrencia-reservas-orden-de-locks.md) | Concurrencia de reservas, orden de locks y riesgos aceptados | Accepted | 2026-10-30 | 003 |

Documentos relacionados:

- `docs/architecture/data-model.md`: esquema, restricciones, backfill y recuperación de la migración `0022`.
- `docs/architecture/api.md`: contratos de endpoints.
- `docs/architecture/spec-driven-development.md`: flujo de trabajo por especificación.
