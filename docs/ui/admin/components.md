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

- `Header`
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

## Component: Header

### Purpose

Mostrar identidad del panel y acción global de cierre de sesión.

### Composition

- branding del panel
- acción `Cerrar sesión` usando `Button`

### Usage

Uso:

- barra superior persistente de vistas administrativas autenticadas

---

## Component: ContentWrapper

### Purpose

Mantener ancho, padding y ritmo de espaciado consistente en el contenido del admin.

### Usage

Uso:

- contenedor de secciones de dashboard
- base para vistas operativas futuras

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
