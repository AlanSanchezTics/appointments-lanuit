# Ronda 33 — contratos API en api.md — Developer

Informe consolidado por el Orquestador (el Developer no pudo escribir el archivo). Solo documentación; sin commit.

## Cambios
`docs/architecture/api.md`: secciones nuevas «Administración de meses, citas y clientes» (11 contratos: months/catalog, months/[month]/status, blocked-slots/[id] PATCH, appointments/[id]/{confirm,reject,cancel}, clients/{[clientId],catalog,next-number,search}) y «Endpoints públicos auxiliares» (`reservar/lock/release-beacon`, `/api/cancelar*` 410). Derivados del código, no ejecutados. Orquestador: cada ruta aparece como encabezado una vez; 9 marcas «Pendiente de aclarar».

## Discrepancias código ↔ docs detectadas (decisión de producto del owner; el código no se tocó)
1. Detalle de cliente: business-rules dice línea de tiempo sin PENDING/REJECTED y métricas solo CONFIRMED; el código devuelve todos los estados.
2. Catálogo de clientes: orden `APPOINTMENTS_DESC` cuenta todos los estados, `totalAppointments` muestra solo CONFIRMED; el mismo nombre tiene semántica distinta en catálogo y detalle.
3. Validación: `ZodError` siempre responde `VALIDATION_ERROR`; los códigos `CLIENT_CATALOG_PAGE_*` y `CLIENT_SEARCH_LIMIT_INVALID` solo salen con valores no numéricos.
4. Búsqueda de clientes: `total` = elementos devueltos; relevancia solo sobre los `limit×3` más recientes.
5. `PATCH blocked-slots` responde 409 `BLOCKED_SLOT_NOT_EDITABLE` para bloqueos de día completo (`00:00`) aun siendo futuros; reglas no lo mencionan.
6. `PATCH blocked-slots` crea evento de Calendar si no tenía `googleEventId`.
7. `POST confirm`: no valida fecha futura ni mes activo; si Calendar falla, 200 con `SYNC_FAILED` sin evento de bitácora para ese paso; si falla la escritura a SYNC_FAILED, 400 `UNKNOWN_ERROR` con la confirmación ya guardada.
8. `findActiveAppointmentByIdInMonthForUpdate` y `findBlockedSlotByIdForUpdate` no usan `FOR UPDATE` (nombre engañoso).
9. `PATCH status` a INACTIVE no comprueba citas del mes ni usa transacción.
10. `release-beacon` libera por token sin comprobar teléfono/fecha/expiración.
11. Código muerto: `lib/cancel/api-client.ts`, `hooks/cancel/use-cancel-flow.ts` y `components/cancel/cancel-form.tsx` llaman a rutas 410 y ninguna página los monta.

## Fuera de alcance
Sin ficha en api.md: `DELETE .../blocked-slots/[id]` y `PATCH /api/admin/clients/[clientId]`.
