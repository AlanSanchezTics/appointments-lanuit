# Ronda 06-D (T075-D): informe del Developer

**Alcance**: solo documentación. Contradicciones C1 a C4 del informe `round-06-docs-c-developer.md`, con la decisión D86 del owner (el código es la verdad; se alinea la spec al código). Opcional C7 (solo verificación). Sin código, sin pruebas, sin cambios en `tasks.md`, `STATE.md`, `00-decisions.md`, `business-rules.md`, `api.md`, `docs/features/*` ni `data-model.md`.

**Estado**: completada. Ninguna afirmación de esta ronda se apoya en ejecución de pruebas. Verificación estática: lectura de código y `grep`. La única ejecución es `python3 scripts/check-workflow-profile.py`.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `docs/specification.md` | Cuatro pasajes (lista abajo). Resto del archivo sin cambios de esta ronda. |
| `specs/003-flexible-month-availability/agent-reports/round-06-docs-d-developer.md` | Este informe. |

`git diff --stat docs/specification.md` muestra también cambios de las rondas A, B y C, que siguen sin commit. Los de esta ronda son solo los cuatro pasajes siguientes.

## Pasajes cambiados en `docs/specification.md`

1. **Sección 4.1, línea 78 (C3, flujo público).** Antes: "si todos los horarios... están ocupados, bloqueados o transcurridos... se pinta cerrado (D34)". Ahora: si ningún horario es ofrecible (ocupado, bloqueado, transcurrido, o excluido por separación mínima o capacidad), el día se muestra deshabilitado y no se puede seleccionar (sección 7.1). El flujo público no distingue lleno de cerrado. Los tonos `closed`, `full` y gris son del calendario admin (15.7). Se quitó la cita a D34 de esta frase, porque D34 solo trata horarios transcurridos (ver dudas).
2. **Sección 7, paso 5, línea 185 (C4, nota de pendiente).** Nota "Pendiente de decisión de producto": el umbral de 15 días considera solo `CONFIRMED` y `SYNC_FAILED`; una `PENDING` no dispara la sugerencia aunque sí ocupa horario en el resolvedor. Mientras no se decida, rige ese comportamiento. No se cambió la regla ni el código.
3. **Sección 15.7, líneas 1114 a 1116 (C3, admin).** Gris (`closed`) solo cuando, sin contar citas, no queda ningún horario de la rejilla tras quitar bloqueos y horas pasadas (incluye sin regla o excepción, todo bloqueado, todo pasado, y días anteriores a hoy, D56). `full` (`availableSpaces = 0`) si no es gris, por ejemplo por citas activas o por capacidad o separación. Un día con bloqueos parciales y el resto ocupado es `full`, no gris.
4. **Sección 15.7, líneas 1173 a 1174 (C2).** La elegibilidad de horario bloqueable es "horario que el resolvedor de la sección 4.3 ofrece ese día en ese momento", con la lista explícita de exclusiones (pasado, ocupado incluido `PENDING`, lock, bloqueo manual, separación mínima y capacidad). Un día con horarios en la regla pero sin horario ofrecible responde `SLOT_NOT_AVAILABLE`. Sin horarios en la regla responde `DATE_NOT_OPERATIONAL` (sin cambio).
5. **Sección 15.7, líneas 1176 a 1180 (C1).** Reglas de la acción `Día completo`: `SLOT_LOCKED` si un lock vigente cae en la rejilla de la regla; `DAY_ALREADY_BLOCKED` si el día ya tiene día completo; `SLOT_NOT_AVAILABLE` si, con citas activas, locks y bloqueos puntuales existentes, no queda horario ofrecible. Si se acepta, elimina los bloqueos puntuales del día (y sus eventos espejo; fallos como `syncWarnings`) y crea el marcador único.

No se añadieron etiquetas de ronda (C1 a C4) a la spec: son códigos de este workflow, no de producto.

## Estado de cada contradicción

- **C1 (bloqueo de día completo): documentado en la spec.** Verificado en `lib/admin/blocked-spaces/service.ts`, `createAdminBlockedSlots`: orden de comprobaciones rama de día completo: `SLOT_LOCKED` (L256), `DAY_ALREADY_BLOCKED` (L260), `SLOT_NOT_AVAILABLE` (L273, resolvedor vacío con `blockedSlotsSet` de bloqueos existentes), y `deleteBlockedSlotsByDate` (L281) antes de crear el marcador. La rama de horarios puntuales usa `SLOT_LOCKED` (L298), `SLOT_NOT_AVAILABLE` (L302 y L315). Mapeo HTTP en `app/api/admin/months/[month]/blocked-slots/route.ts`: 409 para los tres, ya documentado en `api.md` L423. `business-rules.md` ya lo recogía (L664 a L667), sin cambio.
- **C2 (horas bloqueables vs separación y capacidad): documentado en la spec.** Verificado: `getAdminBlockableSlots` → `buildBlockableDays` → `resolveMonthDays` → `resolveDay` → `computeDayAvailability` (`lib/availability/capacity-engine.ts` L43 a L70). `createAdminBlockedSlots` usa el mismo `resolveDay`. `business-rules.md` L659 ya lo decía, sin cambio.
- **C3 (día lleno vs gris): documentado en la spec, en dos planos.** Admin: `lib/admin/months/detail-service.ts`: `closed` = día pasado o `hasNoResolvedTimes` (usa solo bloqueos, `fullDayBlocked` y hora actual; no ocupación); si no es `closed`, `resolveTone(0)` = `full`. Público: `components/booking/booking-wizard-step-schedule.tsx` L218 a L236: `isAvailable = slots.length > 0`, botón `disabled` sin distinción de causa. Spec 7.1 L283 ya decía "días sin disponibilidad deben mostrarse deshabilitados".
- **C4 (sugerencia de 15 días): nota de pendiente en la spec 7, paso 5, sin cambio de comportamiento.** Verificado: `lib/appointments/lock-reservation-slot.ts` L78 a L96: `status: { in: ["CONFIRMED", "SYNC_FAILED"] }`.
- **C7 (reprogramación pública exige mes ACTIVE): respondido, sin cambio.** `lib/my-appointments/service.ts` L351: `await getBookableMonthConfig(input.month)`. `lib/active-months/service.ts` L44 a L62: rechaza mes pasado y mes distinto de `ACTIVE` con `MONTH_NOT_ALLOWED`. Pero el `catch` de L394 a L399 convierte cualquier error en `SLOT_NOT_AVAILABLE` (es el F4 ya conocido). `business-rules.md` L286 dice "bookable" (coincide con el código). La spec 8.2 no lo menciona.

## Evidencia de verificación

- Lectura de: `lib/admin/blocked-spaces/service.ts` (L130 a L397), `lib/admin/blocked-spaces/day-block.ts`, `lib/availability/resolver.ts` (L28 a L58), `lib/availability/capacity-engine.ts` (L43 a L70), `lib/admin/months/detail-service.ts` (L40 a L110, L160 a L195), `lib/appointments/lock-reservation-slot.ts` (L60 a L100), `lib/my-appointments/service.ts` (L329 a L404), `lib/active-months/service.ts` (L44 a L66), `components/booking/booking-wizard-step-schedule.tsx` (L214 a L240), `app/api/admin/months/[month]/blocked-slots/route.ts` (L1 a L30).
- Grep: códigos `SLOT_LOCKED`, `DAY_ALREADY_BLOCKED`, `SLOT_NOT_AVAILABLE`, `DATE_NOT_OPERATIONAL` en `app`, `lib` y `docs/architecture`.
- Decisión D34 (`specs/003-flexible-month-availability/agent-reports/00-decisions.md`, línea 63), buscada por `grep`: "Un día cuyos horarios ya pasaron todos se pinta gris como cerrado." No se leyó el log completo.
- `python3 scripts/check-workflow-profile.py`: exit 0. Salida: `WARNING: installed Spec Kit 0.11.9 differs from tested 1.0.5` (aviso de entorno, no bloqueante) y `OK: 9 keys, all defined, used, and resolvable`.
- No se ejecutaron pruebas, build, lint ni consultas a la BD. Ninguna afirmación de "verificado" depende de ejecución.

## Dudas y decisiones para el Orchestrator (no decididas aquí)

1. **Día completo y bloqueos puntuales (C1, borde).** La comprobación `SLOT_NOT_AVAILABLE` cuenta los bloqueos puntuales existentes como no ofrecibles (`blockedSlotsSet` en el resolvedor). Si el único horario libre del día ya está bloqueado puntualmente, el día completo se rechaza, aunque al aceptarse esos bloqueos se borrarían. La spec documenta el código tal cual. Decidir si es intencional o si debe cambiar.
2. **D34 y el gris por bloqueo.** El texto literal de D34 solo cubre días con horarios ya transcurridos. El gris por "todos los horarios bloqueados" viene de D13 y de la 15.7, no de D34 literal. No hay contradicción entre D34 y el tono `full` por ocupación. Si el owner quiere que D34 cubra también bloqueos, debe quedar registrado en el log de decisiones; no lo modifiqué.
3. **C4 en `business-rules.md`.** Las líneas 134 a 135, 799 y 813 dicen "citas activas futuras" para el umbral de 15 días. Coinciden con la redacción de la spec, no con el código. No añadí nota allí porque el brief pedía solo la spec; el owner decide si la nota se replica.
4. **C7 en la spec 8.2.** La spec 8.2 no dice que el mes destino debe estar `ACTIVE`, mientras que el código sí lo exige y oculta el motivo tras `SLOT_NOT_AVAILABLE` (F4). Propongo añadirlo a 8.2 en una ronda posterior, si el owner confirma el comportamiento. No lo cambié (C7 era solo verificación).
5. **`docs/features/admin-month-detail-flow.md` está desalineado y no se tocó.** Es anterior a la spec 003: L68 a L91 describe propagación direccional de `BLOCK_MODE` (retirada); L133 dice "día completo = 3 espacios" (la spec cuenta una unidad por horario de la rejilla); L140 a L146 usa `días hábiles × 3` y "weekend" como tono (la 15.7 dice que no hay tono de fin de semana); L151 pinta en gris `full` con slots bloqueados (la 15.7 dice `full`). Es trabajo de Fase 2 (T076) o de un parche aparte. Requiere decisión del owner, no solo redacción.
6. **`docs/architecture/api.md` y `business-rules.md` no se modificaron en esta ronda.** Ambos coinciden con la spec para C1, C2 y C3.

## Trazabilidad (AGENTS.md)

Documentation Impact:
- Impacto en flujo: Sí (reglas de bloqueo de día completo y de horas bloqueables; tonos del calendario admin; ámbito del día no disponible en el flujo público; nota de pendiente en la sugerencia de 15 días). Sin cambio de comportamiento de código.
- `docs/specification.md`: actualizado. Secciones: 4.1 (días válidos, línea 78), 7 (paso 5, línea 185), 15.7 (semántica de color, líneas 1114 a 1116; restricciones del modal de bloqueo, líneas 1173 a 1174; reglas de la acción día completo, líneas 1176 a 1180).
- `docs/architecture/business-rules.md`: sin cambios; coincide con el código para C1 a C3 (ver dudas 3 y 5 para C4 y features).
- `docs/architecture/api.md`, `docs/features/*`, `data-model.md`, `docs/decisions/*`, `docs/ui/**`: sin cambios.

Flow Contract Check:
- UI steps updated: No (no hay cambio de pasos de UI; la 15.7 describe el estado de la UI de la Fase 2 y no se reconcilió aquí).
- API contract updated: No (los códigos ya estaban en `api.md`; no cambió ningún contrato).
- Validation rules updated: Yes (reglas de elegibilidad de horario bloqueable y del día completo, en la spec).
- Acceptance criteria updated: No (esta ronda no toca criterios de aceptación).
- docs/specification.md aligned: Parcial. Las secciones tocadas coinciden con el código verificado. El conjunto no está alineado por `docs/features/admin-month-detail-flow.md` (duda 5, previa a esta ronda) y por la pregunta C4 abierta.

Migration Compatibility Check:
- Schema changes required: No.
- Data backfill required: No.
- Legacy compatibility required: No cambio en esta ronda (sin cambio de `slot_mode` ni de presets).
- Rollback strategy defined: No aplica a esta ronda (solo docs).
- Cleanup phase defined: No aplica a esta ronda.
- Integrity protections defined: No aplica a esta ronda (solo documentación de protecciones ya existentes).

Admin UI Check: no aplica (no hay cambios de UI).
Notification Contract Check: no aplica.

## Turnos

Unas 30 llamadas de herramienta, dentro del presupuesto. No se usó compactación. Ronda cerrada.
