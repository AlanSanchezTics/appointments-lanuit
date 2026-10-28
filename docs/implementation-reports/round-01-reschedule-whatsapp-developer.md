# Round 01 — Acción WhatsApp tras reprogramar cita desde el panel admin (Developer)

- Flujo: cambio acotado a flujo existente (Developer → Reviewer), sin spec (`{{adhoc_reports_dir}}`).
- Fecha: 2026-10-27. Worktree: `.claude/worktrees/cita-whatsapp-confirmation-585e93`. Rama `claude/cita-whatsapp-confirmation-585e93`.
- Nada commiteado.
- Reviewer sugerido: `reviewer` (bajo riesgo). El cambio no toca Prisma, auth, `AppointmentLog`, reglas de booking, locks ni Google Calendar; solo UI admin, i18n y un helper de texto. El Orchestrator decide.

## Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `components/admin/months/MonthDetailView.tsx` | modificado | Llama al hook nuevo; `handleReschedule(appointmentId, phone)` recibe el teléfono de la fila; tras `sileo.promise` resuelto ofrece la acción de WhatsApp con la fecha/hora de la respuesta. |
| `components/admin/months/BookAppointmentModal.tsx` | modificado | Usa el helper compartido para fecha/hora del mensaje. Se quitan `locale` y `parseDateOnly` (ya no se usan). Comportamiento idéntico. |
| `hooks/admin/months/useRescheduleWhatsappAction.ts` | nuevo | Hook con `offerRescheduleWhatsapp({ phone, date, timeSlot })`: arma URL y llama `sileo.action`. |
| `lib/whatsapp/appointment-labels.ts` | nuevo | `formatWhatsappAppointmentLabels({ date, timeSlot, language })` → `{ date, time }`. Extraído verbatim de BookAppointmentModal. |
| `locales/es/admin.json` | modificado | `monthsDetail.dayModal.notifications.whatsappActionTitle` y `whatsappActionButton`. |
| `locales/en/admin.json` | modificado | Mismas dos claves en inglés. |
| `docs/specification.md` | modificado | Sección 15.7 (Catálogo de meses admin), bullet "En edición de cita del modal diario". |
| `docs/features/admin-month-detail-flow.md` | modificado | Paso 23, bloque `Editar`: acción WhatsApp tras reprogramar. |
| `tests/lib/whatsapp/appointment-labels.test.ts` | nuevo | 3 tests del helper (es, es PM, en). |
| `tests/hooks/admin/months/use-reschedule-whatsapp-action.test.ts` | nuevo | 1 test del hook (payload de `sileo.action`, URL solo al click, mensaje). |

Además: `npm install` (README) creó `node_modules`. `package-lock.json` no cambió. `tsconfig.tsbuildinfo` lo modificó un `tsc` mío y lo restauré con `git checkout`.

## Qué cambió (comportamiento)

1. Tras una reprogramación exitosa se mantiene el toast de éxito existente (`sileo.promise`). Después se muestra un `sileo.action` con título `¿Avisar a la clienta por WhatsApp?` y botón `Enviar por WhatsApp`.
2. Al click del botón se abre `https://wa.me/52{phone}?text={mensaje}` con `window.location.assign` (misma pestaña, sincrónico dentro del click).
3. Mensaje: clave existente `monthsDetail.bookModal.success.whatsappMessage` (`🗓️ *Nos vemos el {{date}} a las {{time}}*!`), con fecha y hora **nuevas** tomadas de la respuesta del PATCH (`date`, `timeSlot`). La fecha sale capitalizada (`Miércoles, 18 de Marzo`) y la hora en minúsculas (`10:00 am`), igual que en el agendado.
4. Teléfono: `appointment.phone` de la fila (10 dígitos), capturado en el click antes de `stopEditing()`.
5. Si la reprogramación falla, `offerRescheduleWhatsapp` no se ejecuta (está después del `await`). Solo queda el toast de error existente.
6. Si la respuesta es `SYNC_FAILED`, la reprogramación sí quedó persistida, así que la acción también se ofrece. El código no revisa `status`.
7. Nada se persiste (ni estado de cita ni `AppointmentLog`).

## Decisiones tomadas y por qué

- **Formato de teléfono `52{phone}`** (no `+52`). La especificación documenta `https://wa.me/52{phone}` (secciones 8, 15 y `business-rules.md`) y el hook de recordatorios usa el mismo. `BookAppointmentModal` usa `+52`; no lo toqué para no cambiar su comportamiento.
- **Clave de mensaje reutilizada**, sin clave nueva. Como el brief pide, reutilicé `bookModal.success.whatsappMessage`.
- **Discrepancia de texto (requiere decisión del owner):** el brief cita el mensaje con `!!` al final (`*!!`). La clave existente en `es` termina en `!` (`*!`). Mantuve el texto existente para no cambiar el mensaje del agendado. Si el owner quiere `!!`, hay que cambiar la clave `bookModal.success.whatsappMessage` (afecta también al agendado) o crear una clave nueva.
- **Copy nuevo propuesto** (requiere revisión del owner): título `¿Avisar a la clienta por WhatsApp?` / `Notify the client on WhatsApp?`; botón `Enviar por WhatsApp` / `Send on WhatsApp`. Sin `description`; el brief lo marca como opcional.
- **Ubicación del helper:** `lib/whatsapp/appointment-labels.ts` (junto a `message.ts`), porque es formato de mensajes de WhatsApp y no lógica de fechas general.
- **Hook nuevo** `useRescheduleWhatsappAction` (AGENTS: interacción fuera del componente). Sigue el patrón de `useShareMonthAgenda`: sin argumentos, `useTranslation("admin")` dentro.
- **Idioma:** igual que `MonthDetailView` (`resolvedLanguage === "en" ? "en" : "es"`).
- **Fecha/hora de la respuesta** del PATCH y no `editDate`/`editTimeSlot`. El servidor confirma los valores (`lib/admin/appointments/service.ts` devuelve `date` y `timeSlot` del input ya validado).
- **Alternativa no usada:** `SileoPromiseOptions` tiene una opción `action`, que pondría el botón dentro del mismo toast de éxito. El brief pidió un toast aparte (`sileo.action` después de `sileo.promise`), así que lo seguí. Lo dejo anotado por si el owner prefiere un solo toast.

## Comandos ejecutados y resultados

Nota: el brief y el perfil (`{{test_commands}}`) dicen que los comandos están en la sección "Commands" de `CLAUDE.md`. Esa sección **no existe**: `CLAUDE.md` solo importa `@AGENTS.md`, y `AGENTS.md` no tiene sección de comandos. Usé los scripts de `package.json`. El install lo tomé de `README.md` (`npm install`).

| # | Comando | Resultado |
|---|---|---|
| 1 | `npm install` | Exit 0. `node_modules` no existía; se instaló desde el lockfile. `package-lock.json` sin cambios. Avisos de `npm audit` (no revisados, fuera de alcance). |
| 2 | `npx vitest run tests/lib/whatsapp tests/hooks/admin/months/use-reschedule-whatsapp-action.test.ts tests/components/admin/months/book-appointment-modal.test.tsx tests/components/admin/months/month-detail-view.test.tsx tests/lib/datetime` | **Test Files: 1 failed, 5 passed (6). Tests: 1 failed, 36 passed (37).** Pasan los 3 tests nuevos del helper, el test nuevo del hook, `book-appointment-modal` (3), `message.test.ts` (4), `mexico-city` (6) y 19 de 20 de `month-detail-view`. Falla solo `MonthDetailView > disables schedule CTA when month is inactive` (ver "Limitaciones"). |
| 3 | Comprobación de pre-existencia del fallo de (2): reemplacé temporalmente `MonthDetailView.tsx` y `BookAppointmentModal.tsx` por su versión HEAD (`git checkout HEAD --`), ejecuté solo ese test y restauré mis versiones desde una copia (`cmp` idéntico). | El test **también falla en HEAD**: pre-existente, no causado por este cambio. |
| 4 | `npx eslint` sobre los 6 archivos de código tocados/nuevos | Exit 0. |
| 5 | `npm run lint` | Exit 0. 0 errores; 4 warnings, todos en archivos que no toqué (`hooks/admin/useReminderAppointments.ts`, `hooks/booking/use-booking-wizard.ts`). |
| 6 | `npm run lint:admin-i18n` | Exit 0. 0 errores; 1 warning en `hooks/admin/useReminderAppointments.ts` (no tocado). |
| 7 | `npx tsc --noEmit -p tsconfig.json` | **Exit 2**: 66 líneas de error en 21 archivos. **Ningún error en archivos que toqué** (`MonthDetailView.tsx`, `BookAppointmentModal.tsx`, el hook, el helper, los tests nuevos ni los locales). Los errores están en tests y specs e2e que no toqué (p. ej. `tests/components/admin/months/month-detail-view.test.tsx` líneas 1411–1573, fuera de mi edición). No corrí tsc sobre HEAD como línea base. |
| 8 | Validación JSON de `locales/es/admin.json` y `locales/en/admin.json` (python `json.load`) | OK. Las claves de ambos idiomas coinciden exactamente (`es-only: []`, `en-only: []`). El posible problema de coma final mencionado en el brief no existe: ambos archivos parsean. |

No ejecuté: la suite completa (`npm run test`), `test:integration`, Playwright (`test:e2e`), ni el navegador real.

## Documentation Impact

- Yes.
- Updated `docs/specification.md`: sección **15.7 Catálogo de meses admin**, bullet "En edición de cita del modal diario" (tras reprogramar: toast con acción, mensaje y fecha/hora nuevos, teléfono, no automático, sin persistencia, sin oferta si falla).
- Updated `docs/features/admin-month-detail-flow.md`: paso 23, bloque `Editar`.
- **No actualizado: `docs/architecture/business-rules.md`.** No está en las rutas autorizadas. Recomiendo una línea en "Admin edit policy" (líneas ~547–560): tras reprogramación exitosa la UI ofrece opcionalmente un aviso WhatsApp con la nueva fecha/hora; no es una regla de negocio ni persiste nada. Pendiente de autorización del Orchestrator.
- Momento de la actualización: después de implementar, en el mismo cambio.
- Ambigüedades: (a) `!` vs `!!` en el mensaje; (b) copy nuevo del título y botón; (c) si el owner quiere la acción en un solo toast (opción `action` de `sileo.promise`).
- No hay cambios en `docs/ui/admin/*` (no se agregó componente visual).

## Flow Contract Check

- UI steps updated: Yes (paso de reprogramación con toast de WhatsApp en la especificación y en el flujo).
- API contract updated: No (el `PATCH /api/admin/appointments/[appointmentId]/reschedule` no cambió; el frontend usa `date` y `timeSlot` de la respuesta existente).
- Validation rules updated: No (no hay validación nueva; la acción solo se ofrece tras éxito).
- Acceptance criteria updated: No (`admin-month-detail-flow.md` no tiene sección de criterios de aceptación separada; el comportamiento quedó en los pasos del flujo).
- docs/specification.md aligned: Yes (sección 15.7).

## Migration Compatibility Check

- Schema changes required: No.
- Data backfill required: No.
- Legacy compatibility required: No.
- Rollback strategy defined: Yes (cambio solo de frontend; revertir el commit devuelve el comportamiento anterior, sin datos afectados).
- Cleanup phase defined: N/A (no hay compatibilidad transitoria).
- Integrity protections defined: N/A (no toca persistencia; la reprogramación sigue igual en backend).

## Admin UI Check

- Uses components/admin/ui: N/A. No se agregó ningún elemento visual; el toast es de `sileo`, montado ya en el admin.
- Reused existing components: N/A (sin nuevos componentes visuales).
- New reusable components created: No.
- Tokens respected: N/A (sin estilos nuevos).
- design-system.md aligned: N/A (sin cambios visuales).
- Public flow untouched: Yes. `BookAppointmentModal` es admin. No toqué `components/booking` ni flujos públicos; solo se refactorizó el texto de WhatsApp de este modal admin.

## Notification Contract Check

- Sileo used for success/warning/error/info: Yes. El éxito y el error de reprogramar siguen con `sileo.promise` (sin cambios).
- Sileo action notifications used when applicable: Yes (`sileo.action` con botón).
- Sileo promise notifications used when applicable: Yes (existente, sin cambios).
- i18n applied in admin notifications: Yes (título y botón con `t`; mensaje con `t`).
- Alternative notification systems introduced: No.

## Evidencia y estado

- **Verificado estáticamente:** diseño y cableado (la oferta va después del `await`, el teléfono sale de la fila, el helper es el mismo código que tenía `BookAppointmentModal`), lint sin errores, tsc sin errores en archivos tocados, JSON de locales válido, paridad de claves es/en.
- **Ejecutado:** vitest (resultados arriba), eslint, lint, lint:admin-i18n, tsc, validación JSON.
- **Pendiente de aceptación manual del owner (no ejecutado):** en el admin, reprogramar una cita futura y comprobar: (1) aparecen el toast de éxito y el toast con botón; (2) el botón abre WhatsApp en la misma pestaña con el número `52…` y el mensaje con la nueva fecha y hora; (3) con una reprogramación fallida no aparece el toast de WhatsApp; (4) el texto (`!` vs `!!`, copy) y la duración del toast son aceptables.

## Limitaciones

1. **Sin prueba de componente del flujo de guardar.** No existía test del flujo de reprogramar en `month-detail-view.test.tsx`. Escribir uno requiere mockear `sileo` y recorrer editar → guardar. Por eso el cableado de `MonthDetailView` (teléfono correcto, sin oferta si falla) queda **solo verificado estáticamente** más la regresión de la suite de `month-detail-view`. Puedo agregar ese test si el Orchestrator lo autoriza.
2. **Sin navegador real.** El render del toast de `sileo.action` y el salto a WhatsApp no se probaron en navegador. El test del hook stubbea `location` en jsdom.
3. **`BookAppointmentModal`**: el refactor se verificó porque el código es idéntico y el helper tiene tests con los strings esperados. Las pruebas existentes de ese modal no cubren el paso de éxito con WhatsApp. Esa brecha ya existía.
4. **Fallo previo no relacionado:** `MonthDetailView > disables schedule CTA when month is inactive` falla en HEAD (verificado). La prueba espera el CTA de agendar deshabilitado en meses inactivos, pero el commit `56c11dc` permitió agendar en meses inactivos. Es una prueba desactualizada. No la toqué: el archivo no está autorizado.
5. **Errores de tsc previos** en 21 archivos de test/e2e no tocados. No corrí tsc sobre HEAD como línea base.
6. **Warnings de lint previos** en archivos no tocados.
7. **Comandos:** la sección "Commands" de `CLAUDE.md` que referencian el brief y el perfil no existe. El perfil (`{{test_commands}}`) apunta a un lugar inexistente; conviene corregirlo.
8. **Duración del toast:** `sileo.action` se llama sin `duration`, así que usa el valor por defecto de sileo. No lo verifiqué.
9. `business-rules.md` no actualizado (fuera de alcance; ver Documentation Impact).

## Handoff

- Hecho: implementación, pruebas nuevas, docs de flujo y especificación, i18n, verificaciones de lint/tsc/vitest.
- Pendiente: decisión del owner sobre `!` vs `!!` y copy; autorización para `business-rules.md` (una línea); autorización opcional de un test de componente para el flujo de guardar; Reviewer.
- Archivos tocados: los 10 de la tabla de arriba, más `docs/implementation-reports/round-01-reschedule-whatsapp-developer.md` (este reporte).
- Siguiente paso: que el Orchestrator lance el Reviewer (`reviewer`) con este reporte y la aceptación manual pendiente.
