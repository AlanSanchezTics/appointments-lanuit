# Ronda 26 (F1-b): correcciones tras la revisión de la ronda 25

- Rol: Developer (`developer`). Flujo: Developer → Reviewer de alto riesgo (pendiente del Orquestador). Área de alto riesgo: locks de reserva.
- Alcance: solo documentación y pruebas. No se cambió lógica de producción, constantes ni orden de locks. Sin commit, sin `git stash`, sin `git add -A`.
- Decisión del owner aplicada: H1 aceptado como riesgo residual con el impacto real de F-01 (ver corrección 1). Sigue sin ser alcanzable por debajo de 30 s en uso normal.
- Entrega revisada: árbol de trabajo sin commit sobre `003-flexible-month-availability` (base 91874d6). Informes de referencia: `round-24-f1-developer.md` y `round-25-f1-reviewer.md`.
- Turnos: aproximadamente 50 (estimado, no medido por la plataforma). Dentro del tope de 80.

## 1. Archivos modificados en esta ronda

| Archivo | Corrección | Líneas (tras la edición) |
|---|---|---|
| `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` | 1, 2, 3, 4, 5, 6 | L4 (fecha), L30 (lista de transacciones), L37-38 (tiempos, F-03 y F-10), L55-60 (riesgo residual F1, F-01, F-02), L75-79 (consecuencias: F-02, F-09, F-06, pendientes) |
| `docs/specification.md` | 1, 4 | L421 (lista de transacciones con `GET_LOCK`), L453-456 (F1) |
| `docs/architecture/business-rules.md` | 1, 3, 4 | L187 (Lock order, paso 1: lista de seis transacciones y 15 s), L206-207 (Known limitations, F1) |
| `docs/architecture/data-model.md` | 1, 4 | L199 (lista de seis transacciones), L218-223 (limitaciones F1) |
| `lib/db/appointments.ts` | 3 | L584-589: solo el texto del comentario (pasa de 5 a 6 líneas, por eso la línea de código `SET SESSION ... = DEFAULT` pasa de L631 a L632). Ningún valor ni línea de código cambió |
| `tests/lib/db/booking-lock-timeouts.test.ts` | 3 | L34: nombre de la prueba. El cuerpo no cambió |
| `tests/integration/booking-lock-expiry.integration.test.ts` | 7 | L99 (afirmación del mensaje), L179-217 (prueba nueva de restauración de sesión, antes de la residual) |
| `specs/003-flexible-month-availability/agent-reports/round-24-f1-developer.md` | 2 | Bloques de Migration Compatibility Check: "Legacy compatibility required" pasa a Yes y "Rollback strategy" con salvedad |
| `specs/003-flexible-month-availability/agent-reports/round-26-f1b-developer.md` | nuevo | Este informe |

Cambios de producción: `lib/db/appointments.ts` solo tiene cambio en comentario respecto a la ronda 24. La comprobación de que el código no cambió es la mutación de la sección 3 (hash del `git diff` antes y después).

## 2. Correcciones aplicadas

1. **F-01 (H1, impacto real).** La ADR (L55-58), `docs/specification.md` §9 (L453-456), `business-rules.md` (L206-207) y `data-model.md` (L218-223) describen ahora el impacto: mientras la conexión del pool viva, las reservas de esa fecha o de ese teléfono responden `LOCK_TIMEOUT` (409) tras 5 s. Es denegación por fecha o teléfono, no solo fuga de lock. Se indica aceptación del owner (ronda 26) y qué no se midió: duración del lock huérfano, `GET_LOCK` directo desde otra sesión (solo se midió `IS_USED_LOCK`), reutilización de la conexión (contador re-entrante, según documentación de MySQL, no medido) y efecto bajo carga.
2. **F-02 y F-09 (H5 y rollback).** ADR L76-77: tras una expiración la conexión conserva `innodb_lock_wait_timeout = 5` (medido por el Reviewer en la ronda 25), que afecta a flujos fuera de reserva que reutilicen la conexión hasta que una transacción de reserva la restaure (deducido del código) o la conexión se cierre. Revertir el código no limpia valores ya filtrados. Informe de la ronda 24, Migration Compatibility Check: "Legacy compatibility required" pasa a Yes; "Rollback strategy defined" pasa a Yes con salvedad.
3. **F-03 (peor caso).** Reformulado como "caso de una sola espera de cada tipo" en ADR L37, en el comentario de `lib/db/appointments.ts` L584-589 (solo texto) y en el nombre de la prueba de `tests/lib/db/booking-lock-timeouts.test.ts` L34. Las cadenas de esperas exitosas (10 + 5k s; k >= 4 llega a 30 s) quedan como parte del riesgo residual H1 en ADR, spec §9, business-rules y data-model. Los números son los mismos en los cuatro documentos.
4. **F-04 (lista de rutas).** ADR L30 ahora lista las seis transacciones con `GET_LOCK` (reserva pública, confirmación, bloqueo de horario del wizard, creación admin, reprogramación admin, reprogramación pública). El bloqueo de espacios queda como excepción que aplica pasos 2 a 6 (F2, D83). Se conserva la excepción de la transición admin `PENDING` (párrafo de excepción de la ADR). `data-model.md` L199 incluye confirmación y wizard. `business-rules.md` L187 y `spec §9` L421 tienen la misma lista.
5. **F-06 (pool).** ADR L78: una reserva contendida puede ocupar una conexión hasta unos 15 s (más con esperas encadenadas), frente a 5 s antes; riesgo de `P2024` bajo ráfagas; no medido; el repositorio no define `connection_limit`. ADR L79: decisión de tamaño de pool pendiente del owner.
6. **F-10 (H6).** ADR L38: el `timeout` de `$transaction` cuenta desde el inicio de la transacción (mensaje de Prisma "since the start of the transaction"; evidencia: mutación A del Reviewer, 5005 ms con timeout de 5000 ms). `maxWait` es una espera aparte, de la conexión del pool. No se inspeccionó el motor Rust. H6 queda cerrado con la evidencia del Reviewer, que no repetí.
7. **F-05 (pruebas, integración).**
   - (a) L99: `expect(waiterError?.message).toMatch(/Lock wait timeout/i)` en la prueba de espera de fila.
   - (b) Prueba nueva L179-217: "tras releaseBookingLocks, la sesión de la transacción vuelve al innodb_lock_wait_timeout previo". Lee `@@SESSION` antes de `acquireBookingLocks`, dentro de la misma transacción, y después de `releaseBookingLocks`. Afirma que durante la transacción vale 5 y que tras liberar vuelve al valor previo y al valor por defecto del servidor (`@@GLOBAL`, leído al inicio de la prueba, sin fijar 50).
   - Numeración final de `booking-lock-expiry.integration.test.ts`: 1 espera de fila; 2 operación de 6 s con opciones de producción; 3 LOCK_TIMEOUT; 4 restauración de sesión (nueva); 5 residual.
   - Desviación respecto al brief: la prueba nueva va antes de la residual, no al final, y por eso la residual pasa de 4 a 5. Motivo: la prueba residual deja su conexión del pool con 5 s (H5). Si la prueba nueva corriera después, leería una conexión contaminada.

## 3. Evidencia de la mutación (C2) y de la restauración

Mutación: quitar `await tx.$executeRawUnsafe("SET SESSION innodb_lock_wait_timeout = DEFAULT");` de `lib/db/appointments.ts` (L632 tras el ajuste del comentario; antes de esta ronda estaba en L631). Respaldo previo en la scratchpad, verificación con hash, `perl -ni` que elimina solo esa línea (coincidencia por contenido, no por número), conteo de líneas antes y después.

Primer intento (prueba sin `@@GLOBAL`): la prueba nueva **pasó** bajo la mutación (15 ms). Causa: las pruebas 1 a 3 dejan la misma conexión del pool con 5 s, así que el valor "previo" ya era 5 y la comparación `after === before` pasaba. La mutación no era visible. Corregido añadiendo la comparación con el valor por defecto del servidor.

Segundo intento (prueba corregida): la prueba nueva **falla** bajo la mutación: `AssertionError: expected 5 to be 50`. Las otras 4 pasan. Log: `scratchpad/r26-mut-C2-integration-v2.log`.

Restauración (mismo comando que la mutación, se ejecuta aunque falle la prueba):
- `cp` desde el respaldo, después `cmp` del archivo contra el respaldo: idéntico.
- sha256 de `lib/db/appointments.ts` antes de la mutación y después de la restauración: `b4c91104bbd871a4f8ce672ac5f196a1a8c7ff02a56bdd44ee0e71bfb2366d8a` (igual).
- sha256 del `git diff -- lib/db/appointments.ts` antes y después: `c8cb8f16b42305c0162a7eb4c14076b32837bfde31276e66e6ec2027d37184b6` (igual).
- Conteo de la línea `SET SESSION ... = DEFAULT`: 1 antes, 0 bajo mutación, 1 tras restaurar.
- El harness avisó de que el comando "modificó 1 archivo leído previamente" (`lib/db/appointments.ts`). Es la mutación y su restauración, verificadas arriba.

Nota: la mutación A (timeout de 5 s) y la mutación de la prueba LOCK_TIMEOUT son del Reviewer. No las repetí.

## 4. Comandos ejecutados y resultados

| # | Comando (wrapper a `appointments_test`, serial cuando es integración) | Resultado |
|---|---|---|
| 1 | `node run-integration.mjs npx vitest run --maxWorkers=1 tests/integration/booking-lock-expiry.integration.test.ts` (antes de la mutación) | 5/5 pasan |
| 2 | Mismo comando con `--reporter=verbose` | 5/5 pasan (lista con los 5 nombres) |
| 3 | Mutación C2 con prueba v1 (solo `after === before`) | 5/5 pasan. Mutación NO detectada. Causa en sección 3 |
| 4 | Ejecución limpia con prueba v2 (verbose) | 5/5 pasan |
| 5 | Mutación C2 con prueba v2 + restauración + verificación de hashes | 4/5. La prueba de restauración falla (`expected 5 to be 50`). Restauración verificada |
| 6 | `node run-integration.mjs npx vitest run --maxWorkers=1 --reporter=verbose tests/integration` (integración completa, serial) | 63 pruebas: 58 pasan, 5 fallan. Línea base: 5 fallos. Fallos: `cancel-appointment` x3 (`PrismaClientValidationError` en `prisma.client.create`) y `reservation-lock` x2 (`expected [] to have a length of 1`). Ninguno de lock de F1 ni de timeout. `booking-lock-expiry` pasa 5/5 dentro de esta ejecución |
| 7 | `npx vitest run` sobre los 6 archivos de prueba de lock (`booking-lock-timeouts`, `appointments.lock-order`, `appointments.service`, `book-appointment`, `lock-reservation-slot`, `my-appointments.service`) | 6/6 archivos, 60/60 pruebas |
| 8 | `npx tsc --noEmit -p . --incremental false` | 32 errores, todos en `tests/` (línea base 32). Ninguno en `lib/` ni `app/`. `tsconfig.tsbuildinfo` sin cambios |
| 9 | `npx eslint lib/db/appointments.ts tests/lib/db/booking-lock-timeouts.test.ts tests/integration/booking-lock-expiry.integration.test.ts` | exit 0 |
| 10 | `grep` de frases obsoletas en `docs/`, `lib/`, `tests/` | Quedan "peor caso" y "15 s" solo en el informe de la ronda 24 (L38 y L158, ver hallazgo 6.4) y en las referencias nuevas que lo explican |

No ejecutado en esta ronda:
- Suite unitaria completa (`npx vitest run` sin filtro). La línea base de 21 fallos en 11 archivos no se volvió a medir. Los cambios de esta ronda son de comentario, nombre de prueba e integración, pero no se ha verificado de nuevo.
- `npm run lint` completo y `npm run lint:admin-i18n` (no hay UI tocada).
- E2E (`playwright`).
- Reviewer de alto riesgo (lo lanza el Orquestador).
- Prueba de humo del `SET SESSION` en staging (F-11, pendiente del owner).
- Medición de la duración del lock huérfano, del pool bajo carga y de la respuesta de `GET_LOCK` desde otra sesión.
- Motor Rust de Prisma (H6, no inspeccionado).
- Nada se ejecutó contra `appointments` ni contra producción. No se leyó ni imprimió `.env`. El wrapper se usó solo como lanzador.

## 5. Checks de entrega

Flow Contract Check:
- UI steps updated: No. No cambia ningún paso de UI.
- API contract updated: No. No cambia ninguna ruta, campo, código ni estado. `api.md` no se tocó en esta ronda.
- Validation rules updated: No. Ninguna validación cambió.
- Acceptance criteria updated: No. No hay criterios de aceptación del proceso modificados. La prueba de integración sí cambia (acepta más comportamiento verificado).
- docs/specification.md aligned: Yes. §9, L421 (lista de transacciones) y L453 (F1).

Migration Compatibility Check:
- Schema changes required: No. Sin cambios en `prisma/schema` ni migraciones.
- Data backfill required: No. No hay datos que migrar.
- Legacy compatibility required: Yes. El `SET SESSION innodb_lock_wait_timeout` cambia el estado de conexiones compartidas del pool. Tras una expiración (residual F1), la conexión conserva 5 s de espera de fila y afecta a flujos fuera de reserva hasta que una transacción de reserva la restaure o la conexión se cierre (medido en la ronda 25; F-02 y F-09 del Reviewer).
- Rollback strategy defined: Yes, con salvedad. Revertir los cambios de `lib/db/appointments.ts` y de los seis cierres devuelve el comportamiento de HEAD para las transacciones nuevas. Salvedad: revertir no limpia el `innodb_lock_wait_timeout = 5` ni el `GET_LOCK` ya filtrados en las conexiones del pool; persisten hasta que la conexión se cierre. No hay datos que deshacer.
- Cleanup phase defined: No aplica. No hay columnas, tablas ni flags legacy. El valor de sesión se limpia con la siguiente transacción de reserva que use esa conexión, o al cerrarla. No hay fase propia de limpieza.
- Integrity protections defined: Yes, a nivel de aplicación (timeouts, cota de espera de fila, locks con nombre existentes, prueba de restauración de sesión). No se añadió restricción de base de datos. La ADR ya registra que `appointments` no tiene `UNIQUE (date, time_slot)` por decisión del owner.

Documentation Impact:
- Requires change to docs/specification.md: Yes. Actualizado: §9 L421 (lista de transacciones que toman `GET_LOCK`) y §9 L453 (F1, con impacto de F-01, cifras de F-03 y lo no medido).
- Flow change: No cambia ningún comportamiento. Es una corrección de documentación sobre el riesgo residual, la lista de transacciones y las cifras, y una prueba más.
- Documentos actualizados: `docs/decisions/0006-concurrencia-reservas-orden-de-locks.md` (L4, L30, L37-38, L55-60, L75-79), `docs/architecture/business-rules.md` (L187, L206-207), `docs/architecture/data-model.md` (L199, L218-223), `docs/specification.md` (L421, L453-456). Informe de la ronda 24, dos bloques del check de migración.
- Ambigüedades: (a) la ADR habla de "la excepción de la transición admin PENDING" sin citar un ID (en el brief figura T077; el texto de la ADR no lo cita, y no lo añadí). (b) `business-rules.md` L179 (Scope) lista las escrituras que tocan horarios sin el bloqueo del wizard. No lo cambié porque el alcance es lista de named locks, no escrituras; el Orquestador decide.

Admin UI Check: No aplica (sin UI).
Notification Contract Check: No aplica (sin notificaciones).

## 6. Hallazgos abiertos y pendientes

### 6.1 Pendientes del owner (decisiones y pruebas, no ejecutadas aquí)

- **H1 (aceptado en la ronda 26).** Riesgo residual de F1 con el impacto de F-01. Pendiente de registrarlo en `STATE.md` por el Orquestador (no edité `STATE.md`). Sin medir: duración del lock huérfano, reutilización de la conexión, `GET_LOCK` directo desde otra sesión, efecto bajo carga.
- **F-06 (tamaño del pool).** Pendiente del owner. Repositorio sin `connection_limit`. Riesgo `P2024` bajo ráfagas, no medido.
- **F-11 (prueba de humo del `SET SESSION` en staging).** Pendiente del owner antes de la release combinada (D45). La versión y los permisos de MySQL de producción no están verificados.

### 6.2 Decisiones de producto para el Orquestador (no implementadas)

- **F-07.** El 409 `LOCK_TIMEOUT` cae en texto genérico en el admin (`components/admin/months/MonthDetailView.tsx`, `resolveBookAppointmentErrorDescriptionKey` y el `switch` de reprogramación). Sería una micro-ronda de UI (i18n y `sileo`). No implementado.
- **F-08.** Los scripts `scripts/retry-sync-failed-appointments.mjs` y `scripts/retry-sync-failed-blocked-slots.mjs` toman y liberan named locks con el cliente global, sin transacción. Preexistente. Ronda aparte. No implementado.

### 6.3 Observaciones de esta ronda

- **Prueba de restauración (7b):** la primera versión no detectaba la mutación porque las pruebas anteriores contaminan la conexión del pool. La versión final compara con `@@GLOBAL`. Si se añaden pruebas que dejen la conexión con 5 s, esta prueba seguirá detectando la mutación, pero podría requerir reordenarse.
- **Prueba residual (5):** deja su conexión con 5 s por diseño (H5). Sigue siendo la última de la integración por esa razón.
- **H6:** cerrado con la evidencia del Reviewer (mutación A y mensaje de Prisma). No lo repetí.
- **Re-entrancia de `GET_LOCK`:** es la afirmación de la documentación de MySQL que el Reviewer citó. No la medí, y así está escrito en los documentos.

### 6.4 Restos fuera del alcance de esta ronda

- `specs/003-flexible-month-availability/agent-reports/round-24-f1-developer.md` L38 y L158 siguen diciendo "peor caso 15 s". Son registro histórico. Este informe y la ADR son la referencia vigente. No se cambiaron porque la lista de correcciones acotaba el informe de la ronda 24 a los dos bloques del check de migración.
- Los demás informes con "Legacy compatibility required: No" (en `docs/implementation-reports/` y `docs/plans/`) no están relacionados con F1.

## 7. Qué no se verificó

- Ningún comando se ejecutó contra `appointments` ni contra producción.
- La línea base de 21 fallos unitarios no se repitió en esta ronda (sección 4, fila no ejecutada).
- El Reviewer de esta ronda no se ha ejecutado. Esta ronda no tiene aprobación.
- Las mediciones de la ronda 25 (H5, `IS_USED_LOCK`, mutación A) son del Reviewer y no se repitieron aquí.
- Aceptación manual del owner pendiente hasta que la confirme formalmente (sección 6.1).

## 8. Handoff

- Hecho: correcciones 1 a 7 del brief (documentación, comentario, nombre de prueba, prueba de restauración y afirmación de mensaje). Corrección 8 no implementada, anotada en 6.1 y 6.2.
- Verificado por ejecución: integración nueva (5/5, limpia y bajo mutación con restauración verificada), integración completa serial (58/63; línea base de 5 fallos), unitarias de 6 archivos (60/60), tsc (32 errores en `tests/`), eslint de 3 archivos (exit 0).
- Pendiente: Reviewer de alto riesgo; actualizar `STATE.md` con H1 aceptado y el estado de esta ronda (lo hace el Orquestador); decisiones del owner (6.1) y del Orquestador (6.2).
- Archivos tocados: los de la sección 1.
- Siguiente paso sugerido: Reviewer de alto riesgo sobre esta ronda, con foco en la prueba de restauración (mutación C2) y en la lista de seis transacciones en los cuatro documentos.
