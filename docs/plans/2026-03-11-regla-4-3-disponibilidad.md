# Redefinicion Regla 4.3 (Pares Direccionales + Maximo 3 por Dia)

## Resumen
Actualizar la especificacion y la logica de disponibilidad/reserva para reemplazar la regla de "separacion minima de 4 horas" por una regla direccional por pares horarios, manteniendo duracion de evento Google en 3 horas.

Decisiones cerradas para esta implementacion:
- Tercer par oficial: `17:00` y `18:00`.
- Maximo por dia: 3 citas, con modelo "1 cita por par".
- Evaluacion de disponibilidad: composicion global contra todas las citas confirmadas del dia.

## Cambios de implementacion
- **Especificacion funcional** (`docs/specification.md`):
  - Reescribir seccion 4.3 para definir formalmente:
    - Pares: `(09:00,10:00)`, `(13:00,14:00)`, `(17:00,18:00)`.
    - Regla direccional:
      - Si una cita esta en la primera hora de un par, bloquear la segunda hora de todos los pares anteriores.
      - Si una cita esta en la segunda hora de un par, bloquear la primera hora de todos los pares posteriores.
    - Limite de 3 citas por dia (max. una por par).
  - Actualizar invariantes y casos edge para eliminar toda referencia a "4 horas".
- **Logica de negocio de disponibilidad/reserva**:
  - Sustituir en reglas la validacion por distancia horaria (`APPOINTMENT_GAP_HOURS`) por una funcion determinista de compatibilidad por pares e indice de par.
  - Mantener una sola fuente de calculo de slots validos reutilizada por:
    - calculo mensual de disponibilidad;
    - validacion transaccional de `bookAppointment`.
  - Asegurar comportamiento composicional: un slot candidato es valido solo si no viola ninguna restriccion inducida por ninguna cita ocupada del dia.
  - Enforce explicito del limite diario: rechazar reserva cuando ya existan 3 citas activas ese dia (aunque no haya choque directo de slot).
- **Constantes/contratos internos**:
  - Retirar dependencia de `APPOINTMENT_GAP_HOURS` en disponibilidad.
  - Conservar `BASE_TIME_SLOTS` y `GOOGLE_EVENT_DURATION_HOURS = 3`.
  - No hay cambios en API HTTP ni en schema publico de request/response.

## Plan de pruebas
- **Unitarias de reglas** (`tests/lib/availability/rules.test.ts`):
  - Reemplazar casos de "minimum gap/backward spacing" por matriz de compatibilidad por pares.
  - Casos minimos:
    - Sin ocupados -> salen los 6 slots.
    - Ocupado `17:00` -> disponibles `09:00` y `13:00` (no `10:00`, `14:00`, `18:00`, ni `17:00`).
    - Ocupado `10:00` -> disponibles `14:00` y `18:00` (no `09:00`, `10:00`, `13:00`, `17:00`).
    - Composicion con multiples ocupados (ej. `10:00` + `14:00`) para validar interseccion de restricciones.
    - Dia con 3 citas validas ya ocupadas -> no slots disponibles.
- **Unitarias de servicio** (`tests/lib/availability/service.test.ts`):
  - Ajustar descripciones/expectativas a la nueva semantica por pares.
  - Verificar que el dia desaparece cuando la combinacion de ocupados deja 0 slots.
- **Integracion de reserva** (`tests/integration/book-appointment.integration.test.ts`):
  - Reemplazar pruebas de "minimum gap" por aceptacion/rechazo segun regla direccional.
  - Agregar caso explicito de rechazo por tope diario (4ta reserva en mismo dia).
  - Mantener prueba de concurrencia first-commit-wins y error `SLOT_NOT_AVAILABLE`.

## Supuestos y defaults
- "recerva/reserva" se interpreta como reserva (correccion ortografica, sin impacto funcional).
- El ejemplo conflictivo `15/16` queda descartado; se usa definitivamente `17/18`.
- No se modifica la duracion en Google Calendar: sigue en 3 horas.
- No se cambian rutas ni contratos de API; solo reglas de disponibilidad/validacion y pruebas.
