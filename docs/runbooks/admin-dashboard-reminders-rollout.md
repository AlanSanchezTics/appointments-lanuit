# Runbook: Admin Dashboard Reminders Rollout

## Objetivo

Definir la secuencia operativa para desplegar, validar y revertir el bloque de `Recordatorios` del dashboard admin, incluyendo el flujo de apertura de WhatsApp, el tracking de envíos y la tolerancia esperada ante errores de autorización y duplicado.

## Alcance

Este runbook aplica únicamente al rollout de la funcionalidad de recordatorios del panel admin:

- bloque visual `Recordatorios` en `/admin`
- acción `Enviar recordatorio`
- endpoint de tracking de recordatorios
- persistencia asociada para evitar reenvíos duplicados

No cubre cambios del flujo público ni otras secciones del dashboard admin.

## Prerrequisitos de migración

Antes de desplegar, validar que las siguientes dependencias estén listas:

1. Migración de base de datos aplicada para la tabla de recordatorios.
2. Índice único activo para impedir duplicados por `appointment_id + reminder_type`.
3. API admin desplegada con soporte para:
   - lectura del dataset de recordatorios,
   - registro de apertura/envío,
   - respuestas estables para errores esperados.
4. UI admin desplegada con:
   - card de recordatorios visible,
   - acción por fila,
   - feedback de error/estado.
5. Sesión admin funcional en staging y producción.
6. Dataset mínimo para smoke:
   - al menos 1 cita `CONFIRMED` o `SYNC_FAILED` para `NEXT_DAY`,
   - al menos 1 cita `CONFIRMED` o `SYNC_FAILED` para `NEXT_WEEK`.

## Orden de despliegue

Seguir este orden para minimizar riesgo:

1. Aplicar migración de base de datos.
2. Desplegar backend/API admin.
3. Verificar que el endpoint de tracking responde en staging.
4. Desplegar frontend admin.
5. Validar render del bloque y la acción de envío.
6. Ejecutar smoke checks funcionales.
7. Monitorear logs y errores durante la ventana inicial.

## Smoke checks funcionales

Ejecutar los siguientes checks en staging y repetir en producción tras el despliegue.

### 1. Acceso y render

- Iniciar sesión en `/admin/login`.
- Abrir `/admin`.
- Confirmar que el bloque `Recordatorios` está visible.
- Confirmar que aparecen las secciones `Mañana` y `Próxima semana`.
- Confirmar que cada cita muestra:
  - nombre,
  - número de cliente,
  - teléfono,
  - fecha u hora,
  - acción `Enviar recordatorio`.

### 2. Acción principal

- Hacer clic en `Enviar recordatorio` sobre una cita elegible.
- Confirmar que se abre una nueva pestaña o ventana con el flujo de WhatsApp esperado.
- Confirmar que el tracking de recordatorio se registra correctamente.
- Confirmar que la UI no queda bloqueada y el dashboard sigue navegable.

### 3. Idempotencia visible

- Reintentar la misma acción sobre la misma cita y tipo de recordatorio.
- Confirmar que el sistema evita un segundo envío y responde con conflicto funcional.

### 4. Alineación de datos

- Verificar que las citas mostradas corresponden a estados activos permitidos:
  - `CONFIRMED`
  - `SYNC_FAILED`
- Verificar que no aparezcan citas fuera del bucket esperado.

## Validación de errores esperados

Durante el smoke, validar explícitamente los siguientes casos.

### 401 Unauthorized

Condición:

- intentar consumir el endpoint de recordatorios sin sesión admin válida.

Esperado:

- respuesta `401`,
- el frontend no debe mostrar acción exitosa,
- el usuario debe ser redirigido o bloqueado por la capa de auth según el flujo estándar.

### 409 Conflict

Condición:

- intentar registrar de nuevo el mismo recordatorio para la misma cita y el mismo tipo.

Esperado:

- respuesta `409`,
- la UI debe mostrar feedback de que el recordatorio ya fue enviado o registrado,
- no debe crearse un segundo registro persistido.

## Plan de rollback operativo

Usar rollback por capa según el punto de falla.

### Caso 1: falla solo la UI

Síntomas:

- el dashboard carga,
- el bloque no renderiza,
- o la acción de envío falla solo en frontend.

Acción:

- revertir frontend a la versión anterior.
- mantener backend si el contrato API sigue sano.

### Caso 2: falla API o persistencia

Síntomas:

- errores en el endpoint de tracking,
- errores de lectura del dataset,
- conflicto de esquema o migración.

Acción:

- revertir backend/API al release previo estable.
- si el problema está en la migración reciente, desactivar la ruta funcional afectada si existe feature flag o aislarla por despliegue.

### Caso 3: falla general del flujo

Síntomas:

- errores mixtos en UI, API o base de datos,
- smoke checks fallan de forma consistente,
- el bloque rompe navegación del dashboard.

Acción:

- hacer rollback completo al release anterior estable.
- validar que `/admin` vuelve a renderizar sin el bloque problemático.

## Checklist operativo

- [ ] Migración aplicada
- [ ] Backend/API desplegado
- [ ] Frontend admin desplegado
- [ ] Bloque `Recordatorios` visible
- [ ] Acción `Enviar recordatorio` abre WhatsApp
- [ ] Tracking persistido correctamente
- [ ] `401` validado
- [ ] `409` validado
- [ ] Rollback probado o preparado
- [ ] Logs monitoreados tras despliegue

## Pendientes

- Definir si este rollout se ejecuta con ventana de mantenimiento o con despliegue continuo.
- Confirmar nombre exacto del endpoint de tracking en staging si cambia respecto al contrato de implementación.
- Confirmar si el smoke de producción se ejecuta manualmente o por checklist automatizado.
