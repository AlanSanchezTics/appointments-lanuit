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

### Inputs / Selects

- Background: white
- Border: 1px solid `#E5E7EB`
- Radius: 12px
- Height: 44px

Uso:

- filtros
- selección de estado/año

---

## Layout Patterns

### Metrics Grid

- Desktop: 3 columnas
- Mobile: 2 columnas

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

---

## Iconography

- Estilo: outline
- Grosor: 2px
- Color base: accent

Ejemplos:

- calendar → meses
- archive → inactivos
- arrow → navegación
- check → confirmado

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
