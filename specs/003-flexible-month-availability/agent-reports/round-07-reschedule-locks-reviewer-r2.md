# Ronda 07 (1F) corrección 3, re-revisión ciclo 3: reviewer-high-risk (r2)

Transcrito (resumido) por el Orchestrator desde el hand-back. Repo no modificado por el Reviewer; mutaciones y sondas en copia del scratchpad (`rv2/`), solo `appointments_test`, sin credenciales impresas, sin tocar `appointments`.

**Veredicto: Rejected** (1 bloqueante, B-1). BLK-1 y NB-4 verificados con ejecución. La norma limita a tres las rondas de corrección: tras esta tercera con hallazgos abiertos el Orchestrator debe escalar al owner.

## Estado de hallazgos del ciclo 2
BLK-1 resuelto en las 5 rutas. BLK-2 parcial (persiste B-1). NB-1/NB-2 resueltos en `reschedule-reservation-lock`, persisten en `admin-create-concurrency`. NB-3 docs pendiente (NB-5). NB-4 resuelto. NB-6 (F1/D82) sin cambio.

## Bloqueante
**B-1.** `lib/my-appointments/service.ts:354-358`: `try { await getBookableMonthConfig(input.month) } catch { throw new Error("SLOT_NOT_AVAILABLE") }` convierte en 409 cualquier error, incluso no de dominio (`findActiveMonth`, `lib/db/active-months.ts:27-38`, usa el cliente global fuera de la transacción: timeout de pool P2024, corte de conexión). Contradice D81/D89. Evidencia: sonda con `mockRejectedValueOnce(new Error("Timed out fetching a new connection from the connection pool"))` => devuelve `SLOT_NOT_AVAILABLE`. Corrección: capturar `error.message === "MONTH_NOT_ALLOWED"` (único error de dominio, `lib/active-months/service.ts:44-62`), relanzar el resto, y añadir el test en `tests/lib/my-appointments.service.test.ts`. Sin pérdida de datos ni doble reserva. Solo se acepta como residual si el owner lo registra.

## No bloqueantes
- NB-1 `tests/integration/admin-create-concurrency.integration.test.ts:138` espera 800 ms (puede pasar sin detectar regresión); usar espera de `LOCK WAIT`.
- NB-2 mismo archivo L66-68: réplica de la reserva con el orden antiguo (limpieza antes de conflictos); invertir líneas y actualizar el comentario L61, o usar la función real.
- NB-3 los unitarios de `lock-reservation-slot`, `book-appointment` (confirmación) y `blocked-spaces.service` no afirman el orden D89 (`invocationCallOrder`).
- NB-4 sonda de espera (`reschedule-reservation-lock.integration.test.ts:136-150`) cuenta cualquier fila de `data_lock_waits`; afirmar que el objeto en espera es `appointments`.
- NB-5 documentación pendiente: ADR 0006 L16-22 (sin RL, D88/D89; `docs/decisions/` figura como no rastreado), runbook L9-11 y L14-16 ("cada minuto" choca con la advertencia), spec L202/L417/L435, paso 8 de 7, 8.2, 9; `booking-flow.md` L132/L227; `business-rules.md` ~L196/~L288; `api.md`.
- NB-6 (decisión operativa): D88 elimina la limpieza global perezosa; las filas expiradas de fechas pasadas solo se borran con `npm run locks:cleanup`; sin cron la tabla crece sin límite. Confirmar cron o aceptar crecimiento.
- NB-7 scripts globales: aceptable documentar sin cambiar código, condicionado a NB-5.
- NB-8 `lib/admin/appointments/service.ts`: faltan dos comentarios NB-4 del respaldo de las 22:24 (código idéntico). Restaurarlos.
- NB-9 `lib/db/blocked-slots.ts:80` `listBlockedSlotsByDateForUpdate` no bloquea (F2/D80); renombrar o documentar.

## Verificación ejecutada
- Mutaciones de orden (cada una falla solo su test con 1213, otras 8 pasan): M1 reserva pública (`lock-reservation-slot.ts:123-124`), M2 confirmación (`book-appointment.ts:483-484`), M3 creación admin (`admin/appointments/service.ts:281-282`), M4 reprogramación admin (`:474-475`), M5 bloqueo de espacios (`blocked-spaces/service.ts:239-240`). Orden actual: 9/9 x3 y en suite completa.
- Sonda de esperas: con el orden actual la única espera es `appointments|PRIMARY|X|RECORD`; con M1 aparece `reservation_locks|PRIMARY|X|RECORD`.
- BLK-2: con catch antiguo fallan los 2 tests nuevos de ocupación/bloqueos y el de lectura de locks; "keeps mapping a non-bookable month" pasa en ambos por diseño.
- NB-4: 4/4 sonda en `appointments_test` (incluye caso mixto lock propio + ajeno => `SLOT_LOCKED`; la versión 1E dejaba pasar ese caso).
- Vitest dirigido (38 archivos) 257/261 (4 fallos de línea base presentes también en HEAD: api-admin-cancel-route, month-detail-view, whatsapp appointment-labels x2 por formato `Intl`). Integración completa 30/35 (cancel 3/3, reservation-lock L65/L145 = línea base). eslint lib/ exit 0; tsc 32 errores todos en tests.
- Orden en código, todas las rutas: named -> FOR SHARE -> conflictos -> limpieza/lectura/escritura de RL; ninguna toma RL antes que citas.

## Reconstrucción de los dos archivos admin (puede/no puede afirmar)
Puede afirmar: comparando contra el snapshot de 1E (`r5-review/build-copy`, 13:29 del 30/10, con `next build`), `lib/admin/appointments/service.ts` y `lib/admin/blocked-spaces/service.ts` difieren solo en D88, D89, N4 y comentarios; no falta ningún cambio de 1E (D71, D72, D73, D76, D77, NB-2, NB-3 presentes); el código coincide con el respaldo de las 22:24 salvo 2 comentarios; tests de admin pasan. Nota: la copia `scratchpad/r07r1/copy` contiene residuos de las mutaciones del Reviewer del ciclo 2 en `lib/db/appointments.ts` y `lib/my-appointments/service.ts` (no afecta a los archivos admin; el estado actual de esos dos fue leído y es correcto).
No puede afirmar: que el snapshot 1E sea byte a byte el estado aprobado (sin commit ni hash); que el respaldo de las 22:24 sea el estado validado por el owner (r2 nunca fue revisado); ni que no haya cambios no documentados en otros archivos del 003 (no comparó todo contra HEAD).

## Correcciones requeridas
1. B-1 (bloqueante). 2. Antes de cerrar: NB-5 y NB-8. 3. Recomendado: NB-1..NB-4. 4. Owner: NB-6 (cron de `locks:cleanup`) y aceptación de NB-7 con runbook corregido. 5. B-1 solo se acepta como residual si el owner lo registra.
