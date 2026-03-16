# AGENTS.md

## Propósito

Este archivo define las reglas operativas que todo agente debe seguir al trabajar en este repositorio.

Su objetivo principal es asegurar que los cambios en código, arquitectura, comportamiento funcional y especialmente en los **flujos de usuario o de negocio** queden reflejados en la documentación oficial del proyecto.

La documentación fuente de verdad para funcionalidad, reglas, flujos y contexto del producto es:

- `docs/specification.md`

## Regla principal de documentación

Cada vez que un agente modifique o proponga modificar el flujo de una funcionalidad del proyecto, debe:

1. Identificar si el cambio impacta comportamiento funcional, reglas de negocio, validaciones, estados, integraciones, pasos del flujo, UI/UX o persistencia.
2. Revisar `docs/specification.md` antes de implementar.
3. Actualizar `docs/specification.md` para reflejar el nuevo comportamiento esperado.
4. Asegurar que la documentación quede alineada con la implementación final.
5. Incluir en su plan o entrega una nota explícita indicando qué sección de `docs/specification.md` fue actualizada o debe actualizarse.

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

## Obligación del agente antes de implementar

Antes de escribir código, el agente debe hacer lo siguiente:

1. Leer `docs/specification.md`.
2. Comparar la solicitud actual contra la documentación existente.
3. Detectar si la documentación ya cubre el cambio solicitado.
4. Si la documentación está desactualizada, incompleta o contradice el nuevo requerimiento:
   - señalarlo explícitamente
   - proponer la actualización correspondiente
   - incluir la actualización de documentación como parte del plan de trabajo

## Obligación del agente después de implementar

Después de implementar un cambio, el agente debe verificar que:

- `docs/specification.md` describa el flujo real actualizado
- las reglas de negocio nuevas estén documentadas
- las validaciones nuevas estén documentadas
- los cambios relevantes en UI/UX estén documentados
- las integraciones o efectos secundarios modificados estén documentados
- no existan desalineaciones entre implementación y documentación

## Prioridad entre código y documentación

Cuando exista una discrepancia entre la solicitud actual, el código existente y `docs/specification.md`, el agente debe:

1. Tratar `docs/specification.md` como la fuente principal de verdad histórica del sistema.
2. Detectar si el cambio solicitado implica una evolución del producto.
3. Si el producto debe evolucionar, actualizar la documentación para representar el nuevo comportamiento deseado.
4. No asumir que el código actual es automáticamente correcto si contradice la especificación.
5. No asumir que la especificación está automáticamente vigente si la solicitud actual redefine el flujo; debe documentar el cambio.

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
