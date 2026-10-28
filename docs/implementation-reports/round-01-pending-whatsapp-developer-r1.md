# Ronda 01 - Corrección 1: redirección en la misma pestaña tras confirmar (Developer)

- Flujo: Developer -> validación humana -> Reviewer (riesgo bajo, sin spec, `docs/implementation-reports/`).
- Motivo: la dueña rechazó abrir WhatsApp en nueva pestaña porque los navegadores móviles la bloquean. El admin debe funcionar en móvil.
- Estado: corrección implementada y verificada con tests, tsc (comparado con línea base), eslint y lint:admin-i18n. Pendiente validación manual en móvil y escritorio. Sin commit.
- Reemplaza a `round-01-pending-whatsapp-developer.md` (queda marcado como superseded).

## Archivos modificados en esta corrección

| Archivo | Cambio |
|---|---|
| `components/admin/ui/PendingAppointmentsCard.tsx` | Se eliminan la ventana en blanco, el cierre en error y el estado auxiliar de ventana. Tras `CONFIRMED` o `SYNC_FAILED` se llama a `redirectToConfirmationWhatsapp(item)` y se sale con `return` (sin `router.refresh()`). En error solo se muestra el toast. En `reject` se mantiene `router.refresh()`. Sigue con un solo `useState`. |
| `hooks/admin/usePendingAppointmentWhatsapp.ts` | Simplificado a un único efecto: `redirectToConfirmationWhatsapp(item)` construye el mensaje con `t("dashboard.pendingAppointments.whatsappMessage")` (fecha con `formatLongDate`, hora con `formatTimeSlotLabel`) y ejecuta `window.location.assign(buildWhatsappUrlFromMessage({ phone: "52" + item.phone, message }))`. Sin `window.open` ni `opener`. |
| `tests/components/admin/ui/pending-appointments-card.test.tsx` | Reescrito para redirección: 4 tests (CONFIRMED, SYNC_FAILED, error, reject). |
| `docs/specification.md` | Sección 15.1.4 (Dashboard), bloque `Pendientes de confirmación`: redirección en la misma pestaña, sin refresh previo, toast breve, vuelta atrás, error y reject sin redirigir. |
| `docs/features/admin-auth-flow.md` | Bullet `Confirmar`: redirección en la misma pestaña, salida del dashboard, lista actualizada al volver. |
| `docs/ui/admin/components.md` | PendingAppointmentsCard: Structure, Rules (sin `window.open`, sin refresh antes del redirect), Implementation Notes. |
| `docs/implementation-reports/round-01-pending-whatsapp-developer.md` | Marcado como superseded (una línea). |
| `docs/implementation-reports/round-01-pending-whatsapp-developer-r1.md` | Nuevo: este reporte. |

Sin cambios: `locales/es/admin.json` y `locales/en/admin.json` (la clave y el texto siguen igual), `lib/whatsapp/message.ts`, `docs/architecture/business-rules.md`, API, esquema, flujo público.

## Decisiones tomadas

- **Refresh antes del redirect: no.** `router.refresh()` es asíncrono y no espera su resultado. Si se llama justo antes de `window.location.assign`, la navegación lo cancela y no aporta garantía. La salida de la página hace que el dashboard se vuelva a cargar. Por eso el refresh queda solo en `Rechazar`.
- **Actualización al volver atrás.** `/admin/page.tsx` usa `cookies()` (verificado en código), por lo que es una ruta dinámica que se renderiza en el servidor. Al volver atrás con una carga normal, el dashboard trae la lista actual. Caveat no verificado: si el navegador restaura la página desde bfcache (Safari y Chrome pueden hacerlo), mostrará el DOM anterior con la cita todavía en pendiente. Por eso se necesita validación manual. Mitigación posible no implementada: escuchar `pageshow` con `event.persisted` y llamar `router.refresh()`. Es decisión de la dueña si la validación lo muestra.
- **Estado `pendingTransition` al volver.** El `finally` libera el estado tras llamar a `assign`. Si la página se restaura desde bfcache, los botones aparecen habilitados.
- **Toast de éxito.** Sileo puede mostrarse brevemente antes de la salida; no hay esperas artificiales.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin/ui/pending-appointments-card.test.tsx tests/app/admin-dashboard-page.test.tsx tests/hooks/admin` | 21 passed (4 archivos) |
| `npx vitest run tests/components/admin/ui` | 11 passed, 1 failed. El fallo es el test previo de `reminder-appointments-card.test.tsx` (ver abajo). |
| `npx tsc --noEmit` | exit 2, 66 errores. Conjunto idéntico a la línea base (`diff` vacío). Ninguno en archivos tocados. |
| `npx eslint components/admin/ui/PendingAppointmentsCard.tsx hooks/admin/usePendingAppointmentWhatsapp.ts tests/components/admin/ui/pending-appointments-card.test.tsx` | exit 0 |
| `npm run lint:admin-i18n` | exit 0, 1 warning previo en `hooks/admin/useReminderAppointments.ts` (fuera de alcance) |

Fallo previo fuera de alcance: `tests/components/admin/ui/reminder-appointments-card.test.tsx` falla con `Cannot redefine property: assign` en su línea 24 (`vi.spyOn(window.location, "assign")`). Falla también aislado. No se modificó ese test ni sus archivos. Mi test resuelve el mismo problema con `vi.stubGlobal("location", { href, assign })` y `vi.unstubAllGlobals()` en `afterEach`, sin tocar el test ajeno.

`tsconfig.tsbuildinfo` modificado por tsc se restauró con `git checkout`.

## Qué prueba cada test

1. CONFIRMED: `assign` se llama una vez con `https://wa.me/525512345678?text=` y el texto decodificado igual a `🗓️ *Nos vemos el {fecha larga} a las 09:00 AM*!!`. `refresh` no se llama.
2. SYNC_FAILED: también redirige.
3. Error del servidor (`ok: false`): no redirige, no llama a `refresh`, y el botón `Confirmar` vuelve a estar habilitado.
4. Rechazar (`REJECTED`): no redirige, llama a `refresh`.

## Bloques de verificación

Documentation Impact:
- Yes
- Updated docs/specification.md: Yes
- Sections affected: 15.1.4 Dashboard (`/admin`), bloque `Pendientes de confirmación`; `docs/features/admin-auth-flow.md` (dashboard, bloque `Pendientes de confirmación`); `docs/ui/admin/components.md` (PendingAppointmentsCard: Structure, Rules, Implementation Notes).
- `docs/architecture/business-rules.md`: sin cambios; verificado que no contradice el flujo admin.
- Momento: durante la implementación.

Flow Contract Check:
- UI steps updated: Yes (la confirmación ahora sale del dashboard hacia WhatsApp en la misma pestaña)
- API contract updated: No (endpoints y payload sin cambios)
- Validation rules updated: Yes (condición de redirección por `CONFIRMED`/`SYNC_FAILED` y comportamiento en error documentados)
- Acceptance criteria updated: No (el bloque no tiene sección formal de criterios; la validación manual está en este reporte)
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No
- Rollback strategy defined: Yes (revertir el commit; sin estado persistido)
- Cleanup phase defined: No aplica
- Integrity protections defined: No aplica

Admin UI Check:
- Uses components/admin/ui: Yes (`Button`, `AdminIcon` ya existentes)
- Reused existing components: Yes
- New reusable components created: No
- Tokens respected: Yes (sin cambios visuales)
- design-system.md aligned: Yes (no requiere cambios)
- Public flow untouched: Yes

Notification Contract Check:
- Sileo used for success/warning/error/info: Yes (existente, sin notificaciones nuevas)
- Sileo action notifications used when applicable: No aplica
- Sileo promise notifications used when applicable: Yes (existente)
- i18n applied in admin notifications: Yes (el mensaje de WhatsApp vía `react-i18next`)
- Alternative notification systems introduced: No

## Diseño estático, ejecutado y pendiente

- **Estático (revisado en código):** `window.open`, `opener` y el cierre de ventana ya no aparecen en el código (verificado con grep). La redirección usa `window.location.assign` después del `await`, que no es un popup y no lo bloquean los navegadores móviles. `/admin` es dinámica (`cookies()`). Interpolación sin escape: `escapeValue: false` en `lib/i18n/client.ts` y `server.ts`.
- **Ejecutado:** los 4 tests de componente (jsdom, con mocks de sileo, fetch y location), tests de dashboard y de hooks admin, tsc (comparado con la línea base), eslint y lint:admin-i18n.
- **No ejecutado:** redirección real en Safari iOS y Chrome Android; comportamiento real de bfcache al volver atrás; cabeceras de caché reales de `/admin`; sincronización real con Calendar; Playwright e2e; render en inglés en runtime.

## Validación manual pendiente (la dueña)

En iOS Safari, Android Chrome y escritorio (Chrome y Safari):
1. Confirmar una cita `PENDING`: el admin sale del dashboard y WhatsApp abre en la misma pestaña con `🗓️ *Nos vemos el {fecha} a las {hora}*!!` y destinatario `52` + 10 dígitos.
2. Caso `SYNC_FAILED` (Calendar fallando): también redirige.
3. Rechazar: NO redirige; la cita sale de la lista tras el refresco.
4. Error de confirmación (por ejemplo, cita ya resuelta en otra pestaña): toast de error, NO redirige, los botones siguen habilitados.
5. Volver atrás tras confirmar: el dashboard NO debe mostrar la cita ya confirmada. Esta es la comprobación clave de bfcache. Si muestra la cita pendiente, hay que añadir el refresh por `pageshow` (ver decisiones).
6. Idioma `en`: `🗓️ *See you on {date} at {time}*!!`.

## Puntos para decisión de la dueña

- **Regla de recordatorios.** `docs/specification.md` (bloque Recordatorios) dice que la URL debe abrirse de forma síncrona durante el click. Esa regla sigue vigente para recordatorios. El flujo de pendientes ahora redirige después de un `await`. No es un popup, así que no hay bloqueo, pero se aparta de ese patrón. Confirmar que es aceptable.
- **Caché al volver atrás.** Decidir si añadir `pageshow` + `router.refresh()` si la validación 5 falla.
- **Texto del mensaje.** El brief pide `!!`. La clave existente `monthsDetail.bookModal.success.whatsappMessage` usa un solo `!`. No se reutilizó. La hora sigue el formato de la tarjeta (`09:00 AM`).

## Limitaciones

- Sin fallback si el redirect falla: `assign` siempre navega en la misma pestaña, así que no hay bloqueo de popup. No se valida que WhatsApp esté instalado o disponible.
- El toast de éxito puede no verse antes de la salida de la página (aceptado por la dueña).
- `STATE.md` no se creó. No hay commit.
- Fallos previos fuera de alcance: 66 errores de tsc y el test de `reminder-appointments-card`.
- `{{test_commands}}` del profile apunta a la sección "Commands" de `CLAUDE.md`, que no existe; se usó `package.json`.

Skipped: el refresh `pageshow` por bfcache (decisión abierta, no implementada), el fallback en error de navegación, e2e Playwright. Not checked: Safari iOS y Chrome Android reales, comportamiento de bfcache, cabeceras de caché de `/admin`, Calendar real. Riesgo: si el navegador restaura la página desde bfcache, el dashboard puede mostrar la cita todavía pendiente hasta recargar. La validación 5 es la que lo confirma o descarta.
