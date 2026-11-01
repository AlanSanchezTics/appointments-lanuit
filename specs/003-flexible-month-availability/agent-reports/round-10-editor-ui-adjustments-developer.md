# Ronda 10 (ajustes visuales del editor de disponibilidad) - Developer

**Spec**: 003-flexible-month-availability | **Lane**: micro-cambio UI admin (sin tareas de tasks.md) | **Rama**: `003-flexible-month-availability` | **Commits**: ninguno

Rutas relativas a la raíz del repositorio. Sin cambios de servidor, API, esquema, BD ni `.env`. No se usó speckit-implement.

## 1. Resumen

- Ajustes de UI y copy pedidos por el owner tras revisar en móvil, sobre el editor de disponibilidad (Ronda 2A).
- Cambios implementados: fechas en filas independientes, campo de horas con selects (hora, minutos, AM/PM) en formato 12 h, botón "+" primario solo icono, separación y máximo en filas independientes, tooltip de ayuda en "Conservar capacidad" (nuevo componente `Tooltip`).
- Valores internos, estado, `useAvailabilityEditor` y contrato con el servidor sin cambios: siguen siendo `HH:mm` (24 h).
- Actualización posterior (autorizada por el coordinador): `Switch` admite la prop opcional `labelAdornment`, y el icono de ayuda de "Conservar capacidad" queda junto a la etiqueta. Ver sección 12.
- Lo de la sección 9 (decisión 1) queda resuelto por esa autorización.
- Estado: implementado y verificado por ejecución de pruebas dirigidas y análisis estático. Pendiente la revisión visual en navegador a 375 px (owner).

## 2. Archivos

Nuevos:

- `components/admin/ui/Tooltip.tsx`: disparador de icono `info` (`AdminIcon`, `adminIcons.info`) con globo `role="tooltip"` enlazado por `aria-describedby`. Abre con foco, clic/tap o puntero; cierra con blur, Escape o salida del puntero. Tokens del admin (`--admin-surface`, `--admin-border`, `--admin-text-primary`, `shadow-sm`). Sin colores hexadecimales. Documentar en `docs/ui/admin/components.md` en T076 (regla de promoción).
- `tests/components/admin/ui/tooltip.test.tsx` (3 pruebas).
- `tests/components/admin/ui/switch.test.tsx` (2 pruebas, añadido tras la autorización).
- `tests/components/admin/months/availability-params-fields.test.tsx` (2 pruebas).

Modificados:

- `components/admin/ui/TimeSlotChipInput.tsx` (reescrito en su interfaz visual; mismas props públicas salvo lo indicado abajo).
- `components/admin/months/availability/AvailabilityParamsFields.tsx`: separación mínima y máximo en filas independientes; "Conservar capacidad" con `Switch` y `labelAdornment` = `Tooltip` (`align="center"`).
- `components/admin/ui/Switch.tsx` (autorizado tras el primer informe): prop opcional `labelAdornment?: ReactNode`. Si no se pasa, el DOM es idéntico al anterior (la `<label>` sigue como hijo directo de la raíz). Si se pasa, `label` y el adorno van en un `<span class="flex min-w-0 items-center gap-1.5">` fuera de la `<label>`, así que usar el adorno no alterna el switch. Los otros usos (`MonthsCatalogView`) no cambian.
- `components/admin/ui/Tooltip.tsx` (ajuste posterior): `align` acepta `"start" | "center" | "end"` (por defecto `"end"`); el globo mide `w-56` (224 px) para caber a 375 px cuando va junto a la etiqueta.
- `components/admin/months/availability/AvailabilityRuleForm.tsx`: "Desde" y "Hasta" en filas independientes (`grid-cols-2` a `flex-col`). Sin cambios en `AvailabilityExceptionForm.tsx`, que hereda los cambios de `TimeSlotChipInput` y `AvailabilityParamsFields`.
- `locales/es/admin.json` y `locales/en/admin.json`: solo claves de `monthsDetail.availability` (ver sección 5).
- `tests/components/admin/ui/time-slot-chip-input.test.tsx`: reescrito (6 pruebas, antes 2).
- `tests/components/admin/months/availability-editor.test.tsx`: una línea (`"09:00"` a `"9:00 AM"`, el chip ya no muestra 24 h).

No tocados: `hooks/admin/months/useAvailabilityEditor.ts` (no fue necesario), `components/admin/ui/Switch.tsx`, `admin-icons.ts`, `docs/**`, `tasks.md`.

## 3. Qué cambió en cada ajuste

1. **Fechas.** "Desde" y "Hasta" pasan de dos columnas a filas apiladas. Los inputs ya son `w-full`. Verificación de no desborde a 375 px: solo estática (ver sección 7).
2. **Horas.**
   - a. Etiqueta "Horas" a "Horario" (es) y "Schedule" (en).
   - b. El botón "Agregar hora" es ahora `Button` variante `primary`, tamaño `sm`, cuadrado de 44 px (`h-11 w-11`), solo con icono `faPlus` de FontAwesome. Su nombre accesible es `aria-label` = `fields.addTime` ("Agregar hora" / "Add time"). Se importa `faPlus` directamente porque `admin-icons.ts` no tiene plus y ese archivo no está en la lista autorizada (ver sección 9, decisión 2).
   - c. (Sustituido en la sección 13: ya no hay selects; ahora un único `Input` nativo `type="time"`.) El botón "+" se habilita solo con un valor. Enter añade la hora.
   - Presentación en chips y en el aria-label de quitar: `H:mm AM|PM`. Ejemplos: "9:00 AM", "1:00 PM", "12:30 PM", "12:00 AM". En en-locale igual (AM/PM).
   - Conversión: 12 AM = `00:xx`, 12 PM = `12:xx`, resto a 24 h. El valor emitido siempre es `HH:mm`. `00:00` sigue inválido: lo rechaza el motor en `useAvailabilityEditor` (error `AVAILABILITY_TIME_INVALID`). Orden ascendente por valor 24 h y sin repetidos, como antes.
   - Aria-label de quitar: `"Quitar hora 9:00 AM"`.
3. **Separación mínima y máximo** en filas independientes (`flex-col`).
4. **Conservar capacidad.** Icono de información con tooltip. Redacción ajustada al comportamiento real del motor (`lib/availability/capacity-engine.ts`, `docs/architecture/business-rules.md` línea 80 y 726). La propuesta del brief ("acomoda las citas... aprovecha la mayor cantidad de horarios") no es fiel: el motor no reubica citas, solo decide qué horas se ofrecen. Texto final:
   - es: "Si está activada, una hora solo se ofrece cuando reservarla no reduce cuántas citas más caben ese día. Si está desactivada, solo se aplican la separación mínima y el máximo de citas por día."
   - en: "When on, a time is offered only if booking it does not reduce how many more appointments fit that day. When off, only the minimum gap and the maximum appointments per day apply."
   - Nombre accesible del disparador: "Ayuda: conservar capacidad" / "Help: preserve capacity".

Otros cambios de copy de la misma sección de locales:

- `errors.timeInvalid` ya no menciona `HH:mm` (el usuario ya no escribe 24 h): es "Hay una hora no válida. 12:00 AM no se puede usar." / "One time is not valid. 12:00 AM cannot be used."
- Claves nuevas: `fields.hour`, `fields.minute`, `fields.period`, `fields.preserveCapacityHelpLabel`, `fields.preserveCapacityHelp`, y el bloque `periods` (`am`, `pm` = "AM"/"PM" en ambos idiomas).

## 4. Diseño estático

- Ninguna regla de dominio nueva en UI. La validación sigue en el motor vía el hook.
- Estado de UI: un `useState` en `TimeSlotChipInput` (borrador de hora) y uno en `Tooltip` (abierto/cerrado). Son estado local de presentación de componentes UI, como ya ocurría en `TimeSlotChipInput` y `BottomSheetModal`. No se extrajeron a `hooks/`. Si el owner quiere la regla estricta de AGENTS, se mueven a `hooks/shared/` en una ronda posterior.
- Helpers `toTime24`/`splitTime24`: conversión pura de presentación, dentro del componente. No son lógica de negocio.
- `TimeSlotChipInput` usa `useTranslation("admin")` directamente, igual que `Input` y `Select`. Las claves son de `monthsDetail.availability.*`, así que el componente queda acoplado a esa feature. Si se reutiliza fuera, las claves de periodo y de campos deben pasar a `common` (T076).
- `Select` ignora la prop `id` (no la reenvía al `<select>`) y acepta `aria-label`, que sí se reenvía. Por eso los selects llevan `aria-label` con su nombre visible.
- Tokens: solo variables `--admin-*`, `--error` (ya usada) y clases de componentes UI. Medidas nuevas: `w-64`, `max-w-[calc(100vw-2rem)]`, `h-6 w-6`, `h-11 w-11` (solo tamaños).
- Flujo público no tocado.

## 5. Ejecutado

| Comando | Resultado |
|---|---|
| `node -e` (lectura de `locales/{es,en}/admin.json`) | JSON válido; `fields.times` = "Horario"/"Schedule"; `periods` presente en ambos idiomas |
| `npx vitest run` sobre `time-slot-chip-input`, `tooltip`, `availability-params-fields`, `availability-editor-modal`, `availability-editor`, `availability-affected-dialog` y `tests/hooks/admin/months` | 10 archivos, 52 pruebas en verde, 1 fallo: `useRescheduleWhatsappAction` (línea base) |
| `npx vitest run tests/components/admin tests/hooks/admin/months` (suite completa de estos directorios) | 26 archivos, 121 pruebas: 116 en verde, 5 fallos. Los 5 están en la línea base: `ClientsCatalogView`, `AppointmentLogsView`, `ReminderAppointmentsCard` (3 preexistentes), `MonthDetailView > disables schedule CTA when month is inactive`, `useRescheduleWhatsappAction`. Ningún fallo nuevo |
| `npx tsc --noEmit` | 32 errores, igual que la línea base, todos en `tests/`. Ninguno en archivos tocados (filtro por nombres: sin coincidencias) |
| `npx eslint` sobre los archivos tocados (componentes, pruebas) | exit 0 |
| `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` (no tocado) |

Pruebas actualizadas o nuevas (qué verifican):

- `time-slot-chip-input.test.tsx`:
  - Chip muestra "9:00 AM" y el valor emitido es `"09:00"`.
  - PM y mediodía: "1:30 PM" emite `13:30`; "12:15 PM" emite `12:15`; orden por valor 24 h.
  - 12 AM emite `00:00` (el motor lo rechaza después).
  - Sin repetidos; botón deshabilitado hasta elegir los tres campos.
  - Botón "+" sin texto, con nombre accesible "Agregar hora" y con SVG.
  - Enter añade; quitar por nombre "Quitar hora 9:00 AM".
- `tooltip.test.tsx`: descrito por `aria-describedby` y oculto hasta abrir; abre con foco, cierra con blur o Escape; abre con clic.
- `availability-params-fields.test.tsx`: el disparador "Ayuda: conservar capacidad" muestra el texto; el interruptor sigue emitiendo `preserveCapacity`.

## 6. Admin UI Check

```text
Admin UI Check:
- Uses components/admin/ui: Yes (Select, Button, Switch, Input, Tooltip, AdminIcon)
- Reused existing components: Yes (Select, Button, Switch, Input, AdminIcon; el helper de tooltip no existía)
- New reusable components created: Yes (components/admin/ui/Tooltip.tsx; documentar en docs/ui/admin/components.md en T076)
- Tokens respected: Yes (variables --admin-* y --error; shadow-sm; sin hexadecimales nuevos)
- design-system.md aligned: No verificado en esta ronda (no se leyó design-system.md; revisión en T076)
- Public flow untouched: Yes
```

```text
Notification Contract Check:
- Sileo used for success/warning/error/info: No aplica (sin notificaciones nuevas ni cambiadas)
- Sileo action notifications used when applicable: No aplica
- Sileo promise notifications used when applicable: No aplica
- i18n applied in admin notifications: No aplica
- Alternative notification systems introduced: No
```

## 7. Documentation Impact

```text
Documentation Impact:
- Yes (cambia la forma en que el usuario escribe y ve las horas, el texto de error de hora y la ayuda de capacidad)
- docs/specification.md: NO actualizado en esta ronda (fuera del alcance del micro-cambio)
- Secciones que deben actualizarse en T076: consideraciones de UI del editor de disponibilidad (entrada de horas en 12 h con AM/PM, etiqueta "Horario", botón "+" icono); texto de error de hora; ayuda de "Conservar capacidad"; orden de campos de fechas y de separación/máximo
- docs/ui/admin/components.md: documentar Tooltip y TimeSlotChipInput (regla de promoción)
- docs/ui/admin/design-system.md: revisar en T076 (no verificado aquí)
```

```text
Flow Contract Check:
- UI steps updated: Yes (pasos visuales de entrada de horas y campos; sin cambio de orden de pasos)
- API contract updated: No (no cambió ningún endpoint ni payload)
- Validation rules updated: No (solo el texto de `timeInvalid`; la regla es la misma)
- Acceptance criteria updated: No (T076)
- docs/specification.md aligned: No (pendiente T076)
```

```text
Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Sí, y se mantiene (los valores siguen siendo HH:mm; el contrato no cambia)
- Rollback strategy defined: No aplica (solo UI; revertir el commit restaura el comportamiento anterior)
- Cleanup phase defined: No aplica
- Integrity protections defined: No aplica (las reglas del servidor no cambiaron)
```

## 8. Pendiente

Pendiente del owner (validación manual en navegador, no verificada aquí):

- Revisión a 375 px y escritorio: que "Desde"/"Hasta" y "Separación"/"Máximo" no desborden; que los tres selects y el botón "+" quepan en una fila; que el globo de "Conservar capacidad" no se salga de la tarjeta.
- Tap en móvil: el tooltip abre con tap y cierra al tocar fuera. El comportamiento de eventos de puntero emulados solo se ha revisado en pruebas con jsdom.
- Lectura en español e inglés de la ayuda de capacidad y del aviso de 12:00 AM.

Pendiente de otras rondas: T076 (documentación: `components.md`, `design-system.md`, spec, feature docs), decisiones de la ronda 2A (sección 9 del informe 2A).

## 9. Decisiones y desviaciones que necesitan al Orchestrator

1. **Resuelta.** El icono de ayuda de "Conservar capacidad" va junto a la etiqueta mediante `Switch.labelAdornment` (autorizado por el owner, ver sección 12).
2. **Icono "+".** `admin-icons.ts` no tiene `faPlus`. Se importó de FontAwesome directamente (mismo patrón que `Select.tsx`). Si se quiere todo el iconario en un solo sitio, añadir `plus: faPlus` a `admin-icons.ts` (fuera de lista).
3. **Texto de ayuda.** Redactado según el motor real (sección 3, punto 4), no según la propuesta del brief, que describía un reacomodo de citas que el motor no hace. Confirmar redacción con el owner.
4. **Resuelta en la sección 13.** Se usa un único `type="time"` nativo; el formato 12/24 h del control lo decide el dispositivo.

## 10. Limitaciones

- La revisión de layout a 375 px es solo estática: no se ejecutó ningún navegador.
- Las pruebas usan jsdom: no comprueban layout ni el comportamiento de tap real.
- `TimeSlotChipInput` pasa `id` al input nativo (vía `Input`), así que la asociación con su etiqueta es directa.
- El diff de `locales/*.json` incluye también las claves de rondas anteriores (el editor está sin commit).
- Ningún commit. No se marcó nada en `tasks.md`.

## 11. Handoff

- **Hecho:** ajustes 1 a 4 de la lista del owner, incluido el icono junto a la etiqueta de "Conservar capacidad" (sección 12). Pruebas dirigidas y de suite en verde salvo los 5 fallos de la línea base. `tsc` igual a la línea base. ESLint y lint i18n sin errores nuevos.
- **Pendiente:** validación visual del owner (sección 8); decisión 2 (icono "+" en `admin-icons.ts`) si el owner la quiere; T076 para documentación.
- **Archivos tocados:** los de la sección 2.
- **Siguiente paso:** el Orchestrator decide sobre las decisiones 2 a 5 de la sección 9.

## 12. Actualización tras autorización de Switch.tsx

Autorización del owner (vía coordinador): editar `components/admin/ui/Switch.tsx` y sus pruebas, y mover el Tooltip de "Conservar capacidad" junto a la etiqueta.

Cambios:
- `components/admin/ui/Switch.tsx`: prop opcional aditiva `labelAdornment?: ReactNode`, renderizada junto a la `<label>` fuera de ella. Sin la prop, el marcado no cambia.
- `components/admin/ui/Tooltip.tsx`: `align` `"start" | "center" | "end"`; globo `w-56`.
- `components/admin/months/availability/AvailabilityParamsFields.tsx`: el `Tooltip` (`align="center"`) se pasa como `labelAdornment` del `Switch`; se quitó la fila contenedora anterior.
- `tests/components/admin/ui/switch.test.tsx` (nuevo, 2 pruebas): sin adorno, el marcado y el alternar son los de antes; con adorno, el adorno no alterna el switch y el switch sigue funcionando.

Ejecutado tras el cambio:

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin tests/hooks/admin/months` | 27 archivos, 123 pruebas: 118 en verde, 5 fallos, todos de la línea base (ClientsCatalogView, AppointmentLogsView, ReminderAppointmentsCard, MonthDetailView "disables schedule CTA when month is inactive", useRescheduleWhatsappAction). Ningún fallo nuevo |
| `npx tsc --noEmit` | 32 errores (línea base), ninguno en archivos tocados |
| `npx eslint` sobre archivos tocados (Switch, Tooltip, TimeSlotChipInput, AvailabilityParamsFields, pruebas) | exit 0 |
| `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente (`hooks/admin/useReminderAppointments.ts`) |

Pendiente del owner: comprobar en navegador a 375 px que el icono junto a "Conservar capacidad" y el globo caben sin desborde (la verificación de layout sigue siendo solo estática).

Sin commits. No se usó Reviewer.

## 13. Segunda ronda de ajustes del owner (validación móvil 375 px)

Esta sección reemplaza lo que contradiga las secciones 2 a 11 (en particular: selects de hora, minutos y AM/PM; la lista de claves `fields.hour|minute|period`; y la sección 9, decisión 4).

Ajustes pedidos y estado:

1. **Datepickers "Desde"/"Hasta" desbordados.** Causa probable: el `input type="date"` nativo tiene un ancho intrínseco mínimo (sobre todo en iOS) que supera el 100% del contenedor. Cambio: `className="min-w-0 max-w-full"` en los dos inputs de fecha de la regla y en el de la excepción; las tarjetas de regla y excepción llevan `min-w-0`. No se usó `appearance:none`, para no quitar el indicador de calendario en algunos navegadores. Verificación: solo estática. Pendiente el owner en iOS y Android a 375 px.
2. **Horario: un solo campo.** `TimeSlotChipInput` usa un único `Input` (`components/admin/ui/Input.tsx`) con `type="time"`, más el botón "+" (primario, solo icono). Valor interno y emitido: `HH:mm` (24 h). Enter añade. Orden ascendente por valor 24 h, sin repetidos, `00:00` sigue inválido (lo rechaza el motor).
   - **Formato del control nativo.** Lo decide el dispositivo y el idioma del sistema (en algunos será 12 h con AM/PM y en otros 24 h). La app no lo fuerza. Los chips siguen en 12 h: "9:00 AM", "12:00 AM" para `00:00`.
   - Claves i18n retiradas (ya sin uso, comprobado con grep): `monthsDetail.availability.fields.hour`, `fields.minute`, `fields.period`. Se conserva `monthsDetail.availability.periods` (am/pm), porque el formateo de chips lo usa.
3. **Gap uniforme `gap-2`.** Tarjeta de regla, tarjeta de excepción, grupo de fechas y `AvailabilityParamsFields` ahora usan `gap-2`. El grupo de días y el de horario ya lo usaban. No se tocó el espaciado de `AvailabilityEditorModal` (secciones de reglas/excepciones con `gap-3`); si se quiere igualar, es un cambio de una línea en esa pieza.
4. **Chips en rejilla de 3 columnas.** `ul` con `grid grid-cols-3 gap-2`. Cada chip: `min-w-0`, texto `text-xs` con `truncate`, botón de quitar de 20 px (`h-5 w-5`), aria-label completo "Quitar hora 9:00 AM". El orden sigue ascendente. Verificación de ancho a 375 px: solo estática.

Archivos tocados en esta segunda ronda:
- `components/admin/ui/TimeSlotChipInput.tsx` (reescrito: un input nativo, sin selects).
- `components/admin/months/availability/AvailabilityRuleForm.tsx` (gap-2; `min-w-0`; className de inputs de fecha).
- `components/admin/months/availability/AvailabilityExceptionForm.tsx` (gap-2; `min-w-0`; className del input de fecha).
- `components/admin/months/availability/AvailabilityParamsFields.tsx` (`gap-2`).
- `locales/es/admin.json`, `locales/en/admin.json` (se quitan `fields.hour`, `fields.minute`, `fields.period`).
- `tests/components/admin/ui/time-slot-chip-input.test.tsx` (reescrito: 7 pruebas, un input, emite "09:00", chip "9:00 AM", 00:00, sin repetidos, botón "+" accesible, Enter, quitar, rejilla de 3 columnas).

Ejecutado (tras esta segunda ronda):

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin tests/hooks/admin/months` | 27 archivos, 124 pruebas: 119 verdes, 5 fallos de la línea base (ClientsCatalogView, AppointmentLogsView, ReminderAppointmentsCard, MonthDetailView "disables schedule CTA when month is inactive", useRescheduleWhatsappAction). Ningún fallo nuevo |
| `npx vitest run` de las 5 pruebas de availability/chip/switch/tooltip | 5 archivos, 18 pruebas en verde |
| `npx tsc --noEmit` | 32 errores (línea base), ninguno en archivos tocados |
| `npx eslint` sobre `components/admin/ui/{Switch,Tooltip,TimeSlotChipInput}.tsx`, `components/admin/months/availability/`, pruebas tocadas | exit 0 |
| `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente en `hooks/admin/useReminderAppointments.ts` |

Estático / ejecutado / pendiente:
- Estático: sin selects; un solo input nativo; `gap-2` uniforme en reglas, excepciones y parámetros; `min-w-0` y `max-w-full` en las fechas; rejilla de 3 columnas con `min-w-0` y `truncate`.
- Ejecutado: pruebas y comprobaciones de la tabla (jsdom; no miden layout ni formato del control nativo).
- Pendiente del owner (móvil real): que el input de fecha no se salga de la tarjeta en iOS y Android; que el control de hora se vea bien y el formato sea el que el dispositivo tenga configurado; que los chips no se desborden a 375 px.

Admin UI Check (segunda ronda):
- Uses components/admin/ui: Yes (Input, Button, AdminIcon, Card, Switch, Tooltip)
- Reused existing components: Yes (se retiró el uso de `Select` del chip input; `Select` sigue en el máximo por día)
- New reusable components created: No en esta ronda (Tooltip y el `labelAdornment` de Switch ya estaban en rondas anteriores)
- Tokens respected: Yes (sin hexadecimales)
- design-system.md aligned: No verificado (T076)
- Public flow untouched: Yes

Documentation Impact (segunda ronda): Yes (cambia la forma de entrada de horas y el espaciado del formulario). No se actualizó `docs/specification.md` (T076). En T076: documentar el control de hora nativo, su dependencia de dispositivo y los chips en 12 h; y en `components.md`, `TimeSlotChipInput` con un solo input.

Sin commits. No se usó Reviewer.

## 14. Tercera pasada: desbordes en iPhone (Safari iOS, 375 px)

Síntomas del owner: en una excepción, el input "Fecha" se sale de la tarjeta por la derecha; el input "Horario" (`type="time"`) se superpone al botón "+"; hay scroll horizontal en el modal.

Causa raíz (análisis): Safari iOS da a `input[type=date|time|datetime-local]` un ancho intrínseco con apariencia nativa, y `width:100%` no basta para contenerlo. Dentro de una columna flex o de un contenedor `flex` sin `min-w-0`, el hijo no se encoge por debajo de ese ancho mínimo. El `Input` compartido dibujaba esos tipos sin ninguna de estas salvaguardas. Por eso el fallo se repetía en cada uso de fecha u hora.

Cambios (arreglo en el componente compartido, no parches de ancho en los consumidores):

1. **`components/admin/ui/Input.tsx`, cambio aditivo solo para `date`, `time` y `datetime-local`.**
   - Input: `box-border block min-w-0 max-w-full appearance-none [-webkit-appearance:none]`.
   - Raíz y `<label>`: `min-w-0` (y `w-full` en la raíz). Otros tipos: marcado sin cambios.
   - Prueba nueva: `tests/components/admin/ui/input-date-time.test.tsx` (4 pruebas: las clases están en date/time/datetime-local y el padre tiene `min-w-0`; un input `text` no las tiene).
2. **`TimeSlotChipInput.tsx`.** Fila `flex items-start gap-2`; el wrapper del input es `min-w-0 flex-1`; el botón es `shrink-0`. El botón pasa de `h-11 w-11` a `h-14 w-14` para igualar la altura del input nativo (~56 px). Esto es una decisión de alineación mía; si el owner prefiere 44 px, es un cambio de una clase.
3. **`AvailabilityEditorModal.tsx`.** Gap entre secciones `gap-6` (raíz). Secciones de reglas y excepciones con `min-w-0`.
4. **Scroll horizontal.** Raíz del contenido del modal con `overflow-x-clip` (en vez de `overflow-x-hidden`). Motivo: `overflow-x-hidden` fuerza `overflow-y: auto`, lo que crea un scroller vertical y recorta la sombra inferior del botón primario. `overflow-x-clip` recorta solo el eje horizontal (soportado por Safari 16 y posteriores). `BottomSheetModal.tsx` no se tocó.
   - Sombra del botón primario (`--shadow-button`: `0 18px 28px` a 26 % de opacidad): hacia abajo no se recorta, porque el eje vertical no tiene clip. En horizontal, el halo de 28 px de desenfoque se recorta en el borde del contenido a la derecha del botón Guardar. Es cosmético y lo debe confirmar el owner en el dispositivo.

Verificación:
- **Estática únicamente.** No se ejecutó WebKit ni ningún navegador: el layout real de Safari iOS no se midió. Las pruebas de jsdom no miden layout. Pendiente: el owner prueba en el iPhone a 375 px: input de fecha dentro de la tarjeta, control de hora y botón "+" lado a lado, sin scroll horizontal, y el halo del botón Guardar.

Ejecutado:

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin tests/hooks/admin/months` | 28 archivos, 128 pruebas: 123 verdes; 5 fallos de la línea base (ClientsCatalogView, AppointmentLogsView, ReminderAppointmentsCard, MonthDetailView "disables schedule CTA when month is inactive", useRescheduleWhatsappAction). Ningún fallo nuevo |
| `npx tsc --noEmit` | 32 errores (línea base). Ninguno en los archivos tocados (los de `tests/e2e` e `tests/integration` son preexistentes) |
| `npx eslint` sobre `Input`, `TimeSlotChipInput`, `Switch`, `Tooltip`, `components/admin/months/availability`, pruebas tocadas | exit 0 |
| `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente (`hooks/admin/useReminderAppointments.ts`) |

Admin UI Check (tercera pasada):
- Uses components/admin/ui: Yes (Input, Button, Card, Switch, Tooltip)
- Reused existing components: Yes (cambio en `Input` compartido, no un componente nuevo)
- New reusable components created: No
- Tokens respected: Yes (sin hexadecimales; `--shadow-button` existente)
- design-system.md aligned: No verificado (T076)
- Public flow untouched: Yes

Documentation Impact (tercera pasada): Yes (comportamiento de layout del editor). Sin cambios en `docs/specification.md` (T076). Para `components.md` (T076): `Input` aplica contención específica para date/time en iOS.

Sin commits. No se usó Reviewer.

## 15. Espaciado entre grupos dentro de tarjetas de regla y excepción

El owner vio los grupos apretados (los chips casi tocaban la etiqueta de "Separación mínima"). La raíz del modal ya tenía `gap-6` (sección 14); el problema estaba dentro de cada tarjeta.

Contenedores cambiados de `gap-2` a `gap-6` (24 px) entre grupos:

- `AvailabilityRuleForm.tsx`
  - Tarjeta de regla (`Card`): entre Fechas, Días de la semana, Horario, Parámetros, error y botón Quitar.
  - Contenedor de Desde/Hasta: entre ambos campos (decisión mía: son dos campos y no una sola unidad).
- `AvailabilityExceptionForm.tsx`: tarjeta de excepción (`Card`): entre Fecha, Horario, aviso de día cerrado, Parámetros, error y Quitar.
- `AvailabilityParamsFields.tsx`: contenedor raíz: entre Separación mínima, Máximo de citas y Conservar capacidad.

Se mantiene `gap-2` solo dentro de una unidad:

- Fila de hora + botón "+" (`TimeSlotChipInput.tsx`, `flex items-start gap-2`).
- Chips entre sí (`grid grid-cols-3 gap-2`) y el bloque de entrada de horas (`gap-2` entre la fila de entrada, los chips y el error del mismo componente).
- Par etiqueta + tooltip (`Switch`, `labelAdornment`).
- Días de la semana (`fieldset` y botones con `gap-2`).

Sin cambios de comportamiento ni de pruebas: ninguna prueba depende de clases de gap.

Ejecutado:

| Comando | Resultado |
|---|---|
| `npx vitest run tests/components/admin tests/hooks/admin/months` | 28 archivos, 128 pruebas: 123 verdes; 5 fallos de la línea base (sin fallos nuevos) |
| `npx tsc --noEmit` | 32 errores (línea base) |
| `npx eslint` sobre `components/admin/months/availability`, `TimeSlotChipInput.tsx`, `Input.tsx` | exit 0 |
| `npm run lint:admin-i18n` | 0 errores; 1 warning preexistente |

Verificación de espaciado: solo estática. Pendiente del owner en el dispositivo: que los grupos se vean con separación suficiente y que la tarjeta no quede demasiado alta a 375 px.

Sin commits. No se usó Reviewer.
