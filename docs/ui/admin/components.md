# Admin UI Components – La Nuit (Admin Core)

## Purpose

Este documento define los componentes base del admin panel, su intención, uso y reglas de reutilización.

Su objetivo es estandarizar la construcción de interfaces administrativas y evitar variaciones visuales o estructurales innecesarias.

Estos componentes aplican exclusivamente al admin panel.

No aplican al flujo público del sistema.

---

## Scope

Estos componentes deben usarse en:

- dashboards
- vistas operativas
- listados administrativos
- tablas internas
- formularios del admin
- filtros y acciones globales

No deben usarse en:

- booking público
- cancelación pública
- interfaces de usuario final

---

## Base Components Location

Todos los componentes base del admin deben vivir en:

```txt
components/admin/ui/
```

El agente debe reutilizar estos componentes antes de crear nuevos.

## Layout Components Location

Los componentes estructurales del shell admin deben vivir en:

```txt
components/admin/layout/
```

Incluye `AdminLayout`, `AppHeader` y `AdminSidebar`.

## Regla i18n obligatoria

- Todo texto UX visible del admin debe provenir de `react-i18next`.
- No se permiten literales inline de UX en componentes o páginas admin.
- Si un cambio agrega nuevo copy, debe incluir clave en `locales/es/*` y `locales/en/*`.
- Para errores funcionales de auth/admin, el componente debe consumir claves del namespace `adminErrors` a partir de códigos estables.

---

## Component: Button

### Purpose

Representar acciones del usuario dentro del admin panel.

### Variants

**Primary**

- fondo: `accent`
- texto: blanco
- altura: `48px`
- radius: `12px`

Uso:

- acción principal de la vista
- CTA dominante

**Secondary**

- fondo: `inactive-bg`
- texto: `text-primary`

Uso:

- acciones secundarias
- acciones no dominantes

**Disabled**

- opacidad reducida
- cursor no interactivo

Uso:

- acciones temporalmente no disponibles

### Rules

El agente debe:

- usar `Button` para acciones explícitas
- respetar variantes existentes

El agente no debe:

crear botones nuevos con estilos inline
introducir variantes no documentadas sin actualizar este archivo

---

## Component: Card

### Purpose

Contenedor base para agrupar contenido del admin.

Style

- fondo: `surface`
- radius: `12px`
- shadow: ligera
- padding: `16px–20px`

### Usage

Uso:

- tarjetas informativas
- paneles de filtros
- contenedores de tablas o listas
- bloques de configuración

---

## Component: MetricCard

### Purpose

Mostrar métricas de dashboard de forma compacta y consistente.

### Structure

- icono (vía `AdminIcon`)
- label
- valor

### Style

- fondo: `surface`
- radius: `12px`
- padding: `16px`
- alineación: centrada
- tipografía:
  - label: `metric-label`
  - value: `metric-value`

### Usage

Uso:

- KPIs
- indicadores rápidos
- panel superior de métricas

---

## Component: DashboardGreetingCard

### Purpose

Mostrar encabezado contextual del dashboard con fecha de negocio y saludo breve.

### Structure

- fecha en formato corto contextual (zona `America/Mexico_City`)
- saludo principal con nombre del usuario/admin

### Style

- contenedor propio (`section`) sin uso de `Card`
- fondo: `inactive-bg`
- fecha:
  - `metric-label` adaptado (uppercase + tracking)
  - color `text-secondary`
- saludo:
  - tipografía destacada (Montserrat bold)
  - color `text-primary`

### Usage

Uso:

- cabecera de `/admin` (dashboard principal)

### Rules

El agente debe:

- resolver texto visible vía `react-i18next`
- respetar timezone de negocio para la fecha

El agente no debe:

- hardcodear copy visible del saludo o fecha

---

## Component: DailyTipCard

### Purpose

Mostrar un tip operativo diario en el dashboard admin con rotación determinista por fecha.

### Structure

- contenedor base: `Card`
- bloque visual lateral con icono `Lightbulb`
- título del bloque (`Tip del día`)
- contenido textual del tip diario

### Style

- fondo base `canvas`
- borde suave derivado de `primary` (mezcla sobre blanco)
- bloque de icono con fondo `primary` y contraste alto
- título en `accent` con jerarquía fuerte
- texto del tip en `text-primary`, multilinea y legible

### Usage

Uso:

- bloque superior del dashboard `/admin`, debajo de `DashboardGreetingCard`

### Rules

El agente debe:

- resolver el título visible vía `react-i18next`
- consumir contenido desde el servicio de dashboard (`dailyTip`)
- mantener layout responsive sin colapsar el texto en mobile

El agente no debe:

- hardcodear tips en el componente
- resolver rutas de assets CSV dentro de la capa UI

---

## Component: WeeklyOccupancyCard

### Purpose

Mostrar la ocupación operativa de la semana en dashboard admin con comparación frente a la semana anterior.

### Structure

- título del bloque
- indicador comparativo unificado `N% más|menos|similar Vs semana pasada`
- gráfico de barras de 7 días (`lunes` a `domingo`, D57), una columna por día en cuadrícula de 7 columnas (`grid-cols-7`)
- tooltip por barra con número de citas del día

### Style

- contenedor base: `Card`
- barras sobre `inactive-bg` con relleno `primary`
- títulos y labels con tipografía `metric-label` adaptada
- valor principal en peso `extrabold`
- indicador comparativo renderizado como tag/pill sobre `inactive-bg`
- indicador delta con icono semántico:
  - `ArrowCircleUp` verde para `más`
  - `ArrowCircleDown` rojo para `menos`
  - `MinusCircle` gris para `similar`

### Usage

Uso:

- bloque superior del dashboard `/admin`

### Rules

El agente debe:

- usar datos de citas activas (`CONFIRMED`, `SYNC_FAILED`)
- calcular ocupación semanal y delta vs semana anterior en `America/Mexico_City`
- resolver texto visible vía `react-i18next`
- soportar interacción táctil de tooltip (tap para mostrar, blur para ocultar)

El agente no debe:

- hardcodear etiquetas de UI
- omitir sábados o domingos del gráfico: debe mostrar lunes a domingo (D57). El servicio devuelve los siete días y la tarjeta los dibuja en una cuadrícula de 7 columnas (`grid-cols-7`) con `gap-2`, también en móvil

---

## Component: BusiestDayCard

### Purpose

Destacar el día de mayor demanda operativa dentro de la semana actual en el dashboard admin.

### Structure

- título superior en uppercase (`Día más ocupado`)
- nombre del día con mayor ocupación
- subtítulo de apoyo (`Máxima demanda de citas`)
- icono estrella en contenedor circular lateral

### Style

- bloque destacado con fondo `accent`
- tipografía principal en blanco con alto contraste
- subtítulo y título auxiliar en variantes de blanco con opacidad
- borde redondeado (`radius-md`) y sombra ligera

### Usage

Uso:

- bloque superior del dashboard `/admin`, debajo de `WeeklyOccupancyCard`

### Rules

El agente debe:

- usar el dataset semanal lunes-viernes para derivar el día más ocupado
- aplicar desempate por primer día en orden semanal (`lunes` a `viernes`)
- resolver copy visible vía `react-i18next`
- ocultar el bloque cuando la semana no tenga citas activas

El agente no debe:

- calcular el día más ocupado sobre fines de semana

---

## Component: DailyOccupancyCard

### Purpose

Mostrar la ocupación operativa del día actual en dashboard admin.

### Structure

- título contextual:
  - `Ocupación del día` en lunes-viernes
  - `Ocupación para el Lunes` en sábado/domingo
- porcentaje de ocupación
- barra de progreso horizontal
- texto informativo `N citas agendadas para hoy` + icono `InfoCircle`

### Style

- contenedor base: `Card`
- porcentaje en estilo `metric-value` destacado
- barra con track `inactive-bg` y fill `accent`
- línea informativa en `text-secondary`

### Usage

Uso:

- bloque superior del dashboard `/admin`

### Rules

El agente debe:

- calcular ocupación diaria con citas activas (`CONFIRMED`, `SYNC_FAILED`) del día actual
- usar como capacidad del día su `maxPerDay` si está abierto, y `0` si está cerrado o tiene bloqueo de día completo (D44, D53); no usar una constante 3
- resolver copy visible vía `react-i18next`

El agente no debe:

- usar datos de citas canceladas para el porcentaje

---

## Component: TodayAgendaTimelineCard

### Purpose

Mostrar la agenda operativa del día actual como línea de tiempo dentro del dashboard admin.

### Structure

- título contextual:
  - `Agenda de Hoy` en lunes-viernes
  - `Agenda para el Lunes` en sábado/domingo
- icono de navegación en encabezado con enlace a `/admin/months/[currentMonth]`
- listado vertical de filas de cita
- cada fila incluye:
  - bloque de hora (`HH:mm` + `AM/PM`)
  - nombre del cliente
  - teléfono
  - tag de estado (`Listo`, `En curso`, `Pendiente`)

### Style

- contenedor base: `Card`
- filas internas con `surface`, borde redondeado y separación vertical
- separador vertical entre columna de hora y datos del cliente
- fila `En curso` con acento lateral izquierdo
- tag `En curso` con animación `blink`

### Usage

Uso:

- bloque superior del dashboard `/admin`, debajo de `DailyOccupancyCard`

### Rules

El agente debe:

- usar citas activas del día (`CONFIRMED`, `SYNC_FAILED`) ordenadas por hora
- resolver día de referencia: actual en lunes-viernes, siguiente lunes en sábado/domingo
- calcular estado operativo local por cita (`Listo`, `En curso`, `Pendiente`)
- desactivar animaciones en `prefers-reduced-motion`
- resolver copy visible vía `react-i18next`

El agente no debe:

- incluir citas canceladas en la agenda del día

---

## Component: PendingAppointmentsCard

### Purpose

Mostrar en el dashboard principal del admin la cola de citas `PENDING` que requieren revisión manual.

### Structure

- contenedor base: `Card`
- encabezado con icono contextual de pendientes
- subtítulo con conteo de citas pendientes
- estado vacío cuando no hay citas por revisar
- listado de tarjetas por cita pendiente
- acciones por elemento:
  - `Confirmar` (tras éxito con `CONFIRMED` o `SYNC_FAILED` ofrece, en un toast de acción aparte, enviar el mensaje por WhatsApp en la misma pestaña),
  - `Rechazar` (no ofrece WhatsApp)

### Data / Props Contract

- `language: AppLanguage`
- `items: AdminPendingAppointmentItem[]`

Cada elemento de `items` debe proporcionar, como mínimo:

- `appointmentId`
- `name`
- `phone`
- `clientNumber`
- `date`
- `timeSlot`

### Style

- usa el contenedor `Card` existente
- cada cita se presenta en una tarjeta interna con borde suave, sombra ligera y separación vertical consistente
- acciones apiladas en mobile y en dos columnas a partir de `sm`
- iconografía outline vía `AdminIcon`

### Usage

Uso:

- bloque del dashboard `/admin` orientado a revisión operativa de citas pendientes

### Rules

El agente debe:

- mostrar únicamente citas pendientes de confirmación
- permitir transiciones `PENDING -> CONFIRMED` y `PENDING -> REJECTED`
- usar feedback operativo con `sileo.promise` y textos resueltos vía `react-i18next`
- refrescar el dashboard al finalizar una transición exitosa
- en `Confirmar`, solo si la confirmación resulta `CONFIRMED` o `SYNC_FAILED`, mostrar después del toast de éxito un `sileo.action` aparte con título `dashboard.pendingAppointments.notifications.whatsappActionTitle` y botón `dashboard.pendingAppointments.notifications.whatsappActionButton`, sin `description`
- el botón abre WhatsApp con `window.location.assign` en la misma pestaña, de forma síncrona dentro del click; la URL no se abre sin que el admin pulse el botón (ver `docs/architecture/business-rules.md`, "Pending confirmation WhatsApp offer")
- la URL del botón se construye antes de `router.refresh()`, para que siga funcionando si la tarjeta se desmonta
- tras `Confirmar` con éxito, refrescar el dashboard (`router.refresh()`); el admin permanece en el dashboard
- en errores de confirmación, mostrar el toast de error y no ofrecer WhatsApp; en `Rechazar`, refrescar el dashboard y no ofrecer WhatsApp
- la fecha del mensaje usa el formato de fecha larga compartido (sin coma en `es`, ver `docs/specification.md` sección 14, regla 10)
- construir el mensaje de WhatsApp con `dashboard.pendingAppointments.whatsappMessage` (`{{date}}` y `{{time}}` con el texto que muestra la tarjeta) sin escapar HTML
- mantener el bloque usable en desktop y mobile sin agregar estados visuales nuevos al sistema

El agente no debe:

- introducir edición manual del contenido de la cita desde este bloque
- mezclar esta tarjeta con el flujo de detalle mensual
- agregar variantes nuevas de `Button`, `Card` o tokens visuales para resolver este caso
- abrir WhatsApp al rechazar una cita
- abrir WhatsApp con `window.open` (bloqueado por navegadores móviles fuera del gesto directo)

### Implementation Notes

- componente reusable ubicado en `components/admin/ui/PendingAppointmentsCard.tsx`
- integra endpoints admin para confirmar/rechazar citas pendientes
- la oferta del toast de WhatsApp y su mensaje viven en `hooks/admin/usePendingAppointmentWhatsapp.ts` (`offerConfirmationWhatsapp`), que reutiliza `buildWhatsappUrlFromMessage` de `lib/whatsapp/message.ts` y `formatLongDate`/`formatTimeSlotLabel` de `lib/datetime/mexico-city.ts` (no el helper `formatWhatsappAppointmentLabels`, que produce coma en la fecha)
- usa estilos y tokens ya existentes del sistema admin

### Documentation Note

- No requiere cambios adicionales en `docs/ui/admin/design-system.md`
- No requiere cambios adicionales en `docs/ui/admin/tokens.md`
- `docs/features/admin-month-detail-flow.md` no aplica a este bloque y permanece sin cambios

---

## Component: ReminderAppointmentsCard

### Purpose

Mostrar en el dashboard principal del admin las citas próximas que requieren recordatorio manual por WhatsApp.

### Structure

- contenedor base: `Card`
- encabezado del bloque con título `Recordatorios` y subtítulo operativo
- sección `Citas para mañana`
- sección `Citas para la próxima semana`
- estado vacío por sección cuando no hay resultados
- listado de filas por cita con:
  - avatar de iniciales
  - nombre de clienta
  - número de clienta
  - teléfono
  - hora
  - acción iconográfica `Enviar recordatorio`

### Data / Props Contract

- `language: AppLanguage`
- `nextDayItems: DashboardReminderItem[]`
- `nextWeekItems: DashboardReminderItem[]`

Cada elemento de reminders debe incluir:

- `appointmentId`
- `clientNumber`
- `name`
- `phone`
- `date`
- `timeSlot`
- `reminderType` (`NEXT_DAY` | `NEXT_WEEK`)

### Style

- usa `Card` y tokens existentes del admin
- filas con borde suave y foco visible en acción iconográfica
- layout responsive sin variantes nuevas de sistema
- iconografía mediante `AdminIcon` + `adminIcons.sendReminder`

### Usage

Uso:

- bloque del dashboard `/admin`, debajo de `TodayAgendaTimelineCard`

### Rules

El agente debe:

- usar exclusivamente citas activas (`CONFIRMED`, `SYNC_FAILED`) ya resueltas por backend
- abrir la URL final de WhatsApp con URL codificada de forma síncrona durante el click/tap
- evitar pestañas intermedias en blanco
- permitir reenvío ilimitado de recordatorios para una misma cita
- usar `sileo` para feedback (`success`, `warning`, `error`)
- resolver todos los textos por `react-i18next`

El agente no debe:

- enviar recordatorios automáticamente sin acción explícita del admin
- crear sistemas alternativos de notificación
- introducir variantes visuales fuera de tokens/admin design system

### Implementation Notes

- componente reusable ubicado en `components/admin/ui/ReminderAppointmentsCard.tsx`
- integración en `app/admin/page.tsx`

### Documentation Note

- Requiere alineación con:
  - `docs/specification.md` (sección dashboard/admin reminders)
  - `docs/architecture/business-rules.md` (policy reminders widget)
  - `docs/features/admin-auth-flow.md` (flujo dashboard actualizado)

---

## Component: RetouchReminderCard

### Purpose

Mostrar en el dashboard admin las clientas candidatas a recordatorio de retoque cuando no tienen cita confirmada en las ventanas de validación.

### Structure

- contenedor base tipo card con el mismo patrón visual de `ReminderAppointmentsCard`
- encabezado con título y subtítulo
- sección única `Clientas candidatas`
- listado de filas por clienta con:
  - avatar de iniciales
  - nombre de clienta
  - número de clienta
  - teléfono
  - referencia de última cita (`D-21`)
  - acción iconográfica `Enviar recordatorio de retoque`

### Data / Props Contract

- `items: RetouchReminderItem[]`

Cada elemento incluye:

- `clientId`
- `clientNumber`
- `name`
- `phone`
- `lastAppointmentDate`
- `candidateReason`

### Usage

Uso:

- bloque del dashboard `/admin`
- ubicación obligatoria: inmediatamente debajo de `ReminderAppointmentsCard`
- condición de render: solo cuando `items.length > 0`

### Rules

El agente debe:

- reutilizar componentes/tokens del sistema admin existente
- abrir URL final de WhatsApp de forma síncrona durante click/tap
- usar el mensaje fijo de negocio para retoque
- permitir reenvío ilimitado
- resolver labels del bloque vía `react-i18next`

El agente no debe:

- mostrar el bloque cuando no hay candidatas
- introducir estilos ad hoc fuera de tokens/admin system
- mezclar este bloque con flujo público

---

## Component: ListItem

### Purpose

Representar un elemento navegable o accionable dentro de un listado operativo.

### Structure

- icono a la izquierda (vía `AdminIcon`)
- título principal
- subtítulo opcional para contexto secundario (ej. teléfono)
- indicador o contenido secundario a la derecha
- soporta `href` para navegación declarativa y `onClick` para interacción controlada

### Style

- fondo: `surface`
- min-height: `64px`
- radius: `12px`
- padding: `16px`

### Usage

Uso:

- listas de meses
- navegación hacia detalle
- registros resumidos

---

## Component: Select

### Purpose

Permitir selección de opciones en filtros o formularios internos.

### Style

- fondo: `surface`
- borde: `1px solid border`
- radius: `12px`
- altura: `44px`

### Usage

Uso:

- filtros por año
- filtros por estado
- selección administrativa

Notas:

- permite ocultar placeholder cuando el flujo exige un valor siempre seleccionado (`showPlaceholder=false`).

---

## Component: Switch

Archivo: `components/admin/ui/Switch.tsx`

### Purpose

Activar o desactivar una opción binaria de filtrado o de vista (sí/no) en el admin panel.

### Structure

- etiqueta de texto a la izquierda (`label`, vinculada por `id`),
- control `role="switch"` a la derecha con `aria-checked`.
- prop opcional `labelAdornment` (aditiva): contenido junto a la etiqueta, por ejemplo un `Tooltip` de ayuda. Va fuera de `<label>`, así que no alterna el switch. Sin la prop, el marcado no cambia.

### Style

- track: `44px x 24px`, radius `pill`, borde `1px solid border`
- track apagado: fondo `inactive-bg`
- track encendido: fondo `accent`
- knob: círculo blanco (`surface`) de `16px`
- foco visible: outline `accent`
- deshabilitado: opacidad reducida, cursor no interactivo

### Usage

Uso:

- filtros binarios, por ejemplo `Mostrar meses anteriores` en `/admin/months`

Notas:

- no usar para selección entre varias opciones (usar `Select`)
- el componente no mantiene estado propio: el estado llega por `checked` y se actualiza por `onChange`

---

## Component: BottomSheetModal

### Purpose

Presentar flujos contextuales móviles dentro del admin sin navegar a otra pantalla.

### Structure

- backdrop + contenedor anclado al fondo
- handle visual superior
- header (título + close)
- body scrollable con altura máxima controlada

### Style

- `radius-top`: `32px` (`rounded-t-3xl`)
- fondo: `canvas`
- sombra: alta, sin borde duro

### Motion

- enter: `admin-sheet-enter` (SlideFromBottom)
- leave: `admin-sheet-leave` (SlideToBottom)
- fallback sin animación para `prefers-reduced-motion`

### Usage

Uso:

- agenda diaria de `/admin/months/[month]`
- acciones sobre citas y bloqueos (editar/cancelar)
- bloque de acciones operativas del detalle diario:
  - `Agendar nueva cita`
  - `Bloquear espacios`

Reglas:

- debe cerrar por `Escape`, overlay y botón `X`
- no reemplaza modales centrados para formularios complejos
- prop opcional `overlay` (aditiva): contenido que se superpone al panel, fuera del área con scroll, para confirmaciones que deben verse siempre. Lo usa el descarte del editor de disponibilidad. Sin la prop no se renderiza nada adicional.
- con `disableClose` activo, `Escape`, el overlay y la `X` no cierran la hoja.

---

## Component: BlockSpacesModal

### Purpose

Permitir bloqueo manual de espacios desde el detalle mensual admin sin navegación adicional.

### Structure

- reusa `BottomSheetModal` como contenedor
- selector horizontal de días bloqueables
- lista única de horarios bloqueables con selección múltiple: cada horario es un espacio. No hay vista `Por bloque` ni prop `allowBlockView`
- acción `Día completo`: bloquea el día en una sola operación
- acciones masivas de selección:
  - `Seleccionar todo`
  - `Limpiar selección`
- chips de motivo con selección única (`DESCANSO`, `PERSONAL`, `OTRO`)
- CTA de confirmación con estado loading bloqueante

### Rules

- usa iconografía outline (`schedule`, `lock`, `leaf/user`) vía `AdminIcon`.
- no permite texto libre para `OTRO` en v1.
- solo se listan días con al menos un horario bloqueable (horario que el servidor ofrece ese día). Los horarios ocupados, bloqueados, con lock o ya pasados no aparecen.
- `Día completo` se habilita solo si el día tiene al menos un horario bloqueable. Es la misma condición que valida el servidor: si no queda ningún horario libre, responde `SLOT_NOT_AVAILABLE`.
- durante submit:
  - deshabilita campos, acciones y CTA,
  - impide cierre por overlay, `X` y `Escape`.
- todo copy visible se resuelve desde `react-i18next`.

---

## Component: Tooltip

Archivo: `components/admin/ui/Tooltip.tsx`

### Purpose

Mostrar una ayuda contextual junto a un control sin ocupar espacio fijo en el formulario.

### Structure

- disparador: botón solo con icono de información. Su nombre accesible es `label` (p. ej. `Ayuda: conservar capacidad`).
- globo: `role="tooltip"`. El disparador lo referencia con `aria-describedby` aunque esté oculto, para que el lector de pantalla lo anuncie al enfocar el disparador.

### Props

- `label` (obligatoria): nombre accesible del disparador.
- `children`: texto de la ayuda.
- `align` (`"start" | "center" | "end"`, por defecto `"end"`): ancla el globo al disparador. Usar `center` cuando el disparador va junto a una etiqueta de un `Switch` (`labelAdornment`).

### Behavior

- abre con foco, clic/tap o entrada del puntero; cierra al perder el foco, con `Escape` o al salir el puntero.
- con el globo abierto, `Escape` solo cierra el globo y no cierra la hoja que lo contiene. El listener de captura sobre `document` se registra mientras el globo está abierto y detiene la propagación. Con el globo cerrado, `Escape` vuelve a cerrar la hoja.

### Usage

- ayuda de `Conservar capacidad` en `AvailabilityParamsFields` (reglas y excepciones del editor de disponibilidad).

### Rules

- el abierto/cerrado del globo es estado de presentación local al componente. Es una excepción a la regla de hooks de AGENTS, igual que `BottomSheetModal`.

---

## Component: TimeSlotChipInput

Archivo: `components/admin/ui/TimeSlotChipInput.tsx`

### Purpose

Editar una lista de horas `HH:mm` (horario de una regla o de una excepción) con altas y bajas mediante chips.

### Structure

- un único `Input` nativo `type="time"` con su etiqueta. A su derecha, botón `+` primario, solo icono, con `aria-label` = `addLabel`. Mide 56 px de alto para igualar el input.
- rejilla de chips de 3 columnas. Cada chip muestra la hora en 12 h con AM/PM (`9:00 AM`, `1:00 PM`, `12:00 AM` para `00:00`) y un botón de quitar con `aria-label` `<removeLabel> <hora en 12 h>`.
- `emptyLabel` opcional cuando la lista está vacía.
- `error` opcional, con `role="alert"`.

### Contract

- el valor de `values` y el que emite `onChange` son siempre `HH:mm` (24 h). La vista de 12 h es solo presentación.
- la lista queda en orden ascendente por valor 24 h, sin duplicados.
- `Enter` en el input añade la hora. El botón `+` está deshabilitado sin valor.
- el formato del control nativo (12 o 24 h) lo decide el dispositivo y el idioma del sistema. La app no lo fuerza.
- no valida reglas de dominio. `00:00` (marcador interno de día completo) y los límites del motor los rechaza la validación del editor (`AVAILABILITY_TIME_INVALID`).

### Style

- chips: fondo `inactive-bg`, borde `border`, texto `text-xs` truncado, radius pill.
- botón de quitar: 20 px, foco visible con outline `accent`.

### Rules

- el valor pendiente de agregar es estado de presentación local al componente. Es la misma excepción que `Tooltip` y `BottomSheetModal`.

---

## Component: AvailabilityEditorModal

Archivos:

- `components/admin/months/availability/AvailabilityEditorModal.tsx` (contenedor presentacional)
- `components/admin/months/availability/AvailabilityRuleForm.tsx`
- `components/admin/months/availability/AvailabilityExceptionForm.tsx`
- `components/admin/months/availability/AvailabilityParamsFields.tsx`
- hooks: `hooks/admin/months/useAvailabilityEditor.ts`, `hooks/admin/months/useAvailabilitySave.ts`, `hooks/admin/months/useMonthAvailabilityController.ts` (une editor y guardado para `MonthDetailView`) y `hooks/admin/months/useDiscardConfirmDialog.ts`

### Purpose

Editar las reglas semanales y las excepciones por fecha de un mes no pasado. Se abre con el botón `Reglas` del detalle mensual.

### Structure

- `BottomSheetModal` con título `Disponibilidad del mes`.
- aviso cuando el mes no tiene reglas: se usa el horario por defecto (lunes a viernes, fin de semana cerrado).
- sección `Reglas semanales`. Cada regla (`AvailabilityRuleForm`) es una tarjeta con:
  - `Desde` y `Hasta` (`type="date"`, acotados al mes), en filas separadas;
  - días de la semana (botones de alternancia `aria-pressed`, de lunes a domingo);
  - horario (`TimeSlotChipInput`);
  - parámetros (`AvailabilityParamsFields`);
  - error del ítem, si lo hay, y botón `Quitar`.
- sección `Excepciones por fecha`. Cada excepción (`AvailabilityExceptionForm`) es una tarjeta con:
  - `Fecha` (`type="date"`, acotada al mes);
  - horario (`TimeSlotChipInput`);
  - aviso `Sin horas: este día quedará cerrado.` cuando la lista de horas está vacía;
  - parámetros, error del ítem y botón `Quitar`.
- `AvailabilityParamsFields` (compartido por regla y excepción): separación mínima (numérico 0 a 1440), máximo de citas por día (selector 1 a 6) y `Conservar capacidad` (`Switch` con `Tooltip` junto a la etiqueta).
- botones `Agregar regla`, `Agregar excepción`, `Cancelar` y `Guardar disponibilidad`.
- `AffectedAppointmentsDialog` (sección propia) y la confirmación de descarte, que se superpone al panel.

### Valores por defecto (D6, D10, D99)

- regla nueva: rango = mes completo, días lunes a viernes, horario `09:00, 10:00, 13:00, 14:00, 17:00, 18:00`, separación `240`, `Conservar capacidad` activado y máximo `3`.
- excepción nueva: fecha = día 1 del mes, horario vacío (día cerrado con aviso), separación `240`, `Conservar capacidad` activado y máximo `3`.

### Validation

- cada ítem se valida con el motor de disponibilidad al editar (la validación espejo reutiliza las reglas del servidor): rango dentro del mes, horas `HH:mm` válidas y distintas de `00:00`, días de la semana, separación 0 a 1440, máximo 1 a 6 y máximo 24 horas por día. Un campo de separación vacío es un error.
- los errores de conjunto (traslape de reglas y fechas de excepción repetidas) solo se muestran cuando todos los ítems son válidos.
- si hay cualquier error, `Guardar` queda deshabilitado.

### States

- carga: texto `Cargando disponibilidad…` con `role="status"`. Si falla, muestra error con `Reintentar`.
- sin cambios: `Guardar` deshabilitado.
- con cambios sin guardar: `Cancelar`, la `X` y el overlay piden confirmación de descarte.
- guardando: controles, cierre y `Guardar` bloqueados; el botón muestra `Guardando…`.
- éxito: el detalle del mes se recarga y el editor se cierra.

### Descarte

- la confirmación `¿Descartar cambios?` es un `role="alertdialog"` que se superpone al panel, en la parte superior, fuera del área con scroll.
- un scrim cubre el encabezado (título y `X`). Tocarlo no cierra ni descarta nada.
- el contenido del editor queda `inert` mientras la confirmación está abierta.
- el foco inicial va a `Seguir editando`. `Escape` equivale a `Seguir editando`. Al cerrar la confirmación, el foco vuelve al elemento que lo tenía antes.
- `Descartar` cierra el editor y pierde el borrador.
- el color del scrim es el token `--admin-scrim` (`rgba(28, 25, 23, 0.35)`), el mismo fondo de `BottomSheetModal` y `Modal`. Está definido en `app/globals.css` y documentado en `tokens.md` (D105b; el color no cambió al tokenizarlo).

### Guardado y notificaciones

- `Guardar` pide primero una previsualización al servidor. Si hay citas activas futuras que quedarían fuera de la nueva rejilla, abre `AffectedAppointmentsDialog`. Si no hay, guarda directamente.
- la carga usa `sileo.show` de tipo `loading`, que se descarta al terminar. El resultado usa `sileo.success` (`Disponibilidad guardada`) o `sileo.error` con descripción por código.
- excepción a `sileo.promise` (aceptada por el owner, D102): `sileo.promise` mostraría error ante el rechazo `AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED` y no puede silenciarlo. Ese 409 no es un error: abre el diálogo de citas afectadas sin notificación de error.
- `AVAILABILITY_VERSION_CONFLICT` muestra el mensaje `La disponibilidad cambió mientras editabas. Cierra el editor y ábrelo de nuevo para cargar la versión actual.` No hay recarga dentro del editor.

### Rules

- la lógica vive en hooks. Los componentes son presentacionales (AGENTS, reglas de hooks).
- todo texto visible se resuelve con `react-i18next`.

---

## Component: AffectedAppointmentsDialog

Archivo: `components/admin/months/availability/AffectedAppointmentsDialog.tsx`

### Purpose

Confirmar un guardado de disponibilidad que deja citas activas futuras fuera de la nueva rejilla. Es una decisión explícita del admin, no una notificación.

### Structure

- `Modal` (no `BottomSheetModal`) con título `Hay citas que quedarían fuera del horario`.
- texto con el total de citas afectadas y la aclaración de que guardar no modifica las citas.
- lista de citas (máximo de alto con scroll). Cada cita muestra fecha corta (zona `America/Mexico_City`), hora en 12 h, estado (`Solicitada`, `Confirmada`, `Confirmada (sincronización fallida)` o `Estado desconocido`) y cliente.
- botones `Cancelar` (ghost) y `Confirmar y guardar` (primario).

### Behavior

- `Cancelar` solo cierra el diálogo. No escribe nada.
- `Confirmar y guardar` repite el guardado con `confirmAffectedAppointments: true`. Las citas no cambian de fecha, hora ni estado.
- mientras el guardado está en curso, ambos botones y el cierre están deshabilitados.
- no usa `sileo` (D18).

### Rules

- la lista incluye solo citas activas futuras (o de hoy con hora posterior a la actual) que estaban dentro de la rejilla vigente y quedan fuera de la propuesta. Las citas pasadas no se listan.

---

## Component: Input

### Purpose

Capturar información en formularios internos o filtros.

### Style

- fondo: `surface`
- borde: `1px solid border`
- radius: `12px`
- altura mínima: `44px`
- cuando el input incluye icono, se alinea en el lado izquierdo
- variante password:
  - icono decorativo alineado a la izquierda
  - botón de acción mostrar/ocultar alineado a la derecha (ícono ojo)

### Usage

Uso:

- búsquedas
- filtros
- formularios internos del admin
- login admin (username/password con iconografía consistente)

Nota:

- cuando un `Input` incluya icono, debe usar `AdminIcon`.
- todo `Input` con `type="password"` debe incluir toggle de visibilidad por defecto.
- `type="date"`, `type="time"` y `type="datetime-local"` llevan contención específica: el input usa `box-border`, `min-w-0`, `max-w-full` y `appearance:none`, y su contenedor usa `min-w-0`. Motivo: en Safari iOS estos inputs tienen un ancho intrínseco y se salen de la tarjeta o se superponen al botón vecino (por ejemplo, el `+` de `TimeSlotChipInput`). Los demás tipos no cambian.

---

## Component: AdminIcon

### Purpose

Normalizar iconografía del admin sobre Font Awesome, centralizando color, tamaño y accesibilidad.

### Source

- `components/admin/ui/AdminIcon.tsx`

### Rules

- tono por defecto: `accent`
- tamaño por defecto: `sm`
- decorativo por defecto (`aria-hidden`)
- permite override controlado de tono/tamaño/clase cuando el componente lo requiera

---

## Component: StatusTag

### Purpose

Mostrar el estado resumido de una entidad o registro.

### Style

- radius: pill
- padding horizontal: 12px
- font: tag

### Suggested Variants

**Active**

- fondo: success-bg
- texto: success-text

**Inactive**

- fondo: inactive-bg
- texto: text-secondary

### Usage

Uso:

- estados de mes
- estados operativos
- badges contextuales

---

## Component: Table

### Purpose

Mostrar datos tabulares o listados de alta densidad dentro del admin.

### Structure

- header
- body
- row actions
- empty state

### Style

**Header**

- fondo neutro
- texto con mayor peso visual

**Row**

- fondo: `surface`

**Hover**

- cambio sutil de fondo

**Actions**

- alineadas a la derecha

### Usage

Uso:

listados con múltiples columnas
gestión operativa
vistas densas de información

---

## Component: FiltersPanel

### Purpose

Agrupar controles de filtro y acciones globales del admin.

### Composition

Construido a partir de:

- `Card`
- `Input`
- `Select`
- `Button`
- `Usage`

### Uso:

- bloques de filtros superiores
- paneles de consulta rápida

---

## Component: MetricsGrid

### Purpose

Distribuir métricas en formato responsivo y consistente.

### Layout Rules

- desktop: 3 columnas
- mobile: 2 columnas
- gap: `16px`

### Composition

Construido a partir de:

- `MetricCard`

Nota:

- en `/admin/months` puede usarse variante compacta de 3 columnas en mobile.

---

## Pattern: MonthsCatalogPage (MVP Operativo)

### Composition

- `MetricCard` x6 en grid 3x2
- `Select` para `Año` y `Estado`
- `Switch` para `Mostrar meses anteriores` (apagado por defecto)
- `Button` (`Nuevo`) para abrir modal de alta
- `ListItem` para filas de meses con `href` o `onClick`

### Behavior

- `Año` y `Estado` refrescan métricas y listado
- `Mostrar meses anteriores` solo filtra la lista en cliente (no cambia métricas); su estado persiste en la URL como `past=1`
- el contador de la lista refleja los meses visibles
- filas navegan a `/admin/months/[month]`
- botón `Nuevo` abre modal de registro de meses futuros

---

## Pattern: MonthDetailPage (Operativo)

### Composition

- encabezado con navegación de regreso al catálogo
- grid de métricas `2x2`
- tarjeta de saturación proyectada (porcentaje + barra)
- calendario mensual operativo de 7 columnas

### Data Contract

- fuente: `GET /api/admin/months/[month]`
- métricas:
  - `confirmedAppointments`
  - `cancelledAppointments`
  - `availableSpaces`
  - `blockedSpaces` (MVP: `0`)
- calendario:
  - `calendarDays[]` con `tone` (`available`, `low`, `full`, `closed`) e `isWeekend`

### Behavior

- mes inválido o no registrado -> estado not found del route.
- mes pasado -> visualización histórica (solo lectura).

---

## Component: Modal

### Purpose

Contenedor reusable para interacciones enfocadas en capa superior (overlay) dentro del admin.

### Structure

- overlay de fondo
- panel centrado
- título
- botón de cierre
- contenido libre

### Behavior

- cierre por `Esc`
- cierre por botón `x`
- cierre por click en overlay
- `role="dialog"` y `aria-modal="true"`
- focus trap básico entre elementos interactivos

### Usage

Uso:

- modal de `Registrar nuevo mes`
- futuras confirmaciones admin de acciones controladas

---

## Component: AdminLayout

### Purpose

Proveer el shell principal del panel administrativo para vistas protegidas.

### Composition

- `AppHeader`
- `AdminSidebar`
- `ContentWrapper`

### Usage

Uso:

- `/admin/`
- futuras pantallas protegidas del admin

---

## Component: AdminRootLayout Notifications

### Purpose

Inicializar el sistema global de notificaciones del panel admin.

### Composition

- `Toaster` de `sileo`, montado en `app/admin/layout.tsx`.

### Rules

- Todas las notificaciones admin (`success`, `warning`, `error`, `info`, acción, promesa) deben dispararse con `sileo`.
- No introducir librerías alternativas de notificaciones para esos casos.
- El texto de notificaciones debe salir de `react-i18next` (namespace `admin`/`adminErrors` según corresponda).

### Usage

Uso:

- shell global de `/admin/*`
- feedback transversal del panel administrativo

---

## Component: Header (Legacy)

### Status

Componente reemplazado por `AppHeader` + `AdminSidebar` dentro de `AdminLayout`.

---

## Component: AppHeader

### Purpose

Mostrar el título de sección del módulo admin, el disparador de menú en mobile y el control de idioma del shell.

### Composition

- botón de menú (solo mobile)
- ícono contextual
- título de sección resuelto por i18n según ruta activa
- botón de buscador global a la izquierda del selector de idioma (`es`/`en`)
- buscador global de clientes dentro de modal del shell, con debounce, estado de carga y resultados

### Usage

Uso:

- barra superior persistente en rutas autenticadas `/admin/*` (excepto login)

### Rules

El agente debe:

- mantener el buscador global como parte del shell, no como una vista aislada
- limitar los resultados visibles a un máximo de 8
- mostrar nombre, número de cliente, teléfono y fidelidad cuando exista
- limpiar el estado del buscador después de navegar al detalle

El agente no debe:

- mover la lógica de búsqueda a páginas de feature
- introducir una segunda variante de buscador fuera del shell admin

---

## Component: AdminSidebar

### Purpose

Proveer navegación principal del panel admin y acción global de logout.

### Composition

- branding (`title` + `subtitle`)
- lista de navegación (`Dashboard`, `Meses`, `Clientes`)
- item disabled para módulos no habilitados
- acción `Cerrar sesión` al final

### Behavior

- desktop (`lg+`): sidebar fijo
- mobile: drawer con overlay + botón de cierre
- estado activo por ruta (`exact`/`prefix`)

### Usage

Uso:

- shell global de navegación en rutas autenticadas del admin

---

## Component: ContentWrapper

### Purpose

Mantener ancho, padding y ritmo de espaciado consistente en el contenido del admin.

### Usage

Uso:

- contenedor de secciones de dashboard
- base para vistas operativas futuras

---

## Component: BookAppointmentModal

### Purpose

Permitir que el admin agende una cita desde `/admin/months/[month]` sin navegar fuera del detalle mensual.

### Structure

- contenedor `BottomSheetModal`
- selector horizontal de día disponible
- selector de horario disponible por día
- selector de cliente con dos modos:
  - cliente existente (búsqueda remota + selección única)
  - alta inline de cliente nuevo (nombre + teléfono)
- CTA principal `Agendar cita`
- vista de éxito en el mismo bottom sheet con resumen (`fecha`, `hora`, `cliente`) y acción `Volver`

### Rules

- CTA `Agendar nueva cita` se muestra antes de `Bloquear espacios` en `/admin/months/[month]`
- el admin puede agendar en meses `INACTIVE` (el flujo público exige `ACTIVE`); no se muestra en meses pasados
- horarios del día: se piden a la agenda del día del servidor (`availableSlots`). Si el horario elegido sigue ofrecido al recargar, se conserva; si no, se elige el primero
- `Agendar cita` está deshabilitado mientras no haya día y horario seleccionados o mientras carga la agenda del día
- durante submit:
  - se bloquean interacciones del modal
  - se impide cierre por overlay, `X` y `Escape`
- notificaciones operativas del flujo usan `sileo`
- todos los textos visibles se resuelven con `react-i18next`

---

## Reuse Rules

El agente debe:

- reutilizar componentes existentes antes de crear uno nuevo
- extender componentes solo si la nueva variante es recurrente
- documentar nuevas variantes en este archivo

El agente no debe:

- duplicar componentes con pequeñas diferencias visuales
- crear componentes equivalentes fuera de `components/admin/ui/`
- mover estos componentes al flujo público
- duplicar un sistema paralelo de notificaciones en features del admin

---

## Promotion Rule

Si un patrón visual aparece más de una vez en el admin:

debe promoverse a componente reusable
debe documentarse aquí
debe alinearse con `design-system.md` y `tokens.md`

---

## Relationship with Documentation

Todo componente del admin debe alinearse con:

- `docs/ui/admin/design-system.md`
- `docs/ui/admin/tokens.md`

Si existe conflicto:

1. tokens definen valores base
2. design-system define reglas visuales
3. components.md define uso y composición

---

## Final Rule

Si una nueva pantalla del admin requiere un patrón no documentado:

- primero debe decidirse si es una variante o un componente nuevo
- después debe documentarse aquí antes de proliferar en múltiples pantallas
