# Ronda 23 · T077-b — Scrim tokenizado, README L151-152 y excepción D102 en AGENTS.md (Developer)

- Spec: 003 Disponibilidad flexible por mes.
- Continuación de T077 (`round-22-t077-docs-developer.md`, §2.3). Alcance: 3 cambios. Sin cambios de lógica, comportamiento ni apariencia. Sin migraciones, sin BD, sin `.env`, sin commit, sin marcar T077 en `tasks.md`, sin tocar otros archivos de `specs/`.
- Tipo de verificación: **ejecutada** (vitest, tsc, eslint) más **estática** (grep y lectura de código y docs). No hay verificación visual en navegador.
- Turnos aproximados: ~33 de 80.

## 1. Archivos y líneas cambiadas

| Archivo | Líneas (estado final) | Cambio |
|---|---|---|
| `app/globals.css` | L39 (nueva, dentro de `:root`, tras `--admin-border`) | `--admin-scrim: rgba(28, 25, 23, 0.35);` |
| `components/admin/ui/Modal.tsx` | L97 | `bg-[rgba(28,25,23,0.35)]` → `bg-[var(--admin-scrim)]` |
| `components/admin/ui/BottomSheetModal.tsx` | L87 | `bg-[rgba(28,25,23,0.35)]` → `bg-[var(--admin-scrim)]` |
| `components/admin/months/availability/AvailabilityEditorModal.tsx` | L45 (comentario), L48 (clase del scrim) | Clase → `bg-[var(--admin-scrim)]`. El comentario ya no dice "no hay token de scrim". |
| `docs/ui/admin/tokens.md` | ~L77-84 | Subsección "Overlay (scrim): pendiente de tokenizar" → "Overlay (scrim)" con el token `--admin-scrim`, uso, ausencia de variante oscura y D105b. |
| `docs/ui/admin/components.md` | L953 (viñeta de "Descarte" en `AvailabilityEditorModal`) | Ya no dice "el token todavía no existe"; apunta a `--admin-scrim` en `globals.css` y `tokens.md`. |
| `README.md` | L151-152 | "Slots base" → "Horarios"; "Límite diario" reescrito (ver §2.2). No se tocó ninguna otra línea del README. |
| `AGENTS.md` | Bloque nuevo tras el párrafo "No se permite introducir librerías…", dentro de "Regla obligatoria" de "Reglas específicas para notificaciones UI" (+2 líneas) | Excepción D102 documentada. Las reglas existentes no cambiaron. |

Sin cambios: `docs/ui/admin/design-system.md` (no contenía el texto "pendiente de tokenizar" ni "el token aún no existe"; solo habla de color y tonos de disponibilidad) y `docs/specification.md` (ver §5).

### 1.1 Equivalencia del color

- El valor `rgba(28, 25, 23, 0.35)` es el mismo que el literal `rgba(28,25,23,0.35)` anterior. Es igual por lectura estática; no se comparó en navegador.
- `app/globals.css` no tiene bloque de modo oscuro (`dark`, `prefers-color-scheme`, `color-scheme` ausentes), así que el token tiene un único valor.
- La clase `bg-[var(--admin-scrim)]` sigue el mismo patrón que ya usan los componentes admin (`bg-[var(--admin-surface)]`, `bg-[var(--admin-inactive-bg)]`, etc.).

### 1.2 Ocurrencias del literal

- Búsqueda en todo el repo (excluyendo `node_modules`, `.next`, `.git`) de `28,25,23`, `28 25 23` y `0.35)`: en código quedaban solo las 3 ocurrencias indicadas (`Modal.tsx:97`, `BottomSheetModal.tsx:87`, `AvailabilityEditorModal.tsx:48`), ya reemplazadas.
- Fuera de código, el literal aparece en `docs/ui/admin/tokens.md` (valor de referencia, ahora documenta el token) y en `specs/**/agent-reports/` (informes históricos; no se tocaron).
- Flujo público: ningún archivo de `app/booking`, `app/cancelar`, `components/booking` ni `components/cancel` importa `components/admin/ui`. Ninguna ocurrencia del literal en el flujo público.
- Importadores de `Modal`/`BottomSheetModal` (verificados con grep de `import`; solo admin, no se tocaron): `EditClientModal`, `BlockSpacesModal`, `NewMonthModal`, `AffectedAppointmentsDialog`, `MonthDetailView`, `AppHeader`, `AvailabilityEditorModal`, `BookAppointmentModal`.

### 1.3 README (L151-152) y fuente

- Fuente: `docs/specification.md` §4.1 (D6, D28), §4.2 (horas `HH:mm`, `00:00` no válido, hasta 24 horas por regla, D21, D55) y §4.3 (`maxPerDay` de 1 a 6, por defecto `3`, D20).
- Redacción final:
  - `Horarios: los define la regla de disponibilidad del mes que cubre cada día (horas HH:mm distintas de 00:00, hasta 24 por regla). Un mes sin reglas usa 09:00, 10:00, 13:00, 14:00, 17:00 y 18:00 de lunes a viernes; sábados y domingos quedan cerrados.`
  - `Límite diario: lo define cada regla de disponibilidad del mes, de 1 a 6 citas activas por día. Un mes sin reglas usa 3 citas activas por día.`
- Desviación menor del brief: añadí "de lunes a viernes" y "sábados y domingos quedan cerrados". La spec (D6, D28) define así el default; sin esa precisión el README sugeriría que el default abre todos los días.

### 1.4 Excepción en AGENTS.md

- Texto añadido: "Excepción documentada: guardado del editor de disponibilidad. `hooks/admin/months/useAvailabilitySave.ts` no usa `sileo.promise`…". Motivo: `sileo.promise` muestra error ante cualquier rechazo, y el 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` no es un fallo (abre el diálogo de citas afectadas), así que no puede silenciarse. El hook usa `sileo.show` (tipo `loading`, descartado al terminar), `sileo.success` y `sileo.error`, con control propio del estado de guardado. Decisión D102; referencia a `docs/ui/admin/components.md`, componente `AvailabilityEditorModal`, subsección «Guardado y notificaciones».
- Lectura del hook: L66-98 de `useAvailabilitySave.ts`; el comentario de L67 da el mismo motivo. El texto de AGENTS es coherente con `components.md` (L959).

## 2. Verificación

### 2.1 Ejecutado

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin` | 26 archivos: 22 pasan, 4 fallan. Tests: 105 pasan, 4 fallan, de 109. |
| `npx tsc --noEmit` | 32 líneas `error TS`, todas en `tests/` (baseline 32). 0 en `Modal.tsx`, `BottomSheetModal.tsx`, `AvailabilityEditorModal.tsx`, `globals.css`. |
| `npx eslint` sobre `Modal.tsx`, `BottomSheetModal.tsx`, `AvailabilityEditorModal.tsx` | exit 0. |
| `npm run lint:admin-i18n` | exit 0. 0 errores, 1 warning en `hooks/admin/useReminderAppointments.ts:13` (no tocado). |
| `npm run lint` (completo) | exit 0. 0 errores, 4 warnings en 2 archivos no tocados (`hooks/admin/useReminderAppointments.ts`, `hooks/booking/use-booking-wizard.ts`). |

Fallos de `tests/components/admin` (4):

- `appointment-logs/appointment-logs-view.test.tsx` > "renders the client column label, puts actor last, and keeps the action filter aligned"
- `clients/clients-catalog-view.test.tsx` > "renders catalog blocks and delegates filter/list actions"
- `months/month-detail-view.test.tsx` > "disables schedule CTA when month is inactive"
- `ui/reminder-appointments-card.test.tsx` > "opens the final WhatsApp URL directly from click" (`Cannot redefine property: assign`, problema del entorno de prueba)

Atribución: los cuatro están en la línea base registrada en `STATE.md` (Fase 2 de código: AppointmentLogsView, ClientsCatalogView, ReminderAppointmentsCard, MonthDetailView "disables schedule CTA…"). Los archivos de prueba no importan `Modal`, `BottomSheetModal` ni `AvailabilityEditorModal`. No se comparó contra HEAD en esta ronda (`git stash` prohibido), así que la atribución es por la línea base registrada, no por una ejecución nueva en HEAD. El quinto fallo de la línea base (`useRescheduleWhatsappAction`, hook) no entra en esta ejecución.

Pruebas de los componentes tocados que pasan: `ui/bottom-sheet-modal` 5/5, `months/availability-discard-confirm` 5/5 (descarte con scrim), `months/availability-editor-modal` 1/1, `months/availability-editor` 4/4, `months/availability-affected-dialog` 3/3. Otras que usan `Modal`: `block-spaces-modal` 4/4, `book-appointment-modal` 3/3, `new-month-modal` 1/1, `edit-client-modal` 5/5. No existe prueba directa de `ui/Modal.tsx`; su cobertura es indirecta.

### 2.2 No ejecutado

- `npm test` completo y pruebas de integración (no permitidas en la ronda).
- `next build`: no estaba en la lista de verificación permitida. La compilación de la clase `bg-[var(--admin-scrim)]` por Tailwind no se comprobó con build; el patrón ya se usa en el admin.
- Navegador o Playwright: no se comparó visualmente el scrim en ambos modos (no hay modo oscuro) ni el comportamiento de blur.
- Comparación de color en tiempo de ejecución: la equivalencia es estática (§1.1).

## 3. Trazabilidad y bloques

### Admin UI Check
- Uses components/admin/ui: Yes. `Modal` y `BottomSheetModal` están en `components/admin/ui/`; `AvailabilityEditorModal` compone `BottomSheetModal` de ese mismo directorio.
- Reused existing components: Yes. No se creó ningún componente.
- New reusable components created: No.
- Tokens respected: Yes. El scrim pasa de literal a token `--admin-scrim`. El valor no cambió. No se introdujeron hexadecimales ni valores nuevos fuera del token.
- design-system.md aligned: Yes. `design-system.md` no menciona el scrim como pendiente; no requiere cambio. El token está documentado en `tokens.md` y `components.md`.
- Public flow untouched: Yes. Ningún archivo del flujo público importa componentes admin ni contiene el literal.

### Notification Contract Check
- Sileo used for success/warning/error/info: Yes. El código de notificaciones no cambió (`useAvailabilitySave.ts` usa `sileo.show`, `sileo.success`, `sileo.error`).
- Sileo action notifications used when applicable: Yes. No aplica en el editor de disponibilidad; no se añadieron ni cambiaron.
- Sileo promise notifications used when applicable: No, en el guardado del editor. Es la excepción D102 ahora documentada en AGENTS.md ("Excepción documentada: guardado del editor de disponibilidad"). Motivo técnico: el 409 de confirmación no puede silenciarse con `sileo.promise`.
- i18n applied in admin notifications: Yes. El hook usa `t("monthsDetail.availability.notifications.*")`, sin cambios.
- Alternative notification systems introduced: No.

### Documentation Impact
- Yes (documentación y reglas; sin cambio de comportamiento ni de flujo).
- Updated docs/specification.md: No. El flujo, los estados, las validaciones y la UI no cambiaron. La spec ya documenta la excepción D102 en §15 (L1141, "No se usa `sileo.promise`…"). El scrim no aparece en la spec.
- Sections affected: `docs/ui/admin/tokens.md` ("Overlay (scrim)"); `docs/ui/admin/components.md` (`AvailabilityEditorModal`, "Descarte"); `AGENTS.md` ("Reglas específicas para notificaciones UI", "Regla obligatoria"); `README.md` ("Reglas funcionales clave", L151-152).

Flow Contract Check: no aplica (no hay cambio de flujo, paso, API ni validación).
Migration Compatibility Check: no aplica (sin esquema, datos ni migraciones).

## 4. Hallazgos fuera de alcance (no tocados)

1. `hooks/admin/months/useAvailabilitySave.ts` L33: el comentario dice "PUT con sileo.promise", pero L67 y la nueva excepción de AGENTS dicen lo contrario. El comentario es obsoleto. Corregirlo requiere tocar el hook, que no estaba en el alcance; propongo corregirlo en una ronda posterior o en la revisión.
2. `components/admin/ui/Modal.tsx` no tiene prueba directa; la cobertura del scrim es indirecta.
3. Los 4 warnings de `npm run lint` en archivos no tocados (`useReminderAppointments.ts`, `use-booking-wizard.ts`) son preexistentes en este árbol; no se investigaron.

## 5. Limitaciones y pendientes para el Orquestador

- Pendiente de verificación en navegador: ver el scrim en el modal de descarte y en `Modal`/`BottomSheetModal` (ya es responsabilidad del owner en validación visual, como en rondas previas).
- Decisiones nuevas: ninguna. La única desviación respecto al brief es la precisión "de lunes a viernes" en el README (§1.3), derivada de la spec.
- Para el cierre de T077: `reviewer-docs` debe revisar `tokens.md`, `components.md`, `AGENTS.md` y el README. Por la naturaleza del cambio (código de una línea de clase más un token), un revisor de bajo riesgo puede bastar, salvo que el Orquestador prefiera el de alto riesgo por tocar componentes de admin. El diff de código son 4 líneas en 4 archivos más `globals.css`.

## 6. Handoff

- Estado: los 3 cambios están hechos y verificados como se indica en §2. Sin commit.
- Archivos tocados: `app/globals.css`, `components/admin/ui/Modal.tsx`, `components/admin/ui/BottomSheetModal.tsx`, `components/admin/months/availability/AvailabilityEditorModal.tsx`, `docs/ui/admin/tokens.md`, `docs/ui/admin/components.md`, `README.md` (L151-152), `AGENTS.md`, y este informe.
- Pendiente: revisión (`reviewer-docs` o bajo riesgo) y validación visual del owner del scrim; luego, según STATE, marcar T077 [X] (lo hace el Orquestador tras la revisión).
- Siguiente acción sugerida: el Orquestador lanza la revisión de T077 con este informe y el de la ronda 22.
