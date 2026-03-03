## Documento Fuente de Verdad

Este documento define las reglas normativas del sistema.

Cualquier otro archivo (incluyendo AGENTS.md o copilot-instructions.md)
debe alinearse a esta especificación.

En caso de discrepancia, este documento prevalece.

# Especificación Técnica Formal

# Sistema de Reservas — Portal de Citas Manicurista

---

## 1. Objetivo

Definir formalmente las reglas funcionales, invariantes, restricciones técnicas y comportamiento del sistema de reservas para una manicurista independiente.

Este documento está diseñado para servir como especificación fuente para implementación backend, frontend y validaciones por agente de IA local.

---

## 2. Contexto General

- Profesional única (no múltiples recursos).
- Fuente de verdad: MySQL.
- Zona horaria obligatoria: America/Mexico_City.
- Integraciones:
  - Google Calendar (sistema espejo).
  - WhatsApp (notificación manual vía redirección).
- Enfoque Mobile-first.

---

## 3. Alcance Temporal

### 3.1 Regla de Mes Activo

El sistema solo permite reservar dentro del mes calendario en curso.

Formato de ruta:

    /citas/YYYY-MM

Restricciones:

- No se permiten meses pasados.
- No se permiten meses futuros.
- El backend valida que el mes solicitado coincida con el mes actual.
- Todas las reglas de disponibilidad aplican únicamente dentro del mes activo.

---

## 4. Reglas de Disponibilidad

### 4.1 Días válidos

- Solo lunes a viernes.
- No se permiten citas el mismo día.
- Si todos los horarios de un día están ocupados, el día no debe mostrarse disponible.

### 4.2 Horarios Base

- 09:00
- 10:00
- 13:00
- 14:00
- 17:00
- 18:00

### 4.3 Duración y Separación

- Duración del evento en Google Calendar: 3 horas.
- Separación mínima entre inicios de citas: 4 horas.

Regla formal:

    abs(start_time_nuevo - start_time_existente) >= 4 horas

---

## 5. Restricciones por Teléfono

- Un número telefónico solo puede tener una cita activa futura.
- Debe cancelar antes de crear otra.
- Formato obligatorio: 10 dígitos numéricos sin espacios.
- Nombre mínimo: 3 caracteres.

---

## 6. Estados de Cita

- CONFIRMED
- CANCELLED
- SYNC_FAILED

No existe estado PENDING persistente.

---

## 7. Flujo de Reserva

1. Usuario accede al mes actual.
2. Selecciona día disponible.
3. Selecciona horario disponible.
4. Ingresa nombre y teléfono.
5. Confirma cita.
6. Backend:
   - Inicia transacción.
   - Valida disponibilidad.
   - Inserta cita CONFIRMED.
   - Commit.
7. Crea evento en Google Calendar.
8. Redirige a WhatsApp con mensaje codificado.

Mensaje base:

    Hola Pau, soy {Nombre}.
    Te agendé para el día {Fecha} a las {Hora}.
    Muchas gracias.

El mensaje debe codificarse usando encodeURIComponent.

---

## 8. Flujo de Cancelación

1. Usuario ingresa teléfono.
2. Sistema busca cita activa futura.
3. Muestra detalles.
4. Usuario confirma cancelación.
5. Backend:
   - Cambia estado a CANCELLED.
   - Elimina evento en Google Calendar.
6. El horario vuelve a estar disponible automáticamente.

No se pueden cancelar citas pasadas.

---

## 9. Control de Concurrencia

Modelo: First-commit-wins.

Requisitos obligatorios:

- Transacciones MySQL.
- SELECT ... FOR UPDATE.
- Índice único compuesto:

  UNIQUE(date, time_slot)

Orden:

1. START TRANSACTION
2. Validar disponibilidad con bloqueo
3. INSERT
4. COMMIT
5. Crear evento Google

Google Calendar no es fuente de verdad.

---

## 10. Modelo de Datos

Tabla: appointments

- id (PK)
- name VARCHAR(100)
- phone VARCHAR(10)
- date DATE
- time_slot TIME
- status ENUM('CONFIRMED','CANCELLED','SYNC_FAILED')
- google_event_id VARCHAR(255)
- created_at DATETIME
- updated_at DATETIME

Índices:

- UNIQUE(date, time_slot)
- INDEX(phone, status)
- INDEX(date)

---

## 11. Casos Edge

1. Acceso a mes distinto al actual → Rechazar.
2. Doble confirmación simultánea → Solo una gana.
3. Fallo Google → Estado SYNC_FAILED.
4. Reserva mismo día → Rechazar.
5. Usuario con cita activa intenta reservar → Bloquear.
6. Todos los horarios ocupados → Día no visible.
7. Manipulación frontend → Backend recalcula.
8. Cancelación simultánea y nueva reserva → Resolver vía transacciones.
9. Cambio horario verano → Usar siempre America/Mexico_City.

---

## 12. Invariantes del Sistema

1. MySQL es fuente de verdad.
2. Google Calendar es sistema espejo.
3. No existen traslapes.
4. Separación mínima de 4 horas.
5. Solo una cita activa por teléfono.
6. Solo lunes a viernes.
7. No mismo día.
8. Solo mes en curso.
9. Confirmación atómica.
10. Cancelación libera horario.

## 13. Stack de tecnologías

- Next js
- Tailwind css
- Prisma ORM
- Docker para generar ambiente
