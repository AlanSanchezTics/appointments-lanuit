# Ronda 07 (1F): la reprogramación pública respeta `reservation_locks` (D87)

Estado: **código y pruebas unitarias listos para Reviewer (alto riesgo)**. La prueba de integración está escrita pero **no ejecutada** (requiere una base de pruebas desechable que no está autorizada, ver "Pendiente").

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `lib/my-appointments/service.ts` | `validateRescheduleDestination` lee el lock vigente del destino y rechaza si es de otra clienta. Se pasa `phone` a la validación. |
| `tests/lib/my-appointments.service.test.ts` | Mock de `@/lib/db/appointments` parcial (usa el helper real). `queryRawMock` se reinicia en cada test. Bloque nuevo "reservation locks at the destination (D87)" con 4 casos. |
| `tests/integration/reschedule-reservation-lock.integration.test.ts` | Nuevo. 4 casos de integración (no ejecutado). |

No se tocaron documentos (`docs/**`), esquema, rutas ni UI.

## Semántica replicada

| Flujo | Lock de otra clienta sobre la hora | Código de error |
|---|---|---|
| Reserva pública (`acquireReservationSlotLockCore`, `lock-reservation-slot.ts`) | Cuenta como ocupado (`expires_at > now`). Los locks propios se borran antes de leer. | `SLOT_LOCKED` |
| Creación admin y reprogramación admin (`admin/appointments/service.ts`) | `findActiveReservationLockForSlotForUpdate` y `activeLock.phone !== <cliente>` | `SLOT_LOCKED` |
| **Reprogramación pública (este cambio)** | Mismo helper y misma comparación por teléfono | `SLOT_NOT_AVAILABLE` |

Código del fix (resumen):

```ts
const activeLock = await findActiveReservationLockForSlotForUpdate(tx, {
  date: input.date,
  timeSlot: input.timeSlot,
  now,
});

if (activeLock && activeLock.phone !== input.phone) {
  throw new Error("SLOT_NOT_AVAILABLE");
}
```

## Decisiones

1. **Código de error: `SLOT_NOT_AVAILABLE`** (reutilizado, sin código nuevo).
   - La ruta `app/api/my-appointments/reschedule/route.ts` solo mapea a 409 `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_NOT_MODIFIABLE`, `SLOT_NOT_AVAILABLE` y `LOCK_TIMEOUT`. Un `SLOT_LOCKED` caería en 400 sin cambiar la ruta.
   - `docs/architecture/api.md` (reprogramación pública) documenta solo `SLOT_NOT_AVAILABLE` para destinos no disponibles.
   - Alternativa: `SLOT_LOCKED` exige cambiar la ruta, `api.md` y el manejo de UI. **Decisión de producto/contrato para el Orchestrator**, no tomada aquí.
2. **Exclusión de la cita que se reprograma: no hace falta para locks.** Ya se excluye de la ocupación por `id` (código existente). Los locks no tienen FK a la cita.
3. **Exclusión de locks del mismo cliente: sí.** Si el teléfono del lock es el de la solicitud, no bloquea. Es la misma regla que la reserva pública y la creación admin. **No se borra** el lock propio: la reprogramación no crea lock ni posee su token, y borrarlo sería un efecto secundario no pedido. Caduca solo.
4. **Lectura de locks en el punto correcto.** Orden resultante en la transacción:
   `acquireBookingLocks(fecha, teléfono)` -> FOR SHARE de reglas -> `lockConflictingAppointments` -> FOR UPDATE de la cita -> ocupación -> **lectura de locks** (`FOR UPDATE`, `expires_at > now`) -> `resolveDay` -> UPDATE.
   - La lectura es bloqueante, así que no depende del snapshot de REPEATABLE READ.
   - Los escritores de `reservation_locks` por fecha (adquisición, cleanup, confirmación) toman `booking:date:D` antes, así que no hay escritor concurrente durante la validación.
   - Invariante: como la adquisición rechaza horas con lock ajeno (`SLOT_LOCKED`), hay a lo sumo un lock vigente por (fecha, hora). Por eso el `LIMIT 1` del helper no oculta un lock ajeno.
5. **Error dentro del `try`.** Un error SQL en la lectura de locks también se convierte en `SLOT_NOT_AVAILABLE`, igual que el resto de la validación (limitación F4 ya documentada en `api.md`, no se corrige aquí).

## Pruebas

### Antes del fix (static red verificado)

`npx vitest run tests/lib/my-appointments.service.test.ts`: **2 fallos esperados**, 10 pasan.
- "rejects a destination held by another client's active lock": la reprogramación resuelve en lugar de rechazar.
- "filters expired locks in the lookup...": no hay consulta de locks.
- Los casos "own lock" y "no locks" pasan antes y después (guardas de regresión).

### Después del fix (ejecutado)

Comando: `npx vitest run tests/lib/my-appointments.service.test.ts tests/app/api-my-appointments-reschedule-route.test.ts tests/app/api-my-appointments-cancel-route.test.ts tests/app/api-my-appointments-lookup-route.test.ts tests/lib/appointments/lock-reservation-slot.test.ts`

- **30/30 pasan** en 5 archivos (service 12, reschedule route 3, cancel route 2, lookup route 2, lock-reservation-slot 11).

### Fallos preexistentes conocidos (reproducidos)

- `tests/app/api-admin-cancel-route.test.ts`: "returns 200 when cancellation succeeds" **FAIL** (reproducido, no relacionado).
- `tests/components/admin/months/month-detail-view.test.tsx`: "disables schedule CTA when month is inactive" **FAIL** (reproducido, no relacionado).
- `reservation-lock` (TIME L65/L145) y `cancel-appointment` (0/3): son integración. Con la base deshabilitada aparecen como *skipped* en esta ejecución; **no reproducidos** (requieren base).

### Otros checks

- `npx tsc --noEmit -p tsconfig.json`: 32 líneas de error en el proyecto. Ninguna en los archivos tocados. No comparé contra la línea base.
- `npx eslint` sobre los 3 archivos tocados: sin salida (sin errores).
- `tests/integration/reschedule-reservation-lock.integration.test.ts` sin `ENABLE_INTEGRATION_DB`: colecciona y queda en *skipped* (4/4). Confirma que compila; no ejecuta lógica.

### Integración: no ejecutada

- El helper `tests/integration/helpers/db.ts` hace `deleteMany` sobre `activeMonth`, `reservationLock`, `appointmentLog`, `appointment` y `client` en el `DATABASE_URL` activo. El `.env` solo define `DATABASE_URL` (desarrollo) y `DATABASE_URL_PROD`; no hay base de pruebas separada.
- Ejecutarla contra esa base borraría datos. No se ejecutó: el brief no autoriza ese destino.
- **Caso que debe fallar sin el fix:** "rejects a destination held by another client's active lock...". Sin el fix la reprogramación resuelve. Los demás casos son guardas (lock expirado, lock propio, sin locks).
- Comando previsto, solo con base desechable autorizada:
  `ENABLE_INTEGRATION_DB=1 DATABASE_URL=<base desechable> npx vitest run --no-file-parallelism tests/integration/reschedule-reservation-lock.integration.test.ts`

## Documentation Impact

- Sí, hay impacto documental. **No se editó ningún documento** (lo hace otra ronda).
- `docs/specification.md` §8.2 paso 4 ya describe la ocupación con locks. Con el fix es cierto. Falta mencionar que un destino con lock vigente de otra clienta responde `SLOT_NOT_AVAILABLE` (en la sección de errores de 8.2, si la hay).
- `docs/architecture/api.md`: L247 y L484-492 (`SLOT_NOT_AVAILABLE` del reschedule público). Agregar la causa "lock vigente de otra clienta". Sin cambio de códigos ni de HTTP.
- `docs/architecture/business-rules.md` ~L288: ya dice que el reschedule considera locks activos. Sin cambio de texto necesario.
- §9 y ADR 0006: el orden de locks del reschedule público no cambia (lectura de locks después de los conflictos).
- Pendiente de comprobar por el Orchestrator: si existe `docs/features/*` para reprogramación pública (no lo revisé).
- Decisión a registrar en `00-decisions.md`: D87 implementado con `SLOT_NOT_AVAILABLE` y exclusión de locks propios (decisión 1 y 3 de este informe).

Flow Contract Check:
- UI steps updated: No (sin cambio de UI; el mensaje ante `SLOT_NOT_AVAILABLE` ya existe)
- API contract updated: No (mismos códigos y HTTP; nueva causa de un código existente, la documentación debe mencionarlo)
- Validation rules updated: Pendiente en docs (regla de negocio: lock vigente bloquea el destino)
- Acceptance criteria updated: Pendiente en docs
- docs/specification.md aligned: No todavía (el texto de §8.2 ya lo describe; falta la nota de error)

## Migration Compatibility Check

- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: No (sin cambio de contrato; el único cambio de comportamiento es rechazar un destino con lock ajeno vigente)
- Rollback strategy defined: Sí (revertir `lib/my-appointments/service.ts` y los tests; no se escribe ningún dato nuevo)
- Cleanup phase defined: Sí, no requerida (los locks caducados se ignoran por el predicado `expires_at > now` y los limpia el flujo de adquisición existente)
- Integrity protections defined: Sí, solo a nivel aplicación (named lock de fecha + FOR UPDATE). No se agregó constraint de base de datos porque no cambia el esquema.

## Riesgos residuales y puntos abiertos

1. **Owner/Orchestrator:** confirmar `SLOT_NOT_AVAILABLE` (elegido) frente a `SLOT_LOCKED`. El segundo implica cambios de ruta, `api.md` y UI.
2. Bloqueos manuales admin (`blocked-spaces`) y su lectura plana (D80/F2): no revisados en esta ronda.
3. `rescheduleAppointmentInTransaction` (`reservar/confirm` con reagendado) no consulta locks ajenos. Queda protegido por el token propio (un lock vigente impide que otra clienta reserve esa hora), así que no se cambió.
4. `releaseReservationSlotLock` borra locks sin el named lock de fecha (preexistente). Solo puede quitar un lock, así que el efecto es conservador.
5. El mapeo de `validateRescheduleDestination` convierte cualquier error en `SLOT_NOT_AVAILABLE` (F4, preexistente).
6. Perfil: `{{test_commands}}` apunta a "CLAUDE.md, sección Commands", que no existe (`CLAUDE.md` solo importa `@AGENTS.md`). Usé los scripts de `package.json`. Conviene corregir el perfil.

## Pendiente

- Owner: autorizar una base de pruebas desechable para ejecutar la integración con `--no-file-parallelism`.
- Reviewer (alto riesgo): revisar el diff de `lib/my-appointments/service.ts` y el caso de integración.
- Docs (otra ronda): §8.2, `api.md` L247 y L484-492, y registrar D87.
