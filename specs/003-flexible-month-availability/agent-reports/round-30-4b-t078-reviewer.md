# Ronda 30 (4B + T078) - Reviewer high-risk

Spec 003, tareas T069 a T074 (ronda 4B) y T078 (cierre documental). Rama `003-flexible-month-availability`, HEAD `fed5d46`, cambios sin commit en el árbol de trabajo. Modo auditoría: no se modificó ningún archivo del proyecto. Único archivo creado: este informe.

## Veredicto

**Rejected** (1 hallazgo bloqueante, B-1). La implementación de código de 4B es correcta: no quedan lecturas ni escrituras de `slot_mode` en el código de aplicación, la API no devuelve `slotMode`, el PATCH sigue aceptando el preset y las suites ejecutadas coinciden con la línea base. El bloqueo es documental y afecta al procedimiento de una migración irreversible: `docs/architecture/data-model.md` presenta como opcional el respaldo que el owner decidió obligatorio, y no incluye precondiciones de verificación antes de `0023`.

## Comandos ejecutados y resultados

| # | Comando / verificación | Resultado |
|---|---|---|
| 1 | `npx tsc --noEmit --incremental false` | 32 errores, todos en `tests/`. Conjunto idéntico a la línea base (archivo y código; línea ignorada). Fuera de `tests/`: 0. `tsconfig.tsbuildinfo` sin cambios. |
| 2 | `npx vitest run` (equivale a `npm test`) | 807 pruebas: 723 pasan, 21 fallan, 63 omitidas, en 11 archivos fallidos. Lista de fallos idéntica a la línea base (`baseline-npmtest.txt`). Sin fallos nuevos. |
| 3 | Integración serial vía wrapper `scratchpad/with-test-db.sh npx vitest run --maxWorkers=1 tests/integration` (`DATABASE_URL` forzada a `appointments_test`, aborta si no coincide, `ENABLE_INTEGRATION_DB=1`) | 63 pruebas: 58 pasan, 5 fallan. Los 5 coinciden con la línea base: `cancel-appointment` x3 (`PrismaClientValidationError`) y `reservation-lock` x2 (`expected [] to have a length of 1`). `availability-backfill` 3/3, `availability-concurrency` 4/4, `admin-create-concurrency` 2/2. |
| 4 | Lectura de solo lectura en `appointments_test` (antes y después de la integración) | `_prisma_migrations`: 0022 y 0023 con `finished_at`. `active_months` sin columna `slot_mode`. El test de backfill la recrea y la elimina; tras la integración la columna sigue ausente. |
| 5 | `eslint` sobre los 42 archivos de código tocados (lista de `git diff HEAD --name-only` y no rastreados, sin `docs/`) | Exit 0. |
| 6 | `npx prisma validate` | Válido. |
| 7 | Locales `locales/es/admin.json` y `locales/en/admin.json` | JSON válido. 521 claves en cada idioma, paridad exacta. Ninguna clave `slotMode` restante. Ninguna referencia en código a `monthsDetail.slotMode.*`. |
| 8 | `npx next build` en copia de la scratchpad sin `.env`, `.git` ni BD (`node_modules` enlazado) | Exit 0. Único warning: `crypto` en Edge Runtime en `lib/admin/auth/service.ts` (preexistente, NB-R3-3 de la STATE). |
| 9 | Playwright 1.59.1, chromium, `PLAYWRIGHT_PORT=3917`, `ENABLE_E2E_DB=1`, wrapper `appointments_test`, credenciales Google vacías (fuerza `CALENDAR_NOT_CONFIGURED`, sin llamadas externas) | Ver tabla E2E abajo. |

### E2E (Playwright)

El puerto 3000 lo ocupa otro proceso `node` (PID 70733), que no toqué; el servidor de Playwright se levantó en el 3917. Los specs con `test.describe.skip` requieren `ENABLE_E2E_DB=1`; sin esa variable se omiten y no cuentan como verificación.

| Spec | Configuración | Resultado |
|---|---|---|
| `admin-month-availability.spec.ts` (S-06 x2, S-07) | `--workers=1`, `ACTIVE_MONTH_WINDOW_SIZE=1`, tras borrar la fila residual `2026-12` creada por mi propia ejecución (id 11087, sin dependientes) | 3/3 pasan |
| `booking.spec.ts` (suite de reglas S-09 x3) | `--workers=1`, ventana 1 | 3/3 pasan (07:30 y 14:30 con reglas; rechazo `SLOT_NOT_AVAILABLE`) |
| `booking.spec.ts` (home y redirección a WhatsApp) | mismo run | 2 fallan (ver N-10c). `legacy booking endpoint` pasa. |
| `locking.spec.ts` | mismo run | 3/3 pasan |
| `cancellation.spec.ts` | mismo run | 2/3 pasan. Falla "user completes cancellation wizard in three steps" (ver N-10e). |
| `admin-month-detail.spec.ts` | `--workers=1` | Falla en el test 1 (ver N-10d); el test 2 se omite. No verificado. |

Evidencia de que el dev server escribió en la BD de pruebas: en `appointments_test` aparecen los clientes creados por el spec de cancelación a las 18:58 (`E2E Cancel`, `E2E Wizard Cancel`). Residuos que dejé en `appointments_test`: la fila `2026-11` ACTIVE (la crea `globalSetup`); el usuario `e2e-admin` reescrito con el hash del pepper de prueba; clientes y citas de prueba. No queda la fila `2026-12`.

## Verificación de los puntos del brief

### 1. Migración 0023 y esquema

- `prisma/migrations/0023_drop_active_months_slot_mode/migration.sql`: `ALTER TABLE active_months DROP COLUMN slot_mode`. Sin índices ni FK sobre la columna (0006, 0009 y 0014 no crean índices sobre ella). Sin vistas, triggers ni procedimientos en `prisma/migrations`.
- Orden: 0023 depende de 0022. `migrate deploy` ejecuta en orden y se detiene ante un fallo, así que 0023 no corre si 0022 falla. Riesgo cubierto en B-1: la marcación manual de 0022 como aplicada (`prisma:resolve:applied`) sin backfill sí permitiría que 0023 se ejecute antes de tener reglas.
- Esquema: `enum MonthSlotMode` y `slotMode` eliminados. `model AvailabilityMigrationRun` conservado (L201). `prisma validate` válido.
- Si algún proceso antiguo sigue vivo tras 0023 (código de HEAD), el fallo es ruidoso, no silencioso: lecturas de `active_months` con `slot_mode` (`findActiveMonth`, `listActiveMonths` vía reservas públicas, `findRegisteredMonth`, SQL de `findMonthAvailability`) devuelven error de columna inexistente; las escrituras antiguas (`replaceMonthAvailability` con `slot_mode`) también fallan y no escriben nada. Lo verifiqué leyendo `git show HEAD`.

### 2. SQL crudo y consultas Prisma

- `grep` de `slot_mode`, `slotMode`, `MonthSlotMode`, `month-slot-mode`, `deriveSlotMode`, `updateRegisteredMonthSlotMode`, `DEFAULT_MONTH_SLOT_MODE` en `app`, `components`, `hooks`, `lib`, `scripts`, `tests`, `prisma` (excluyendo `tsconfig.tsbuildinfo`): sin lecturas ni escrituras residuales. Restos legítimos: nombre del endpoint `updateAdminMonthSlotMode`, entrada `slotMode` del preset (RQ-1), icono `slotModeSettings` (cosmético), y fixtures del oráculo legacy (`tests/lib/availability/fixtures/legacy-block-oracle.ts`, parámetro de modo, no BD).
- SQL crudo sobre `active_months` en `lib/`: solo `lib/db/availability-rules.ts` L91 y L223, sin `slot_mode`. `scripts/*.mjs` no referencian la columna. `scripts/reconcile-active-months.mjs` usa el modelo Prisma `activeMonth` sin `slotMode` (ver N-7).
- Diff de `lib/db/availability-rules.ts`: el `SELECT` de `readMonthAvailability` ya no incluye `slot_mode` y `replaceMonthAvailability` solo incrementa `availability_version`. Sin cambio de `FOR UPDATE` ni de la guarda de versión.
- Llamadores de `replaceMonthAvailability`, `findRegisteredMonth`, `findActiveMonth`, `listActiveMonths`, `createInactiveMonths` y `reconcileActiveMonthsInDatabase`: todos compatibles con la nueva firma (tsc sin errores nuevos).

### 3. Contrato de API

- Respuestas: `GET .../availability` (`toMonthAvailabilityResponse`), `GET /api/admin/months/[month]` (`getAdminMonthDetail`) y `PATCH .../slot-mode` (`updateAdminMonthSlotMode`, devuelve `{ month, availabilityVersion }`) no contienen `slotMode`. No hay alias en las rutas.
- Entrada del PATCH: `UPDATE_MONTH_SLOT_MODE_SCHEMA` usa `SLOT_MODE_PRESET_VALUES` (mismos valores que antes), el cliente `api-client.ts` envía `slotMode` como preset y `UpdateAdminMonthSlotModePayload` lo tipa como `AvailabilityPresetMode`.
- Consumidores de UI: ninguno lee `slotMode` de una respuesta. El cliente `updateAdminMonthSlotMode` (`lib/admin/months/api-client.ts` L115) no tiene llamadores en `hooks/`, `components/` ni `app/`, y tampoco los tenía en HEAD (N-8).
- Texto "Modalidad" y claves `monthsDetail.slotMode.*` existían en los locales de HEAD, pero ningún componente las usaba en HEAD. Retirarlas no cambia ninguna pantalla.

### 4. Pérdida de comportamiento

- Símbolos eliminados y llamadores en HEAD: `deriveSlotMode` (solo `lib/admin/months/service.ts`, ambos sitios ya actualizados), `DEFAULT_MONTH_SLOT_MODE` (solo `createInactiveMonths`, actualizado), `updateRegisteredMonthSlotMode` (sin llamadores), `lib/availability/month-slot-mode.ts` (solo tipos y constante, reubicados en `lib/availability/defaults.ts`).
- Pruebas eliminadas: 11 (818 a 807): 1 de `DEFAULT_MONTH_SLOT_MODE` y 10 de `deriveSlotMode`. Revisé las 16 líneas `expect` eliminadas: todas corresponden a esas funciones o al campo `slotMode` retirado. Las dos aserciones de `slotMode` que contenían `expect(...slotMode)` son `tests/lib/admin/months.detail-service.test.ts` L134 (ver N-3) y el test de backfill (sustituido por SQL crudo).
- Auditoría: ninguna de las rutas o funciones tocadas escribía eventos de auditoría (`grep` de `audit` y `appointmentLog` en HEAD: sin resultados en `lib/admin/months/service.ts` ni en `lib/db/admin-months.ts`). No se pierde ningún evento.
- Motor de reservas: `lib/availability/service.ts` no cambia y HEAD no usaba `slotMode` para calcular horarios (lectura de HEAD confirmada). La reserva pública no depende de la columna desde la reescritura de la ronda 4A.
- Test de backfill (`tests/integration/availability-backfill.integration.test.ts`): la columna legada se crea en `beforeAll` solo si falta y se elimina en `afterAll` solo si la creó el propio test. Verificado tras la ejecución: columna ausente. Efecto secundario en la BD de pruebas (N-9).

### 5. Documentación

Coinciden con el código: `docs/specification.md` L119, L526, L605, L1319-1320, L1493-1494 y L1503; `docs/architecture/api.md` L306, L371-377, L383, L394, L497; `docs/architecture/data-model.md` L24, L175, L261 y la sección de 0023 (L267-290); ADR 0001 L10 y L27 (constantes retiradas en 4A); ADR 0004 (estado Superseded, `deriveSlotMode` eliminado); ADR 0005 L10; `docs/decisions/README.md` L12.

Discrepancias: B-1 (respaldo y precondiciones), N-2 (runbook obsoleto), N-6 (afirmaciones no verificables sobre `appointments` local), N-8 (arrastres de T078 sin cerrar).

### Migration Compatibility Check

- Schema changes required: Yes (0023, `DROP COLUMN active_months.slot_mode`).
- Data backfill required: No en 4B (lo hizo 0022).
- Legacy compatibility required: Yes, sin ventana de convivencia (código de HEAD y 4B no pueden coexistir tras 0023).
- Rollback strategy defined: Yes, parcial y no automática. SQL de recreación descrito. **No probado** (N-5).
- Cleanup phase defined: Yes (0023 es la limpieza física; `availability_migration_runs` conservada por decisión del owner).
- Integrity protections defined: No hay protecciones nuevas, y no hacen falta: la columna no interviene en FK ni índices. Falta la precondición de datos de B-1.

## Hallazgos

### Bloqueantes

**B-1. Procedimiento de Gate 4 presenta como opcional el respaldo que el owner decidió obligatorio, y no exige precondiciones antes de `0023`.**
- Ubicación: `docs/architecture/data-model.md` L285 ("Es una recomendación, no una decisión tomada") y L282-288 (orden de despliegue). La STATE (`specs/003-flexible-month-availability/agent-reports/STATE.md`, "Resume here", punto 4) registra la decisión del owner de 2026-11-01: "backup OBLIGATORIO antes (dump o tabla auxiliar con id y `slot_mode`)". El informe de 4B (`round-28-4b-developer.md` L115) repite la versión "recomendación".
- Escenario de fallo: el operador lee el documento, considera el respaldo opcional y ejecuta `prisma migrate deploy`. Si además 0022 se marcó como aplicada sin ejecutar su backfill (por ejemplo, con `npm run prisma:resolve:applied` tras un fallo parcial de DDL, que en MySQL no es transaccional), 0023 borra `slot_mode` sin que existan reglas: los meses caen en el default D6 y la disponibilidad pública cambia en silencio. Sin respaldo no hay forma de reconstruir el modo.
- Corrección requerida:
  1. Cambiar L285 a obligatorio, citando la decisión del owner del 2026-11-01, y exigir verificar el respaldo (conteo de filas igual a `active_months` y una restauración de prueba en `appointments_test`).
  2. Añadir precondiciones de datos antes de `migrate deploy` de 0023, documentadas en esa sección: (a) `SELECT COUNT(*) FROM availability_migration_runs WHERE name = 'backfill-availability-rules-v1'` devuelve 1; (b) ningún mes de `active_months` queda sin filas en `availability_rules` cuando tenía `slot_mode` distinto de la regla por defecto (consulta de cobertura); (c) `_prisma_migrations` registra 0022 con `finished_at`.
  3. Reflejar las mismas precondiciones en el "Migration Compatibility Check" del informe 4B o en la sección correspondiente de `tasks.md` (T069), para que el Gate 4 las lleve como lista de comprobación.
- Este punto es procedimental; la decisión de fondo (si el respaldo es obligatorio) ya la tomó el owner. Lo que se pide es que el documento lo refleje.

### No bloqueantes

**N-1. Orden de despliegue: el código 4B no necesita que 0023 esté aplicada.** El código 4B no referencia `slot_mode` (ver sección 2), así que puede desplegarse con 0022 aplicada mientras la versión anterior sigue sirviendo, y 0023 se aplica después, cuando ya no haya procesos de la versión anterior. El orden actual (parar todo, migrar, desplegar) provoca una ventana sin servicio que no es necesaria. Es decisión del owner (su entrevista pidió "parar todas las instancias"). Referencias: `data-model.md` L282-288; `round-28-4b-developer.md` L111-118.

**N-2. Runbook obsoleto y sin pasos de migración.** `docs/runbooks/admin-month-detail-rollout.md` L9 exige "Migraciones de Fase 1/Fase 2 aplicadas (sin cambios de esquema para este feature)" y su sección «Rollout en producción» (L67 y siguientes) no menciona migraciones. Quien lo siga puede desplegar 4B sin 0022 y la lectura de `availability_rules` fallará. Pendiente de T078 según la STATE. Corrección sugerida: apuntar a la sección de Gate 4 de `data-model.md` o marcar el runbook como histórico de fase 1/2.

**N-3. Cobertura negativa ausente para `slotMode` en `GET /api/admin/months/[month]`.** Al retirar `expect(result.slotMode)` (`tests/lib/admin/months.detail-service.test.ts` L134) no se añadió aserción negativa. El test de ruta (`api-admin-month-detail-route.test.ts`) mockea el servicio. Escenario: alguien reintroduce `slotMode` en `getAdminMonthDetail` y ninguna prueba falla. Corrección sugerida: `expect(result).not.toHaveProperty("slotMode")` en L134. El PATCH sí queda cubierto: `tests/lib/admin/months.service.test.ts` L199-203 usa `toEqual({ month, availabilityVersion })`, que falla si aparece una clave extra.

**N-4. Migración sin guarda.** `0023` ejecuta `ALTER TABLE ... DROP COLUMN` sin `IF EXISTS` (L7). Si alguien eliminó la columna a mano, `migrate deploy` falla y deja la migración marcada como fallida. No hay daño de datos, pero el fallo obliga a intervenir con `migrate resolve`. Aceptable, anotar en el runbook de Gate 4.

**N-5. Rollback no probado.** El SQL de recreación (`ALTER TABLE ... ADD COLUMN slot_mode ...` y `UPDATE ... JOIN respaldo`) está descrito en `data-model.md` L290-296 pero no se ejecutó. Antes del Gate 4 conviene probarlo en una base desechable del mismo MySQL, nunca en `appointments` ni en producción. Riesgo residual si no se prueba: el rollback falla justo cuando se necesita.

**N-6. Afirmaciones no verificables por mí.** `data-model.md` L9 ("0022 aplicada en la copia local de la base, 2026-10-31") y L271 y L327 ("0023 aplicada solo en `appointments_test`"). Verifiqué ambas en `appointments_test` (0022 y 0023 aplicadas). No consulté la BD local `appointments` porque la regla del owner lo prohíbe, así que el "solo" y el estado de la copia local no están verificados. El owner debe confirmarlo o reformular el texto.

**N-7. Procesos antiguos fuera de la web.** `scripts/reconcile-active-months.mjs` (`npm run months:reconcile`) usa el modelo Prisma `activeMonth` y falla con el cliente de HEAD después de 0023. No es un cron (los crons de producción según D92 son `locks:cleanup`), pero debe figurar en la lista de procesos a parar antes de 0023.

**N-8. Arrastres de T078 sin cerrar en código.**
- `MONTH_NOT_ACTIVE` sin emisor: `app/api/admin/months/[month]/appointments/route.ts` L27 y `components/admin/months/MonthDetailView.tsx` L88. Preexistente; no lo cerró la ronda 29.
- `WeeklyOccupancyCard.tsx` L100 con `grid-cols-5` para 7 días (ya documentado como abierto).
- Comentarios obsoletos sobre PENDING (D59/D61): `lib/admin/months/detail-service.ts` L189 y `lib/admin/dashboard/service.ts` L473 (ya documentados).
- Icono `adminIcons.slotModeSettings` (`components/admin/ui/admin-icons.ts` L88; `MonthDetailView.tsx` L1109). Cosmético.
- `updateAdminMonthSlotMode` en `lib/admin/months/api-client.ts` L115 sin llamadores de UI (también en HEAD). Decidir si se usa o se retira.

**N-9. Efectos del test de backfill en la BD de pruebas.** `tests/integration/availability-backfill.integration.test.ts` L97-98 borra todas las filas de `availability_migration_runs` y, al final, la fila que queda es la del fixture (`rows_created = 2`), no la de 0022 (`rows_created = 3` según la evidencia de la ronda 1A). Solo afecta a `appointments_test`. El guard de L25 comprueba el nombre de la base, no el host; el wrapper cubre el host. Anotarlo en la sección de pruebas.

**N-10. Infraestructura E2E (preexistente, no causada por 4B).**
- (a) `tests/e2e/global-setup.ts` crea los meses de la ventana (`ACTIVE_MONTH_WINDOW_SIZE`, por defecto 2). Desde noviembre de 2026 incluye `2026-12`, y `tests/e2e/admin-month-availability.spec.ts` L116 y la suite de reglas de `booking.spec.ts` abortan con "Refusing to run". Mitigación usada: `ACTIVE_MONTH_WINDOW_SIZE=1` y borrar el residuo. Ya estaba registrada como ventana E2E válida hasta 2026-12-13.
- (b) Los specs que crean `2026-12` en `beforeAll` colisionan si corren en paralelo (`Unique constraint failed on active_months_month_key`). Ejecutar con `--workers=1`.
- (c) `booking.spec.ts` L263 busca `a[href^="/citas/"][href$="/booking"]`, pero la home de HEAD enlaza a `/booking` (`app/page.tsx` L55). L312 espera la URL `/citas/<mes>/booking`, mientras la app redirige a `/booking?month=`. Los dos spec y las rutas no están modificados en el árbol (`git status`).
- (d) `tests/e2e/admin-month-detail.spec.ts` L123 crea un cliente sin `clientNumber`, campo obligatorio. Falla en el test 1. Este spec es el gate E2E del runbook (N-2), así que no hay evidencia E2E de la vista de detalle tras 4B.
- (e) `tests/e2e/cancellation.spec.ts` L171 espera el encabezado "La cita fue cancelada." y no aparece. El nombre coincide con un fallo de la línea base unitaria ("cancel wizard > completes cancellation and renders success message in step 3").
- (f) `tests/e2e/admin-month-availability.spec.ts` L60-75 lee `.env` directamente para el pepper de autenticación. No lo leí yo; con `ADMIN_AUTH_PEPPER` exportado el spec no lo usa. Conviene que el owner lo sepa.

**N-11. Wrapper de integración con credenciales fijas.** El wrapper de la scratchpad usa `root:root` en `127.0.0.1:3306` (STATE: pendiente de aceptación del owner). No está en el repo ni lee `.env`, y solo apunta a `appointments_test`. Aceptar explícitamente o sustituir por variable de entorno.

## Correcciones requeridas (solo bloqueantes)

1. B-1: actualizar `docs/architecture/data-model.md` (sección "Migración 0023", L282-288) para que el respaldo sea obligatorio y se verifique, y añadir las tres precondiciones de datos. Después, re-ejecutar la verificación documental (grep de "recomendación" en la sección 0023).

Cuando B-1 esté corregido, no hace falta una ronda completa de código: basta una re-revisión documental de la sección. Las decisiones sobre N-1 y N-11 son del owner.

## Riesgos residuales

- Orden de despliegue de Gate 4 sin prueba (N-1, N-5): el rollback descrito no está probado y el orden actual impone una ventana sin servicio.
- Dependencia de la marcación manual de 0022 (B-1): si alguien marca 0022 sin backfill, 0023 destruye el único origen del modo.
- Procesos fuera de la web (N-7): el script de reconciliación falla tras 0023 si se ejecuta con código antiguo.
- Cobertura negativa (N-3): reintroducir `slotMode` en el detalle no rompe ninguna prueba.
- E2E de detalle del mes (N-10d) sin evidencia: la vista de detalle no se validó E2E tras 4B.
- Pool y locks: fuera del alcance de 4B; siguen los riesgos F1/F2/H1 de la STATE, aceptados por el owner.

## Qué no pude verificar

- Producción y staging: no tocados, como exige la regla. Gate 4 no ejecutado.
- BD local `appointments`: no consultada (regla del owner). Por eso no verifiqué que 0023 esté "solo" en `appointments_test` ni el estado de 0022 en la copia local (N-6).
- Ejecución de `migrate deploy` de 0023: no la repetí. Verifiqué el estado resultante en `appointments_test`, no el paso de aplicación.
- Rollback SQL: no ejecutado (N-5).
- E2E en HEAD para confirmar que los fallos de N-10 son preexistentes: no lo ejecuté. La atribución se basa en que esos specs y rutas no figuran modificados en `git status` y en la línea base unitaria.
- `admin-month-detail.spec.ts` completo (N-10d), `admin-clients-catalog.spec.ts`, `admin-dashboard-reminders.spec.ts`: no ejecutados o no verificados.
- Revisión visual, integración real con Google Calendar (S-11) y WhatsApp, arranque de Dockploy: fuera de alcance de esta ronda.
- Salidas guardadas en la scratchpad: `/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/de56eec6-6707-4ada-9fd5-423ddadab785/scratchpad/` (`r30-vitest-full.txt`, `r30-tsc.txt`, `r30-integration.txt`, `r30-eslint.txt`, `r30-e2e-*.txt`, `r30-build.txt`).

## Observaciones de proceso

- El dev server de Playwright generó `.next/` en el árbol del proyecto. Está ignorado por git. `next build` se ejecutó en una copia.
- Se borró una fila residual de `2026-12` en `appointments_test`, creada por mi propia ejecución de E2E (sin dependientes). Es el único cambio de datos que hice fuera de los tests.

PONYTAIL: no revisé el resto de E2E de `tests/e2e/` ni la copia de producción, y no ejecuté el rollback. Riesgo para el owner: un Gate 4 sin respaldo verificado o sin precondiciones puede borrar el único origen del modo de cada mes.
