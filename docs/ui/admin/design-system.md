# Admin Design System – La Nuit (Admin Core)

## Purpose

Este documento define el sistema visual del panel administrativo (Admin Panel) del sistema La Nuit.

Su objetivo es:

- garantizar consistencia visual en todas las vistas administrativas
- evitar estilos arbitrarios o duplicados
- servir como contrato de UI para desarrolladores y agentes
- permitir escalabilidad del frontend sin degradación visual

---

## Scope (Alcance)

Este design system aplica exclusivamente a:

- vistas del panel administrativo
- dashboards internos
- listados, filtros, métricas y gestión operativa

NO aplica a:

- flujo público (booking, cancelación)
- interfaces de usuario final
- vistas externas o embebidas

El agente no debe aplicar estas reglas fuera del contexto admin.

---

## Design Principles

1. Consistencia sobre creatividad
2. Reutilización sobre duplicación
3. Claridad sobre densidad visual
4. Jerarquía visual explícita
5. Acciones principales claramente destacadas
6. Feedback visual inmediato

---

## Color System

### Base

- Canvas (fondo general): `#FBF9F5`
- Surface (cards, modales): `#FFFFFF`

### Primary / Brand

- Primary: `#E49F53`
- Accent (acciones principales): `#875207`

### Semantic

- Success Background: `#D1FAE5`
- Success Text: `#065F46`

- Inactive / Neutral Layer: `#F5F3EF`

### Text

- Primary Text: `#1C1917`
- Secondary Text: `#6B7280`

### Borders

- Border: `#E5E7EB`

---

## Typography

### Titles

- Font: Montserrat
- Weight: Bold
- Size: 18px

### Metric Labels

- Font: Montserrat
- Weight: Bold
- Size: 10px
- Transform: Uppercase

### Metric Values

- Font: Montserrat
- Weight: ExtraBold
- Size: 16px

### Body / Table Text

- Font: Montserrat
- Weight: Medium
- Size: 14px

---

## Spacing System

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### Layout Rules

- Padding horizontal general: 24px
- Gap entre cards: 16px
- Padding interno cards: 16px–20px

---

## Border Radius

- sm: 8px
- md: 12px
- lg: 16px
- xl: 32px (uso específico para top corners de bottom-sheet modal)

---

## Components

---

### Button

#### Primary (CTA)

- Background: `#875207`
- Text: white
- Border radius: 12px
- Height: 48px
- Width: full (mobile)

Uso:

- acción principal del flujo (ej. NUEVO)

---

#### Secondary

- Background: neutral
- Text: oscuro

Uso:

- acciones secundarias

---

#### Disabled

- Opacidad reducida
- Cursor: not-allowed

---

### Card (Base Container)

- Background: white
- Radius: 12px
- Shadow: ligera
- Padding: 16px–20px

Uso:

- contenedor principal de información

---

### Metric Card

- Background: white
- Radius: 12px
- Padding: 16px
- Layout:
  - icono
  - label
  - valor

Uso:

- métricas de dashboard

---

### List Item

- Min height: 64px
- Background: white
- Radius: 12px
- Padding: 16px
- Layout:
  - icono izquierda
  - texto
  - chevron derecha

Uso:

- navegación hacia detalle

---

### Table / List High Density

- Header:
  - fondo neutro
  - texto bold

- Row:
  - fondo blanco

- Hover:
  - leve cambio de fondo

- Actions:
  - alineadas a la derecha

---

### Status Tag

- Border radius: full
- Padding horizontal: 12px
- Font size: 11px
- Font weight: semi-bold

Ejemplo:

- activo → verde suave
- inactivo → gris

---

### Notifications (Admin Feedback)

- Provider obligatorio: `sileo`.
- Render global: `Toaster` en `app/admin/layout.tsx`.
- Tipos cubiertos por contrato:
  - `success`, `warning`, `error`, `info`
  - notificaciones con acción
  - notificaciones por promesa
- Regla de contenido:
  - textos de notificación resueltos vía `react-i18next`
  - mensajes breves, accionables y consistentes con el tono del admin
- Restricción:
  - no introducir sistemas alternativos de toast/notification en panel admin sin excepción documentada.

---

### BottomSheet Modal (Day Agenda)

### BottomSheet Modal (Block Spaces)

- Ubicación: detalle mensual admin (`/admin/months/[month]`), CTA secundaria `Bloquear espacios`.
- Estructura:
  - título + close icon,
  - sección `Selección de día` (chips verticales 72x88 en scroll horizontal),
  - sección `Selección de espacio` (cards full-width seleccionables múltiples),
  - sección `Motivo` (chips tipo pill, selección única),
  - CTA `Confirmar bloqueo`.
- Estados visuales obligatorios:
  - día activo: fondo `primary` (`#E49F53`) + texto blanco,
  - slot activo: tarjeta completa en `primary` + texto/icono blanco,
  - motivo activo: `success-bg` + `success-text`.
- Interacción:
  - touch targets mínimos `44px`,
  - foco visible en todos los controles,
  - durante submit: modal bloqueado (sin cerrar por overlay, `X` o `Escape`).

- Uso: detalle diario desde calendario mensual (`/admin/months/[month]`).
- Layout:
  - anclado al fondo de la pantalla,
  - backdrop con blur suave,
  - superficie con `rounded-t-3xl` (32px top corners),
  - handle superior visual para affordance táctil.
- Header:
  - título a la izquierda,
  - acción cerrar (`X`) a la derecha,
  - sin navegación secundaria interna.
- Motion:
  - entrada: `SlideFromBottom`,
  - salida: `SlideToBottom`,
  - respetar `prefers-reduced-motion`.
- Interacción:
  - cierre por botón `X`,
  - cierre por click en overlay,
  - cierre por tecla `Escape`.
  - cuando el día es elegible, incluye bloque de acciones con CTAs primarias:
    - `Agendar nueva cita`,
    - `Bloquear espacios`.
  - ambos CTAs reutilizan los mismos modales del detalle mensual con la fecha del día preseleccionada.
  - si el día no es elegible, el bloque de acciones no se renderiza.

---

### Inputs / Selects

- Background: white
- Border: 1px solid `#E5E7EB`
- Radius: 12px
- Height: 44px
- cuando el control usa icono, se posiciona al lado izquierdo del campo

Variante password (admin):

- icono decorativo del campo en el lado izquierdo
- botón de acción mostrar/ocultar en el lado derecho con ícono de ojo
- la acción mostrar/ocultar debe mantener el mismo estilo de color/tono del sistema (secondary/accent en interacción)

Uso:

- filtros
- selección de estado/año
- formularios de autenticación admin

---

## Layout Patterns

### App Shell (Header + Sidebar)

- Las vistas autenticadas del admin usan shell estructural:
  - sidebar lateral,
  - app header superior,
  - área de contenido principal.
- Sidebar:
  - ancho fijo por token (`sidebar-width`),
  - fondo `surface`,
  - borde derecho `border`,
  - navegación vertical con estado activo y estado deshabilitado.
- App header:
  - altura fija por token (`header-height`),
  - fondo `surface`,
  - borde inferior `border`,
  - versión minimalista (título de sección + acción menú en mobile + selector de idioma en el extremo derecho).
- Responsive:
  - desktop (`lg+`): sidebar persistente,
  - mobile: sidebar en drawer con overlay y botón de cierre.

### Metrics Grid

- Desktop: 3 columnas
- Mobile: 2 columnas

Excepción documentada:

- Vista `/admin/months` (catálogo de meses) usa 3 columnas también en mobile para mantener densidad operativa del mockup validado.
- En esta vista, cada `MetricCard` debe mantener legibilidad y targets táctiles adecuados.

### Month Detail Layout

- Vista `/admin/months/[month]`:
  - encabezado con navegación de regreso,
  - grid de métricas `2x2`,
  - tarjeta de saturación (porcentaje + barra),
  - calendario mensual de 7 columnas.
- Semántica de color para disponibilidad diaria:
  - alta (`availableSpaces >= 2`) -> `availability-high` (azul),
  - baja (`availableSpaces = 1`) -> `availability-low`,
  - sin espacios por citas agendadas (`availableSpaces = 0` y cupo lleno por citas) -> `availability-full` (verde),
  - sin espacios por bloqueos manuales o fin de semana no operativo -> `availability-weekend` (gris).

---

### Filters Panel

- Card contenedor
- Inputs alineados horizontalmente
- CTA debajo (full width en mobile)

---

### List Section

- título + contador
- lista de items
- separación vertical constante

Patrón para `/admin/months`:

- filas compactas con `ListItem` en altura reducida (~56-60px),
- icono dentro de contenedor cuadrado a la izquierda,
- título de mes a la izquierda,
- `chevron-right` a la derecha para indicar navegación,
- estados inactivos con menor énfasis visual (opacidad/tono secundario).

### Months Catalog Filters Panel

- contenedor neutro (`inactive-bg`)
- dos selects en grid de 2 columnas: `Año` y `Estado`
- CTA `Nuevo` visible en ancho completo
- `Nuevo` abre modal de registro de meses futuros

### Months Register Modal

- contenedor centrado sobre overlay
- ancho móvil máximo de la app (`~412px`)
- título + acción de cierre (`x`)
- selector de año
- grilla de meses en 3 columnas
- la grilla excluye meses ya creados
- selección múltiple por chip/botón
- estado seleccionado:
  - fondo `primary`
  - texto blanco
- CTA `Guardar` en ancho completo

---

## Iconography

- Librería oficial: Font Awesome (free-solid + free-regular)
- Wrapper obligatorio: `components/admin/ui/AdminIcon.tsx`
- Estilo: outline
- Grosor: 2px
- Color base: accent

Ejemplos:

- calendar → meses
- archive → inactivos
- arrow → navegación
- check → confirmado

Reglas de uso:

- las vistas admin no deben importar `FontAwesomeIcon` directamente
- los íconos deben pasar por `AdminIcon` para mantener tono/tamaño consistentes
- los componentes base (`Input`, `MetricCard`, `ListItem`) deben recibir iconos ya normalizados por `AdminIcon`

---

## Usage Rules (CRÍTICO)

El agente debe:

- usar únicamente componentes de `components/admin/ui`
- respetar los tokens definidos
- reutilizar componentes existentes
- mantener consistencia visual

El agente no debe:

- usar colores hardcodeados fuera del sistema
- crear estilos inline arbitrarios
- duplicar componentes visuales
- modificar el estilo sin actualizar este documento

---

## Anti-patterns

- Botones con colores distintos a los definidos
- Cards con padding inconsistente
- Inputs con estilos diferentes entre pantallas
- Uso de estilos inline repetidos
- Mezcla de estilos admin con flujo público
- Creación de variantes no documentadas

---

## Relationship with Code

Este documento debe mapearse a:

```txt
components/admin/ui/
```

Todos los componentes UI del admin deben implementarse ahí.

---

## Enforcement Rule

Si un componente UI se repite más de una vez:

→ debe convertirse en componente reusable dentro de `components/admin/ui/`

---

## Final Rule

Si una vista del admin no puede construirse usando este sistema:

→ el sistema debe evolucionar antes de crear UI nueva

---
