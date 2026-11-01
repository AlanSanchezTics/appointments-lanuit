# Ronda 06 T075-E (Developer, solo documentación): informe

Estado: ediciones aplicadas. Pendiente de revisión por el Reviewer (bajo o alto riesgo, ver recomendación al final). Solo documentación: no se tocó código, tests, `lib/my-appointments/`, `tasks.md` ni `STATE.md`.

Decisión de origen: D87 (T075 review, 2026-10-30).

## Alcance

- B2 (bloqueos manuales y orden de locks): alineado con el código y con `docs/architecture/data-model.md`.
- B1 (reprogramación pública y `reservation_locks`): NO modificado. `docs/specification.md` L371 (8.2 paso 4) y `docs/architecture/business-rules.md` L288 se quedan como están; la corrección de código va en la ronda 1F (D87).
- Menores N1, N2, N3 y N4 del informe 06: aplicados (ver tabla).

## Archivos modificados

| Archivo | Cambio | Motivo (fuente de verdad) |
|---|---|---|
| `docs/specification.md`, sección 9 "Orden de locks" (L419-425) | Los bloqueos manuales no toman los locks con nombre (paso 1; limitación F2, D83). Paso 4 distingue: creación y reprogramación admin con lectura bloqueante (D77); en bloqueos manuales la lectura de citas es bloqueante y la de bloqueos de horario es plana. Paso 5: liberación de locks solo en los flujos que los tomaron. Se añade D83 al encabezado. | `lib/admin/blocked-spaces/service.ts` L230-245; `data-model.md` "Concurrencia a nivel de datos" |
| `docs/specification.md`, sección 7 paso 8 (L199-205) | Orden corregido: locks con nombre y reglas (sección 9, "Orden de confirmación", pasos 2-3) -> limpieza de locks expirados (paso 4) -> validación del `lock_token` -> conflictos del día con bloqueo (paso 6) -> disponibilidad. Antes, la limpieza iba antes de los locks (N2). | `lib/appointments/book-appointment.ts` L480-482 (acquire, rules, cleanup); sección 9 "Orden de confirmación" |
| `docs/architecture/business-rules.md`, "Concurrency Rules" (L184-189) | Mismos puntos que la spec, en inglés: el paso 1 no aplica a manual blocks; el paso 4 separa citas (exclusiva) de bloqueos de horario (planos, F2); el paso 5 limita la liberación a los flujos que tomaron locks. L177 y L185 cubiertos. | Igual que la fila anterior |
| `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`, "Decisión" (pasos 1, 4, 5) y riesgo F2 | Se añade la excepción de los bloqueos manuales al paso 1 y se corrige el paso 4 (antes decía lectura de ocupación bloqueante también en bloqueos manuales). F2 indica que los bloqueos manuales no toman los locks con nombre. | Igual que la fila anterior; ADR consistente con `data-model.md` L207-217 |
| `docs/architecture/api.md` L255 | Eliminada la frase "La reconciliación de `docs/specification.md` y de `docs/features/*` se hace en T075-B y en la Fase 2" (N3). | D87. `D52` ya fija la conciliación documental para el cierre de la Fase 2. |
| `docs/architecture/api.md`, creación admin, lista de errores (antes L440) | Eliminada la línea `422 MONTH_NOT_ACTIVE` (N1). | `grep` en `lib/`: ningún módulo lanza `MONTH_NOT_ACTIVE`. `specification.md` 15.7: el agendado no exige mes ACTIVE. |
| `docs/architecture/api.md`, nota de `LOCK_TIMEOUT` (antes L443) | "según la medición del Reviewer (informe de la Ronda 1E)" -> "según la medición de F1 (D82; ADR 0006)". | ADR 0006 F1 (medido 7 de 10) |
| `docs/architecture/data-model.md` L174 | "Ver 'Ambigüedades' en el informe de ronda" -> "Ver D6 y D84". | D84: meses reconciliados sin reglas usan D6 |
| `docs/architecture/data-model.md` L213 | "(ver el informe de ronda y las decisiones D82 y D83)" -> "(ver las decisiones D82 y D83 y ADR 0006)". | D82, D83, ADR 0006 |

## Verificación contra el código y las decisiones (estática)

Verificado por lectura y `grep` antes de editar. No se ejecutaron pruebas (no aplica a una ronda documental).

- Bloqueos manuales (`lib/admin/blocked-spaces/service.ts`, L230-245): dentro de `prisma.$transaction`, `findMonthAvailabilityForShare` (L232), `cleanupExpiredReservationLocks` (L238), `lockConflictingAppointments` (L239), `listActiveAppointmentSlotsByDateForUpdate` (L242, `FOR UPDATE` real), `listActiveReservationLocksForDate` (L243), `listBlockedSlotsByDateForUpdate` (L244, lectura plana, F2). No hay `acquireBookingLocks` ni `GET_LOCK` en `lib/admin/blocked-spaces/` (`grep` sin resultados).
- Orden de confirmación (`lib/appointments/book-appointment.ts` L480-482): `acquireBookingLocks`, `readMonthRulesInTransaction`, `cleanupExpiredReservationLocks`; después la búsqueda del token. Coincide con sección 9 "Orden de confirmación".
- `MONTH_NOT_ACTIVE`: solo aparece en `app/api/admin/months/[month]/appointments/route.ts:27` (mapeo) y en `components/admin/months/MonthDetailView.tsx:93` (caso de UI). Ningún módulo de `lib/` lo lanza. Se dejan como están (código, fuera de alcance).
- `data-model.md` "Concurrencia a nivel de datos" (L197-217) es la referencia; la spec, business-rules y el ADR ahora coinciden con ella en: exclusión de manual blocks del paso 1, lectura de citas bloqueante en bloqueos manuales, lectura plana de bloqueos de horario (F2).

## Comandos ejecutados

- `python3 scripts/check-workflow-profile.py`: exit 0 en esta ejecución. Salida: `WARNING: installed Spec Kit 0.11.9 differs from tested 1.0.5` y `OK: 9 keys, all defined, used, and resolvable`. El Reviewer de la ronda 06 registró exit 1 con el mismo aviso; el aviso es de entorno y la comprobación de claves pasa en ambas.
- `grep` de cierre sobre `docs/`: patrones "informe de ronda", "informe de la Ronda", "T075-B", "Reviewer", "Ronda 1E", "Ronda 1A", "informe 06". Quedan solo los casos listados en "Pendientes" (fuera de la lista del brief).
- `grep` de `MONTH_NOT_ACTIVE` en `docs/architecture/api.md`: 0 resultados. `grep` de `T075-B` en `api.md`: 0 resultados.
- Confirmado que B1 sigue intacto: `specification.md` L371 contiene "locks, bloqueos manuales y horario futuro"; `business-rules.md` L288 contiene "active locks, manual blocks".

## Documentation Impact

- Impacto documental: Yes.
- Cambio de comportamiento: No. Se documenta el orden y los alcances reales del código; la única reordenación (spec 7 paso 8) refleja el orden actual de `book-appointment.ts`.
- `docs/specification.md` actualizado: Yes. Secciones: 7 (paso 8, Backend de la confirmación) y 9 (Orden de locks).
- `docs/architecture/business-rules.md` actualizado: Yes. Sección: Concurrency Rules (pasos 1, 4, 5). L288 no modificado (B1 pendiente).
- ADR 0006 actualizado: Yes (Decisión y F2).
- `docs/architecture/api.md` actualizado: Yes (L255, creación admin errores, nota LOCK_TIMEOUT).
- `docs/architecture/data-model.md` actualizado: Yes (L174, L213).
- Flow Contract Check:
  - UI steps updated: No (sin cambio de pasos de UI).
  - API contract updated: Yes (sólo se quitó un código que no se lanza y se corrigió la nota).
  - Validation rules updated: No.
  - Acceptance criteria updated: No.
  - docs/specification.md aligned: Yes para los pasajes de esta ronda; No para B1 (pendiente de ronda 1F, D87).
- Migration Compatibility Check: no aplica (sin cambios de modelo, datos ni migraciones).
- Admin UI Check: no aplica (sin cambios de UI).

## Pendientes y ambigüedades (para el Orchestrator)

1. B1 (código, ronda 1F, D87): spec 8.2 paso 4 (L371) y business-rules L288 afirman que la reprogramación pública respeta `reservation_locks`; `lib/my-appointments/service.ts` `validateRescheduleDestination` no los lee. Hasta la ronda 1F, la documentación describe una garantía que el código no da. Esta ronda no lo corrige, por instrucción.
2. Citas de ronda que quedan en docs permanentes, fuera de la lista del brief. No tienen un ID de decisión que las cubra, así que no las he cambiado (no invento IDs). Decidir el reemplazo o aceptar la cita:
   - `docs/architecture/data-model.md` L241: "(informe de la ronda 1A)" sobre la prueba de `CHECK` de MySQL (`max_per_day = 7`). Sin ID en el log.
   - `docs/decisions/0002-diferencias-con-bloqueos-manuales-frente-al-legado.md` L25: "(informe de la ronda 1B)" sobre el riesgo de cobertura de `SECOND_ONLY_MODE` con bloqueos. Sin ID en el log (D54 cubre la semántica, no la cobertura).
   - `docs/architecture/data-model.md` L9 y L296: "ronda 1A" como etapa de trabajo, no como cita de informe. Se dejan.
3. `docs/decisions/0002-...md` L26: "debe reflejar esta semántica en T075-B" está en futuro, pero T075-B ya está cerrado. Reescribirlo requiere decidir el texto (ADR aceptada); no lo he tocado.
4. N3: el Reviewer proponía "Fase 2 (T076)"; D87 pide quitar la frase. Se quitó. Si el owner quiere la nota de pendiente, D52 ya la registra.
5. Código fuera de alcance: `app/api/admin/months/[month]/appointments/route.ts:27` y `components/admin/months/MonthDetailView.tsx:93` manejan `MONTH_NOT_ACTIVE`, que ya no se lanza. Candidatos a limpieza en Fase 4.

## Limitaciones

- Verificación estática por lectura y `grep`. No hay pruebas ejecutadas ni verificación en runtime. La afirmación "la documentación coincide con el código" se basa en las líneas citadas arriba.
- Los números de línea de `api.md` cambian tras las ediciones; las referencias "antes L..." indican la posición previa.

## Handoff

- Hecho: B2 (spec sección 9 y 7 paso 8, business-rules, ADR 0006), menores N1 a N4, comprobación del perfil.
- Pendiente: B1 (ronda 1F, código); citas de ronda de la lista 2; ADR 0002 L26; decisión del owner sobre las citas restantes.
- Archivos tocados: los cuatro de la tabla de arriba (`docs/specification.md`, `docs/architecture/business-rules.md`, `docs/architecture/api.md`, `docs/architecture/data-model.md`) y `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`, más este informe.
- Siguiente paso: Reviewer de documentación. Recomendación: `reviewer-high-risk`, porque los pasajes editados describen el orden de locks de escritura (área de alto riesgo: slot locks y concurrencia) y el Reviewer debe contrastarlos con el código.
