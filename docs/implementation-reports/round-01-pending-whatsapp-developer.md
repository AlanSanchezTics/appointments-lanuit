# Ronda 01 - WhatsApp al confirmar cita pendiente (Developer)

> Superseded por `round-01-pending-whatsapp-developer-r1.md` (la apertura en nueva pestaña fue rechazada por la dueña). Se conserva solo como registro.

- Flujo: Developer -> validación humana -> Reviewer (riesgo bajo, sin spec, `docs/implementation-reports/`).
- Estado: implementación terminada y verificada con tests/tipos/lint. Pendiente validación manual de la dueña (ver sección final). No hay commit.
- Sin cambios de API, esquema, reglas de negocio ni flujo público.

## Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `components/admin/ui/PendingAppointmentsCard.tsx` | modificado | `handleTransition` recibe el item completo. En `confirm` abre la ventana de forma síncrona antes del `await`; si el resultado es `CONFIRMED` o `SYNC_FAILED` asigna la URL de WhatsApp; en cualquier otro caso o error la cierra. `reject` no abre ventana. Sigue habiendo un solo `useState`. |
| `hooks/admin/usePendingAppointmentWhatsapp.ts` | nuevo | `openConfirmationWindow` (`window.open("", "_blank")`, `opener = null`) y `navigateConfirmationWindow` (formatea fecha/hora con `formatLongDate` y `formatTimeSlotLabel`, traduce con `dashboard.pendingAppointments.whatsappMessage` y construye la URL con `buildWhatsappUrlFromMessage`). |
| `locales/es/admin.json` | modificado | `dashboard.pendingAppointments.whatsappMessage` = `🗓️ *Nos vemos el {{date}} a las {{time}}*!!` |
| `locales/en/admin.json` | modificado | Igual clave = `🗓️ *See you on {{date}} at {{time}}*!!` |
| `tests/components/admin/ui/pending-appointments-card.test.tsx` | nuevo | 4 tests del flujo de confirmación/rechazo (ver abajo). |
| `docs/specification.md` | modificado | Sección 15.1.4 (Dashboard `/admin`), bloque `Pendientes de confirmación`: comportamiento de WhatsApp en `Confirmar`, condición por status, ventana síncrona, cierre en fallo, bloqueo de popup, `Rechazar` sin WhatsApp. |
| `docs/features/admin-auth-flow.md` | modificado | Bullet `Confirmar` del bloque `Pendientes de confirmación` (sección dashboard) con la apertura de WhatsApp. |
| `docs/ui/admin/components.md` | modificado | `PendingAppointmentsCard`: Structure (acción Confirmar/Rechazar), Rules (apertura síncrona, i18n, prohibido abrir WhatsApp en rechazo), Implementation Notes (hook y helper reutilizado). |
| `docs/implementation-reports/round-01-pending-whatsapp-developer.md` | nuevo | Este reporte. |

No modificados (verificados): `lib/whatsapp/message.ts` (se reutiliza `buildWhatsappUrlFromMessage` sin extender), `docs/architecture/business-rules.md`, `docs/ui/admin/design-system.md`, `docs/ui/admin/tokens.md`, endpoints `/api/admin/appointments/{id}/confirm|reject`, esquema Prisma, flujo público.

Nota de `tsconfig.tsbuildinfo`: `tsc --noEmit` lo modificó; se restauró con `git checkout`. No queda en el diff.

## Qué cambia en el comportamiento

1. Click en `Confirmar`: se abre una ventana en blanco de inmediato (síncrono, dentro del gesto del usuario) y se llama al endpoint de confirmación como antes (`sileo.promise`).
2. Si la respuesta es `CONFIRMED` o `SYNC_FAILED`: la ventana navega a `https://wa.me/52{phone}?text={mensaje codificado}`. Después se mantiene `router.refresh()`.
3. Si la respuesta es error o hay excepción: la ventana se cierra y no se abre WhatsApp. El toast de error de sileo no cambia.
4. Si el navegador bloquea `window.open` (devuelve `null`): la confirmación se completa igual y no se abre WhatsApp. No hay fallback (ver limitaciones).
5. Click en `Rechazar`: sin cambios en el flujo, no abre ventana ni WhatsApp.

Fecha y hora del mensaje son los mismos valores que muestra la tarjeta (`formatLongDate` y `formatTimeSlotLabel` con `language`). El teléfono es `52` + `item.phone`; el teléfono ya se normaliza a 10 dígitos al reservar (`lib/booking/draft-rules.ts`), mismo criterio que los recordatorios.

## Comandos ejecutados y resultados

Comandos del proyecto: `CLAUDE.md` no tiene sección "Commands" (solo importa `AGENTS.md`), así que usé los scripts de `package.json`.

| Comando | Resultado |
|---|---|
| `npx vitest run tests/app/admin-dashboard-page.test.tsx` (línea base, antes de editar) | 1 passed |
| `npx tsc --noEmit` (línea base, antes de editar) | exit 2, 66 errores previos, todos en archivos de `tests/` (app, components, e2e, integration, lib, scripts) ajenos a estos archivos |
| `npx tsc --noEmit` (final) | exit 2, 66 errores; conjunto idéntico a la línea base (`diff` vacío). Ningún error en archivos tocados. |
| `npx eslint components/admin/ui/PendingAppointmentsCard.tsx hooks/admin/usePendingAppointmentWhatsapp.ts tests/components/admin/ui/pending-appointments-card.test.tsx` | exit 0, sin avisos |
| `npm run lint:admin-i18n` | exit 0, 1 warning previo en `hooks/admin/useReminderAppointments.ts` (import no usado, fuera de alcance) |
| `npx vitest run tests/components/admin/ui/pending-appointments-card.test.tsx` | 4 passed |
| `npx vitest run tests/components/admin/ui tests/app/admin-dashboard-page.test.tsx tests/hooks/admin tests/lib/admin/dashboard.service.test.ts` (final) | 29 passed, 1 failed |

Fallo no causado por esta ronda: `tests/components/admin/ui/reminder-appointments-card.test.tsx` ("opens the final WhatsApp URL directly from click") falla con `TypeError: Cannot redefine property: assign` en su propia línea 24 (`vi.spyOn(window.location, "assign")`). Falla también aislado. Ni el test ni `ReminderAppointmentsCard` ni su hook se modificaron en esta ronda. No lo reproduje en un checkout limpio, así que el origen previo se deduce de la línea que falla, no de una ejecución en HEAD.

## Tests añadidos (4)

Los 4 casos usan `sileo` y `fetch` mockeados, `window.open` espiado y las traducciones reales de `es`:

1. Confirmar con `CONFIRMED`: `window.open` se llama en el mismo click (antes de resolver el fetch); la URL final tiene origen `https://wa.me`, path `/525512345678`, texto decodificado igual a `🗓️ *Nos vemos el {fecha larga} a las 09:00 AM*!!`; `opener` queda `null`; no se cierra la ventana.
2. Confirmar con `SYNC_FAILED`: también navega a WhatsApp, no cierra la ventana.
3. Confirmar con error del servidor (`ok: false`): la ventana se cierra y su `location.href` queda vacío.
4. Rechazar con `REJECTED`: no se llama a `window.open` y no se navega.

## Bloques de verificación

Documentation Impact:
- Yes
- Updated docs/specification.md: Yes
- Sections affected: 15.1.4 Dashboard (`/admin`), bloque `Pendientes de confirmación`; `docs/features/admin-auth-flow.md` (dashboard, bloque `Pendientes de confirmación`); `docs/ui/admin/components.md` (PendingAppointmentsCard: Structure, Rules, Implementation Notes).
- `docs/architecture/business-rules.md`: verificado, sin cambios. La regla de WhatsApp en `PENDING` (L145) está acotada al paso de éxito del flujo público de reserva y no contradice el flujo admin. No cambió ninguna regla de negocio.
- Momento de la actualización: durante la implementación (misma ronda).
- Ambigüedades detectadas: ver "Puntos para decisión de la dueña".

Flow Contract Check:
- UI steps updated: Yes (nuevo paso de apertura de WhatsApp tras `Confirmar`)
- API contract updated: No (endpoints y payload sin cambios; se usa el campo `status` que ya devuelve)
- Validation rules updated: Yes (la condición de apertura por status `CONFIRMED`/`SYNC_FAILED` queda documentada; no hay validación de entrada nueva)
- Acceptance criteria updated: No (el bloque no tiene sección formal de criterios de aceptación en `docs/`; la validación manual está listada abajo)
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Yes (revertir el commit; no hay estado persistido nuevo)
- Cleanup phase defined: No aplica
- Integrity protections defined: No aplica (no hay escritura nueva; la URL de WhatsApp no persiste)

Admin UI Check:
- Uses components/admin/ui: Yes (`Button`, `AdminIcon` ya existentes)
- Reused existing components: Yes
- New reusable components created: No (solo se añade un hook)
- Tokens respected: Yes (sin cambios visuales)
- design-system.md aligned: Yes (no requiere cambios)
- Public flow untouched: Yes

Notification Contract Check:
- Sileo used for success/warning/error/info: Yes (los toasts existentes siguen con `sileo.promise`; no se añadieron notificaciones nuevas)
- Sileo action notifications used when applicable: No aplica (no hay botón de acción en la notificación)
- Sileo promise notifications used when applicable: Yes (existente, sin cambios)
- i18n applied in admin notifications: Yes (los textos nuevos son solo el mensaje de WhatsApp, vía `react-i18next`)
- Alternative notification systems introduced: No

## Diseño estático (revisado, no ejecutado en navegador)

- La ventana se abre antes del primer `await` del handler: `openConfirmationWindow()` es síncrono y `submitPendingTransition` empieza su `fetch` en el mismo tick. El test 1 confirma la llamada a `window.open` justo después del click.
- `opener = null` evita que la página de WhatsApp manipule la pestaña del admin.
- La interpolación no escapa HTML: `lib/i18n/client.ts` (L24) y `lib/i18n/server.ts` (L16) tienen `escapeValue: false`. Revisado en código, no probado en runtime con caracteres especiales.
- Si `window.open` lanza excepción dentro del `try`, el `finally` libera los botones (corregido durante la ronda: la apertura estaba fuera del `try`).

## Ejecutado frente a pendiente

- Ejecutado: los 4 tests de componente (jsdom), tests de dashboard y de hooks admin, tsc (comparado con línea base), eslint y lint:admin-i18n.
- No ejecutado: comportamiento real de popups en navegadores; Safari iOS y Chrome Android; sincronización real con Google Calendar; suite Playwright e2e (requiere base de datos); render en inglés en runtime (los tests usan `es`).

## Validación manual pendiente de la dueña

1. Escritorio (Chrome y Safari): en `/admin` con una cita `PENDING`, pulsa `Confirmar`. Debe aparecer el toast de cita confirmada, abrirse WhatsApp con el mensaje `🗓️ *Nos vemos el {fecha} a las {hora}*!!` y el destinatario `52` + 10 dígitos de la clienta. La tarjeta debe desaparecer tras el refresco.
2. Móvil (iOS Safari y Android Chrome): repetir el punto 1. Confirmar que WhatsApp abre sin bloqueo de popup.
3. Rechazar en escritorio y móvil: NO debe abrirse ninguna pestaña ni WhatsApp.
4. Fallo de confirmación (por ejemplo, confirmar una cita ya resuelta desde otra pestaña): toast de error y ninguna pestaña en blanco que quede abierta.
5. Caso `SYNC_FAILED` (con Calendar fallando): WhatsApp debe abrirse igual.
6. Idioma `en`: el mensaje debe salir como `🗓️ *See you on {date} at {time}*!!`.
7. Bloqueador de popups activo: la cita queda confirmada, no se abre WhatsApp y no hay error visible (limitación conocida).

## Puntos para decisión de la dueña

- Popup bloqueado: se confirma la cita pero no se abre WhatsApp, sin fallback. Un fallback con navegación en la misma pestaña haría perder el contexto del dashboard, así que no lo añadí. Hay que decidir si se quiere otra opción.
- Pestaña en blanco transitoria: la regla de recordatorios (`docs/specification.md`, bloque Recordatorios) dice "no debe abrir una pestaña intermedia en blanco". Este flujo abre una ventana en blanco durante la petición porque el brief lo pide para evitar el bloqueo de popups en móvil. No queda pestaña en blanco permanente. Confirmar si la excepción es aceptable.
- Texto del mensaje: el brief pide `!!`. La clave existente `monthsDetail.bookModal.success.whatsappMessage` (flujo de reserva admin) usa un solo `!` y minúsculas en la hora. No la reutilicé: el brief pide la hora tal como la muestra la tarjeta (por ejemplo `09:00 AM`).
- La tarjeta muestra `AM`/`PM` en mayúsculas; el mensaje hereda ese formato, tal como pidió el brief.

## Limitaciones y pendientes

- `{{test_commands}}` del profile apunta a la sección "Commands" de `CLAUDE.md`, que no existe. Usé `package.json`. Conviene corregir el profile o `CLAUDE.md` (Orchestrator).
- `tsc --noEmit` ya falla con 66 errores previos fuera de este alcance; no se corrigieron.
- El test de `reminder-appointments-card` falla previamente (ver arriba); no se tocó.
- `STATE.md` no se creó (instrucción de la ronda).
- No hay commit. Los cambios están sin commitear en el árbol de trabajo.

Skipped: fallback cuando el popup está bloqueado, test separado del hook (cubierto por el test de componente), e2e Playwright. Not checked: navegadores móviles reales, sincronización real con Calendar. Riesgo: algunos navegadores móviles pueden bloquear la ventana aunque se abra desde el click; la validación manual de la dueña es necesaria antes de dar el flujo por bueno.
