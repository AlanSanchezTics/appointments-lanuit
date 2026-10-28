# Round 01 - Pending WhatsApp redirect - Reviewer re-revisión (r1)

Fecha: 2026-10-27
Rol: `reviewer` (riesgo bajo, sin spec). Modo auditoría: no se modificó la entrega.
Alcance: verificación de la corrección 2 del Developer (solo documentación). Reporte original: `docs/implementation-reports/round-01-pending-whatsapp-reviewer.md`.

## Veredicto

**Approved**

B1 y B2 quedaron resueltos en los docs, y N2 quedó resuelto en la especificación (la garantía de bfcache ya no se declara). No hay incoherencias nuevas en los docs ni en el código. No hubo cambios de código desde la última corrida de tests de la ronda.

## Hallazgos

### Blocking

Ninguno.

### Non-blocking

- **N1 - Decisión de redirect en el componente (sin cambios).** `components/admin/ui/PendingAppointmentsCard.tsx:130-137` mantiene la condición `action === "confirm" && (CONFIRMED || SYNC_FAILED)` en el componente, no en el hook. AGENTS.md pide lógica de interacción en hooks. Deuda menor, no bloquea.
- **N3 - Ventana de doble toque (sin cambios).** `finally` (línea 143) rehabilita los botones justo después de `window.location.assign` (línea 135). Un segundo toque antes de salir de la página envía una segunda confirmación y recibe 409 (`APPOINTMENT_STATUS_INVALID_TRANSITION`). Sin documentar. Mitigación posible: no liberar `pendingTransition` cuando se redirige.
- **N5 - Formato de los locales (sin cambios).** `locales/es/admin.json` y `locales/en/admin.json` son JSON válido (verificado con `JSON.parse`), pero el diff contiene reformateo fuera de la clave nueva: la coma suelta de cierre de `dashboard` se reacomodó, y ambos archivos terminan sin salto de línea final. Es ruido en el diff.
- **N6 - Teléfono sin guarda en el hook (sin cambios).** `hooks/admin/usePendingAppointmentWhatsapp.ts:31` construye `52${item.phone}`. El invariante de 10 dígitos viene de `VarChar(10)` y del regex de alta. No se verificó el camino de imports históricos. Defensa en profundidad opcional.
- **N4 - Copia en inglés sin coma (aceptado, documentado).** `formatLongDate` en `en` produce `Monday April 13`. Es decisión de la dueña y ya está registrada en `docs/specification.md` sección 14, regla 10. Queda como nota para revisión de copy.

## Verificación de los puntos de la corrección 2

### B1 - Formato de fecha larga en docs de flujos públicos: resuelto

- `docs/specification.md:636-642` (sección 14, regla 10): documenta `es` (`Lunes 13 de Abril`, sin coma) y `en` (`Monday April 13`). Aplica a flujos públicos (reserva, pendiente, cancelación, `Mis citas`) y admin. Registra el cambio de formato y que lo decidió la dueña. Las excepciones (recordatorios) están explícitas.
- Código alineado con la regla: `lib/datetime/mexico-city.ts:99` devuelve `` `${capitalize(weekday)} ${longDate}` ``. El helper no lo usan los recordatorios (`grep formatLongDate` en `hooks/admin`, `components/admin`, `lib/admin` solo devuelve el hook de pendientes, `ClientDetailView` y `BookAppointmentModal`, todos del alcance documentado).
- Referencias cruzadas: `docs/specification.md:300` (mensaje de éxito de reserva) apunta a la regla 10; `docs/features/cancel-flow.md:66` documenta el formato sin coma en el mensaje de cancelación.
- Greps de coherencia:
  - Fecha con día de la semana seguida de coma, sin distinguir mayúsculas, en `docs`, `components`, `hooks`, `lib`, `app`, `locales` y `tests` (excluyendo reportes): solo aparece `docs/specification.md:640`, que es la nota histórica del cambio, correcta. Los demás resultados (`components/admin/ui`, `lib/admin/dashboard/service.ts:343`) son lógica de días, no formato.
  - Plantilla de recordatorio `NEXT_WEEK` con coma en `locales/es/admin.json:140`: no usa `formatLongDate`, y la excepción está documentada en la regla 10 y en la plantilla de la especificación (`docs/specification.md:852`).
- Test de la helper actualizado: `tests/lib/datetime/mexico-city.test.ts:38` espera `Lunes 13 de Abril`.

### B2 - Regla de redirección de pendientes en business-rules: resuelto

- `docs/architecture/business-rules.md:154-160`: sección nueva "Pending confirmation WhatsApp redirect". Cubre: aplica solo a `Confirmar` del bloque, redirección en la misma pestaña solo con `CONFIRMED`/`SYNC_FAILED`, sin `router.refresh()` antes de redirigir, `Rechazar` y errores sin redirect, prohibición de `window.open`, y la excepción explícita a la regla síncrona de recordatorios.
- `docs/architecture/business-rules.md:376`: en "Reminders widget policy" se agrega la excepción, con su motivo. Los recordatorios y retoques siguen síncronos.
- `docs/ui/admin/components.md:486-491`: la nota de UI referencia la excepción y la regla de fecha compartida.
- Verificado el nombre de la sección "Reminders widget policy" (línea 366), a la que apunta la nueva nota.

### N2 - Garantía de bfcache: resuelto en documentación

- `docs/specification.md:837`: ya no declara garantía. Dice que la lista depende de si el navegador vuelve a cargar `/admin` desde el servidor, que no hay handler de `pageshow`, y que en caso de restauración desde caché la lista depende del navegador. Es una descripción honesta del comportamiento real. Confirmé que no existe `pageshow` en el código del round.

### Otros chequeos

- Ningún doc vigente cita `!!` para el mensaje de WhatsApp. El texto es `!` en `locales/es/admin.json:108`, `locales/en/admin.json:108`, `docs/specification.md:825` y `tests/components/admin/ui/pending-appointments-card.test.tsx:77`. Coherente. Las menciones a `!!` están solo en `docs/implementation-reports/round-01-pending-whatsapp-developer*.md` (históricos, según la coordinación).
- Ninguna mención a popup, pestaña nueva o `window.open` en la feature, salvo la regla que lo prohíbe (`components.md:497`, `business-rules.md:158`).
- `docs/features/admin-auth-flow.md:69` está alineado con la nueva regla.
- Diff de docs: 5 archivos (`business-rules.md`, `admin-auth-flow.md`, `cancel-flow.md`, `specification.md`, `components.md`). No se tocó código en esta corrección.

## Comandos

| Comando | Resultado |
|---|---|
| `git status --short` y `git diff --stat -- docs` | Solo cambian docs en la corrección 2. |
| `grep` de fecha con coma (mayúsculas y minúsculas) y de `!!` en docs, components, hooks, lib, app, locales y tests | Sin incoherencias fuera de reportes históricos. |
| `grep` de `formatLongDate` en `hooks/admin`, `components/admin`, `lib/admin` | Solo consumidores del alcance documentado. |
| `stat` de mtimes de código | El último cambio de código fue `tests/lib/datetime/mexico-city.test.ts` a las 23:38:01. La última corrida de tests de la ronda (39 pasan en 8 archivos, incluido `tests/lib/datetime`) se hizo después. No hace falta repetirla. |
| `node -e JSON.parse` de `locales/{es,en}/admin.json` | Válidos. Ambos sin salto de línea final (N5). |

Corridas previas de esta ronda (vigentes, sin cambios de código desde entonces): vitest de las suites tocadas, 39 tests en 8 archivos pasan; eslint de los 3 archivos tocados, exit 0; `npm run lint:admin-i18n`, exit 0 (1 warning preexistente en un archivo no tocado); tsc, 66 errores preexistentes, ninguno en archivos tocados; 4 fallos preexistentes en `tests/components` que también ocurren en `HEAD` (ver reporte original).

## Riesgos residuales

- N3 (doble toque durante la salida).
- N6 (teléfono sin guarda; imports históricos sin verificar).
- Cobertura de tests: sin casos en `en`, sin `CALENDAR_NOT_CONFIGURED`, sin teléfono inválido, sin Playwright.
- Fallos preexistentes en la suite (`appointment-logs-view`, `clients-catalog-view`, `month-detail-view`, `reminder-appointments-card`) y 66 errores de tsc en `tests/`. No pertenecen a esta ronda.

## Nota de trazabilidad

- Impacto en flujo: sí (pendientes admin; formato de fecha compartido con flujos públicos y admin).
- Impacto documental: sí. Documentado en `docs/specification.md` (sección 14 regla 10; sección 15.1.4 con excepción de bfcache corregida), `docs/architecture/business-rules.md` (nueva sección y excepción en recordatorios), `docs/features/cancel-flow.md`, `docs/features/admin-auth-flow.md`, `docs/ui/admin/components.md`.
- Admin UI Check: uso de componentes Yes, tokens Yes, `design-system.md` aligned Yes, Public flow untouched **No** (por el formato compartido), que ahora está documentado y declarado en el reporte del Developer r2.
- Notification Contract Check: sileo para success/error Yes; sileo action N/A; sileo promise Yes; i18n Yes; sistema alternativo No.
