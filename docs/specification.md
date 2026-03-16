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

### 3.1 Regla de Meses Activos

El sistema permite reservar únicamente dentro de los meses marcados como `ACTIVE` en `active_months`.

Formato de ruta:

    /citas/YYYY-MM

Restricciones:

- No se permiten meses pasados.
- Los meses futuros solo se permiten si están marcados como `ACTIVE`.
- El backend valida que el mes solicitado esté en `active_months` con estado `ACTIVE`.
- Todas las reglas de disponibilidad aplican únicamente dentro de meses activos.
- Ventana operativa por defecto: mes actual + siguiente mes (`ACTIVE_MONTH_WINDOW_SIZE=2`), extensible a N meses.
- Los meses pasados deben quedar `INACTIVE` por reconciliación automática.

---

## 4. Reglas de Disponibilidad

### 4.1 Días válidos

- Solo lunes a viernes.
- Se permiten citas el mismo día **solo** si el horario seleccionado aún no ha pasado en la zona `America/Mexico_City`.
- Horarios del mismo día ya transcurridos no deben mostrarse como disponibles.
- Si todos los horarios de un día están ocupados, el día no debe mostrarse disponible.
- Los horarios con lock temporal vigente tampoco deben mostrarse como disponibles.

### 4.2 Horarios Base

- 09:00
- 10:00
- 13:00
- 14:00
- 17:00
- 18:00

### 4.3 Regla Direccional por Pares + Máximo Diario

- Duración del evento en Google Calendar: 3 horas.
- Pares oficiales de horarios:
  - (09:00, 10:00)
  - (13:00, 14:00)
  - (17:00, 18:00)
- Límite diario: máximo 3 citas activas por día.
- Restricción estructural: máximo 1 cita activa por par.

Regla direccional formal:

- Si existe una cita en la primera hora de un par $i$, se bloquea la segunda hora de todos los pares anteriores ($j < i$).
- Si existe una cita en la segunda hora de un par $i$, se bloquea la primera hora de todos los pares posteriores ($j > i$).
- Un slot candidato es válido solo si cumple simultáneamente todas las restricciones inducidas por todas las citas activas del día (composición global).

---

## 5. Restricciones por Teléfono

- Un número telefónico solo puede tener una cita activa futura.
- Debe cancelar antes de crear otra.
- Formato persistido obligatorio: 10 dígitos numéricos.
- En UI se permite captura con separadores (espacios/guiones/paréntesis), pero backend normaliza a 10 dígitos antes de validar y persistir.
- Nombre mínimo: 3 caracteres.
- El cliente se identifica por teléfono.
- Un teléfono no puede estar asociado a más de un nombre.

---

## 6. Estados de Cita

- CONFIRMED
- CANCELLED
- SYNC_FAILED

No existe estado PENDING persistente.

---

## 7. Flujo de Reserva

1. Usuario accede a un mes habilitado (`/citas/YYYY-MM`).
2. Selecciona día disponible.
3. Selecciona horario disponible.
4. Ingresa teléfono.
5. Al avanzar, backend valida teléfono y realiza `check + lock` temporal (`TTL = 10 minutos`):
   - Si el cliente existe por teléfono, se avanza directo a confirmación.
   - Si el cliente no existe, UI solicita nombre y luego avanza a confirmación usando el lock ya creado.
6. Si el lock no puede crearse (slot ocupado/lockeado), usuario debe elegir otro horario.
7. Usuario confirma cita.
8. Backend:
   - Inicia transacción.
   - Limpia locks expirados.
   - Valida lock temporal vigente (`lock_token`) para fecha/slot/teléfono.
   - Valida disponibilidad.
   - Resuelve cliente por teléfono (reutiliza si existe, crea si no existe).
   - Inserta cita CONFIRMED ligada a `client_id`.
   - Elimina lock temporal consumido.
   - Commit.
9. Crea evento en Google Calendar.
10. Redirige a WhatsApp con mensaje codificado.
11. El endpoint legacy `POST /api/reservar` queda deprecado y debe responder `410`.

Si el usuario abandona en confirmación o expira el TTL, el lock deja de bloquear automáticamente.

Mensaje base:

    Hola Pau ✨
    soy {Nombre} ✌️.
    Ya te agendé para el día {Fecha} a las {Hora}.
    Muchas gracias y bonito día 😊

    (Para cancelar tu cita accede a https://dominio.com/cancelar)

El mensaje debe codificarse usando encodeURIComponent.

---

## 8. Flujo de Cancelación

1. Usuario ingresa teléfono.
2. Sistema busca cita cancelable con estas condiciones simultáneas:
   - Estatus `CONFIRMED`.
   - Fecha futura (`date > hoy` en zona `America/Mexico_City`).
   - Dentro de un mes `ACTIVE` en `active_months`.
   - La cita debe estar al menos a 24 horas de distancia; si faltan menos de 24 horas, no se permite cancelación por este medio.
3. Si existe coincidencia, se muestran detalles de la cita y acciones:
   - `Cancelar cita`.
   - `Regresar al inicio`.
4. Usuario confirma cancelación.
5. Backend:
   - Cambia estado a `CANCELLED`.
   - Elimina evento en Google Calendar (si existe `google_event_id`).
6. UI muestra el mensaje final:
   - `Tu cita ha sido cancelada con exito`.
7. El horario vuelve a estar disponible automáticamente.

No se pueden cancelar citas pasadas.

---

## 9. Control de Concurrencia

Modelo: First-commit-wins.

Requisitos obligatorios:

- Transacciones MySQL.
- SELECT ... FOR UPDATE.
- Índice compuesto no único para rendimiento de consultas por slot:

  INDEX(date, time_slot)

Locking temporal adicional:

- Tabla `reservation_locks` para bloquear slot durante el paso de confirmación.
- `TTL` fijo de 10 minutos por lock.
- Sin cron obligatorio: cleanup lazy en endpoints de lock/confirm y filtro por `expires_at > now` en disponibilidad.

Orden de confirmación:

1. START TRANSACTION
2. Limpiar locks expirados (`expires_at <= now`)
3. Validar lock temporal vigente (`lock_token`) con bloqueo
4. Validar disponibilidad con bloqueo
5. INSERT (siempre crea una nueva fila)
6. Eliminar lock consumido
7. COMMIT
8. Crear evento Google

Google Calendar no es fuente de verdad.

Histórico de cancelaciones:

- Re-reservar un slot previamente cancelado crea una nueva fila.
- Las filas CANCELLED se conservan como historial.
- La disponibilidad y conflictos se calculan solo sobre estados activos (CONFIRMED, SYNC_FAILED).

---

## 10. Modelo de Datos

Tabla: clients

- id (PK)
- name VARCHAR(100)
- phone VARCHAR(10) UNIQUE
- created_at DATETIME
- updated_at DATETIME

Tabla: appointments

- id (PK)
- client_id (FK -> clients.id)
- date DATE
- time_slot TIME
- status ENUM('CONFIRMED','CANCELLED','SYNC_FAILED')
- google_event_id VARCHAR(255)
- created_at DATETIME
- updated_at DATETIME

Índices:

- INDEX(date, time_slot)
- INDEX(client_id, status)
- INDEX(date)

Tabla: reservation_locks

- id (PK)
- date DATE
- time_slot TIME
- phone VARCHAR(10)
- lock_token VARCHAR(191) UNIQUE
- expires_at DATETIME
- created_at DATETIME
- updated_at DATETIME

Índices:

- INDEX(date, time_slot, expires_at)
- INDEX(phone, expires_at)

Tabla: active_months

- id (PK)
- month CHAR(7) UNIQUE (`YYYY-MM`)
- status ENUM('ACTIVE','INACTIVE')
- created_at DATETIME
- updated_at DATETIME

Índices:

- UNIQUE(month)
- INDEX(status, month)

---

## 11. Casos Edge

1. Acceso a mes no activo o mes pasado → Rechazar.
2. Doble confirmación simultánea → Solo una gana.
3. Fallo Google → Estado SYNC_FAILED.
4. Reserva mismo día → Rechazar.
5. Usuario con cita activa intenta reservar → Bloquear.
6. Día con 3 citas activas válidas (una por par) → Día no visible.
7. Manipulación frontend → Backend recalcula.
8. Cancelación simultánea y nueva reserva → Resolver vía transacciones.
9. Cambio horario verano → Usar siempre America/Mexico_City.
10. Intento de cancelar una cita con menos de 24 horas de anticipación → Rechazar en flujo web de cancelación.
11. Lock temporal expirado durante confirmación → Rechazar (`LOCK_EXPIRED_OR_INVALID`) y pedir reselección.
12. Dos usuarios intentando lockear el mismo slot → Solo un lock vigente gana.
13. Cambio de mes (00:00 America/Mexico_City) con `active_months` desactualizada → el job de reconciliación debe reactivar ventana vigente y desactivar meses pasados.

---

## 12. Invariantes del Sistema

1. MySQL es fuente de verdad.
2. Google Calendar es sistema espejo.
3. No existen traslapes.
4. Regla direccional por pares y máximo 3 citas activas por día.
5. Solo una cita activa por teléfono.
6. Solo lunes a viernes.
7. Mismo día permitido únicamente para horarios futuros (según hora actual en `America/Mexico_City`).
8. Solo meses `ACTIVE` y nunca meses pasados.
9. Confirmación atómica.
10. Cancelación libera horario.
11. Lock temporal expira automáticamente por `expires_at` y no bloquea fuera de su ventana.

## 13. Stack de tecnologías

- Next js
- Tailwind css
- Prisma ORM
- Docker para generar ambiente
