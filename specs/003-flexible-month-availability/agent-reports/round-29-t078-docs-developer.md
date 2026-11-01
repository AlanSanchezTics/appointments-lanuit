# Ronda 29 (T078) - Developer: cierre documental de la fase 4

Spec 003, tarea T078 (`tasks.md`, línea 189). Rama `003-flexible-month-availability`. Solo documentación: no se tocó código, esquema, locales ni pruebas. Sin commit ni push. `tasks.md` no se modificó en esta ronda: T078 queda en `[ ]`.

Estado: alcance documental cerrado salvo el punto (4) de la tarea (endpoints sin contrato en `api.md`), que queda pendiente. T078 no se marca `[X]` por las razones de "Pendiente para el Orquestador".

## Flow Contract Check

- UI steps updated: No. No cambia ningún paso de UI. Se corrigieron textos de documentación que describían el selector `Modalidad` retirado y el gráfico semanal de 5 columnas.
- API contract updated: Yes. `docs/architecture/api.md` (menciones de "Fase 4" sustituidas por "retirado, sin alias (D49)") y `docs/specification.md` (respuesta de detalle del mes y respuesta de `PATCH slot-mode` alineadas con el código).
- Validation rules updated: No.
- Acceptance criteria updated: No. `tasks.md` no se tocó.
- docs/specification.md aligned: Yes, para las secciones listadas en "Documentation Impact". Punto abierto de código, documentado y no corregido: la tarjeta semanal todavía dibuja 5 columnas (ver "Pendiente para el Orquestador", punto 1).

## Migration Compatibility Check

- Schema changes required: No en esta ronda. La migración `0023` se creó en la ronda 4B; aquí solo se documenta.
- Data backfill required: No.
- Legacy compatibility required: Yes. Documentada en `docs/architecture/data-model.md`, sección "Migración 0023: orden, compatibilidad y rollback".
- Rollback strategy defined: Yes. No automática; respaldo recomendado y pendiente de decisión del owner.
- Cleanup phase defined: Yes. El código y la documentación ya no referencian la columna; la eliminación física va en `0023`, pendiente de despliegue (Gate 4).
- Integrity protections defined: Yes, sin protecciones nuevas. La eliminación no toca claves foráneas ni índices (la columna no tenía índice).

## Admin UI Check

- Uses components/admin/ui: No cambio de UI. Solo texto de `docs/ui/admin/components.md`.
- Reused existing components: N/A.
- New reusable components created: No.
- Tokens respected: N/A.
- design-system.md aligned: N/A (sin cambio visual).
- Public flow untouched: Yes. No se editó `booking-flow` ni `cancel-flow` salvo una frase de nota sobre la inconsistencia aceptada del reagendado (ver abajo).

Notification Contract Check: N/A (sin notificaciones).

## Documentation Impact

- Yes
- Updated docs/specification.md: Yes.
- Sections affected (por encabezado):
  - 4.3, "Cambios de reglas y versión": bullet de la columna `slot_mode` legada (L119).
  - 7 (flujo de reserva pública), sugerencia de `PENDING`: nota de la inconsistencia aceptada (L186). Redactada sin "candidata a Fase 4".
  - 10 (modelo de datos), tabla `active_months`, sección 10.1 "Disponibilidad por mes (spec 003)": L526, L605, L610, L614.
  - 15.1.4 Dashboard, bloque de ocupación semanal (L837): la API devuelve siete días; la tarjeta todavía usa 5 columnas.
  - 15.7 Catálogo de meses: estado de implementación sin "Fase 1/2" (L1056-1057); editor "Reglas" sin "Modalidad" (L1131); creación de meses sin `slot_mode` (L1221, L1230); payload de `PATCH slot-mode` como entrada de preset (L1319-1320, sin cambio de contrato); respuestas de `GET /api/admin/months/[month]` sin `slotMode` y de `PATCH slot-mode` como `{ month, availabilityVersion }` (L1493-1494, L1503).
- Otros documentos actualizados:
  - `docs/architecture/data-model.md`: estado de la migración 0023; sección "Presets de entrada de PATCH slot-mode" (sustituye a "Derivación de slot_mode"); default y estado legado; sección nueva "Migración 0023: orden, compatibilidad y rollback"; bitácora con la fila 0023 (aplicada solo en `appointments_test`, pendiente de Gate 4); "Riesgos de rollback" renombrado como release 0022.
  - `docs/architecture/business-rules.md`: reglas de creación de meses y sección "Slot mode (presets only)" (en inglés, como el resto del documento).
  - `docs/architecture/api.md`: menciones de "Fase 4" retiradas en cuatro lugares.
  - `docs/features/admin-months-catalog-flow.md` (pasos y reglas de creación), `docs/features/admin-month-detail-flow.md` (botón `Reglas`; encabezado "Contrato backend para agendado admin" sin "(Fase 1)"), `docs/features/admin-auth-flow.md` (barras del dashboard), `docs/features/booking-flow.md` (nota de reagendado).
  - `docs/ui/admin/components.md`: L906 sin "Modalidad"; L298 con el estado real del gráfico.
  - ADR: `0001` (negativo: constantes retiradas en 4A; contexto con `rules.ts` retirado), `0004` (estado `Superseded`, sección "Estado actual" y decisión original conservada como historia), `0005` (constante retirada; deuda de comentarios marcada como abierta), `0006` (F1 y residual H1 en el mismo epígrafe; F2 con aceptación del owner el 2026-11-01), `docs/decisions/README.md` (fila 0004 `Superseded`).
- `README.md`: revisado; no contiene referencias a `slot_mode`, `slotMode`, "Modalidad", pares ni fases. Sin cambios.
- `specs/README.md`: sin cambios. La fila 003 se queda como está (no `Implemented`), según la instrucción de la ronda.

## Archivos modificados en esta ronda

- `docs/specification.md`
- `docs/architecture/data-model.md`
- `docs/architecture/business-rules.md`
- `docs/architecture/api.md`
- `docs/features/admin-months-catalog-flow.md`
- `docs/features/admin-month-detail-flow.md`
- `docs/features/admin-auth-flow.md`
- `docs/features/booking-flow.md`
- `docs/ui/admin/components.md`
- `docs/decisions/0001-min-gap-reemplaza-pares-direccionales.md`
- `docs/decisions/0004-derivacion-de-slot-mode.md`
- `docs/decisions/0005-capacidad-del-dashboard-y-contadores.md`
- `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`
- `docs/decisions/README.md`
- Este informe (nuevo).

`git status` de `docs/`: los archivos de la lista (más `api.md`, que ya estaba modificado desde la ronda 4B). No hay cambios fuera de `docs/` y de este informe.

## Verificación contra el código (lectura y grep, no ejecución)

Confirmado en el árbol de trabajo actual:

- `lib/availability/rules.ts`, `lib/availability/month-slot-mode.ts`, `deriveSlotMode`, `DEFAULT_MONTH_SLOT_MODE`, `DIRECTIONAL_SLOT_PAIRS`, `BASE_TIME_SLOTS`, `MAX_APPOINTMENTS_PER_DAY` y `updateRegisteredMonthSlotMode` no aparecen en `app/`, `components/`, `hooks/`, `lib/`, `prisma/schema.prisma`, `scripts/` ni `locales/`.
- `lib/availability/defaults.ts` exporta `SLOT_MODE_PRESET_VALUES`, `AvailabilityPresetMode` y `SLOT_MODE_PRESETS`. `lib/availability/slot-mode-derivation.ts` solo exporta `buildSlotModePresetRules`.
- `lib/admin/months/service.ts` (`updateAdminMonthSlotMode`) devuelve `{ month, availabilityVersion }`. `lib/admin/months/types.ts`: `slotMode` aparece solo en `UpdateAdminMonthSlotModePayload` (entrada).
- `lib/db/availability-rules.ts` (`replaceMonthAvailability`) incrementa `availabilityVersion` y no escribe `slot_mode`.
- `lib/db/admin-months.ts` (`createInactiveMonths`) crea `status: "INACTIVE"` sin columna legada. `lib/db/active-months.ts` (`reconcileActiveMonthsInDatabase`) crea `{ month, status: "ACTIVE" }` sin columna legada.
- `components/admin/ui/WeeklyOccupancyCard.tsx` usa `grid-cols-5` y recorre `data.days`. `lib/admin/dashboard/service.ts` genera siete días (`getWeekDays`, `Array.from({ length: 7 })`).
- `prisma/migrations/0023_drop_active_months_slot_mode/migration.sql` contiene solo `ALTER TABLE active_months DROP COLUMN slot_mode`.
- `git show HEAD:` confirma que el código anterior a 4B seleccionaba `slotMode` en `findActiveMonth`, `listActiveMonths` y `findRegisteredMonth`, y leía `slot_mode` en la consulta SQL de disponibilidad de `lib/db/availability-rules.ts`.
- `tests/lib/availability/fixtures/legacy-block-oracle.ts` y `tests/lib/availability/equivalence-legacy.test.ts` existen (citados en ADR 0001 y 0002).
- Según ADR 0002, la prueba de equivalencia con 432 combinaciones solo cubre `BLOCK_MODE`; el caso `SECOND_ONLY_MODE` con bloqueos sigue como pendiente en esa ADR. No se cambió.

No verificado en esta ronda: el estado de la base `appointments_test` (0023 aplicada) y el resultado de las pruebas. Lo afirma el informe de la ronda 4B, no lo repetí.

## Comandos ejecutados y resultados

1. `rg -n "slot_mode|slotMode|SECOND_ONLY|BLOCK_MODE|Modalidad" docs README.md` (antes de editar): coincidencias en `docs/specification.md`, `docs/architecture/*`, `docs/features/*`, `docs/decisions/*`, `docs/ui/admin/components.md` y `docs/plans/2026-04-10-second-only-mode-availability-rules.md`.
2. `rg -n "slot_mode|slotMode|SECOND_ONLY|BLOCK_MODE|Modalidad" docs README.md | rg -v "^docs/plans/|^docs/instructions/|^docs/audits/|^docs/implementation-reports/"` (después de editar). Resultado: solo restos legítimos, listados abajo.
3. `rg -l` sobre `docs/plans`, `docs/instructions`, `docs/audits`, `docs/implementation-reports`: 1 archivo (`docs/plans/2026-04-10-second-only-mode-availability-rules.md`), no modificado.
4. Búsqueda de fases (`Fase [0-9]|fase [0-9]|fase 4|Fase 4|candidata a Fase` en `docs` y `README.md`, excluyendo plans, instructions, audits e implementation-reports). Resultado: 3 coincidencias restantes, todas revisadas:
   - `docs/architecture/data-model.md` (sección de la migración 0022): "Desplegar el código nuevo..." (texto histórico del release 0022, con el paso ya reformulado).
   - `docs/decisions/0004-derivacion-de-slot-mode.md` (cuerpo histórico de la decisión): texto original conservado bajo "Estado actual".
   - `docs/runbooks/admin-month-detail-rollout.md:9` "Migraciones de Fase 1/Fase 2 aplicadas": no está en la lista de la ronda; sin cambio.
   - `docs/features/admin-clients-catalog-flow.md` "Alcance de esta fase" y `docs/features/admin-auth-flow.md` "en esta fase": lenguaje ajeno a la spec 003; sin cambio.
5. `rg -n "BASE_TIME_SLOTS|DIRECTIONAL_SLOT_PAIRS|MAX_APPOINTMENTS_PER_DAY|...|slotMode|slot_mode" app components hooks lib prisma scripts locales`: sin restos de código excepto la entrada del preset (`lib/admin/months/validation.ts`, `types.ts`, `api-client.ts`, `service.ts` del preset), el nombre del endpoint `updateAdminMonthSlotMode` y el icono `slotModeSettings` (decisiones 4 y 5 de la ronda 4B). Migraciones 0009, 0014 y 0022 conservan la columna en su historia SQL.

### Restos legítimos tras la limpieza

- Preset de entrada de `PATCH slot-mode` (`slotMode` como cuerpo, `BLOCK_MODE|SECOND_ONLY_MODE`): `docs/specification.md` L1319-1320, `docs/architecture/api.md` L371, `docs/architecture/data-model.md` (tabla de presets, "Valor de entrada").
- Historia de migraciones y de columna: `docs/architecture/data-model.md` (0014 y 0022 en "Default", "Migración 0022", "Riesgos de rollback del release 0022", bitácora), y la migración 0023 y las fila de la bitácora. `docs/specification.md` L526 y L614 (migración histórica).
- Nota de rollback: `data-model.md` L304 "restaurar el default `SECOND_ONLY_MODE`" (default de 0014, historia).
- ADR histórico: `docs/decisions/0004-derivacion-de-slot-mode.md` (cuerpo histórico, estado `Superseded`); ADR 0002 y 0003 (diferencias de duración y de semántica histórica con `BLOCK_MODE` y `SECOND_ONLY_MODE`, con "(D2 superada)" y "residuo aceptado").
- Plan histórico: `docs/plans/2026-04-10-second-only-mode-availability-rules.md`. No se modificó; es un registro de lo planeado.
- Negaciones: "no hay vista `Por bloque` ni pares direccionales" (`specification.md` L1095), "no hay propagación direccional" (`specification.md` L1194, `booking-flow.md` L178), y `business-rules.md` L72-76, 671, 696.
- Icono `slotModeSettings` en `components/admin/ui/admin-icons.ts` (código, no docs): pendiente de decisión (decisión 4 de la ronda 4B).

## Qué está verificado y qué no

Verificado en esta ronda, con lectura y grep:
- Que cada afirmación cambiada coincide con el código actual o con `HEAD` cuando describe el comportamiento anterior (lista en "Verificación contra el código").
- Que no quedan `Modalidad`, `slotMode` en respuestas, ni referencias a constantes o archivos retirados en `docs/` salvo los restos legítimos listados.
- Que `docs/` contiene solo cambios de documentación en esta ronda.

No verificado (no ejecutado en esta ronda):
- No se ejecutaron pruebas (`npm test`, `npm run test:integration`), `tsc`, `eslint` ni `next build`. No hay cambios de código; las cifras de la ronda 4B siguen siendo la referencia.
- No se comprobó en `appointments_test` que `0023` esté aplicada ni que la columna no exista (lo afirma el informe 4B).
- No se revisó el formato de las tablas Markdown con una herramienta de enlaces o de lint de Markdown.
- Sin revisión visual de la tarjeta semanal (la afirmación de 7 elementos en 5 columnas viene del código, no de un render).

Pendiente del owner (no decidido aquí):
- Gate 4 para desplegar `0023`, verificación de procesos anteriores a 4B, y decisión sobre el respaldo previo (recomendado, no decidido).
- Confirmar si `availability_migration_runs` se conserva (la documentación dice que sí, hasta decisión).
- Aceptación manual de la UI del admin y pruebas E2E (pendientes desde 4B).

## Pendiente para el Orquestador

1. T078 queda en `[ ]`, por tres motivos:
   - La propia tarea incluye "actualizar la fila 003 de `specs/README.md` a Implemented solo después de la implementación". Esa fila no se toca en esta ronda.
   - Punto de código abierto que la documentación ya describe: la tarjeta `WeeklyOccupancyCard.tsx` usa `grid-cols-5` con siete días (D57). No hay tarea en `tasks.md` para corregirlo. Decisión necesaria: crear tarea de código (la corrección es una línea de clase, pero es cambio de código) o aceptarlo como deuda.
   - Deuda de comentarios de código (ADR 0005): `lib/admin/months/detail-service.ts` L189 y `lib/admin/dashboard/service.ts` L473 describen `PENDING` como incluida, contra D66. Es cambio de código; no se tocó.
2. Punto (4) de la ronda, endpoints sin contrato en `api.md`: no hecho. Sin contrato derivado con certeza de: `GET /api/admin/months/catalog`, `PATCH .../status`, `.../blocked-slots/[id]`, `POST /api/admin/appointments/[id]/{confirm,reject,cancel}`, `/api/admin/clients/*`, `POST /api/reservar/lock/release-beacon`, `/api/cancelar*`. Requiere leer al menos ocho manejadores, su validación y su servicio. Para no agotar el presupuesto, queda como ronda documental propia.
3. Riesgos aceptados F2 (D83), NB-1 y H1: viven en `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md`, sección "Riesgos conocidos que esta decisión acepta". Es el único sitio de riesgos del repositorio (no hay archivo de notas de release). Si el owner quiere otro lugar, decisión del owner. F2 queda con la fecha de aceptación 2026-11-01. NB-1 ya estaba aceptado en su texto original; no se le añadió fecha porque no consta en la documentación.
4. `docs/plans/2026-04-10-second-only-mode-availability-rules.md` contiene el vocabulario antiguo. Es histórico y no se modificó. Si el owner quiere, se puede añadir una nota de estado, pero no se hizo por no estar en la lista de la ronda.
5. `docs/runbooks/admin-month-detail-rollout.md:9` sigue diciendo "Migraciones de Fase 1/Fase 2 aplicadas". Fuera de la lista; pendiente.
6. Gate 4, respaldo previo y verificación de procesos siguen siendo decisiones del owner (ver "Pendiente del owner" del informe 4B).
7. `specs/README.md` y `STATE.md` no se tocaron. El Orquestador debe actualizar el "Resume here" y el historial, incluida la ronda 29.

## Limitaciones

- Solo documentación. No se ejecutaron pruebas ni herramientas de build.
- La revisión es de lectura y grep. No hay verificación de render ni de enlaces.
- Los números de línea citados son los del estado tras mis ediciones.
- Turnos: estimación, no medida: unas 70 llamadas a herramientas, dentro del presupuesto de 80. No hubo handoff por límite.

## Handoff

- Hecho: correcciones de `docs/` del punto 1 al 3 de la tarea, bitácora 0023 y cierre de ADR 0004; ADR 0001 y 0005 corregidos; aceptación de F2, NB-1 y H1 documentada en ADR 0006.
- Pendiente: punto (4) de `api.md`; decisión sobre la tarjeta de 5 columnas (código); comentarios de código de D59/D61; fila 003 de `specs/README.md` (solo tras implementación y owner); Gate 4 de 0023.
- Archivos tocados: listados arriba. Sin commit ni push.
- Siguiente paso: revisión documental (Reviewer de bajo riesgo, porque solo hay documentación), luego decisión del Orquestador sobre T078 y los puntos pendientes.
