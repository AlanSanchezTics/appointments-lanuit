# Round 01 - Pending WhatsApp redirect - Reviewer report

Fecha de revisión: 2026-10-27
Rol: `reviewer` (riesgo bajo, sin spec). Modo auditoría: no se modificó la entrega.
Estado revisado: árbol de trabajo después de los ajustes de la dueña (mensaje con un solo `!`, `formatLongDate` sin coma).

## Veredicto

**Rejected**

Hay un hallazgo bloqueante, y es documental: el cambio global en `formatLongDate` altera textos del flujo público (reserva, cancelación, mis citas y mensajes de WhatsApp), pero `docs/specification.md`, `docs/architecture/business-rules.md` y el reporte del Developer no lo registran. La corrección es solo documentación. El código y los tests de la ronda pasan.

## Hallazgos

### B1 - blocking - Cambio de flujo público sin documentar (formato de fecha larga)

- Archivo: `lib/datetime/mexico-city.ts:99` (`return \`${capitalize(weekday)} ${longDate}\``, antes con coma).
- El helper lo usan flujos públicos, además del admin:
  - `components/booking/booking-success-step.tsx:91`, `components/booking/booking-confirm-step.tsx:79`, `components/booking/booking-pending-confirmation-step.tsx:204`, `components/booking/booking-wizard-step1.tsx:215` y `:264`, `components/booking/booking-wizard-step-identity.tsx:179` y `:225`.
  - `hooks/booking/use-booking-success.ts:34` (fecha que alimenta el WhatsApp de éxito de reserva; no leí el resto del hook).
  - `hooks/cancel/use-cancel-success-whatsapp.ts:46` (mensaje de WhatsApp de cancelación).
  - `components/cancel/cancel-review-step.tsx:78`.
  - `components/my-appointments/my-appointments-flow.tsx:468` (fecha en el mensaje), `:548`, `:655`, `:683`.
  - Admin: `components/admin/clients/ClientDetailView.tsx:352`, `components/admin/months/BookAppointmentModal.tsx:122`, y la propia tarjeta de pendientes.
- Escenario de falla: el cliente recibe por WhatsApp o ve en pantalla "Lunes 13 de Abril" donde antes decía "Lunes, 13 de Abril". Ningún doc de flujo público describe el formato, así que nada registra el cambio, y el checklist de la ronda declara "Public flow untouched". AGENTS.md exige que un cambio de flujo quede reflejado en `docs/specification.md` y que, si cambia una regla, se actualice `business-rules.md`.
- Corrección requerida (sin cambio de código):
  1. `docs/specification.md`: en la sección de formato de fechas o en la de flujos públicos, documentar que la fecha larga es `{Día de la semana} {d} de {Mes}` sin coma, en es y en en, y que afecta a las pantallas y mensajes de WhatsApp públicos y admin.
  2. Este reporte de Developer (o su consolidación) debe declarar el impacto en flujo público; el checklist "Public flow untouched: Yes" ya no es exacto.
- Decisión de producto: la dueña ya la tomó (cambio global). No requiere nueva decisión.

### B2 - blocking - Regla nueva sin entrada en `business-rules.md`

- Archivo: `docs/architecture/business-rules.md` (no contiene la regla de confirmación de pendientes; sí tiene las reglas de WhatsApp público en las líneas 142-145 y 218-220).
- Qué falta: la regla "Confirmar con `CONFIRMED`/`SYNC_FAILED` redirige la misma pestaña a WhatsApp; `Rechazar` y errores no redirigen; no se llama a `router.refresh()` antes de redirigir" vive solo en `docs/specification.md` (líneas 824-833) y en `docs/ui/admin/components.md` (líneas 486-497).
- Qué falta además: `business-rules.md` líneas 365-367 y 393 dicen que el envío de WhatsApp debe abrirse "de forma síncrona durante el click/tap" y "no abrir una pestaña intermedia". La redirección de pendientes es intencionalmente asíncrona (después del `await` de la confirmación) y en la misma pestaña. Esa excepción no está escrita en ningún doc, así que un agente futuro podría "corregirla" a `window.open`.
- Corrección requerida: agregar en `business-rules.md` una sección "Pending confirmation WhatsApp redirect" con la regla anterior, y una nota aclarando que la regla síncrona de recordatorios no aplica a esta redirección, con su motivo.

## Verificación de los puntos pedidos

### 1. Corrección

- **Redirect solo con `CONFIRMED` o `SYNC_FAILED`.** Verificado en `components/admin/ui/PendingAppointmentsCard.tsx:130-137`. La condición es `action === "confirm" && (status === "CONFIRMED" || status === "SYNC_FAILED")`. `reject` cae en `router.refresh()` (línea 139). Cubierto por tests (ver abajo).
- **Errores sin redirect y botones rehabilitados.** `catch` vacío (línea 140) y `finally` con `setPendingTransition(null)` (línea 143). El test "does not redirect and keeps the buttons usable" pasa.
- **`sileo.promise` devuelve la promesa original.** Confirmado en `node_modules/sileo/dist/index.mjs:816-846` (`return p`, y el `.catch` interno no la consume). Por eso `result.status` es válido y el error sigue llegando al `catch`.
- **Teléfono.** `hooks/admin/usePendingAppointmentWhatsapp.ts:31` construye `` `52${item.phone}` `` sin validar la longitud. Esto depende de un invariante, no de una guarda:
  - `prisma/schema.prisma:106` y `:120`: `VarChar(10)`.
  - `lib/validation/appointment.ts:6-9` (`^[0-9]{10}$`) y `lib/admin/clients/validation.ts:64-67` (mismo regex).
  - Si un teléfono de 11 o 9 dígitos, o con formato, llegara a `client.phone` (por ejemplo, por un import histórico), el enlace `wa.me` apuntaría a un número incorrecto sin error visible. No verifiqué el camino de `scripts/import-appointments-historic.mjs`: la búsqueda de `phone` en ese archivo no devolvió resultados; no sé si el archivo existe con ese nombre. Queda como riesgo residual (no bloqueante).
- **URL-encoding.** `lib/whatsapp/message.ts:10-13` aplica `encodeURIComponent` al mensaje y al teléfono. Correcto.
- **`escapeValue`.** `lib/i18n/client.ts` tiene `interpolation: { escapeValue: false }`. El texto del WhatsApp no se escapa a HTML, que es lo correcto para texto plano. Coherente con lo que dice `components.md:488`.
- **Sin restos de popup.** `grep` de `window.open`, `opener`, `_blank` en `components`, `hooks`, `lib`, `app`, `tests` y `docs/features`: el único hallazgo en código del round es el comentario de `hooks/admin/usePendingAppointmentWhatsapp.ts:22`. Los `_blank` que aparecen son de flujos públicos previos (`cancel-success-step`, `my-appointments-flow`, `app/page.tsx`) y del e2e de recordatorios (`tests/e2e/admin-dashboard-reminders.spec.ts:238`), no del round.

### 2. AGENTS.md

- **Hooks.** La lógica de redirección y de mensaje está en `hooks/admin/usePendingAppointmentWhatsapp.ts`, bien ubicado en `hooks/admin/`. La decisión de si redirigir (líneas 130-137 del componente) sigue en el componente. Ver N1.
- **Admin UI Check.** Usa `Button` de `components/admin/ui/`. No introduce estilos ni componentes nuevos. Tokens intactos. Sí: reutiliza `buildWhatsappUrlFromMessage` de `lib/whatsapp/message.ts`.
- **Notification Contract.** Éxito y error con `sileo.promise`, textos con `t(...)`. No hay librerías alternativas de toast. `npm run lint:admin-i18n` pasa (exit 0).
- **Public flow untouched.** **No**, por el helper compartido (B1). Esta casilla debe quedar en "No" con la nota de B1.

### 3. Docs

- `docs/specification.md` 15.1.4 (líneas 818-833): alineada con el comportamiento real y con el mensaje de un solo `!` que la coordinación actualizó (línea 825). Sin menciones a popup ni a pestaña en blanco en esa sección.
- `docs/features/admin-auth-flow.md:69`: alineado, sin menciones obsoletas.
- `docs/ui/admin/components.md:486-503`: alineado, excepto que no documenta la excepción a la regla síncrona (B2) ni el cambio de `formatLongDate`.
- Riesgo de documentación (N2): `specification.md:830` afirma "al volver atrás, el dashboard debe mostrar la lista actualizada". Con bfcache, el navegador puede restaurar el DOM previo y mostrar la cita confirmada todavía en la lista. `app/admin/page.tsx` sí lee `cookies()` y `auth()` (renderizado dinámico), pero eso no evita la restauración desde bfcache. El texto declara como garantía algo que el código no garantiza.

### 4. Tests y comandos

Todos los comandos se ejecutaron en la raíz del repo.

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin/ui/pending-appointments-card.test.tsx tests/app/admin-dashboard-page.test.tsx tests/hooks/admin` | Exit 0. 4 archivos, 21 tests pasan. |
| `npx vitest run tests/lib/datetime tests/app/admin-client-detail-page.test.tsx tests/components/admin/clients/client-detail-view.test.tsx tests/components/admin/months/book-appointment-modal.test.tsx` (con los tests de la ronda) | Exit 0. 8 archivos, 39 tests pasan. Esta es la corrida final, sobre el estado después de los ajustes de la dueña. |
| `npx eslint components/admin/ui/PendingAppointmentsCard.tsx hooks/admin/usePendingAppointmentWhatsapp.ts tests/components/admin/ui/pending-appointments-card.test.tsx` | Exit 0, sin salida. |
| `npm run lint:admin-i18n` | Exit 0. 1 warning preexistente en un archivo no tocado: `hooks/admin/useReminderAppointments.ts:13` (`DashboardReminderType` sin uso). |
| `npx tsc --noEmit -p tsconfig.json` | Exit 2. 66 líneas `error TS`, igual que la línea base conocida. Ninguna cae en archivos tocados (`PendingAppointmentsCard`, `usePendingAppointmentWhatsapp`, `mexico-city.ts`, `pending-appointments-card.test.tsx`, `mexico-city.test.ts`, `lib/datetime`, `hooks/admin`). Los errores están en `tests/` (por ejemplo `tests/lib/maintenance/reject-pending-appointments.test.ts`). |
| `npx vitest run tests/components tests/hooks` | 79 pasan, 4 fallan. Los 4 fallan también en `HEAD` limpio (ver abajo). |

Verificación de línea base: extraje `HEAD` con `git archive` en `scratchpad/baseline-head` (sin tocar `.git` ni el árbol) y corrí los cuatro tests fallidos. Resultado: 4 fallos idénticos, por lo que son previos a esta ronda:
- `tests/components/admin/appointment-logs/appointment-logs-view.test.tsx` (clase de select).
- `tests/components/admin/clients/clients-catalog-view.test.tsx` (label "Estado").
- `tests/components/admin/months/month-detail-view.test.tsx` (CTA deshabilitado).
- `tests/components/admin/ui/reminder-appointments-card.test.tsx` ("Cannot redefine property: assign", el fallo conocido).

Otros hechos que confirmé en esta revisión:
- Tests que aseguran el formato con coma: solo `tests/lib/datetime/mexico-city.test.ts:38`, ya actualizado por la coordinación. No encontré otros tests con nombres de día en español o inglés seguidos de coma.
- `tests/components/admin/ui/pending-appointments-card.test.tsx` cubre: CONFIRMED (redirect, URL, teléfono, texto, sin refresh), SYNC_FAILED (redirect), error (sin redirect, botón habilitado), reject (refresh, sin redirect). No cubre: en, `CALENDAR_NOT_CONFIGURED`, teléfono fuera de 10 dígitos, ni el callback de error de sileo.
- Ninguna corrida de Playwright (`tests/e2e`) se hizo en esta revisión.

Nota de higiene: `tsc` con `incremental: true` modificó `tsconfig.tsbuildinfo` durante mi corrida. Lo restauré con `git checkout -- tsconfig.tsbuildinfo`. El árbol quedó solo con los cambios de la ronda y los ajustes de la dueña.

## Hallazgos no bloqueantes

- **N1 - non-blocking - Decisión de redirect en el componente.** `components/admin/ui/PendingAppointmentsCard.tsx:130-137` mezcla la regla "¿redirigir?" con el manejo de estado. AGENTS.md pide que la lógica de interacción viva en hooks. Mover la decisión al hook, o al menos a una función pura exportada, sería lo consistente. `handleTransition` ya tenía lógica de fetch y sileo en el componente antes de esta ronda, así que es deuda previa.
- **N2 - non-blocking - Garantía de bfcache sobredeclarada.** Ver arriba. Corrección sugerida: suavizar `specification.md:830` (por ejemplo: "el navegador puede restaurar la página desde caché; al volver, la lista puede estar desactualizada") o agregar un handler de `pageshow` con `event.persisted` que llame `router.refresh()`. Lo segundo es implementación; la decisión de cuál es la pide el Orchestrator.
- **N3 - non-blocking - Ventana de doble toque tras la redirección.** `finally` (línea 143) vuelve a habilitar los botones justo después de `window.location.assign` (línea 135). Si el admin toca "Confirmar" otra vez antes de que el navegador salga de la página, se envía una segunda confirmación, que responde 409 (`APPOINTMENT_STATUS_INVALID_TRANSITION`) y muestra un toast de error mientras la página se va. Mitigación posible: no liberar `pendingTransition` cuando se redirige.
- **N4 - non-blocking - Copia en inglés sin coma.** Con el helper actual, `formatLongDate` en `en` produce "Monday April 13" (sin coma). Es el resultado del cambio que decidió la dueña; lo señalo solo para que lo confirme si la gramática importa en la copia en inglés.
- **N5 - non-blocking - Formato de los locales.** `locales/es/admin.json` y `locales/en/admin.json` tienen diff de formato fuera de la clave nueva: una coma suelta en la línea de cierre de `dashboard` se reacomodó, y el archivo perdió el salto de línea final (`\ No newline at end of file`). Es ruido en el diff, no rompe nada.
- **N6 - non-blocking - Teléfono sin guarda.** Ver "Teléfono" en la verificación 1. Si se quiere defensa en profundidad, `redirectToConfirmationWhatsapp` podría validar `/^\d{10}$/` antes de construir la URL y, si falla, mostrar el mismo toast de error o no redirigir. Es una decisión de diseño; no es requisito de la ronda.

## Correcciones requeridas

1. (B1) Documentar en `docs/specification.md` el formato de fecha larga sin coma (es y en) y su alcance en flujos públicos y admin. Marcar en el reporte del Developer que el flujo público cambió por el helper compartido.
2. (B2) Agregar a `docs/architecture/business-rules.md` la regla de redirección de pendientes, con la excepción explícita a la regla síncrona de recordatorios.

No se requieren cambios de código para aprobar. Tras aplicar B1 y B2, la ronda puede cerrarse con nueva revisión documental, sin repetir la suite completa.

## Riesgos residuales

- bfcache al volver atrás (N2).
- Teléfono no validado en el punto de uso; el invariante depende del esquema y de la validación de alta, y no verifiqué los imports históricos (N6).
- Doble toque durante la salida (N3).
- Cobertura de tests: sin casos en inglés, sin `CALENDAR_NOT_CONFIGURED`, sin teléfono inválido, y sin Playwright.
- Fallos preexistentes en la suite (`appointment-logs-view`, `clients-catalog-view`, `month-detail-view`, `reminder-appointments-card`) y 66 errores de tsc en `tests/`. Ninguno pertenece a esta ronda.

## Nota de trazabilidad

- Impacto en flujo: sí (pendientes admin, y formato de fecha compartido con flujos públicos).
- Impacto documental: sí. `specification.md` actualizado por la coordinación (línea 825, `!`), pero faltan B1 y B2.
- Admin UI Check: uso de componentes Yes, tokens Yes, `design-system.md` aligned Yes, Public flow untouched **No** (por B1).
- Notification Contract Check: sileo para success/error Yes; sileo action N/A; sileo promise Yes; i18n Yes; sistema alternativo No.
