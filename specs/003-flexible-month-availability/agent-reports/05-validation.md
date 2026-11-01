# T063: validación del quickstart S-01 a S-15 (2026-10-31)

Entorno: contenedor MySQL local `appointments-lanuit-db-1`, base `appointments` restaurada desde un respaldo de producción por el owner (21 migraciones, última 0021; 1432 citas, 147 clientes, 10 meses, 144 bloqueos). La app corrió en `localhost:3200` con `GOOGLE_*`/`WHATSAPP_*` vacíos por entorno del proceso (verificado: la sincronización de bloqueos respondió `CALENDAR_NOT_CONFIGURED`, sin llamadas externas). Producción no se tocó. Admin de prueba `t063-validation` creado en la base local.

## Verificación automatizada
| Escenario | Resultado |
|---|---|
| S-01 motor | `capacity-engine.test.ts` y suite `tests/lib/availability`: pasan (131). |
| S-02 backfill idempotente | `prisma migrate deploy` aplicó 0022 en 0.49 s; 10 reglas (una por mes), 1 fila en `availability_migration_runs`, `availability_version`=1. Segundo deploy: "No pending migrations", 0 cambios (reglas, runs, versiones, logs). |
| S-03 citas sin cambios | MD5 de id\|client_id\|date\|time_slot\|status de las 1432 citas idéntico antes de migrar, tras migrar, tras segundo deploy y tras ediciones de reglas/bloqueos en otros meses (05c69e56…); conteos por estado idénticos. |
| S-10 concurrencia | `availability-concurrency.integration.test.ts`: 4/4 en `appointments_test`. |
| S-11 bloqueos/calendario | `tests/lib/calendar`, `blocked-spaces.service.test.ts`: pasan (60 pruebas del lote). |
| S-15 dashboard | `dashboard.service.test.ts`: pasa. |

## Verificación en la app local (API y navegador integrado)
| Escenario | Resultado |
|---|---|
| S-04 | Feb 2028 (mismo calendario que dic 2026; dic 2026 tiene citas y bloqueos reales): reglas A y B → Disponibles = 67; 5, 6, 12, 13 y 24-29 en gris; 1-4 y 7-11 con 3; 14-23 con 4. |
| S-05 | Oct 2027 (mismo calendario que ene 2027): 21 días abiertos, 63 espacios; sáb 16 y 23 con 3; lun 18 y 25 en 0; sáb 2, 9, 30 en 0. |
| S-06 (pasos 1-4) | Preview sobre nov 2026 quitando 17:00: 1 afectada (cita 1280, 2026-11-11 17:00, CONFIRMED); sin escritura (versión 1→1). Paso 5 (confirmar) cubierto por E2E T061, no repetido aquí. |
| S-07 | PUT con versión vigente 200; PUT con versión vieja 409 `AVAILABILITY_VERSION_CONFLICT`; la base conserva el primero. |
| S-08 | `appointment_logs` 1595 antes y después de guardar reglas. |
| S-09 | `GET /api/availability/2026-11` ofrece horarios del resolvedor; `POST /api/reservar/lock` en domingo cerrado: 409 `SLOT_NOT_AVAILABLE`. |
| S-12 | Bloquear 14:00 el 2-feb: bloqueados 1; día completo 16-feb (rejilla de 4): bloqueados 5 (1+4). |
| S-13 | Mes pasado: 422 `MONTH_IN_PAST`. Mes nuevo (feb 2028): sin reglas, BLOCK_MODE, v0, 63 espacios (default D6). Primera regla: días no cubiertos (24-29) cerrados. |
| S-15 | Dashboard con datos reales: "Ocupación para el lunes 100%, 3 citas" coherente con capacidad = maxPerDay 3. Capacidad 0 en días cerrados: solo por prueba unitaria. |

## No verificado / manual
- S-11 con Google Calendar real (duración de 1 h en el evento): no probado, Google apagado a propósito. Cubierto solo por mocks.
- S-14 rollback a la versión anterior: requiere despliegue real; no probado.
- S-06 paso 5 y S-07 en la UI con esta base: cubiertos por E2E (T061), no repetidos manualmente.
- S-15 capacidad de día cerrado y semanal: solo prueba unitaria.
- Arranque del contenedor con `prisma:deploy` en Dockploy: no probado (solo `migrate deploy` local).
- C4 (D95) sigue pendiente; no cubierto aquí.

## Residuo en la base local `appointments` (el owner autorizó alterarla)
Meses 2028-02 y 2027-10 con reglas; bloqueos 227 y 228 (feb 2028); usuario admin `t063-validation`; filas de log/locks: ninguna nueva de citas.
