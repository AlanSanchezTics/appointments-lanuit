# Auditoría Técnica Final del MVP y Plan de Cierre

## Resumen

Este plan define una auditoría técnica final del MVP antes de declararlo listo para cierre. El objetivo no es construir funcionalidad nueva, sino exponer deuda técnica, validar riesgos operativos reales, priorizar remediaciones y dejar una ruta clara para un agente local que continúe el hardening.

El sistema ya tiene base funcional sólida:

- Reserva y cancelación operan end-to-end
- MySQL es la fuente de verdad
- Google Calendar sync real funciona
- Existen pruebas unitarias, de integración y E2E
- Se corrigieron problemas de concurrencia y cancelación parcial

La auditoría debe concentrarse en:

- deuda técnica residual
- huecos entre especificación y comportamiento actual
- riesgos de operación real
- tareas recomendadas ordenadas por prioridad
- criterios explícitos para cerrar el MVP

## Objetivo de la auditoría

Producir un entregable técnico que responda estas preguntas sin ambigüedad:

1. Qué partes del MVP están listas para producción controlada.
2. Qué deuda técnica sigue abierta y con qué severidad.
3. Qué riesgos funcionales, operativos o de mantenibilidad quedan.
4. Qué siguientes pasos deben hacerse antes de declarar el MVP cerrado.
5. Qué siguientes pasos pueden diferirse a una fase posterior.

## Estado base a auditar

El agente debe partir de este estado actual del repositorio:

- Framework: Next.js App Router
- Persistencia: Prisma + MySQL
- Integraciones: Google Calendar real y WhatsApp redirect
- Entorno local: Docker + Playwright + Vitest
- Commits recientes:
  - `3e0a032 feat: bootstrap booking platform MVP`
  - `26c6de6 fix: harden cancellation and concurrency flows`

## Hallazgos ya conocidos que deben entrar al informe

Estos puntos ya están confirmados y deben aparecer como deuda o riesgo documentado, no volver a descubrirse desde cero:

1. Cancelación en Google no “borra duro” el evento; Google lo deja con `status: "cancelled"`.
2. Existe manejo explícito de `SYNC_FAILED` para fallo de creación de evento espejo.
3. Existe manejo explícito de `CALENDAR_DELETE_FAILED` cuando falla la limpieza en cancelación.
4. Se usa `GET_LOCK` más `FOR UPDATE` para endurecer la concurrencia.
5. `LOCK_TIMEOUT` ya se mapea como `409`.
6. Se corrigió la exposición de fines de semana en disponibilidad.
7. Google Calendar funciona con calendario secundario compartido a la service account.
8. La suite E2E depende de binarios Playwright instalados localmente.

## Alcance incluido

- Auditoría de reglas de negocio contra especificación
- Auditoría de API pública
- Auditoría de persistencia y concurrencia
- Auditoría de integración con Google Calendar
- Auditoría de pruebas existentes
- Auditoría de operación local y DX
- Priorización de deuda técnica
- Recomendación de siguientes pasos

## Fuera de alcance

- Reescritura completa del dominio
- Cambios de producto grandes
- Introducción de panel administrativo
- Observabilidad completa
- Autenticación de usuarios finales
- Multi-recurso o multi-profesional

## Entregable esperado

Crear un documento de auditoría técnica compartible con un agente local, por ejemplo:

- `docs/audits/2026-03-04-mvp-technical-audit.md`

El documento debe contener:

1. Resumen ejecutivo
2. Estado actual del MVP
3. Hallazgos priorizados
4. Deuda técnica clasificada
5. Riesgos abiertos
6. Recomendaciones inmediatas
7. Recomendaciones post-MVP
8. Criterios para declarar el MVP cerrado

## Estructura obligatoria del informe

### 1. Resumen Ejecutivo

Debe responder en una sola pantalla:

- Estado general: `Listo con reservas`, `Listo condicionado`, o `No listo`
- Riesgos críticos abiertos
- Recomendación de lanzamiento
- Bloqueadores reales

### 2. Matriz de Hallazgos

Cada hallazgo debe incluir:

- `ID`
- `Severidad`: `Crítica`, `Alta`, `Media`, `Baja`
- `Área`: `API`, `DB`, `Concurrencia`, `Calendar`, `UI`, `Tests`, `DX`
- `Descripción`
- `Impacto real`
- `Referencia de archivo`
- `Recomendación`
- `Estado`: `Abierto`, `Mitigado`, `Aceptado`

### 3. Deuda Técnica por Categoría

Separar explícitamente:

- Deuda de arquitectura
- Deuda de integraciones
- Deuda de pruebas
- Deuda de operación
- Deuda de DX / mantenimiento

### 4. Siguientes Pasos Recomendados

Dividir en tres horizontes:

- `Antes de cerrar MVP`
- `Primer ciclo post-MVP`
- `Mejoras opcionales`

## Cambios o interfaces que el informe debe considerar

### APIs públicas actuales

- `GET /api/availability/[month]`
- `POST /api/reservar`
- `POST /api/cancelar`

### Respuestas relevantes actuales

Reserva:

- `CONFIRMED`
- `SYNC_FAILED`
- `syncReason` opcional

Cancelación:

- `CANCELLED`
- `syncReason: CALENDAR_DELETE_FAILED` opcional

El informe debe decidir si estas interfaces:

- ya son aceptables como contrato MVP
- o necesitan normalización antes de cierre

### Tipos de razón técnica ya presentes

- `CALENDAR_NOT_CONFIGURED`
- `CALENDAR_SYNC_FAILED`
- `CALENDAR_DELETE_FAILED`
- `LOCK_TIMEOUT`

La auditoría debe decidir si este esquema de razones:

- está suficientemente consistente
- o necesita un catálogo formal de errores

## Metodología obligatoria de auditoría

### Paso 1. Validar contra la especificación

Comparar código actual contra [specification.md](/Volumes/weknow_SSD/development/personal/Docker/appointments-lanuit/docs/specification.md).

Checklist mínimo:

- solo mes actual
- no mismo día
- solo lunes a viernes
- separación de 4 horas
- una cita futura activa por teléfono
- MySQL como fuente de verdad
- Google como espejo
- cancelación libera horario
- concurrencia first-commit-wins

Salida esperada:

- tabla `Regla / Estado / Evidencia / Riesgo`

### Paso 2. Auditar concurrencia y consistencia

Revisar:

- reserva transaccional
- cancelación transaccional
- `FOR UPDATE`
- `GET_LOCK`
- comportamiento en conflicto
- conservación de `googleEventId` si falla limpieza

Salida esperada:

- lista de invariantes protegidos
- lista de invariantes todavía frágiles

### Paso 3. Auditar integración Google Calendar

Revisar:

- creación post-commit
- `SYNC_FAILED`
- smoke test real
- cancelación del espejo
- dependencia de calendario secundario compartido

Preguntas a responder:

- qué pasa si Google responde lento
- qué pasa si Google responde 500
- qué pasa si la credencial expira
- qué pasa si el calendario deja de compartirse

### Paso 4. Auditar cobertura de pruebas

Clasificar qué está cubierto y qué no.

Unit:

- validaciones
- disponibilidad
- calendar helpers
- sync behavior

Integration:

- reserva real en MySQL
- cancelación real en MySQL

E2E:

- entrypoints UI
- booking endpoint flow
- cancellation endpoint flow

Identificar huecos, especialmente:

- flujo UI completo con selección de día/slot en navegador
- retry/manual recovery de `CALENDAR_DELETE_FAILED`
- escenarios de error visibles al usuario
- concurrencia más agresiva
- cambio de DST / timezone edge cases

### Paso 5. Auditar operación y DX

Revisar:

- setup local documentado
- dependencia en Docker daemon
- necesidad de `playwright install`
- uso de `.env`
- sensibilidad de secretos
- claridad del smoke test

El informe debe separar:

- problemas de producto
- problemas de ingeniería
- problemas de operación local

## Hallazgos iniciales recomendados para incluir

Estos son candidatos de alta probabilidad y el agente debe confirmarlos o cerrarlos:

### Alta prioridad

1. Falta estrategia explícita de reintento para `CALENDAR_DELETE_FAILED`.
2. No hay mecanismo administrativo para inspeccionar y corregir citas con `SYNC_FAILED`.
3. No hay rate limiting en endpoints públicos.
4. No hay observabilidad estructurada para errores de concurrencia o de Google.
5. No hay contrato formal unificado de errores API.

### Prioridad media

1. E2E cubre endpoints reales, pero no aún el flujo UI completo paso a paso.
2. README documenta setup, pero no hay runbook de fallos de Google Calendar.
3. Falta criterio formal de limpieza/reintento para eventos cancelados en Google.
4. El uso de named locks está bien, pero necesita documentación técnica de por qué existe además del índice único.

### Prioridad baja

1. Warning de entorno ya fue corregido, pero la configuración dev/test debería quedar documentada.
2. Falta un documento de arquitectura corto para nuevos agentes o devs.
3. El smoke test depende de una fecha/hora fija configurable y podría documentarse mejor.

## Recomendaciones obligatorias de salida

El informe debe terminar con una priorización ejecutiva exacta:

### Antes de cerrar MVP

1. Definir estrategia de remediación para `SYNC_FAILED` y `CALENDAR_DELETE_FAILED`.
2. Formalizar catálogo de errores API y qué debe mostrarse al usuario.
3. Añadir un runbook de operación mínima para Google Calendar y datos inconsistentes.
4. Confirmar si el flujo UI del navegador completo necesita E2E adicional antes de cierre.

### Primer ciclo post-MVP

1. Panel o script administrativo para reintentos de sync.
2. Rate limiting en `/api/reservar` y `/api/cancelar`.
3. Logs estructurados y métricas de errores.
4. Auditoría de seguridad básica sobre inputs y abuso de endpoints.

### Opcional / Futuro

1. Notificaciones automáticas.
2. Panel administrativo.
3. Reagendado.
4. Mejoras visuales y UX avanzada.

## Criterios de aceptación del informe

El informe se considera terminado si:

- clasifica deuda técnica por severidad
- identifica qué riesgos bloquean cierre y cuáles no
- recomienda pasos concretos y ordenados
- no deja decisiones ambiguas al siguiente agente
- incluye referencias a archivos o evidencias
- separa claramente `must fix before close` de `can defer`

## Supuestos y defaults

- Se asume que el objetivo es cierre de MVP, no lanzamiento masivo inmediato.
- Se asume que Google Calendar seguirá siendo sistema espejo y no fuente de verdad.
- Se asume que no se añadirá autenticación de usuario final en esta fase.
- Se asume que el calendario secundario seguirá siendo la estrategia oficial para Google.
- Si un punto no tiene evidencia suficiente, debe marcarse como `Pendiente de validar`, no inferirse como resuelto.

## Formato recomendado para compartir con otro agente local

El documento final debe estar escrito en español técnico, con:

- secciones breves
- tablas o listas planas
- referencias a archivos absolutos cuando aplique
- una sección final `Recomendación de cierre del MVP`

La recomendación final debe usar exactamente una de estas etiquetas:

- `Cerrar MVP`
- `Cerrar MVP con reservas`
- `No cerrar MVP aún`
