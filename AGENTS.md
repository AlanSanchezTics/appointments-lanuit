# AGENTS.md

## Propósito

Este archivo define las reglas operativas que todo agente debe seguir al trabajar en este repositorio.

Su objetivo principal es asegurar que los cambios en código, arquitectura, comportamiento funcional y especialmente en los **flujos de usuario o de negocio** queden reflejados en la documentación oficial del proyecto.

## Regla principal de documentación

---

## Fuentes de verdad del sistema

El sistema se rige por múltiples niveles de documentación, cada uno con una responsabilidad específica:

- `docs/specification.md`
  - Fuente de verdad funcional completa del sistema.
  - Define comportamiento, reglas, flujos y restricciones.

- `docs/architecture/*.md`
  - Define la arquitectura del sistema.
  - Incluye convenciones de routing, API, organización de código y reglas estructurales.

- `docs/architecture/business-rules.md`
  - Define las reglas de negocio del dominio de forma estructurada y sin detalles de implementación.

- `docs/features/*.md`
  - Describe la ejecución paso a paso de los flujos del sistema (ej. booking, cancel).
  - Debe ser consistente con `specification.md`.

- `docs/decisions/*.md`
  - Documenta decisiones arquitectónicas clave y su justificación.

El agente debe considerar todos estos documentos como parte del contrato del sistema.

---

## Regla principal de documentación

Cada vez que un agente modifique o proponga modificar el flujo de una funcionalidad del proyecto, debe:

1. Identificar si el cambio impacta comportamiento funcional, reglas de negocio, validaciones, estados, integraciones, pasos del flujo, UI/UX o persistencia.
2. Revisar `docs/specification.md` antes de implementar.
3. Actualizar `docs/specification.md` para reflejar el nuevo comportamiento esperado.
4. Asegurar que la documentación quede alineada con la implementación final.
5. Incluir en su plan o entrega una nota explícita indicando qué sección de `docs/specification.md` fue actualizada o debe actualizarse.

---

## Reglas de arquitectura

El agente debe respetar la arquitectura definida en `docs/architecture/`.

No debe:

- ignorar las convenciones de routing, API o estructura de carpetas
- inventar nuevas estructuras sin documentarlas
- mezclar responsabilidades entre capas

Cualquier cambio arquitectónico debe:

1. justificarse
2. documentarse en `docs/architecture/`
3. registrarse en `docs/decisions/` si es relevante

---

## Reglas de ubicación de código

Antes de crear cualquier archivo, el agente debe clasificar su propósito:

- Rutas → `app/<feature>/`
- Endpoints → `app/api/`
- Componentes UI reutilizables → `components/ui/`
- Componentes de feature → `components/<feature>/`
- Hooks → `hooks/<feature>/` o `hooks/shared/`
- Lógica de negocio → `lib/<feature>/`
- Utilidades compartidas → `lib/shared/`

El agente no debe:

- colocar lógica de negocio en `app/api`
- colocar lógica compleja en componentes
- usar `lib/` como contenedor genérico sin estructura

---

## Regla obligatoria de hooks

Toda lógica de estado, efectos o interacción debe abstraerse en hooks.

El agente no debe:

- escribir lógica compleja dentro de componentes
- usar múltiples `useState` o `useEffect` sin encapsulación
- duplicar lógica entre componentes

Debe:

- crear hooks en `hooks/<feature>/`
- reutilizar hooks cuando sea posible

---

## Reglas de negocio

Las reglas de negocio deben definirse en:

- `docs/architecture/business-rules.md`

El agente debe:

- usar este documento como referencia principal para lógica de dominio
- no duplicar reglas en múltiples capas
- no implementar lógica sin estar alineada con estas reglas

Si una regla cambia:

- debe actualizar `docs/specification.md`
- debe actualizar `business-rules.md`

---

## Reglas para documentación de flujos (features)

Cada flujo funcional debe documentarse en:

- `docs/features/<feature>-flow.md`

Ejemplos:

- booking-flow.md
- cancel-flow.md

El agente debe:

- usar estos documentos como referencia operativa del flujo
- mantenerlos alineados con `specification.md`
- actualizar estos documentos si cambia el flujo

No debe:

- depender únicamente de `specification.md` si existe un feature doc más estructurado

---

## Qué se considera un cambio de flujo

Se considera cambio de flujo cualquier modificación que afecte uno o más de los siguientes puntos:

- pasos visibles o invisibles de una funcionalidad
- orden de interacción del usuario
- campos requeridos u opcionales
- validaciones
- reglas de negocio
- transiciones entre estados
- condiciones para avanzar, retroceder o confirmar
- creación, edición o eliminación de registros
- side effects del sistema
- integraciones externas
- mensajes de error o recuperación
- locks, expiraciones, reintentos o restricciones temporales
- comportamiento de UI/UX relacionado con el proceso

---

## Obligación del agente antes de implementar

Antes de escribir código, el agente debe hacer lo siguiente:

1. Leer `docs/specification.md`.
2. Leer `docs/architecture/business-rules.md`.
3. Leer el documento correspondiente en `docs/features/` si existe.
4. Comparar la solicitud actual contra la documentación existente.
5. Detectar si la documentación ya cubre el cambio solicitado.
6. Si la documentación está desactualizada, incompleta o contradice el nuevo requerimiento:
   - señalarlo explícitamente
   - proponer la actualización correspondiente
   - incluir la actualización de documentación como parte del plan de trabajo

---

## Obligación del agente después de implementar

Después de implementar un cambio, el agente debe verificar que:

- `docs/specification.md` describa el flujo real actualizado
- `docs/architecture/business-rules.md` refleje las reglas actualizadas
- `docs/features/*.md` reflejen el flujo actualizado
- las validaciones nuevas estén documentadas
- los cambios relevantes en UI/UX estén documentados
- las integraciones o efectos secundarios modificados estén documentados
- no existan desalineaciones entre implementación y documentación

---

## Prioridad entre código y documentación

Cuando exista una discrepancia entre la solicitud actual, el código existente y la documentación, el agente debe:

1. Tratar `docs/specification.md` como la fuente principal de verdad histórica del sistema.
2. Validar consistencia con `business-rules.md` y `features/*.md`.
3. Detectar si el cambio solicitado implica una evolución del producto.
4. Si el producto debe evolucionar, actualizar la documentación para representar el nuevo comportamiento deseado.
5. No asumir que el código actual es automáticamente correcto si contradice la documentación.
6. No asumir que la documentación está automáticamente vigente si la solicitud redefine el flujo; debe documentar el cambio.

---

## Regla para cambios en flujos funcionales

Si una tarea modifica el flujo de una funcionalidad, el agente debe incluir en su plan una sección llamada:

### Documentation Impact

Esa sección debe indicar como mínimo:

- si `docs/specification.md` requiere cambios
- qué parte del flujo cambió
- qué secciones deben agregarse, corregirse o reemplazarse
- si la actualización debe hacerse antes, durante o después de la implementación
- cualquier ambigüedad detectada

## Regla para tareas de planeación

Si la tarea solicitada es de análisis o planeación, el agente no debe limitarse a proponer cambios en código.

También debe:

- analizar impacto documental
- mencionar explícitamente si `docs/specification.md` necesita actualización
- listar las secciones documentales afectadas
- tratar la actualización de `docs/specification.md` como parte del entregable del plan

**IMPORTANTE**: Toda planeación debe considerar los siguientes puntos en su definición:

- **Fase 1: backend y migraciones**
- **Fase 2: UI/UX flow**
- **Fase 3: pruebas y rollout**
- **Fase 4: cleanup técnico**

## Regla para tareas de implementación

Si la tarea solicitada es de implementación, el agente debe considerar la actualización de documentación como parte del trabajo completo.

Una implementación no se considera terminada si el flujo cambió y `docs/specification.md` no refleja el nuevo comportamiento.

### Regla de sincronización entre flujo real y contrato de API/UI

Cuando un cambio funcional altere el orden de pasos, los datos requeridos por paso, los estados intermedios o las condiciones para avanzar en un flujo, el agente debe actualizar de forma consistente:

- `docs/specification.md` con el flujo funcional nuevo
- contratos de entrada/salida de endpoints involucrados
- estados de UI asociados al flujo
- validaciones por paso
- criterios de aceptación del proceso

Además, el agente debe verificar y dejar explícito en su entrega:

```text
Flow Contract Check:
- UI steps updated: Yes/No
- API contract updated: Yes/No
- Validation rules updated: Yes/No
- Acceptance criteria updated: Yes/No
- docs/specification.md aligned: Yes/No
```

### Regla de migración segura y compatibilidad transitoria

Cuando un cambio funcional implique modificaciones en el modelo de datos, relaciones entre entidades, validaciones persistidas o contratos internos del flujo, el agente debe evaluar y documentar explícitamente la estrategia de migración y compatibilidad transitoria.

El agente debe definir, como mínimo:

- si el cambio requiere migración de datos existentes
- si habrá convivencia temporal entre modelo antiguo y modelo nuevo
- qué campos, tablas o relaciones quedan en estado legacy
- en qué orden deben ejecutarse migraciones, backfill, despliegue y limpieza
- qué riesgos de rollback existen
- qué lecturas o flujos podrían romperse durante la transición
- qué validaciones o protecciones de integridad deben añadirse a nivel aplicación y base de datos

Además, el agente debe verificar y dejar explícito en su entrega:

```text
Migration Compatibility Check:
- Schema changes required: Yes/No
- Data backfill required: Yes/No
- Legacy compatibility required: Yes/No
- Rollback strategy defined: Yes/No
- Cleanup phase defined: Yes/No
- Integrity protections defined: Yes/No
```

## Qué debe actualizarse en specification.md

Cuando aplique, el agente debe actualizar en `docs/specification.md` cualquiera de estos apartados, según corresponda:

- resumen funcional
- propósito de la funcionalidad
- actores involucrados
- prerequisitos
- flujo principal
- flujos alternos
- validaciones
- reglas de negocio
- estados y transiciones
- persistencia y modelo de datos
- integraciones externas
- errores y recuperación
- consideraciones de UI/UX
- restricciones técnicas relevantes

## Criterio mínimo de actualización documental

Toda actualización a `docs/specification.md` debe ser:

- precisa
- consistente con el comportamiento final
- suficientemente clara para que otro agente entienda el flujo sin depender del código
- enfocada en comportamiento del sistema y no solo en detalles de implementación
- redactada como documentación mantenible, no como notas temporales

## Regla de trazabilidad en entregables

Cuando el agente entregue un plan, propuesta o implementación, debe incluir una breve nota de trazabilidad indicando:

- si hubo impacto en flujo
- si hubo impacto documental
- si `docs/specification.md` fue actualizado
- qué sección fue modificada o debe modificarse

Ejemplo:

```text
Documentation Impact:
- Yes
- Updated docs/specification.md
- Sections affected: Booking Flow, Validation Rules, Slot Lock Lifecycle
```

## Plantilla de comportamiento esperada del agente

Ante cualquier cambio funcional, el agente debe seguir esta secuencia:

1. Leer `docs/specification.md`.
2. Entender el flujo actual documentado.
3. Comparar contra la solicitud nueva.
4. Detectar diferencias funcionales.
5. Determinar impacto en código, datos, UI/UX e integraciones.
6. Determinar impacto en documentación.
7. Actualizar o proponer actualización de `docs/specification.md`.
8. Implementar o planear el cambio.
9. Verificar alineación final entre código y documentación.

## Restricciones importantes

El agente no debe:

- ignorar `docs/specification.md`
- implementar cambios de flujo sin evaluar impacto documental
- asumir que cambios de UI/UX no requieren documentación
- dejar cambios funcionales relevantes sin registrar
- tratar la documentación como opcional cuando cambie el comportamiento del sistema

## Recomendación de cumplimiento

En tareas complejas, el agente debe separar explícitamente el trabajo en estas categorías:

- Code Impact
- Data Impact
- UI/UX Impact
- Documentation Impact
- Testing Impact

Esto ayuda a mantener consistencia y trazabilidad.

## Regla de cierre

Si el agente modifica cualquier flujo del producto y no actualiza `docs/specification.md` ni explica por qué no era necesario hacerlo, la tarea debe considerarse incompleta.

## Sistema de UI del Admin Panel

El sistema visual del admin panel está definido en:

- `docs/ui/admin/design-system.md`
- `docs/ui/admin/tokens.md`
- `docs/ui/admin/components.md`

Estos documentos constituyen el contrato oficial de UI para todas las vistas administrativas.

---

## Alcance del sistema de UI

Este sistema aplica exclusivamente a:

- panel administrativo
- dashboards internos
- herramientas de gestión

No aplica a:

- flujo público (booking, cancelación)
- interfaces de usuario final

El agente debe mantener separación estricta entre ambos sistemas de UI.

---

## Uso obligatorio de componentes UI del admin

Todos los elementos visuales del admin deben construirse usando:

components/admin/ui/

El agente debe:

- reutilizar componentes existentes antes de crear nuevos
- componer vistas a partir de estos componentes
- mantener consistencia con el design system

El agente no debe:

- crear UI directamente en páginas o features sin usar estos componentes
- duplicar componentes con pequeñas variaciones
- crear componentes visuales fuera de esta carpeta sin justificación

---

## Uso obligatorio de tokens

El agente debe:

- respetar los valores definidos en `tokens.md`
- usar colores, spacing, radius y tipografía definidos
- mantener consistencia visual entre pantallas

El agente no debe:

- usar colores hardcodeados arbitrarios
- introducir nuevos valores sin documentarlos
- mezclar tokens del admin con el flujo público

---

## Regla de construcción de UI

Antes de implementar cualquier vista del admin, el agente debe:

1. Identificar qué componentes del design system aplican
2. Verificar si ya existe un componente reusable
3. Componer la vista usando `components/admin/ui/`
4. Evitar lógica visual duplicada

---

## Regla de promoción a componente reusable

Si un patrón visual aparece más de una vez:

- debe convertirse en componente reusable
- debe ubicarse en `components/admin/ui/`
- debe documentarse en `docs/ui/admin/components.md`

---

## Regla de evolución del sistema de UI

Si un requerimiento visual no puede resolverse con el sistema actual:

1. el agente debe proponer la evolución del sistema
2. actualizar:
   - `design-system.md`
   - `tokens.md` (si aplica)
   - `components.md`
3. después implementar el cambio

El agente no debe:

- resolver inconsistencias creando estilos ad hoc
- introducir variantes no documentadas

---

## Regla de aislamiento con el flujo público

El agente no debe:

- aplicar el design system del admin al flujo público
- migrar componentes del flujo público a `components/admin/ui/`
- asumir que ambos sistemas deben unificarse

Ambos sistemas deben evolucionar de forma independiente.

---

## Validación obligatoria en entregables

Cuando el agente modifique UI del admin, debe incluir:

Admin UI Check:

- Uses components/admin/ui: Yes/No
- Reused existing components: Yes/No
- New reusable components created: Yes/No
- Tokens respected: Yes/No
- design-system.md aligned: Yes/No
- Public flow untouched: Yes/No

---

## Regla de incumplimiento

Si una implementación del admin:

- no usa componentes reutilizables
- introduce estilos no definidos
- rompe consistencia visual
- mezcla sistemas (admin vs público)

la tarea debe considerarse incompleta.

## Reglas específicas para notificaciones UI

### Objetivo

Estandarizar las notificaciones de UI derivadas de acciones del usuario o del sistema.

### Alcance

Esta regla aplica únicamente al frontend del panel admin.

### Regla obligatoria

Para notificaciones de tipo `success`, `warning`, `error`, `info`, notificaciones con acción y notificaciones basadas en promesas, el agente debe usar exclusivamente la librería `sileo`.

No se permite introducir librerías alternativas de `toast`/`notification` para esos casos, salvo que exista una excepción explícita y documentada en este archivo.

### Implementaciones permitidas

Ejemplos de implementación directa:

```typescript
sileo.success({ title: "Changes saved" });

sileo.error({
  title: "Something went wrong",
  description: "Please try again later.",
});

sileo.warning({ title: "Storage almost full" });

sileo.info({ title: "New update available" });
```

Ejemplo de implementación con acción:

```typescript
sileo.action({
  title: "File uploaded",
  description: "Share it with your team?",
  button: {
    title: "Share",
    onClick: () => console.log("Shared!"),
  },
});
```

Ejemplo de implementación con promesas:

```typescript
sileo.promise(fetchData(), {
  loading: { title: "Loading..." },
  success: { title: "Done!" },
  error: { title: "Failed" },
});
```

### Reglas de contenido

- En panel admin, los textos de notificaciones deben resolverse mediante `react-i18next`.
- Los mensajes deben ser breves, claros y orientados a la acción esperada.
- En errores, incluir descripción cuando ayude a recuperación del usuario.

### Criterio de cumplimiento

Una tarea del panel admin que incluya feedback de notificaciones se considera incompleta si:

- no usa `sileo` en los casos cubiertos por esta regla
- mezcla múltiples sistemas de notificación sin justificación documentada

Además, el agente debe verificar y dejar explícito en su entrega:

```text
Notification Contract Check:
- Sileo used for success/warning/error/info: Yes/No
- Sileo action notifications used when applicable: Yes/No
- Sileo promise notifications used when applicable: Yes/No
- i18n applied in admin notifications: Yes/No
- Alternative notification systems introduced: Yes/No
```

## Spec Kit / Spec-Driven Development

Spec Kit is allowed as a per-change workflow layer in this repository.
It does not replace `docs/specification.md`, `docs/architecture/*`, or `docs/features/*`.

Required rules:

- `docs/specification.md` remains the permanent product contract.
- `specs/*` is a temporary working area for the change in progress.
- Any behavior, validation, state, integration, UI/UX, API, or persistence change must include an explicit documentation impact note.
- When product behavior changes, the matching `docs/specification.md` and feature/architecture docs must be updated in the same workstream.
- Spec Kit artifacts must never be treated as the source of truth when they conflict with `docs/*`.
- Use the local constitution in `.specify/memory/constitution.md` and the template overrides in `.specify/templates/overrides/` when working with Spec Kit.

Recommended flow for new feature work:

1. Write or update the feature spec under `specs/<feature>/spec.md`.
2. Clarify ambiguous behavior before planning.
3. Build the implementation plan and task list.
4. Implement in small, testable increments.
5. Reconcile the implementation back into `docs/` before closing the work.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
