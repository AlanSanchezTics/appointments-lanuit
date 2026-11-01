# Round 11: confirmación "¿Descartar cambios?" como overlay superior (Developer)

Fecha: 2026-10-31. Rama: 003-flexible-month-availability. Sin commits, sin BD, sin `.env`.

## Resultado

La tarjeta de confirmación ya no se renderiza al final del formulario desplazable. Ahora se superpone al panel del modal (position absolute, centrada, en la parte superior), fuera del área con scroll. Mientras está abierta, el contenido del formulario queda `inert`, el botón X y el overlay de cierre quedan deshabilitados, y Esc equivale a "Seguir editando".

## Archivos

Modificados:

- `components/admin/ui/BottomSheetModal.tsx` (+4 líneas): prop opcional `overlay?: React.ReactNode`, renderizada como último hijo de la sección `relative` que ya existía, después del `div` con scroll. Sin la prop, `{undefined}` no pinta nada: el marcado y el comportamiento de los demás modales no cambian. No se añadió contenedor nuevo porque la sección ya es `relative`.
- `components/admin/months/availability/AvailabilityEditorModal.tsx`:
  - Eliminado el bloque antiguo de la confirmación al final del formulario.
  - `disableClose` ahora incluye `editor.isDiscardConfirmOpen`.
  - `overlay` renderiza un `div` con `role="alertdialog"`, `aria-labelledby`, `aria-describedby` y clases `absolute inset-x-4 top-4 z-10 mx-auto max-w-md`, con `Card` dentro (mismo título, descripción y botones que antes).
  - El contenedor desplazable recibe `inert={editor.isDiscardConfirmOpen}`.
  - Se llama al hook nuevo. No hay estado ni efectos en el componente.

Creados:

- `hooks/admin/months/useDiscardConfirmDialog.ts`: ids con `useId`, ref del diálogo, foco inicial en el botón `[data-initial-focus]` ("Seguir editando") al abrir, devolución del foco al elemento previo al cerrar (si sigue en el DOM), y Esc que llama a `keepEditing`.
- `tests/components/admin/months/availability-discard-confirm.test.tsx`: 4 pruebas.
- `tests/components/admin/ui/bottom-sheet-modal.test.tsx`: 4 pruebas.

No tocados: `locales/{es,en}/admin.json` (las claves `monthsDetail.availability.discard.*` ya existían en ambos idiomas y bastaron), `docs/*`, `prisma/*`, `.env`, `aria-label` de overlay/X (Fase 4).

## Decisiones de implementación

- `disableClose` mientras la confirmación está abierta: BottomSheetModal ignora su propio Esc y no llama `onClose`. Así se evita una carrera: si BottomSheetModal y el hook manejaran Esc a la vez, `requestClose` podría reabrir la tarjeta.
- `inert` en el contenido: no estaba en el ajuste pedido pero es la forma sencilla de que el foco no salga de la confirmación hacia el formulario. Es una prop de React 19 (`react` ^19.0.0). Solo se comprobó que el atributo se renderiza; el efecto real de `inert` en el navegador no se ha probado.
- Sin capa de atenuación sobre el contenido (opcional, no implementada).
- Sin token nuevo para el z-index: `docs/ui/admin/tokens.md` solo define `shell-z-header` (30) y `shell-z-sidebar` (50). Se usa `z-10` de Tailwind dentro del panel.
- Sombra: la de `Card` (`shadow-sm`, token documentado). No se añadió sombra extra.

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin/months/availability-discard-confirm.test.tsx tests/components/admin/months/availability-editor-modal.test.tsx tests/components/admin/ui/bottom-sheet-modal.test.tsx` | 3 archivos, 9 pruebas, todas pasan. El smoke existente pasa sin cambios. |
| `npx vitest run tests/components/admin tests/hooks/admin/months` | 30 archivos: 25 pasan, 5 fallan. 136 pruebas: 131 pasan, 5 fallan. Los 5 fallos son la línea base exacta: AppointmentLogsView, ClientsCatalogView, MonthDetailView "disables schedule CTA when month is inactive", ReminderAppointmentsCard "opens the final WhatsApp URL directly from click", useRescheduleWhatsappAction. Sin fallos nuevos. |
| `npx tsc --noEmit` | 32 errores, todos en `tests/` (línea base 32). Ninguno en código de producción. |
| `npx eslint` sobre los 5 archivos tocados o creados | exit 0. |
| `npm run lint:admin-i18n` | exit 0, 0 errores. 1 warning en `hooks/admin/useReminderAppointments.ts` (`DashboardReminderType` sin usar). Archivo sin cambios en git: warning preexistente. |

## Estático, ejecutado, pendiente

Ejecutado (jsdom, Testing Library):

- La confirmación tiene `role="alertdialog"` y se nombra por su título.
- Está dentro del panel `dialog` y fuera del contenedor con `overflow-y-auto`.
- Aparece una sola vez con el texto "¿Descartar cambios?".
- Al abrir, el foco va a "Seguir editando". Esc la cierra, mantiene el editor abierto y devuelve el foco a "Cancelar".
- "Seguir editando" mantiene el editor abierto y quita `inert`.
- "Descartar" cierra el editor.
- El BottomSheetModal sin `overlay` no añade nodos; con `overlay` lo pinta dentro del panel y fuera del área con scroll.
- Esc ignorado con `disableClose`, atendido sin él.

Estático (no medido):

- Posición y centrado: `absolute inset-x-4 top-4 mx-auto max-w-md` dentro de la sección `relative`. El centrado depende de auto-márgenes con `max-width` sobre un elemento absolute. Es un patrón habitual, pero no se ha medido en navegador.
- Ancho en 375px, solapamiento con el título y la X del encabezado, y área táctil: no medidos. No hay herramienta de medición de layout disponible en esta ronda; Playwright no se ejecutó.

Pendiente del owner:

- Validación en iPhone (375px): que la tarjeta se ve arriba, no molesta, y que los botones son cómodos de pulsar.
- Lectura con lector de pantalla (VoiceOver): anuncio del alertdialog y foco.

## Limitaciones conocidas

- Mientras la tarjeta está abierta, cubre el título y la X del encabezado. La X y el overlay quedan deshabilitados a propósito; se sale con "Seguir editando" o Esc.
- Restauración de foco: si la confirmación se abrió desde la X o el overlay, esos controles se deshabilitan en el mismo commit y el foco cae en `body` al cerrar. Si se abrió desde "Cancelar", el foco vuelve a "Cancelar".
- Sin atenuación del contenido (opcional).

## Admin UI Check

- Uses components/admin/ui: Yes (`Card`, `Button`, `BottomSheetModal`).
- Reused existing components: Yes.
- New reusable components created: No (se añadió una prop opcional a `BottomSheetModal`).
- Tokens respected: Yes en lo añadido (solo utilidades Tailwind de posición y `var(--admin-*)` ya existentes; sin hexadecimales). El `z-10` no tiene token documentado.
- design-system.md aligned: Pendiente. `docs/ui/admin/components.md` (sección BottomSheetModal) no documenta la prop `overlay`.
- Public flow untouched: Yes.

Observación fuera de alcance, sin verificar: `components/admin/ui/Button.tsx` usa variables `--accent`, `--surface-strong`, `--foreground`, `--border` y `--muted`, que no son tokens `--admin-*`. Puede ser una incumplimiento de la regla de tokens del admin. No se ha investigado.

## Notification Contract Check

No se añadieron ni cambiaron notificaciones. No aplica.

## Flow Contract Check

- UI steps updated: No (pendiente en la documentación del flujo).
- API contract updated: No se requiere (sin cambios de endpoints).
- Validation rules updated: No se requiere (sin cambios de validación).
- Acceptance criteria updated: No (pendiente).
- docs/specification.md aligned: No (pendiente).

## Migration Compatibility Check

- Schema changes required: No.
- Data backfill required: No.
- Legacy compatibility required: No.
- Rollback strategy defined: Sí, revertir el commit; es solo UI.
- Cleanup phase defined: No aplica.
- Integrity protections defined: No aplica.

## Documentation Impact

- Impacto documental: Sí. Cambia el comportamiento de UI del descarte (posición, rol, foco, Esc, contenido inerte).
- `docs/specification.md`: NO actualizado. Estaba fuera de los archivos autorizados. Debe actualizarse la sección del editor de disponibilidad mensual donde se describe la confirmación "¿Descartar cambios?": posición superior sobre el panel, `alertdialog`, Esc = seguir editando, y contenido no interactivo mientras está abierta.
- `docs/ui/admin/components.md` (BottomSheetModal): pendiente documentar la prop opcional `overlay` y que se renderiza fuera del área con scroll.
- `docs/features/*.md`: no revisado. Si el flujo de disponibilidad tiene un doc de feature que describe el descarte, debe actualizarse también.
- Ambigüedad: el Orchestrator debe decidir si la actualización de docs entra en esta ronda o en una siguiente.

## Próximo paso

El Orchestrator decide si se actualizan `docs/specification.md` y `docs/ui/admin/components.md` (ver Documentation Impact). Después, validación en iPhone (375px) por el owner.

Qué no se revisó o no se comprobó: el layout real en navegador, el comportamiento de `inert` en navegadores reales, y el anuncio con lector de pantalla. Riesgo para el owner: la posición sobre el encabezado debe confirmarse en el dispositivo.

## Ajuste posterior del owner: scrim detrás de la tarjeta

Petición: fondo atenuado detrás de la tarjeta "¿Descartar cambios?", que cubra el encabezado (título y X) y quede por debajo de la tarjeta.

Cambios en `components/admin/months/availability/AvailabilityEditorModal.tsx` (dentro de la prop `overlay`, como fragmento):

- Scrim: `div aria-hidden="true"` con `absolute inset-0 z-10 rounded-t-3xl bg-[rgba(28,25,23,0.35)] backdrop-blur-sm`. Sin manejador de clic: tocarlo no cierra ni descarta. Se eligió no hacer nada, como recomendó el coordinador. El `rounded-t-3xl` evita que el atenuado sobresalga de las esquinas redondeadas del panel.
- La tarjeta (wrapper `role="alertdialog"`) pasa de `z-10` a `z-20`, para quedar por encima del scrim.

Token: no existe token de scrim/backdrop en `docs/ui/admin/tokens.md` ni en `app/globals.css`. Se reutiliza el literal que ya usan `BottomSheetModal.tsx` y `Modal.tsx` para su backdrop (`rgba(28,25,23,0.35)`), sin hexadecimales nuevos. Pendiente para el Orchestrator: promoverlo a token documentado (fuera de los archivos autorizados).

Pruebas (`tests/components/admin/months/availability-discard-confirm.test.tsx`, ahora 5 pruebas):

- Con la confirmación abierta hay un scrim `aria-hidden` con `z-10` fuera de la tarjeta, y la tarjeta tiene `z-20`.
- Clic en el scrim: la tarjeta y el diálogo siguen abiertos.
- Tras "Seguir editando" el scrim desaparece.

Resultados tras el ajuste:

- Pruebas de la ronda: 3 archivos, 10 pruebas, todas pasan.
- `npx vitest run tests/components/admin tests/hooks/admin/months`: 137 pruebas, 132 pasan, 5 fallan = línea base exacta (AppointmentLogsView, ClientsCatalogView, MonthDetailView "disables schedule CTA when month is inactive", ReminderAppointmentsCard, useRescheduleWhatsappAction). Sin fallos nuevos.
- `npx tsc --noEmit`: 32 errores, todos en `tests/`.
- `npx eslint` sobre los 5 archivos: exit 0.
- `npm run lint:admin-i18n`: exit 0, 0 errores (1 warning preexistente).

Estático (no medido): que el scrim cubra exactamente el panel y las esquinas, y el contraste del texto de la tarjeta sobre el atenuado con blur. Pendiente del owner: validación visual en iPhone 375px.

Documentation Impact del ajuste: el overlay cambia el aspecto del descarte. Se suma a la documentación pendiente de `docs/specification.md` y `docs/ui/admin/components.md` (BottomSheetModal, prop `overlay`).
