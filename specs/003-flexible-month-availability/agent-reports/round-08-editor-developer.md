# Ronda 2A (editor de disponibilidad) - Developer

**Spec**: 003-flexible-month-availability | **Tareas**: T040-T046 | **Rama**: `003-flexible-month-availability` | **Commits**: ninguno

Rutas relativas a la raíz del repositorio.

## 1. Resumen

- Editor de reglas y excepciones del mes implementado en cliente: cliente API, dos hooks, tres componentes de feature (en `components/admin/months/availability/`) y un componente UI reutilizable (`TimeSlotChipInput`).
- No se tocaron `MonthDetailView`, `BlockSpacesModal` ni `BookAppointmentModal` (Ronda 2B). El modal no está montado en ninguna página todavía: queda listo para que 2B lo abra desde el detalle del mes.
- Ningún endpoint ni regla de servidor cambió. La validación espejo reutiliza `normalizeAvailabilityConfig` de `lib/availability/rules-validation.ts`; no se duplicó ninguna regla.
- Estado: T040-T046 implementadas, verificadas por ejecución (pruebas dirigidas y smoke de render) y por análisis estático (tsc, ESLint). Pendiente de aceptación visual del owner y de T047/T054 (2B).

## 2. Archivos

Nuevos:

- `hooks/admin/months/useAvailabilityEditor.ts` (T041): borrador, validación espejo, detección de cambios, carga y descarte.
- `hooks/admin/months/useAvailabilitySave.ts` (T042): preview, diálogo de citas afectadas (estado), guardado con `sileo.promise`.
- `components/admin/months/availability/AvailabilityParamsFields.tsx` (compartido por T043 y T044; evita duplicar separación, capacidad y máximo por día).
- `components/admin/months/availability/AvailabilityRuleForm.tsx` (T043).
- `components/admin/months/availability/AvailabilityExceptionForm.tsx` (T044).
- `components/admin/months/availability/AvailabilityEditorModal.tsx` (T046; presentacional).
- `components/admin/ui/TimeSlotChipInput.tsx` (T045; reutilizable, documentar en `docs/ui/admin/components.md` en T076).
- `tests/lib/admin/months-availability-api-client.test.ts` (7 pruebas).
- `tests/hooks/admin/months/use-availability-editor.test.ts` (11 pruebas).
- `tests/hooks/admin/months/use-availability-save.test.ts` (7 pruebas).
- `tests/components/admin/ui/time-slot-chip-input.test.tsx` (2 pruebas).
- `tests/components/admin/months/availability-editor-modal.test.tsx` (smoke de render, 1 prueba).

Modificados:

- `lib/admin/months/api-client.ts` (T040): nuevas `fetchAdminMonthAvailability`, `previewAdminMonthAvailability` (POST), `saveAdminMonthAvailability` (PUT); clase `AdminMonthApiError` (message = código; lleva `affectedAppointments` en el 409); `updateAdminMonthSlotMode(month, slotMode, options?)` envía `expectedVersion` (solo si se pasa) y `confirmAffectedAppointments` (default `false`).
- `locales/es/admin.json` y `locales/en/admin.json`: solo se añadió el bloque `monthsDetail.availability` (152 líneas insertadas, 0 eliminadas).
- `specs/003-flexible-month-availability/tasks.md`: marcadas [X] T040-T046.

No modificados, por alcance: `docs/**`, base de datos, `.env`, Prisma, rutas de `app/api`, `lib/admin/months/service.ts`.

## 3. Qué hace cada pieza

**api-client (T040).** `updateAdminMonthSlotMode` es compatible hacia atrás: `MonthDetailView` (2B) lo llama con dos argumentos, y así sigue funcionando igual que antes. Los nuevos parámetros son opcionales.

**useAvailabilityEditor (T041).**
- `open()` carga `GET .../availability`, rellena el borrador con claves locales (`key`, que nunca se envían) y guarda una instantánea JSON para detectar cambios.
- `validateAvailabilityDraft` llama al motor (`normalizeAvailabilityConfig`) por ítem para errores de regla o excepción (rango fuera del mes, hora `00:00` según D55, separación, máximo, días, horas). Los traslapes de reglas (`AVAILABILITY_RULE_OVERLAP`) y las fechas duplicadas de excepción (`AVAILABILITY_EXCEPTION_DATE_DUPLICATE`) solo se comprueban sobre el conjunto completo, cuando todos los ítems son válidos.
- Nueva regla: rango = mes completo, lunes a viernes, horas y parámetros de D6 (`DEFAULT_DAY_RULE`). Nueva excepción: fecha = día 1 del mes, horas vacías, `minGapMinutes` 240, `preserveCapacity` true, `maxPerDay` 3 (D10/A2). Ver decisiones pendientes.
- `usesDefaultRule` = sin reglas (D6/D17).
- `requestClose()` pide confirmación si hay cambios sin guardar; `keepEditing()` la cancela; `close()` descarta el borrador y aborta la carga en vuelo.
- `resolveAvailabilityErrorKey(code)` mapea códigos `AVAILABILITY_*`, `MONTH_*`, `AFFECTED_*` y `VALIDATION_ERROR` a claves `monthsDetail.availability.errors.*`; cualquier otro código cae en `errors.unknown`.

**useAvailabilitySave (T042).**
- `requestSave()`: si el borrador no tiene versión cargada no hace nada. Si no, llama a `preview`. Si hay citas afectadas, abre el estado de confirmación (`isConfirmOpen`, `affectedAppointments`) y no escribe. Si no hay, llama a `persist(false)`. Un fallo del preview muestra `sileo.error` con descripción por código.
- `persist(confirm)`: `PUT` dentro de `sileo.promise` (loading, success, error con `description` por código). Si el servidor responde 409 `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` (carrera entre preview y guardado), no hay toast de éxito: se abre la confirmación con la lista del cuerpo 409. `AVAILABILITY_VERSION_CONFLICT` muestra el mensaje "cierra el editor y ábrelo de nuevo" (no hay acción de recarga in situ).
- Éxito: `onSaved(response)` y después `onClose()`.
- `confirmSave()` envía `confirmAffectedAppointments: true`. `cancelConfirm()` cierra sin escribir.

**TimeSlotChipInput (T045).** Input `type="time"` (el navegador entrega siempre `HH:mm`), botón Agregar, Enter agrega. Mantiene orden ascendente y sin repetidos. Cada chip tiene botón Quitar con `aria-label` "Quitar hora HH:mm". No valida reglas de dominio: `00:00` y el límite de 24 horas los rechaza el motor en el hook.

**AvailabilityRuleForm (T043).** Fechas (`type="date"`, `min`/`max` = límites del mes), días ISO 1-7 como botones `aria-pressed` (lunes = 1), horas con `TimeSlotChipInput`, y `AvailabilityParamsFields`. Muestra el error por código del ítem.

**AvailabilityExceptionForm (T044).** Fecha dentro del mes, horas con `TimeSlotChipInput`, aviso visible "Sin horas: este día quedará cerrado." cuando la lista está vacía, y `AvailabilityParamsFields`.

**AvailabilityParamsFields (compartido).** `Input` numérico (`minGapMinutes`, 0-1440; campo vacío = NaN, que el motor rechaza y que bloquea el guardado), `Select` de 1 a 6 (`maxPerDay`) y `Switch` (`preserveCapacity`).

**AvailabilityEditorModal (T046).** `BottomSheetModal` con `disableClose` mientras guarda. Presentacional: recibe `editor` y `save`. Muestra aviso D6, secciones de reglas y excepciones, errores de conjunto, un bloque mínimo de citas afectadas (ver limitaciones), bloque de descarte, y botones Cancelar y Guardar. Guardar está deshabilitado sin cambios, con errores o con confirmación abierta.

## 4. Diseño estático (revisado sin ejecutar)

- Reglas de dominio solo en el motor (`lib/availability/rules-validation.ts`, `lib/availability/defaults.ts`). El hook las invoca; no hay copia.
- Componentes sin lógica de estado compleja: el estado vive en los dos hooks; los componentes solo leen y llaman acciones.
- Textos: todo en `t()` con claves `monthsDetail.availability.*`. `lint:admin-i18n` confirma que no hay texto JSX literal.
- Tokens: solo variables `--admin-*`, `--error` (ya usada por `Input`) y clases de los componentes UI. No se introdujo ningún color hexadecimal.
- Notificaciones: solo `sileo` (`promise`, `error`), textos vía `react-i18next`. No se introdujo ninguna librería de toast.
- Contrato API: el cuerpo de PUT y preview es exactamente el de `contracts/admin-availability-api.md` (`rules`, `exceptions`, `expectedVersion`, `confirmAffectedAppointments`). El preview no envía `expectedVersion`.
- El hook no envía `id` ni `key` al servidor (se eliminan en `pickRuleBody` y `pickExceptionBody`).

## 5. Ejecutado

| Comando | Resultado |
|---|---|
| `npx vitest run tests/lib/admin/months-availability-api-client.test.ts tests/hooks/admin/months/use-availability-editor.test.ts tests/hooks/admin/months/use-availability-save.test.ts tests/components/admin/ui/time-slot-chip-input.test.tsx tests/components/admin/months/availability-editor-modal.test.tsx` | 5 archivos, 28 pruebas, todas en verde |
| `npx vitest run` sobre todos los tests que mockean `lib/admin/months/api-client` (incluye `use-months-catalog.test.ts` y tres de los nuevos) | 4 archivos, 40 pruebas en verde |
| `npx tsc --noEmit` | 32 errores, idéntico a la línea base de antes de editar (todos en `tests/`, preexistentes). Diff de líneas de error: sin diferencias. Dos errores míos de tipos en pruebas aparecieron en una primera pasada y se corrigieron. |
| `npx eslint` sobre los archivos tocados (api-client, hooks, componentes de availability, TimeSlotChipInput, tests nuevos) | código 0 |
| `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` (no tocado) |

Notas sobre la ejecución:
- Las pruebas no tocan base de datos: el cliente API y el cliente de `sileo` están mockeados. No se ejecutó ninguna prueba de integración.
- No se ejecutó la suite completa (`npm test`). Se ejecutaron las pruebas dirigidas y las que dependen de la misma API.
- Comando de pruebas: el perfil dice que `{{test_commands}}` está en `CLAUDE.md`, sección "Commands", pero esa sección no existe (`CLAUDE.md` solo importa `AGENTS.md`). Usé `npx vitest run <archivo>`, que es lo que indica `package.json`.

## 6. Claves i18n añadidas (`monthsDetail.availability`, es y en: 23 claves de primer nivel, 57 hojas)

- Primer nivel: `title`, `close`, `loading`, `loadFailed`, `retry`, `defaultRuleNotice`, `rulesSection`, `rulesEmpty`, `exceptionsSection`, `exceptionsEmpty`, `closedDayNotice`, `addRule`, `addException`, `removeItem`, `save`, `saving`, `cancel`.
- `discard`: `title`, `description`, `confirm`, `keep`.
- `affected` (bloque provisional, lo reemplaza T047): `title`, `description` (usa `{{total}}`), `confirm`, `back`.
- `fields`: `startDate`, `endDate`, `date`, `weekdays`, `times`, `addTime`, `removeTime`, `minGap`, `maxPerDay`, `preserveCapacity`.
- `weekdays`: `1` a `7` (abreviaturas Lun...Dom / Mon...Sun).
- `notifications`: `saveLoading`, `saveSuccess`, `saveError`.
- `errors`: `unknown`, `invalidRequest`, `monthNotRegistered`, `monthInPast`, `versionConflict`, `affectedConfirmationRequired`, `rangeOutsideMonth`, `rangeInvalid`, `ruleOverlap`, `weekdaysRequired`, `timesRequired`, `timeInvalid`, `minGapOutOfRange`, `maxPerDayOutOfRange`, `timesLimitExceeded`, `exceptionDateDuplicate`, `exceptionDateOutsideMonth`.

Verificado: todas las claves usadas existen en ambos idiomas (se comprobó con un script sobre los archivos de código y sobre el mapa de errores).

## 7. Checks requeridos por AGENTS

```text
Admin UI Check:
- Uses components/admin/ui: Yes (BottomSheetModal, Button, Card, Input, Select, Switch, AdminIcon; TimeSlotChipInput nuevo)
- Reused existing components: Yes
- New reusable components created: Yes (components/admin/ui/TimeSlotChipInput.tsx; pendiente de documentar en docs/ui/admin/components.md en T076)
- Tokens respected: Yes (solo variables --admin-* y --error; sin hexadecimales nuevos)
- design-system.md aligned: No verificado en esta ronda (se revisó tokens.md; design-system.md no se leyó). Pendiente de revisión.
- Public flow untouched: Yes (no se tocó ningún archivo del flujo público)
```

```text
Notification Contract Check:
- Sileo used for success/warning/error/info: Yes (sileo.promise con success/error; sileo.error para fallo de preview)
- Sileo action notifications used when applicable: No aplica (no hay acción en notificaciones)
- Sileo promise notifications used when applicable: Yes
- i18n applied in admin notifications: Yes
- Alternative notification systems introduced: No
```

```text
Documentation Impact:
- Yes (el editor cambia el flujo funcional de disponibilidad)
- docs/specification.md: NO actualizado en esta ronda (el brief excluye docs; T076 reconcilia docs/ui/**, docs/features/* y 15.1.4/15.7)
- Secciones que deben actualizarse en T076: flujo de edición de reglas y excepciones, validaciones por paso, estados del editor, confirmación de citas afectadas (D18), textos de error por código.
- components.md: TimeSlotChipInput a documentar (regla de promoción).
```

```text
Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Sí, y se mantiene (updateAdminMonthSlotMode conserva la firma de dos argumentos)
- Rollback strategy defined: No aplica (sin cambios de BD ni de API en esta ronda)
- Cleanup phase defined: No aplica en esta ronda
- Integrity protections defined: No aplica en esta ronda (las protecciones de servidor ya existen en Fase 1)
```

## 8. Pendiente de aceptación del owner (manual, no verificado)

- Revisión visual en navegador con sesión admin: disposición del bottom sheet en móvil y escritorio, chips de horas, días, avisos y botones.
- Flujo real contra la API con datos: crear regla, crear excepción de día cerrado, guardar, descartar, versión en conflicto, citas afectadas.
- Textos en español e inglés: redacción de los mensajes de error y de los avisos.
- Decisiones de producto de la sección 9.
- Aceptación de diseño de la aplicación de tokens y de `design-system.md`.

## 9. Decisiones de producto pendientes (no decididas aquí)

1. Horas por defecto de una excepción nueva. Implementado: lista vacía, es decir día cerrado, con aviso visible. Alternativa: las horas de D6. Decisión del owner.
2. Valores por defecto de una regla nueva. Implementado: mes completo, lunes a viernes, horas y parámetros de D6. No hay decisión documentada para estos valores; confirmar.
3. Conflicto de versión. El mensaje pide cerrar y reabrir el editor. No hay acción "recargar" in situ. Confirmar si basta.
4. Descarte con cambios. Implementado como tarjeta inline (no como segundo diálogo). Confirmar la forma.
5. Bloque provisional de citas afectadas. Está dentro de `AvailabilityEditorModal` mientras no exista T047. Se sustituye en 2B; confirmar que es aceptable como estado intermedio.

## 10. Limitaciones, fallos y hallazgos

- **Riesgo de compatibilidad (NB-7, D79).** `MonthDetailView` (2B) sigue llamando a `updateAdminMonthSlotMode(month, slotMode)` sin confirmación. Con citas afectadas, el servidor responde 409, igual que antes de esta ronda. Esta ronda no cambia ese comportamiento. No desplegar Fase 1 sin Fase 2, como indica la spec.
- **Modal no montado.** El modal no aparece en ninguna página. Para usarlo, 2B debe llamar a `useAvailabilityEditor(month)` y `useAvailabilitySave({...})` en el contenedor y pasar ambos objetos a `AvailabilityEditorModal`. Los hooks no se llaman dentro del modal para que el componente siga siendo presentacional.
- **Desviación del brief.** T046 menciona `ListItem`. No se usó: las acciones de agregar son `Button`.
- **Cobertura de render.** El smoke de render cubre el modal, la regla y la excepción, el aviso D6, el aviso de día cerrado y el descarte. No cubre el bloque de citas afectadas ni el flujo de guardado completo en UI; ambos están cubiertos a nivel de hook. Las pruebas completas de render son T054 (2B).
- **Errores de `sileo.promise`.** Si `onSaved` lanza una excepción, el error sale por el manejador del botón. El contenedor debe evitar lanzar.
- **Duplicado de etiqueta accesible (fuera de alcance).** `components/admin/ui/BottomSheetModal.tsx` pone el mismo `aria-label` en el botón de overlay y en la X del encabezado. Ambos llaman a `onClose`. Se afecta el nombre accesible, no el comportamiento. No se tocó el componente compartido; el smoke usa `getAllByRole(...)[0]`. Proponer el arreglo al Orchestrator.
- **Versión no cargada.** `requestSave` no hace nada si `expectedVersion` es `null`. El formulario solo se muestra después de una carga correcta, así que en la UI no se llega a ese caso; el guardado no informa al usuario en esa situación.
- **Límites conocidos.** `minGapMinutes` vacío se guarda como `NaN` en el borrador (el motor lo rechaza y el botón Guardar queda deshabilitado). No se validó contra un servidor real.
- **Warning preexistente** en `hooks/admin/useReminderAppointments.ts` (variable sin uso). No tocado.

## 11. Handoff

- **Hecho:** T040-T046 (ver sección 2), 28 pruebas nuevas en 5 archivos en verde, regresión dirigida de los tests que mockean el mismo `api-client` (4 archivos, 40 pruebas, incluye las nuevas) en verde, tsc sin errores nuevos, ESLint y lint i18n en verde, `tasks.md` con T040-T046 marcadas.
- **Pendiente en esta ronda:** aceptación visual del owner; decisiones de la sección 9; `design-system.md` no verificado; documentación en T076 y spec en T075/T076.
- **Pendiente de otras rondas:** T047 (`AffectedAppointmentsDialog`, reemplaza el bloque provisional), T048 (montaje en `MonthDetailView`), T054 (pruebas de render completas), T053 (textos restantes de 2B).
- **Archivos tocados por esta ronda:** los de la sección 2.
- **Siguiente paso:** el Orchestrator revisa este informe y decide las preguntas de la sección 9. Después, la Ronda 2B puede montar el modal y reemplazar el bloque provisional por T047.
