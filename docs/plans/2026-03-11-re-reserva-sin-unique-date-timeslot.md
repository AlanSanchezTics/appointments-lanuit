# Plan de Mejora: Re-reserva con Historial Real (sin `UNIQUE(date, time_slot)`)

## Resumen
Implementar una solución estructural para permitir re-reservar slots cancelados sin hacks de “reactivar registro”, preservando historial completo de citas.
La base será remover la restricción única `date + time_slot`, mantener el control de concurrencia con locks transaccionales actuales y ajustar la lógica de reserva para **siempre crear una nueva cita** cuando el slot esté disponible según reglas activas.

## Cambios de implementación
1. **Modelo y migración DB**
- En `prisma/schema.prisma`, remover `@@unique([date, timeSlot])`.
- Agregar índice no único para rendimiento de consultas por slot diario (ej. `@@index([date, timeSlot])`), manteniendo los índices existentes por `phone,status` y `date`.
- Crear migración SQL que:
  - haga `DROP INDEX appointments_date_time_slot_key` en `appointments`.
  - cree el índice no único nuevo sobre `(date, time_slot)`.
- Regenerar cliente Prisma (`prisma generate`) tras el cambio.

2. **Lógica de negocio de reserva**
- En `lib/appointments/book-appointment.ts`:
  - Eliminar la rama que busca `CANCELLED` para reutilizar (`findFirst + update`).
  - Mantener validación de disponibilidad basada solo en citas activas (`CONFIRMED`, `SYNC_FAILED`).
  - Hacer `create` directo al reservar si pasa reglas.
  - Remover manejo específico de error `P2002` para `SLOT_NOT_AVAILABLE` (ya no aplica al quitar el unique).
- No cambiar contrato del endpoint `api/reservar` (mismos códigos/errores por reglas de negocio).

3. **Concurrencia**
- Mantener mecanismo actual (`GET_LOCK` por fecha/teléfono + `SELECT ... FOR UPDATE` de citas activas), que seguirá serializando reservas del mismo día aun sin índice único.
- Validar explícitamente por pruebas que no se duplique un slot activo por carrera.

4. **Alineación documental**
- Actualizar `docs/specification.md`:
  - Reemplazar menciones de `UNIQUE(date, time_slot)` como invariante/requisito.
  - Documentar que el histórico de canceladas se conserva como registros independientes.
  - Mantener que disponibilidad y conflictos se calculan solo sobre estados activos.

## Cambios en interfaces públicas
- **Sin cambios** en payloads/respuestas de `/api/reservar` y `/api/cancelar`.
- Cambio interno de persistencia:
  - Re-reservar un slot cancelado crea una nueva fila (histórico completo), en vez de reactivar la fila cancelada.

## Plan de pruebas
1. **Unitarias (bookAppointment)**
- Caso: existe cita cancelada previa en mismo `date/timeSlot` y no hay activas conflictivas -> se ejecuta `create` (no `update`) y retorna éxito.
- Caso: slot no disponible por reglas activas -> retorna `SLOT_NOT_AVAILABLE`.
- Caso: flujo exitoso estándar -> mantiene integración con sync/whatsapp sin cambios.
- Ajustar/eliminar tests que asumen reutilización de fila cancelada.

2. **Integración (con DB)**
- Caso crítico re-reserva:
  - reservar slot A, cancelar slot A, reservar slot A de nuevo.
  - verificar que existen **2 filas** para mismo slot: una `CANCELLED` y una `CONFIRMED`.
- Caso de carrera mismo slot:
  - dos reservas concurrentes al mismo `date/timeSlot`.
  - verificar: una exitosa y una rechazada con `SLOT_NOT_AVAILABLE`.
  - verificar que queda solo una cita activa para ese slot.
- Mantener casos existentes de teléfono duplicado y reglas direccionales.

3. **Regresión endpoint**
- Mantener tests de `/api/reservar` para mapping de errores HTTP (409/400) sin cambios contractuales.

## Supuestos y decisiones cerradas
- Estrategia elegida: **siempre crear nueva fila** al re-reservar (no reactivar cancelada).
- Alcance de calidad: **unitarias + integración**.
- Se actualizará la especificación formal para evitar contradicción con implementación.
- No se hará rediseño de reglas de disponibilidad; solo ajuste de persistencia y consistencia de concurrencia.
