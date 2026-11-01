# Ronda 32 — micro-ronda de código — Developer

Informe consolidado por el Orquestador (el Developer no pudo escribir el archivo). Sin commit.

## Cambios
- `components/admin/ui/WeeklyOccupancyCard.tsx` L100: `grid-cols-5` → `grid-cols-7` (D57). Prueba nueva `tests/components/admin/ui/weekly-occupancy-card.test.tsx` (7 columnas, etiquetas LUN…DOM).
- Docs: `docs/ui/admin/components.md` (WeeklyOccupancyCard) y `docs/specification.md` L837 (tarjeta «Ocupación semanal»).
- Comentarios D59/D61 → D66 en `lib/admin/months/detail-service.ts` ~L189 y `lib/admin/dashboard/service.ts` ~L473. Confirmado en código: los contadores admin no cuentan PENDING; sin cambio de lógica.

## Verificación
- Orquestador: diff de código = solo esas líneas; vitest de las tarjetas, detail-service y dashboard service: 22/22.
- Developer: 5 archivos / 27 tests en verde; `tsc` 32 errores solo en `tests/` (línea base); eslint OK.
- NO verificado: layout a 375 px y escritorio (análisis estático: ~35 px por columna a 375 px, ajustado a 320 px). Validación visual pendiente del owner.

## Hallazgos fuera de alcance
1. `tests/lib/admin/months.detail-service.test.ts` L426-443 («counts a PENDING appointment as occupied but not as confirmed (D59)») contradice D66: mockea una fila PENDING que el query real (`lib/db/admin-months.ts` L271) nunca devuelve. Pasa solo por el mock. Reescribir o eliminar.
2. Filtro `status !== "PENDING"` en `detail-service.ts` es un no-op con el query actual.
3. La agenda del día (`lib/db/admin-appointments.ts` L67) también excluye PENDING; business-rules L769 solo habla de «contadores».
