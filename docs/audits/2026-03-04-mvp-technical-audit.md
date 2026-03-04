# Auditoría Técnica Final del MVP y Plan de Cierre

## Resumen Ejecutivo

- Estado general: `Cerrar MVP con reservas`
- Recomendación de lanzamiento: viable para producción controlada de bajo volumen, no para operación desatendida
- Riesgos críticos abiertos:
  - No existe estrategia operativa de remediación para `SYNC_FAILED` y `CALENDAR_DELETE_FAILED`
  - No existe rate limiting en endpoints públicos
  - No existe observabilidad estructurada para fallos de Google Calendar y conflictos de concurrencia
- Bloqueadores reales:
  - Ninguno para cierre de MVP controlado
  - Sí existen bloqueadores para escalar operación o reducir carga manual

El sistema cumple el núcleo del MVP: reserva y cancelación operan end-to-end, MySQL es fuente de verdad, Google Calendar funciona como espejo real y la base de pruebas cubre unit, integration y E2E. Aun así, el cierre debe hacerse con reservas porque la operación sigue dependiendo de intervención manual ante fallos de sync y no existe soporte administrativo mínimo para recuperación.

## Estado Actual del MVP

### Alcance implementado

- Reserva dentro del mes actual
- Cancelación de cita futura por teléfono
- Validaciones backend obligatorias
- Concurrencia endurecida con `FOR UPDATE`, índice único y named locks
- Sincronización real con Google Calendar sobre calendario secundario compartido
- Redirección a WhatsApp
- Suite de pruebas:
  - Unit
  - API
  - Integration con MySQL real
  - E2E con Playwright

### Estado técnico observado

- Framework: Next.js App Router
- Persistencia: Prisma + MySQL
- Integración externa: Google Calendar vía service account
- Entorno local: Docker, Playwright, Vitest
- Commits base:
  - `3e0a032 feat: bootstrap booking platform MVP`
  - `26c6de6 fix: harden cancellation and concurrency flows`

## Validación Contra la Especificación

| Regla | Estado | Evidencia | Riesgo |
|---|---|---|---|
| Solo mes actual | Cumple | [lib/validation/appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/validation/appointment.ts#L19), [app/api/availability/[month]/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/availability/[month]/route.ts#L13) | Bajo |
| No mismo día | Cumple | [lib/validation/appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/validation/appointment.ts#L29) | Bajo |
| Solo lunes a viernes | Cumple | [lib/availability/service.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/availability/service.ts#L41), [tests/lib/availability/service.test.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/lib/availability/service.test.ts#L14) | Bajo |
| Separación mínima de 4 horas | Cumple | [lib/availability/rules.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/availability/rules.ts#L8), [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts#L63) | Medio |
| Una cita activa futura por teléfono | Cumple | [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts#L30), [tests/integration/book-appointment.integration.test.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/integration/book-appointment.integration.test.ts#L44) | Bajo |
| MySQL es fuente de verdad | Cumple | Reserva y cancelación persisten antes de depender del espejo Google. [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts#L24), [lib/appointments/cancel-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/cancel-appointment.ts#L10) | Bajo |
| Google Calendar es espejo | Cumple | Sync después del commit. [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts#L81), [lib/calendar/sync-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/calendar/sync-appointment.ts#L10) | Bajo |
| Confirmación atómica | Cumple con reservas | Transacción + locks + unique constraint. [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts#L24), [lib/db/appointments.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/db/appointments.ts#L143) | Medio |
| Cancelación libera horario | Cumple | Estado cambia a `CANCELLED` y deja de participar en disponibilidad. [lib/appointments/cancel-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/cancel-appointment.ts#L25), [lib/availability/service.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/availability/service.ts#L33) | Bajo |
| Cancelación simultánea y nueva reserva resuelta por transacción | Cumple parcialmente | Cancelación ya es transaccional. [lib/appointments/cancel-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/cancel-appointment.ts#L10) | Medio |

## Matriz de Hallazgos

| ID | Severidad | Área | Descripción | Impacto real | Referencia | Recomendación | Estado |
|---|---|---|---|---|---|---|---|
| AUD-001 | Alta | Calendar | No existe mecanismo de reintento o cola de recuperación para `SYNC_FAILED` y `CALENDAR_DELETE_FAILED` | Fallos temporales de Google requieren intervención manual y pueden dejar citas sin espejo o eventos cancelados sin limpieza final | [lib/calendar/sync-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/calendar/sync-appointment.ts#L23), [lib/appointments/cancel-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/cancel-appointment.ts#L37) | Añadir script o panel de reintento y criterio operativo explícito | Abierto |
| AUD-002 | Alta | API | No existe catálogo formal y estable de errores API | El cliente recibe strings de error sueltos y `syncReason` opcional sin contrato formal; esto complica UX y evolución del frontend | [app/api/reservar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/reservar/route.ts#L18), [app/api/cancelar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/cancelar/route.ts#L15) | Formalizar códigos de error y payload uniforme | Abierto |
| AUD-003 | Alta | Operación | No hay rate limiting ni mitigación de abuso en endpoints públicos | Riesgo de spam, scraping, agotamiento de slots y presión innecesaria sobre MySQL/Google | [app/api/reservar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/reservar/route.ts#L7), [app/api/cancelar/route.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/app/api/cancelar/route.ts#L7) | Añadir rate limiting por IP/teléfono y protección básica de abuso | Abierto |
| AUD-004 | Alta | Observabilidad | No existen logs estructurados, métricas ni alertas | Los fallos de concurrencia, Google o configuración quedan invisibles salvo inspección manual | [lib/appointments/book-appointment.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/appointments/book-appointment.ts#L98), [lib/calendar/google.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/calendar/google.ts#L81) | Agregar logs con contexto mínimo y métricas por tipo de error | Abierto |
| AUD-005 | Media | Tests | E2E cubre endpoints reales, pero no el flujo UI completo de selección día/slot/formulario/cancelación en navegador | La interfaz puede romperse visual o interactivamente sin que la suite lo detecte | [tests/e2e/booking.spec.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/e2e/booking.spec.ts#L9), [tests/e2e/cancellation.spec.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/tests/e2e/cancellation.spec.ts#L9) | Añadir E2E de navegador con interacción completa | Abierto |
| AUD-006 | Media | Calendar | La cancelación en Google no elimina físicamente el evento; queda con `status: cancelled` | No afecta la fuente de verdad, pero puede requerir criterio operativo si el calendario espejo se usa visualmente | Evidencia operativa del smoke/cancel test; comportamiento esperado de Google API | Documentar explícitamente este comportamiento como aceptado | Aceptado |
| AUD-007 | Media | Concurrencia | Se usan named locks además de índice único y `FOR UPDATE`, pero la decisión no está documentada para mantenimiento futuro | Riesgo de que otro agente simplifique la lógica y reabra carreras ya corregidas | [lib/db/appointments.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/db/appointments.ts#L143), [lib/db/appointments.ts](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/lib/db/appointments.ts#L154) | Añadir nota de arquitectura sobre por qué existen `GET_LOCK` y su orden de adquisición | Abierto |
| AUD-008 | Media | DX | El setup local depende de Docker daemon activo, Playwright browsers instalados y secretos válidos; la documentación es útil pero corta para incidentes | Tiempo de onboarding mayor y resolución manual más lenta | [README.md](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/README.md#L13), [package.json](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/package.json#L10) | Crear runbook operativo corto | Abierto |
| AUD-009 | Baja | Calendar | `calendarList.list()` fue inconsistente durante el setup aunque `events.insert` y `events.delete` funcionan | No bloquea el producto, pero puede confundir diagnósticos futuros | Evidencia operativa de smoke tests previos; no usada por runtime de negocio | Documentar como comportamiento no crítico y no basar decisiones de producto en ese endpoint | Aceptado |
| AUD-010 | Baja | Arquitectura | Falta documento de arquitectura orientado a nuevos agentes | Más tiempo de arranque para mantenimiento y hardening | Repositorio sin `docs/architecture.md` final mantenido | Añadir resumen de arquitectura y flujo de datos | Abierto |

## Invariantes Protegidos

- MySQL sigue siendo la fuente de verdad aun cuando Google falle
- Reserva no depende de Google Calendar para confirmar disponibilidad
- `SYNC_FAILED` bloquea nuevas reservas por teléfono como cita activa
- La cancelación persiste `CANCELLED` antes de cualquier resultado de Google
- `googleEventId` se conserva si falla la limpieza del espejo
- Fines de semana ya no se exponen en disponibilidad
- `LOCK_TIMEOUT` ya se trata como conflicto y no como `400`

## Invariantes Todavía Frágiles

- No existe remediación automatizada de citas con `SYNC_FAILED`
- No existe remediación automatizada de cancelaciones con `CALENDAR_DELETE_FAILED`
- La robustez ante latencia alta o caídas repetidas de Google no está instrumentada
- No existe protección frente a abuso externo de los endpoints públicos
- No hay evidencia automatizada de cambio horario estacional o bordes de timezone

## Deuda Técnica por Categoría

### Deuda de arquitectura

- Falta documento breve que explique:
  - por qué se usa `GET_LOCK` además de `UNIQUE(date, time_slot)` y `FOR UPDATE`
  - qué significa `SYNC_FAILED` operativamente
  - por qué Google Calendar es espejo y no fuente de verdad
- Falta catálogo de errores compartido entre backend y frontend

### Deuda de integraciones

- No hay mecanismo de reintento para `SYNC_FAILED`
- No hay mecanismo de reintento o limpieza para `CALENDAR_DELETE_FAILED`
- Falta runbook de rotación de credenciales y pérdida de acceso al calendario
- El smoke test existe, pero no forma parte de un procedimiento documentado de release

### Deuda de pruebas

- Falta E2E de navegador completo para:
  - elegir día
  - elegir horario
  - llenar formulario
  - verificar feedback visual
  - cancelar desde UI
- Falta cobertura específica de DST / timezone edge cases
- Falta prueba explícita de errores visuales al usuario final

### Deuda de operación

- No hay métricas ni alertas
- No hay script/panel para inspeccionar estados anómalos
- No hay procedimiento documentado para limpiar eventos cancelados en Google
- No hay rate limiting ni mitigación de abuso

### Deuda de DX / mantenimiento

- El setup depende de Docker y Playwright browsers instalados localmente
- La documentación no separa setup normal de troubleshooting
- No hay documento único de arquitectura y mantenimiento

## Auditoría de API Pública

### Contrato actual aceptable para MVP

- `GET /api/availability/[month]`
- `POST /api/reservar`
- `POST /api/cancelar`

### Observación de contrato

El contrato actual es utilizable para MVP, pero no está normalizado:

- reserva puede devolver `CONFIRMED` o `SYNC_FAILED`
- cancelación puede devolver `CANCELLED` y `syncReason` opcional
- los errores se devuelven como strings sin estructura formal

### Conclusión

- Aceptable para MVP: sí
- Aceptable como contrato duradero: no

Antes de estabilizar una versión pública más larga, conviene unificar:

- `code`
- `message`
- `retryable`
- `details`

## Auditoría de Integración con Google Calendar

### Estado actual

- Creación de evento real validada
- Cancelación real validada
- Service account funcional con calendario secundario compartido
- Smoke test real operativo

### Riesgos abiertos

- Si Google responde 500 o hay timeout, la cita puede quedar `SYNC_FAILED` sin remediación automática
- Si el calendario deja de compartirse, el sistema degrada correctamente a error, pero no existe alerta
- Si falla el borrado del evento en cancelación, la cancelación persiste y el espejo queda pendiente de limpieza

### Evaluación

La integración está suficientemente funcional para MVP, pero no suficientemente operable para uso sin supervisión.

## Auditoría de Pruebas

### Cubierto

- Unit:
  - validaciones
  - disponibilidad
  - helpers de calendario
  - comportamiento de sync
- API:
  - éxito y errores principales
  - `LOCK_TIMEOUT`
  - `CALENDAR_DELETE_FAILED`
- Integration:
  - reserva real en MySQL
  - cancelación real en MySQL
  - persistencia de `SYNC_FAILED`
- E2E:
  - entrypoints UI
  - booking flow por endpoint público
  - cancellation flow por endpoint público

### No cubierto o cubierto parcialmente

- UI completa en navegador, paso a paso
- recuperación manual/retry de estados de sync anómalos
- escenarios agresivos de concurrencia bajo carga
- DST y bordes de fecha/hora
- mensajes de error visibles y específicos en la UI

## Auditoría de Operación y DX

### Lo que está bien

- Setup local entendible
- Docker compose para MySQL
- Script real de smoke test para Calendar
- Build, tests, integration y E2E ya automatizados

### Lo que falta

- runbook operativo
- guía de incidentes de Google Calendar
- notas de credenciales/rotación
- checklist de release reproducible

## Recomendaciones Inmediatas

### Antes de cerrar MVP

1. Definir estrategia de remediación para `SYNC_FAILED` y `CALENDAR_DELETE_FAILED`.
2. Formalizar catálogo de errores API y qué debe mostrarse al usuario.
3. Añadir un runbook mínimo para Google Calendar, estados anómalos y recuperación manual.
4. Decidir explícitamente si el flujo UI completo necesita E2E adicional antes de declarar cierre.

### Primer ciclo post-MVP

1. Crear panel o script administrativo para:
   - listar `SYNC_FAILED`
   - listar `CALENDAR_DELETE_FAILED`
   - reintentar sync
   - reintentar cleanup
2. Añadir rate limiting en `/api/reservar` y `/api/cancelar`.
3. Añadir logs estructurados y métricas de errores.
4. Ejecutar auditoría básica de seguridad y abuso.

### Mejoras opcionales

1. Notificaciones automáticas
2. Panel administrativo
3. Reagendado
4. Mejoras de UX y estados visuales más detallados

## Plan de Trabajo Recomendado para Otro Agente Local

### Bloque 1: Cierre operativo mínimo

- Crear `docs/runbooks/google-calendar.md`
- Documentar:
  - qué significa `SYNC_FAILED`
  - qué significa `CALENDAR_DELETE_FAILED`
  - cómo usar `npm run calendar:smoke`
  - cómo detectar pérdida de acceso al calendario
  - cómo limpiar un evento cancelado manualmente

### Bloque 2: Contrato de errores

- Introducir un mapa formal de errores de dominio
- Unificar payloads de error de `reservar` y `cancelar`
- Definir qué mensajes son internos y cuáles pueden mostrarse al usuario

### Bloque 3: Herramientas de remediación

- Crear script administrativo local para:
  - consultar citas `SYNC_FAILED`
  - consultar citas canceladas con `googleEventId` remanente
  - reintentar creación/borrado de evento

### Bloque 4: Hardening post-MVP

- Rate limiting
- Logging estructurado
- Métricas mínimas
- E2E de navegador completo

## Criterios para Declarar el MVP Cerrado

El MVP puede declararse cerrado si se acepta explícitamente que:

- el producto saldrá con supervisión operativa básica
- los fallos de sync se corregirán manualmente
- no habrá exposición masiva ni tráfico no controlado en la primera etapa

Si se exige operación más autónoma, entonces no debe cerrarse aún sin:

- remediación de sync
- runbook
- rate limiting
- contrato de errores formal

## Recomendación de Cierre del MVP

`Cerrar MVP con reservas`

Razones:

- El núcleo funcional está resuelto y validado con pruebas reales
- No hay bloqueadores funcionales para uso controlado
- Sí existe deuda técnica relevante en operación, recuperación y hardening
- Esa deuda no impide un cierre de MVP, pero sí impide tratarlo como sistema listo para escalar sin supervisión
</proposed_plan> 
