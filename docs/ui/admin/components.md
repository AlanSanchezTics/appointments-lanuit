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

## Component: WeeklyOccupancyCard

### Purpose

Mostrar la ocupación operativa de la semana en dashboard admin con comparación frente a la semana anterior.

### Structure

- título del bloque
- indicador comparativo unificado `N% más|menos|similar Vs semana pasada`
- gráfico de barras de 5 días (`lunes` a `viernes`)
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
- incluir sábados o domingos en el gráfico

---

## Component: ListItem

### Purpose

Representar un elemento navegable o accionable dentro de un listado operativo.

### Structure

- icono a la izquierda (vía `AdminIcon`)
- título principal
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
- acciones rápidas sobre citas (editar/cancelar)

Reglas:

- debe cerrar por `Escape`, overlay y botón `X`
- no reemplaza modales centrados para formularios complejos

---

## Component: BlockSpacesModal

### Purpose

Permitir bloqueo manual de espacios desde el detalle mensual admin sin navegación adicional.

### Structure

- reusa `BottomSheetModal` como contenedor
- selector horizontal de días bloqueables
- lista de slots bloqueables con selección múltiple
- selector de visualización `Por hora / Por bloque` disponible en `BLOCK_MODE`
- en `SECOND_ONLY_MODE`, la visualización se fuerza a `Por hora`
- acciones masivas de selección:
  - `Seleccionar todo`
  - `Limpiar selección`
- chips de motivo con selección única (`DESCANSO`, `PERSONAL`, `OTRO`)
- CTA de confirmación con estado loading bloqueante

### Rules

- usa iconografía outline (`schedule`, `lock`, `leaf/user`) vía `AdminIcon`.
- no permite texto libre para `OTRO` en v1.
- durante submit:
  - deshabilita campos, acciones y CTA,
  - impide cierre por overlay, `X` y `Escape`.
- todo copy visible se resuelve desde `react-i18next`.

---

## Component: MonthSlotModeModal

### Purpose

Permitir configurar la modalidad mensual desde un CTA `Modalidad` ubicado junto al título del mes en `/admin/months/[month]`.

### Structure

- botón de acción `Modalidad` en header de detalle mensual
- `BottomSheetModal` con selección única:
  - `Bloques de horarios`
  - `Horario fijo`
- CTA de guardado con estado loading bloqueante

### Rules

- guardar usando feedback con `sileo.promise`.
- durante guardado, deshabilitar selección/cierre/CTA para evitar doble submit.
- textos vía `react-i18next`.

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
- `Button` (`Nuevo`) para abrir modal de alta
- `ListItem` para filas de meses con `href` o `onClick`

### Behavior

- filtros refrescan métricas y listado
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
  - `calendarDays[]` con `tone` (`available`, `low`, `full`, `weekend`)

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
- selector de idioma (`es`/`en`) integrado al extremo derecho del header

### Usage

Uso:

- barra superior persistente en rutas autenticadas `/admin/*` (excepto login)

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
- solo habilitado cuando el mes está `ACTIVE`
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
