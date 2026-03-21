# Admin UI Tokens – La Nuit (Admin Core)

## Purpose

Este documento define los design tokens del admin panel de La Nuit.

Su objetivo es centralizar los valores visuales base del sistema para asegurar consistencia, reutilización y escalabilidad en todas las vistas administrativas.

Estos tokens aplican exclusivamente al admin panel.

No aplican al flujo público del sistema.

---

## Scope

Estos tokens deben usarse en:

- dashboards administrativos
- listados
- filtros
- tablas
- formularios internos
- componentes base de `components/admin/ui/`

No deben usarse en:

- booking público
- cancelación pública
- vistas externas al panel administrativo

---

## Colors

### Base

- `canvas`: `#FBF9F5`
  - fondo general del admin

- `surface`: `#FFFFFF`
  - cards, modales, paneles, filas

### Brand / Action

- `primary`: `#E49F53`
  - acento visual de marca en el admin

- `accent`: `#875207`
  - acciones principales, botones CTA, iconografía destacada

### Semantic

- `success-bg`: `#D1FAE5`
  - fondo de estados positivos

- `success-text`: `#065F46`
  - texto de estados positivos

- `inactive-bg`: `#F5F3EF`
  - fondos neutros o estados inactivos

### Text

- `text-primary`: `#1C1917`
  - texto principal

- `text-secondary`: `#6B7280`
  - texto secundario, labels auxiliares

### Borders

- `border`: `#E5E7EB`
  - bordes sutiles en inputs, tablas y contenedores

---

## Typography

### Font Families

- `font-heading`: `Montserrat`
- `font-body`: `Montserrat`

### Text Styles

- `heading-section`
  - font: Montserrat
  - weight: 700
  - size: 18px

- `metric-label`
  - font: Montserrat
  - weight: 700
  - size: 10px
  - transform: uppercase

- `metric-value`
  - font: Montserrat
  - weight: 800
  - size: 16px

- `body`
  - font: Montserrat
  - weight: 500
  - size: 14px

- `tag`
  - font: Montserrat
  - weight: 600
  - size: 11px

---

## Spacing

- `xs`: `4px`
- `sm`: `8px`
- `md`: `16px`
- `lg`: `24px`
- `xl`: `32px`

### Layout References

- `page-horizontal-padding`: `24px`
- `card-gap`: `16px`
- `card-padding-sm`: `16px`
- `card-padding-md`: `20px`

---

## Border Radius

- `radius-sm`: `8px`
- `radius-md`: `12px`
- `radius-lg`: `16px`
- `radius-pill`: `9999px`

---

## Shadows

- `shadow-sm`
  - uso: cards base, metric cards, list items

No deben usarse sombras pesadas en el admin panel.

El sistema visual del admin prioriza ligereza y claridad sobre profundidad excesiva.

---

## Sizing

### Controls

- `button-height`: `48px`
- `input-height`: `44px`
- `list-item-min-height`: `64px`

### Layout Patterns

- `metrics-grid-desktop-columns`: `3`
- `metrics-grid-mobile-columns`: `2`

---

## Iconography

### Style

- outline
- grosor visual aproximado: `2px`

### Default Color

- `accent`: `#875207`

---

## Token Usage Rules

El agente debe:

- usar estos tokens como referencia visual base del admin
- mantener consistencia entre componentes
- preferir reutilización antes que nuevos valores

El agente no debe:

- inventar nuevos colores sin documentarlos
- cambiar spacing arbitrariamente
- mezclar tokens del admin con el flujo público
- usar hexadecimales nuevos si ya existe un token equivalente

---

## Mapping to Code

Estos tokens deben reflejarse en:

- `components/admin/ui/`
- theme del proyecto si existe
- configuración de Tailwind si se decide centralizar ahí

---

## Final Rule

Si un nuevo requerimiento visual del admin no cabe dentro de estos tokens:

- primero debe evolucionarse este documento
- después debe evolucionarse el componente reusable correspondiente
