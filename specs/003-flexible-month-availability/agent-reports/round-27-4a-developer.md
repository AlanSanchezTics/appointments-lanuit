# Ronda 4A (Developer): retirada del código legado de disponibilidad

Spec: 003-flexible-month-availability. Tareas: T064, T065, T066, T067, T068. Alcance: solo código y pruebas, sin migración, sin commits.

## Resumen

- Retirado `lib/availability/rules.ts` (modelo legado con pares direccionales y tope fijo de 3). Ningún archivo de `app`, `lib`, `components`, `hooks` ni `tests` lo importaba, salvo su propia prueba.
- Retiradas las constantes `DIRECTIONAL_SLOT_PAIRS`, `MAX_APPOINTMENTS_PER_DAY`, `BASE_TIME_SLOTS` y el tipo derivado `BaseTimeSlot`. Ningún uso restante fuera del oráculo.
- Retirados `resolveBaseSlotsByMonthMode` y `SECOND_ONLY_BASE_TIME_SLOTS`. Se conserva `MonthSlotMode`, `MONTH_SLOT_MODE_VALUES` y `DEFAULT_MONTH_SLOT_MODE`.
- El oráculo congelado (T013) se conserva. Sus 10 casos concretos de `rules.test.ts` migran a `equivalence-legacy.test.ts` y se afirman contra el oráculo y contra el motor.
- Resultado: sin regresiones. Los fallos de unitaria (21) e integración (5) son idénticos en nombre a la línea base.

## Archivos modificados y borrados

| Archivo | Cambio |
|---|---|
| `lib/availability/rules.ts` | Borrado. |
| `tests/lib/availability/rules.test.ts` | Borrado. Sus 10 casos se conservan en `equivalence-legacy.test.ts` (ver abajo). |
| `lib/constants/slots.ts` | Quedan solo `GOOGLE_EVENT_DURATION_HOURS` y `REQUIRED_TIMEZONE`. Se quitan `BASE_TIME_SLOTS`, `DIRECTIONAL_SLOT_PAIRS`, `MAX_APPOINTMENTS_PER_DAY` y `BaseTimeSlot`. |
| `lib/availability/month-slot-mode.ts` | Se quitan `resolveBaseSlotsByMonthMode`, `SECOND_ONLY_BASE_TIME_SLOTS` y el import de `BASE_TIME_SLOTS`. Se conservan `MONTH_SLOT_MODE_VALUES`, `MonthSlotMode` y `DEFAULT_MONTH_SLOT_MODE`. |
| `tests/lib/availability/month-slot-mode.test.ts` | Se quitan 3 casos de `resolveBaseSlotsByMonthMode`. Queda el caso del valor por defecto. |
| `tests/lib/availability/equivalence-legacy.test.ts` | Se añade un bloque `it.each` con los 10 casos de `rules.test.ts`. Cada caso se afirma contra `legacyGetAvailableStartSlotsWithManualBlocks` (oráculo) y contra `engineSlots` (motor). |
| `tests/lib/availability/fixtures/legacy-block-oracle.ts` | Solo comentario de cabecera: deja de decir que `rules.ts` "se borra en la fase 4" y pasa a fixture permanente. Sin cambios de lógica. |
| `specs/003-flexible-month-availability/tasks.md` | Marcados [X] T064, T065, T066, T067 y T068. |

No tocados: `prisma/`, migraciones, `slot_mode`/`slotMode` en respuestas de API, `.env`, producción, `tsconfig.tsbuildinfo`, `docs/`.

## Clasificación por tarea

- **T064**: `rules.ts` y `rules.test.ts` borrados tras grep sin importaciones. Oráculo conservado.
- **T065**: hecho. El tipo `MonthSlotMode` se mantiene mientras exista la columna (T069 queda para 4B).
- **T066**: hecho. `isWeekdayBookingDate` sale con `rules.ts`: solo lo definía ese archivo y ningún código de aplicación ni prueba lo usaba. `isWeekdayInMexicoCity` (en `lib/datetime/mexico-city.ts`) es otra función y no se toca.
- **T067**: grep SC-006 sin resultados (ver evidencia).
- **T068**: los casos dependientes de pares direccionales eran los de `rules.test.ts` (migrados a oráculo y motor) y los 3 de `resolveBaseSlotsByMonthMode`. La cobertura del horario de 10/14/18 y de 6 horas ya existe en `service.test.ts` ("limits availability to 10:00, 14:00 and 18:00 in SECOND_ONLY_MODE") y en `capacity-engine.test.ts` ("offers 6 slots and 3 spaces on an empty BLOCK day"). Revisado y mantenido en `tests/lib/admin/` y `tests/lib/availability/`: los casos que usan `slotMode` (`months.detail-service`, `blocked-spaces`, `appointments.service`, `months.service`, `dashboard.service`) lo tratan como metadato persistido y construyen el horario con reglas (`buildSlotModePresetRules` o `rules` explícitas). El código de aplicación ya no lee `slot_mode` para el horario. Los tests "pair" de `book-appointment.integration` y `lock-reservation-slot` prueban la regla vigente de bloqueo y no dependen de la constante. No se borró ninguna prueba que cubra comportamiento vigente.

## Cobertura: ¿qué queda sin reemplazo?

- `rules.ts` (funciones `getAvailableStartSlots`, `getAvailableStartSlotsWithManualBlocks`): reemplazo = oráculo como referencia y motor (`resolveDay`) para los mismos 10 casos, más la prueba de equivalencia existente (48 de 432 diferencias aceptadas, 0 diferencias sin bloqueos).
- `resolveBaseSlotsByMonthMode`: reemplazo = horarios 6 y 10/14/18 en pruebas del motor y del servicio (citadas arriba).
- `isWeekdayBookingDate`: sin prueba previa; su regla lunes a viernes queda cubierta por `day-rule.test.ts` ("uses ISO weekdays with Sunday as 7") y por el resolvedor.
- `DIRECTIONAL_SLOT_PAIRS`, `MAX_APPOINTMENTS_PER_DAY`, `BASE_TIME_SLOTS`: sin pruebas que las importen fuera de los archivos borrados.

## Evidencia: grep (T067, SC-006)

Comando: `git grep -n -E "isWeekdayBookingDate|resolveBaseSlotsByMonthMode|DIRECTIONAL_SLOT_PAIRS|MAX_APPOINTMENTS_PER_DAY" -- app lib components hooks`

Resultado: sin coincidencias (código de salida 1).

Búsqueda ampliada de símbolos retirados en todo el árbol versionado, excluyendo `specs/`, `docs/` y `tsconfig.tsbuildinfo`: solo quedan las constantes locales `LEGACY_DIRECTIONAL_SLOT_PAIRS` y `LEGACY_MAX_APPOINTMENTS_PER_DAY` dentro de `tests/lib/availability/fixtures/legacy-block-oracle.ts`. Están permitidas por el brief (la prueba puede referirse al oráculo).

Búsqueda de importaciones de `availability/rules` fuera de los dos archivos borrados: 0.

## Comandos y resultados

Línea base (antes de editar; el árbol solo tenía el cambio de `STATE.md`, que no es código):

| Comando | Resultado base | Resultado tras cambios |
|---|---|---|
| `npm test` (unitaria completa) | 152 archivos; 11 fallidos; 21 pruebas fallidas, 737 pasan, 63 omitidas (821) | 151 archivos; 11 fallidos; 21 pruebas fallidas, 734 pasan, 63 omitidas (818) |
| Conjunto de fallos unitarios | 21 pruebas en 11 archivos | Idéntico (diff vacío) |
| `node <scratchpad>/run-integration.mjs` (integración serial, `appointments_test`) | 14 archivos; 2 fallidos; 5 pruebas fallidas, 58 pasan (63) | Idéntico (diff vacío de nombres) |
| `npx tsc --noEmit --incremental false -p tsconfig.json` | 32 errores, todos en `tests/` | 32 errores, mismo conjunto (ignorando número de línea), 0 fuera de `tests/` |
| `npx eslint lib/availability lib/constants tests/lib/availability lib/admin lib/db` | Salida vacía, código 0 | Salida vacía, código 0 |
| `npx vitest run tests/lib/availability` (previo a la suite completa) | — | 11 archivos, 128 pruebas, todas pasan |

Los fallos de integración son los mismos de la línea base: `cancel-appointment` (3, `PrismaClientValidationError`) y `reservation-lock` (L65 y L145). Los fallos unitarios son los de fecha, ICU y jsdom que ya conocía STATE.md.

Salidas guardadas (en la scratchpad de la sesión): `base-unit.txt`, `after-unit.txt`, `base-integration.txt`, `after-integration.txt`, `base-tsc.txt`, `after-tsc.txt`, `base-eslint.txt`, `after-eslint.txt`, y las listas de fallos `base-unit-fails.txt`, `after-unit-fails.txt`, `base-int-fails.txt`, `after-int-fails.txt`.

## Base de datos y entorno

- Integración solo contra `appointments_test` (`mysql://…@127.0.0.1:3306/appointments_test`) con `ENABLE_INTEGRATION_DB=1`, `--maxWorkers=1`. El wrapper `run-integration.mjs` vive en la scratchpad, fuera del repo; aborta si la URL resultante no apunta a `127.0.0.1` y `/appointments_test`.
- Las credenciales del wrapper son las de desarrollo documentadas en `.env.example` (`root:root`). No leí ni imprimí `.env`. Se verificó con un `SHOW DATABASES` de solo lectura que `appointments_test` existe en el contenedor `appointments-lanuit-db-1`. Ni `appointments` ni `DATABASE_URL_PROD` se tocaron. El owner debe confirmar que esas credenciales son las que usa para la BD de prueba.
- Sin `DATABASE_URL` en `npm test`: las pruebas de integración se omiten sin ella (como en la línea base); la integración se ejecutó solo con el wrapper.

## Clasificación de verificación

- **Diseño estático**: revisión de importaciones (`git grep`), símbolos retirados, cobertura de cada caso borrado, tipo `MonthSlotMode` conservado, `isWeekdayBookingDate` sin consumidores.
- **Ejecutado**: `npm test`, integración serial contra `appointments_test`, `tsc --noEmit` (sin `tsbuildinfo`), `eslint` en directorios afectados, `vitest run tests/lib/availability`, grep T067, `SHOW DATABASES` (solo lectura).
- **Pendiente de aceptación del owner**: validación de esta ronda. Según el flujo acordado, no se lanza `reviewer-high-risk` hasta que el owner apruebe. Sin cambios de UI, sin verificación visual.

## Documentación

- Documentation Impact: No. No cambia comportamiento funcional, reglas, validaciones, API ni UI. No se tocó `docs/specification.md`. Flow Contract Check y Migration Compatibility Check: no aplican (sin cambio de flujo, sin migración, sin cambio de contrato de API).
- Para T078 (reconciliación documental, no se hizo ahora):
  - `docs/decisions/0001-min-gap-reemplaza-pares-direccionales.md` línea 27 dice que las constantes de pares y `MAX_APPOINTMENTS_PER_DAY` "siguen en el código hasta la Fase 4 (T07…)". Ya no es cierto.
  - `docs/decisions/0005-capacidad-del-dashboard-y-contadores.md` línea 10 describe `MAX_APPOINTMENTS_PER_DAY` como constante vigente de capacidad; ya no existe.
  - `docs/plans/*` y `docs/audits/*` mencionan `rules.ts` y las constantes como historia; no requieren cambio.
  - `lib/availability/month-slot-mode.ts` mantiene el comentario "columna legada hasta fase 4, FR-033": sigue siendo cierto hasta 4B (T069), no se toca ahora.

## Limitaciones

- No se ejecutó `npm run test:e2e` ni `npm run build`; la ronda no toca UI ni rutas.
- `npx eslint` se corrió solo sobre los directorios afectados, no sobre todo el repo. Todos los archivos modificados están dentro de esos directorios.
- La prueba de rendimiento del motor (`performance.test.ts`) depende del tiempo; pasó en la ejecución de la ronda.
- La cobertura de los 10 casos migrados es ahora explícita: el `it.each` afirma el oráculo y el motor. Sin embargo, el motor con bloqueos manuales en modo `SECOND_ONLY_MODE` no tiene prueba de equivalencia masiva (solo casos concretos), igual que antes de la ronda.
- Esta ronda no decide producto. No hay decisiones nuevas que devolver al Orquestador.

## Handoff

- Hecho: T064 a T068 con verificación; sin regresiones frente a la línea base.
- Pendiente: validación del owner; luego `reviewer-high-risk` (solo con aprobación del owner). T078 documental (ADR 0001 L27, ADR 0005 L10). Los arrastres de Fase 4 de STATE.md no son parte de esta ronda.
- Archivos tocados: ver tabla. Ningún commit.
- Siguiente paso: que el owner valide; luego, si se autoriza, `reviewer-high-risk` sobre esta ronda.

Ponytail: revisé solo lo que las importaciones y el grep exigían. Pendiente de verificar: el wrapper de integración usa las credenciales de `.env.example`; el owner debe confirmar. Riesgo: ninguno de comportamiento detectado; la reversión es un `git checkout` de los archivos listados.
