Necesito que analices la estructura actual de este proyecto Next.js y generes el archivo:

docs/architecture/directory-conventions.md

## Objetivo del documento

Este documento debe establecer las convenciones de organización de directorios y ubicación de archivos del proyecto, de manera que sirva como referencia para futuros desarrollos humanos y para agentes.

No quiero un inventario superficial de carpetas. Quiero un documento arquitectónico claro que explique la intención de cada tipo de directorio y las reglas para decidir dónde debe vivir cada archivo nuevo.

---

## Contexto del proyecto

El proyecto es una aplicación tipo sistema de reservas construida con Next.js. La documentación de las funcionalidades actuales está documentada en docs/specification.md Analizala completamente.

Directorios actuales relevantes:

- app/api: rutas que procesan la lógica de negocio de la API
- app/citas: rutas del flujo de reserva
- app/cancelar: rutas del flujo de cancelación
- components/booking: componentes específicos del proceso de reserva
- components/ui: componentes universales
- lib/: funciones utilitarias

Nueva convención obligatoria a integrar:

- hooks/`<feature>`: hooks específicos por dominio para evitar lógica dentro de componentes
- hooks/shared (o hooks/): hooks reutilizables

Importante:

- app/booking y app/cancel son ejemplos de features, no casos únicos
- el documento debe generalizar la arquitectura
- el documento debe ser útil para guiar a agentes en futuras implementaciones

---

## Fase 1: Planificación (obligatoria, no omitir)

Antes de generar el documento final, debes realizar un plan interno que incluya:

0. Analiza la estructura real del proyecto.

1. Identificación de tipos de responsabilidad en el proyecto:
   - rutas
   - API
   - UI
   - lógica de negocio
   - hooks
   - utilidades

2. Identificación de patrones actuales en la estructura

3. Detección de riesgos arquitectónicos (ej: lógica mezclada en componentes)

4. Definición de cómo generalizar la estructura para futuras features

5. Definición de reglas claras de ubicación de archivos

No muestres este análisis como lista de pasos. Úsalo para construir un documento sólido.

---

## Fase 2: Generación del documento

Con base en tu planificación, genera el archivo completo:

docs/architecture/directory-conventions.md

---

## El documento debe incluir

- propósito del documento
- principios base de organización
- responsabilidad de cada tipo de directorio
- integración explícita de:
  - hooks/`<feature>`
  - hooks/shared
- convención general para:
  - app/`<feature>`
  - components/`<feature>`
  - hooks/`<feature>`
- reglas de ubicación de archivos
- guía de decisión para nuevos archivos
- anti-patrones o prácticas a evitar

---

## Directorios a documentar explícitamente

- app/
- app/api/
- app/`<feature>`/
- components/
- components/ui/
- components/`<feature>`/
- hooks/
- hooks/`<feature>`/
- lib/

---

## Reglas importantes

- No describas solo carpetas existentes; define intención arquitectónica
- No asumas que booking y cancel serán las únicas features
- No propongas una reestructura completa del proyecto salvo que sea estrictamente necesario
- Si detectas inconsistencias, documéntalas como observaciones breves
- Usa lenguaje claro, técnico y normativo
- El documento debe ser accionable para un agente

---

## Estructura esperada del markdown

# Directory Conventions

## Purpose

## Core principles

## Directory responsibilities

### app/

### app/api/

### app/`<feature>`/

### components/

### components/ui/

### components/`<feature>`/

### hooks/

### hooks/`<feature>`/

### lib/

## File placement rules

## Rules for new features

## Anti-patterns

## Decision guide for new files

---

## Entregable

Genera directamente el contenido completo del archivo markdown listo para guardarse en:

docs/architecture/directory-conventions.md
