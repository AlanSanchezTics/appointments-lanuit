# Ronda 01 - Corrección 2 (solo documentación): hallazgos B1, B2 y N2 del Reviewer (Developer)

- Flujo: corrección documental sobre la ronda 01 (Developer -> Reviewer, riesgo bajo, sin spec).
- Fuente: `docs/implementation-reports/round-01-pending-whatsapp-reviewer.md` (solo B1, B2 y N2 se atienden).
- Estado: documentación actualizada. No hay cambios de código en esta corrección. Sin commit.
- Ronda 01 completa: ver `round-01-pending-whatsapp-developer-r1.md` (sigue vigente para el código y los tests de la redirección).

## Cambios del código de la dueña que esta corrección documenta (no modificados aquí)

- `lib/datetime/mexico-city.ts`, `formatLongDate`: el formato pasó de `{Día}, {d} de {Mes}` a `{Día} {d} de {Mes}` (sin coma). Resultado: `es` = `Lunes 13 de Abril`; `en` = `Monday April 13` (verificado con Intl, `es-MX` y `en-US`).
- `locales/es/admin.json` y `locales/en/admin.json`, clave `dashboard.pendingAppointments.whatsappMessage`: es = `🗓️ *Nos vemos el {{date}} a las {{time}}*!`; en = `🗓️ *See you on {{date}} at {{time}}*!` (un solo `!`, no `!!` como indicaba el brief de la ronda 01).
- Estos cambios no se tocaron en esta corrección.

## Archivos modificados en esta corrección (solo documentación)

| Archivo | Hallazgo | Cambio |
|---|---|---|
| `docs/specification.md` | B1 | Sección 14 (Internacionalización y Contrato de Mensajes), nueva regla 10: formato de fecha larga compartido (`formatLongDate`), es y en, alcance en flujos públicos y admin, cambio de formato decidido por la dueña, y excepción de recordatorios (no usan el helper). |
| `docs/specification.md` | B1 | Nota en el mensaje base de `CONFIRMED`: `{Fecha}` usa el formato de la regla 10. |
| `docs/specification.md` | N2 | Bloque `Pendientes de confirmación`: la frase sobre volver atrás ya no declara garantía. Dice que si el navegador vuelve a cargar `/admin` desde el servidor la cita confirmada ya no aparece; que no hay refresco forzado al restaurar desde caché de navegación (sin handler de `pageshow`), y que en ese caso el resultado depende del navegador. |
| `docs/specification.md` | (ajuste de la propia sección) | Bloque `Pendientes de confirmación`: el mensaje queda con `!` simple. |
| `docs/architecture/business-rules.md` | B2 | Nueva sección "Pending confirmation WhatsApp redirect" tras "Pending review rules": alcance (solo `Confirmar`), condición (`CONFIRMED`/`SYNC_FAILED`), URL, sin `router.refresh()` antes del redirect, `Rechazar` y errores sin redirect, prohibido `window.open`, y excepción explícita. |
| `docs/architecture/business-rules.md` | B2 | Política de recordatorios: nota de excepción. La redirección de pendientes no es un recordatorio y no está sujeta a la regla síncrona; motivo: el resultado se conoce tras confirmar y un redirect tras el `await` en la misma pestaña no lo bloquea el popup blocker. Recordatorios y retoque siguen siendo síncronos. |
| `docs/features/cancel-flow.md` | B1 | En el paso de `Notificar por WhatsApp`: la fecha usa el formato de fecha larga sin coma (`Lunes 13 de Abril`), con referencia a la sección 14, regla 10. |
| `docs/ui/admin/components.md` | B2 (y punto 3 del Reviewer) | PendingAppointmentsCard, Rules: la redirección es asíncrona y en la misma pestaña, excepción explícita a la regla de recordatorios con referencia a business-rules; la fecha del mensaje usa el formato compartido. |
| `docs/implementation-reports/round-01-pending-whatsapp-developer-r2.md` | - | Este reporte. |

Revisados sin cambio: `docs/features/admin-auth-flow.md` (ya describe la redirección; sin mención de fecha larga), `docs/features/booking-flow.md` y `docs/features/my-appointments-flow.md` (no describen el formato de la fecha ni el texto del mensaje con fecha). `docs/architecture/business-rules.md` no tiene formato de fecha, así que la regla de formato queda solo en la especificación (presentación, no regla de negocio).

## Impacto en flujos públicos (declaración corregida, B1)

- El flujo público **sí cambia**, por el helper compartido `formatLongDate`, no por la ronda 01. Afecta a:
  - pantallas de reserva: `booking-success-step`, `booking-confirm-step`, `booking-pending-confirmation-step`, `booking-wizard-step1` (dos usos), `booking-wizard-step-identity` (dos usos);
  - mensajes de WhatsApp de reserva (`hooks/booking/use-booking-success.ts`);
  - cancelación: `cancel-review-step` y el mensaje de WhatsApp de cancelación (`hooks/cancel/use-cancel-success-whatsapp.ts`);
  - `Mis citas`: `my-appointments-flow` (varios usos, incluido el mensaje).
- Lo que cambia para el usuario final: en `es` la fecha pasa de `Lunes, 13 de Abril` a `Lunes 13 de Abril`, tanto en pantalla como en el texto del WhatsApp.
- No cambia el contrato de API ni la lógica de negocio.
- Los recordatorios del admin no cambian (usan su propia plantilla).

## Verificación de los puntos pedidos

- B1: `docs/specification.md` sección 14, regla 10; referencias en `cancel-flow.md` y en el mensaje de `CONFIRMED`. Impacto público declarado arriba.
- B2: `business-rules.md`, sección "Pending confirmation WhatsApp redirect" y excepción en la política de recordatorios. Verificado que las líneas de la regla síncrona están en el bloque "Reminders widget policy".
- N2: frase de bfcache suavizada en `specification.md` (bloque `Pendientes de confirmación`). No se implementó `pageshow`.
- N1, N3 a N6: no tocados, según la instrucción.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `grep` de `whatsappMessage` en locales y de `Nos vemos` / `See you on` en `docs/` | Locales con `!` simple; la especificación coincide con `!`. Sin `!!` residual en docs fuera de reportes históricos. |
| `npx vitest run tests/components/admin/ui/pending-appointments-card.test.tsx tests/app/admin-dashboard-page.test.tsx` | 5 passed (2 archivos) |
| `node -e` con `Intl.DateTimeFormat` (`es-MX`, `en-US`, zona `America/Mexico_City`) | es = `lunes` + ` de ` + `abril` (capitalizado por el helper: `Lunes 13 de Abril`); en = `Monday April 13` |

No se ejecutaron tsc, eslint ni lint:admin-i18n: esta corrección no modificó código ni archivos TypeScript. `tsconfig.tsbuildinfo` no se tocó en esta corrección.

## Bloques de verificación

Documentation Impact:
- Yes
- Updated docs/specification.md: Yes
- Sections affected: 14 (regla 10, formato de fecha larga); 15.1.4 Dashboard, bloque `Pendientes de confirmación` (N2 y mensaje con `!`); nota en mensaje base `CONFIRMED`.
- Updated docs/architecture/business-rules.md: Yes (sección "Pending confirmation WhatsApp redirect"; excepción en "Reminders widget policy").
- Feature docs: `docs/features/cancel-flow.md` (fecha larga); `docs/features/admin-auth-flow.md` revisado sin cambio adicional.
- UI docs: `docs/ui/admin/components.md` (PendingAppointmentsCard, Rules).
- Momento: después de la implementación (corrección documental).
- Ambigüedades: ver "Puntos abiertos".

Flow Contract Check:
- UI steps updated: Yes (texto de la redirección en el dashboard; formato de fecha en pantallas públicas por el helper compartido)
- API contract updated: No (sin cambios de endpoints ni payloads)
- Validation rules updated: Yes (condición de redirección: `CONFIRMED`/`SYNC_FAILED`; reject y error sin redirect)
- Acceptance criteria updated: No (no hay sección formal de criterios; validación manual en el reporte r1)
- docs/specification.md aligned: Yes

Admin UI Check (corregido por B1):
- Uses components/admin/ui: Yes
- Reused existing components: Yes
- New reusable components created: No
- Tokens respected: Yes
- design-system.md aligned: Yes
- Public flow untouched: **No**. Afectado solo por el cambio de formato de fecha larga del helper compartido `formatLongDate` (ver "Impacto en flujos públicos"). La redirección de pendientes no toca el flujo público.

Migration Compatibility Check: sin cambios de esquema ni datos (schema: No; backfill: No; legacy: No; rollback: revertir el commit de la ronda; integridad: no aplica).

Notification Contract Check: sin cambios en notificaciones en esta corrección (los toasts de pendientes siguen con `sileo.promise`; el texto de WhatsApp sigue en `react-i18next`).

## Puntos abiertos (para la dueña / Orchestrator)

- Validación manual pendiente (sin cambios respecto a r1): redirección en la misma pestaña en iOS Safari, Android Chrome y escritorio; `Rechazar` y error sin redirect; y comportamiento al volver atrás (bfcache, ahora documentado como dependiente del navegador).
- N2 queda documentado sin garantía. Si la validación muestra la cita pendiente al volver, la mitigación sería `pageshow` con `event.persisted` y `router.refresh()`; no implementada.
- Regla de recordatorios: la excepción de pendientes queda documentada en `business-rules.md`. Confirmar que la dueña la acepta como excepción permanente.
- Texto `!` simple (decisión de la dueña), diferente del brief original `!!` y de la clave de reserva admin (`!`). Documentado con `!`.

Skipped: N1 y N3 a N6 (fuera de la instrucción), tsc/eslint (sin cambios de código). Not checked: el formato de fecha en el modal de reserva admin, que arma su propia etiqueta de WhatsApp (no re-verificado su texto exacto en esta corrección). Riesgo: el cambio de formato afecta a clientas en `es` en pantallas y WhatsApp públicos; la decisión está tomada por la dueña, pero no hubo validación de la clienta final.
