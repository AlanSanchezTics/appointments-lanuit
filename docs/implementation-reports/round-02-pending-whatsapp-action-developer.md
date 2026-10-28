# Round 02 — Oferta de WhatsApp como toast con acción tras confirmar cita pendiente (Developer)

- Flujo: cambio acotado a flujo existente (Developer → validación humana → Reviewer), sin spec (`docs/implementation-reports/`).
- Fecha: 2026-10-27. Rama `production`. Sobre el commit `995aa90` (ronda 01 pendiente) con los cambios sin commitear.
- Nada commiteado. `tsconfig.tsbuildinfo` lo modificó `tsc` y lo restauré con `git checkout`.
- Reviewer sugerido: `reviewer` (bajo riesgo: UI admin, i18n, hook, tests y docs; no toca Prisma, auth, `AppointmentLog`, booking, locks ni Calendar). El Orchestrator decide.

## Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `components/admin/ui/PendingAppointmentsCard.tsx` | modificado | Tras `CONFIRMED`/`SYNC_FAILED` llama `offerConfirmationWhatsapp(item)` en vez de redirigir. Ahora siempre llama `router.refresh()` tras éxito (rechazar también). Error sigue sin refresh. |
| `hooks/admin/usePendingAppointmentWhatsapp.ts` | modificado | `redirectToConfirmationWhatsapp` → `offerConfirmationWhatsapp(item)`: construye el mensaje y la URL y llama `sileo.action` con título, botón y `onClick` que hace `window.location.assign`. |
| `locales/es/admin.json` | modificado | `dashboard.pendingAppointments.notifications.whatsappActionTitle` y `whatsappActionButton`. |
| `locales/en/admin.json` | modificado | Mismas dos claves en inglés. |
| `tests/components/admin/ui/pending-appointments-card.test.tsx` | modificado | Mock de `sileo` con `action`; 5 tests (CONFIRMED, SYNC_FAILED, desmontaje, error, rechazar). |
| `tests/hooks/admin/use-pending-appointment-whatsapp.test.ts` | nuevo | 2 tests del hook: es y en (título, botón, URL solo al click, mensaje con fecha y hora). |
| `docs/specification.md` | modificado | Sección 15.1.4, bloque `Pendientes de confirmación`; línea 31 (resumen de integraciones WhatsApp, que decía "auto-intento" también para el admin). |
| `docs/architecture/business-rules.md` | modificado | Sección "Pending confirmation WhatsApp redirect" reescrita como "Pending confirmation WhatsApp offer". Eliminada la excepción en "Reminders widget policy". |
| `docs/features/admin-auth-flow.md` | modificado | Bullet `Confirmar` del bloque `Pendientes de confirmación`. |
| `docs/ui/admin/components.md` | modificado | `PendingAppointmentsCard`: Structure, Rules e Implementation Notes. |

Sin cambios: `lib/whatsapp/appointment-labels.ts`, `lib/datetime/*`, `hooks/admin/months/*`, `components/admin/months/*`, `lib/whatsapp/message.ts`. El hook de reprogramar no se tocó (no hubo que compartir lógica: el hook de pendientes ya recibe `t` y `language` por parámetro y su diferencia es el texto de fecha, ver decisión 2).

## Qué cambió (comportamiento)

1. `Confirmar` llama al endpoint con `sileo.promise` como antes (toast de éxito o de error sin cambios).
2. Si el status devuelto es `CONFIRMED` o `SYNC_FAILED`, después del `await` se muestra un `sileo.action` aparte con título `¿Avisar a la clienta por WhatsApp?` y botón `Enviar por WhatsApp` (en: `Notify the client on WhatsApp?` / `Send on WhatsApp`). Sin `description`.
3. La URL se construye en el momento de ofrecer el toast: `https://wa.me/52{phone}?text={encodedMessage}`. El `onClick` del botón hace `window.location.assign(url)`, en la misma pestaña, sincrónico dentro del click. Nada se abre solo.
4. Mensaje: clave existente `dashboard.pendingAppointments.whatsappMessage` (`🗓️ *Nos vemos el {date} a las {time}*!`, un solo `!`), con `formatLongDate(item.date, language)` y `formatTimeSlotLabel(item.timeSlot, language)`, igual que ya usaba la tarjeta.
5. Orden en `handleTransition`: primero `offerConfirmationWhatsapp(item)` (que captura URL y teléfono), después `router.refresh()`. Así el botón del toast sigue funcionando si la tarjeta se desmonta.
6. `Rechazar` no ofrece WhatsApp y refresca. Un error de confirmación no ofrece WhatsApp y no refresca (sin cambios).
7. No se persiste nada extra: no cambia el estado de la cita ni se escribe en `AppointmentLog` por ofrecer o enviar el mensaje. La confirmación en sí sigue igual en backend.

## Decisiones tomadas y por qué

1. **Toast separado con `sileo.action`** (como pidió el brief y el owner), no la opción `action` de `sileo.promise`.

2. **Fecha y hora: se conserva `formatLongDate` + `formatTimeSlotLabel`, no el helper `formatWhatsappAppointmentLabels`.** Comparación real (Intl de Node en este entorno, y la lógica del helper):

   | Entrada `2026-03-31`, `09:00` | Tarjeta (y especificación) | Helper compartido |
   |---|---|---|
   | `es` fecha | `Martes 31 de Marzo` | `Martes, 31 de Marzo` |
   | `es` hora | `09:00 AM` | `09:00 am` |
   | `en` fecha | `Tuesday March 31` | `Tuesday, March 31` |
   | `en` hora | `09:00 AM` | `09:00 am` |

   Criterio: la especificación (sección 15, regla 10) fija que la fecha larga no lleva coma, decisión de la dueña aplicada de forma global. El helper la pone en ambos idiomas, así que usarlo aquí contradiría esa regla y además cambiaría la hora que ya muestra la tarjeta. Se conserva lo que ya usa la tarjeta, como pide el brief. El helper no se modificó.

3. **Duración del toast: no fijada (default de sileo).** En `node_modules/sileo` (v0.1.5) la constante es `DEFAULT_TOAST_DURATION = 6000` (6 s), y `sileo.action` se llama sin `duration`. No la fijé porque no pude verificar en navegador cuánto tiempo se lee y se pulsa el botón, y el owner pidió validarlo a mano. Si la validación dice que 6 s es poco, la opción es pasar `duration` en `sileo.action` (valor en ms, o `null` según la API de sileo; no comprobé el comportamiento de `null`). Decisión del owner.

4. **Copy**: título y botón según lo indicado por el owner. Mensaje con un solo `!`.

5. **Hook sin `useTranslation` interno**: se mantuvo la firma existente (`{ language, t }` desde la tarjeta) para no ampliar el cambio.

6. **Idioma `en` probado en el hook**: el test de la tarjeta solo cubre `es`. El test del hook usa `i18next.getFixedT("en", "admin")` para validar las claves nuevas en inglés y el formato de fecha en inglés.

## Comandos ejecutados y resultados

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx vitest run tests/components/admin/ui/pending-appointments-card.test.tsx tests/hooks/admin/use-pending-appointment-whatsapp.test.ts` | 2 archivos, **7 tests pasan** (card 5, hook 2). |
| 2 | `npx vitest run tests/components/admin/ui/pending-appointments-card.test.tsx tests/app/admin-dashboard-page.test.tsx tests/hooks/admin tests/lib/whatsapp` | **8 archivos, 32 tests pasan**, incluye `use-months-catalog` (15), `use-reschedule-whatsapp-action` (1), `use-retouch-reminders` (1), `message` (4), `appointment-labels` (3), `admin-dashboard-page` (1). |
| 3 | `npx eslint` sobre los 4 archivos de código y test tocados/nuevos | Exit 0, sin mensajes. |
| 4 | `npm run lint:admin-i18n` | 0 errores; 1 warning previo en `hooks/admin/useReminderAppointments.ts` (no tocado). |
| 5 | Validación JSON de `locales/es/admin.json` y `locales/en/admin.json` (python `json.load`) | Ambos válidos. Claves iguales en es y en (`es-only: []`, `en-only: []`). Terminan en `}` sin salto final, igual que antes (no reformateados; el diff de locales son 2 líneas por archivo). |
| 6 | `npx tsc --noEmit -p tsconfig.json` | Exit 2 con **66 errores**, igual a la línea base indicada en el brief. **Ninguno en archivos tocados.** Los errores están en tests y e2e no tocados. No corrí tsc sobre HEAD por separado. |
| 7 | `git checkout -- tsconfig.tsbuildinfo` | Restaurado. |

Comandos que no ejecuté: suite completa (`npm run test`), `test:integration`, `test:e2e`, navegador real. Las suites conocidas con fallo previo (`reminder-appointments-card`, `appointment-logs-view`, `clients-catalog-view`, `month-detail-view`) no están en el conjunto de la ronda y no las corrí.

## Documentation Impact

- Yes.
- Updated `docs/specification.md`:
  - Sección 15.1.4, bloque `Pendientes de confirmación`: toast de acción en vez de redirect; el admin permanece en el dashboard; URL construida antes del refresh; sin persistencia; errores y rechazar sin oferta. Se eliminaron las viñetas sobre la salida de la página y el bfcache.
  - Línea 31 (Integraciones): aclara que en el admin la oferta es un toast con botón, sin redirección automática.
- Updated `docs/architecture/business-rules.md`:
  - "Pending confirmation WhatsApp redirect" reescrita como "Pending confirmation WhatsApp offer": solo tras `CONFIRMED`/`SYNC_FAILED`; no automática; reject y error no ofrecen; no persiste nada; el botón abre en la misma pestaña dentro del click.
  - Eliminada la excepción de "Reminders widget policy" (ya no aplica). La regla síncrona de recordatorios y retoque sigue vigente.
- Updated `docs/features/admin-auth-flow.md`: bullet `Confirmar`.
- Updated `docs/ui/admin/components.md`: PendingAppointmentsCard, Structure, Rules e Implementation Notes (nombre de la función, uso de `formatLongDate`/`formatTimeSlotLabel` y no del helper).
- Momento: después de implementar, en el mismo cambio.
- Ambigüedades abiertas:
  - Duración del toast (decisión 3).
  - Copy final del título y botón (lo pidió el owner, pendiente de confirmación visual).
  - Diferencia de formato con el flujo de reprogramar (ver "Hallazgos fuera de alcance").
- Sin cambios en `docs/features/cancel-flow.md` (fuera de alcance; no menciona este flujo).

## Flow Contract Check

- UI steps updated: Yes (el paso de confirmación pasa de redirect a toast de acción).
- API contract updated: No (`POST /api/admin/appointments/{id}/confirm` no cambió).
- Validation rules updated: No (la condición `CONFIRMED`/`SYNC_FAILED` para ofrecer no cambió; sí cambia la forma de ejecutar la oferta, documentada en la especificación).
- Acceptance criteria updated: No (los docs tocados no tienen sección de criterios separada; el comportamiento quedó en los pasos de la especificación 15.1.4 y en `admin-auth-flow.md`).
- docs/specification.md aligned: Yes.

## Migration Compatibility Check

- Schema changes required: No.
- Data backfill required: No.
- Legacy compatibility required: No.
- Rollback strategy defined: Yes (cambio solo de frontend y docs; revertir el commit devuelve el redirect anterior; no hay datos afectados).
- Cleanup phase defined: N/A.
- Integrity protections defined: N/A (la persistencia de la confirmación no cambió).

## Admin UI Check

- Uses components/admin/ui: Yes (`PendingAppointmentsCard` y `Button` existentes; el toast es `sileo`, ya montado en el admin).
- Reused existing components: Yes.
- New reusable components created: No.
- Tokens respected: Yes (no se tocaron estilos).
- design-system.md aligned: Yes (no requiere cambios; `components.md` actualizado).
- Public flow untouched: Yes (no se tocó `components/booking`, `lib/booking` ni el flujo público).

## Notification Contract Check

- Sileo used for success/warning/error/info: Yes (`sileo.promise` existente para éxito y error).
- Sileo action notifications used when applicable: Yes (`sileo.action` tras `CONFIRMED`/`SYNC_FAILED`).
- Sileo promise notifications used when applicable: Yes (existente, sin cambios).
- i18n applied in admin notifications: Yes (título y botón por `t` con claves nuevas en es y en).
- Alternative notification systems introduced: No.

## Evidencia y estado

- **Diseño estático (no ejecutado en navegador):**
  - La oferta solo se llama para `confirm` con `CONFIRMED` o `SYNC_FAILED`.
  - `offerConfirmationWhatsapp` llama antes a `router.refresh()`, y la URL se construye al ofrecer.
  - `window.location.assign` solo aparece dentro del `onClick` del botón.
  - Reject y error no llaman a `sileo.action`.
- **Ejecutado (vitest, eslint, lint:admin-i18n, JSON, tsc):** resultados en la tabla de comandos. Los 7 tests de la tarjeta y del hook cubren: título y botón en es y en, URL solo al click, desmontaje antes del click, rechazar y error sin oferta, y `router.refresh` tras confirmar con éxito.
- **Pendiente de validación humana (no ejecutado):**
  1. En el dashboard admin, confirmar una cita `PENDING` (desktop y móvil): aparece el toast de éxito y después el toast con título `¿Avisar a la clienta por WhatsApp?` y botón `Enviar por WhatsApp`.
  2. Pulsar el botón: abre WhatsApp en la misma pestaña, con número `52…` de 10 dígitos y el mensaje `🗓️ *Nos vemos el Martes 31 de Marzo a las 09:00 AM*!` (o la fecha correspondiente).
  3. Tras confirmar, la tarjeta desaparece y el admin no sale del dashboard.
  4. Con `SYNC_FAILED` (o simulado) se ofrece el mismo toast.
  5. Rechazar y una confirmación fallida no muestran el toast de WhatsApp.
  6. El toast permanece visible el tiempo suficiente para pulsar el botón (default de sileo, 6 s, decisión 3).
  7. Copy del título y del botón, en es y en.

## Hallazgos fuera de alcance (no tocados; para el Orchestrator)

1. **Inconsistencia de formato en el flujo de reprogramar (ronda 01, commit `37bcf7a`).** `hooks/admin/months/useRescheduleWhatsappAction.ts` usa `formatWhatsappAppointmentLabels`, que produce coma en la fecha (`Miércoles, 18 de Marzo`) y hora en minúsculas (`10:00 am`). La especificación 15, regla 10 dice que no hay coma. El test `tests/hooks/admin/months/use-reschedule-whatsapp-action.test.ts` asserta el texto con coma. Además, el bloque de formateo que hoy está en el helper ya existía en `components/admin/months/BookAppointmentModal.tsx` antes de `37bcf7a` (`git show 37bcf7a^:components/admin/months/BookAppointmentModal.tsx`, líneas 188-200), así que el mensaje de WhatsApp del modal de reserva admin probablemente también lleva coma. Recomiendo que el owner decida y que se abra una ronda que unifique el formato (probablemente usando `formatLongDate`/`formatTimeSlotLabel` en el helper, o en el hook de reprogramar). No lo toqué: `hooks/admin/months` y `lib/whatsapp/appointment-labels.ts` (lib compartido) quedaban fuera de alcance y la decisión no es mía.
2. **Reporte de la ronda 01 de reprogramar** (`docs/implementation-reports/round-01-reschedule-whatsapp-developer.md`) figura como untracked en `git status` desde antes de esta ronda. No lo modifiqué.

## Limitaciones

1. Sin navegador real: no se verificó el render del `sileo.action`, su posición, su duración ni la navegación a `wa.me`.
2. El test de desmontaje llama `unmount()` a mano; no reproduce el refresh real de Next.
3. El hook de pendientes y la tarjeta no tienen mutation testing; la validación de que el botón no abre solo se basa en la aserción de `assign` no llamado antes del click.
4. `npm run test` completo y `test:e2e` no se ejecutaron.
5. La comparación de tsc usa la cifra de 66 del brief; no se corrió sobre HEAD por separado.

## Handoff

- Hecho: implementación, tests de la tarjeta y del hook, locales, documentación (spec 15.1.4, resumen de integraciones, business rules, admin-auth-flow, components.md), verificaciones listadas.
- Pendiente: validación manual del owner (lista arriba); decisión del owner sobre duración del toast y copy; decisión sobre la inconsistencia de formato del hallazgo 1; Reviewer (`reviewer`).
- Archivos tocados: 9 modificados y 1 nuevo de código/test, más este reporte (ver tabla).
- Siguiente paso: el Orchestrator presenta la validación manual al owner y, si aprueba, lanza el Reviewer con este reporte.
